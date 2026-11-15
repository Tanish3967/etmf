/**
 * Background Automation Daemons (§8.5.2.11 & §8.5.2.12)
 *
 * 1. Inactive Document Retention & Purge Daemon:
 *    - Hierarchical retention policy (options -> organization_profiles -> tenants.settings -> default 30 days)
 *    - Strict ICH GCP / 21 CFR Part 11 Retention Lock (never purge audit_plan_documents)
 *    - Cascading child record deletion and physical file unlinking
 *    - Immutable audit_log preservation with snapshot destruction audit logging
 *
 * 2. SLA Reminder Daemon:
 *    - Evaluates workflow task age against SLA_LIMITS
 *    - Generates Reminder 1 (approaching, <= 2 days remaining) and Reminder 2 (breached/overdue)
 *    - Contextual role-based recipient targeting with fallback
 *    - Daily idempotency & anti-spam controls
 *    - Dual-channel in-app notifications and 21 CFR Part 11 audit trails
 *
 * 3. Daemon Lifecycle:
 *    - Configurable unref'd intervals with top-level error handling
 *    - State tracking for administrative inspection and scheduled job reports
 */

import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { getDB, appendAudit } from '../database.js';

// Standard SLA limits matching workflow definition
export const SLA_LIMITS = {
  'Draft': 7,
  'Pending Review': 5,
  'Under Review': 5,
  'Review Complete': 2,
  'Pending Approval': 3,
  'Pending Signoff': 3,
  'Pending Publish': 2,
  'More Info Requested': 5,
};

// Scheduler daemon internal state
const daemonState = {
  active: false,
  startedAt: null,
  purgeJob: {
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    lastRun: null,
    lastResult: null,
  },
  slaJob: {
    intervalMs: 6 * 60 * 60 * 1000,  // 6 hours
    lastRun: null,
    lastResult: null,
  },
};

let purgeTimer = null;
let slaTimer = null;

/**
 * Resolves effective retention days for inactive documents
 * Hierarchy: options.retentionDays -> organization_profiles.REMOVE_ALL_INACTIVE_DOCUMENTS -> tenants.settings -> default 30 days
 */
export function resolveRetentionDays(tenantId, options = {}) {
  if (options.retentionDays !== undefined && options.retentionDays !== null) {
    const val = Number(options.retentionDays);
    if (!isNaN(val) && val >= 0) return val;
  }

  const db = getDB();
  const effectiveTenant = tenantId || 'tenant-001';

  try {
    const profile = db.prepare(
      'SELECT value_str FROM organization_profiles WHERE tenant_id = ? AND name = ?'
    ).get(effectiveTenant, 'REMOVE_ALL_INACTIVE_DOCUMENTS');

    if (profile && profile.value_str) {
      const parsed = parseInt(profile.value_str, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch (err) {
    // Non-fatal, proceed to next fallback
  }

  try {
    const tenant = db.prepare('SELECT settings FROM tenants WHERE id = ?').get(effectiveTenant);
    if (tenant && tenant.settings) {
      const parsedSettings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : tenant.settings;
      const sVal = parsedSettings.retentionDays ?? parsedSettings.REMOVE_ALL_INACTIVE_DOCUMENTS ?? parsedSettings.purge_retention_days;
      if (sVal !== undefined && !isNaN(Number(sVal)) && Number(sVal) >= 0) {
        return Number(sVal);
      }
    }
  } catch (err) {
    // Non-fatal, proceed to default
  }

  return 30; // Clinevo default threshold
}

/**
 * Inactive Document Retention & Purge Daemon
 * Evaluates inactive documents against retention policy and purges eligible documents
 */
export async function runInactiveDocumentPurge(tenantId = null, options = {}) {
  const db = getDB();
  const effectiveDays = resolveRetentionDays(tenantId, options);
  const dryRun = Boolean(options.dryRun);
  const forceAll = Boolean(options.forceAllInactive || effectiveDays === 0);

  // 1. Query candidate inactive documents with retention age
  let query = `
    SELECT d.*,
           (julianday('now') - julianday(COALESCE(d.deleted_at, d.updated_at, d.created_at, datetime('now')))) as inactive_days
    FROM documents d
    WHERE (d.tenant_id = :tenantId OR :tenantId IS NULL)
      AND (d.active = 0 OR d.status IN ('Inactive', 'Removed'))
  `;

  if (!forceAll) {
    query += ` AND (julianday('now') - julianday(COALESCE(d.deleted_at, d.updated_at, d.created_at, datetime('now')))) >= :retentionDays`;
  }

  query += ` ORDER BY d.created_at ASC`;

  const candidates = db.prepare(query).all({
    tenantId: tenantId || null,
    retentionDays: effectiveDays,
  });

  // 2. Fetch all audited document IDs (Mandatory ICH GCP E6(R2) / 21 CFR Part 11 Deletion Lock)
  const auditedDocRows = db.prepare(`
    SELECT DISTINCT document_id
    FROM audit_plan_documents
    WHERE document_id IS NOT NULL
      AND (tenant_id = ? OR ? IS NULL)
  `).all(tenantId, tenantId);

  const auditedDocSet = new Set(auditedDocRows.map(r => r.document_id));

  const eligibleDocumentIds = [];
  const purgedDocumentIds = [];
  const auditLockedDocumentIds = [];

  for (const doc of candidates) {
    eligibleDocumentIds.push(doc.id);

    // GCP / Part 11 Regulatory Preservation Lock
    if (auditedDocSet.has(doc.id)) {
      auditLockedDocumentIds.push(doc.id);
      continue;
    }

    if (!dryRun) {
      // Step A: Safely unlink physical file from disk
      if (doc.file_path) {
        try {
          if (fs.existsSync(doc.file_path)) {
            fs.unlinkSync(doc.file_path);
          }
        } catch (unlinkErr) {
          console.warn(`⚠️ [Purge Daemon] Unable to unlink file ${doc.file_path}:`, unlinkErr.message);
        }
      }

      // Also clean up any version files if present
      try {
        const versions = db.prepare('SELECT file_path FROM document_versions WHERE document_id = ?').all(doc.id);
        for (const v of versions) {
          if (v.file_path && fs.existsSync(v.file_path)) {
            try { fs.unlinkSync(v.file_path); } catch (e) {}
          }
        }
      } catch (e) {}

      // Step B: Atomically cascade deletion of child records and document row
      const deleteTransaction = db.transaction(() => {
        const safeDelete = (table, col, val) => {
          try { db.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).run(val); } catch (e) {}
        };

        // Child tables in foreign-key dependency order
        safeDelete('annotations', 'document_id', doc.id);
        safeDelete('document_versions', 'document_id', doc.id);
        safeDelete('queries', 'document_id', doc.id);
        safeDelete('electronic_signatures', 'document_id', doc.id);
        safeDelete('workflow_history', 'document_id', doc.id);
        try { db.prepare('DELETE FROM document_links WHERE source_id = ? OR target_id = ?').run(doc.id, doc.id); } catch (e) {}
        safeDelete('document_notes', 'document_id', doc.id);
        safeDelete('document_access_log', 'document_id', doc.id);
        safeDelete('document_move_log', 'document_id', doc.id);
        try { db.prepare('DELETE FROM document_copy_log WHERE source_doc_id = ? OR target_doc_id = ?').run(doc.id, doc.id); } catch (e) {}
        safeDelete('ai_audit', 'document_id', doc.id);

        // Delete parent document row
        db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
      });

      deleteTransaction();

      // Step C: 21 CFR Part 11 ALCOA+ Audit Trail (NEVER delete audit_log, append snapshot record)
      appendAudit({
        tenantId: doc.tenant_id,
        studyId: doc.study_id,
        documentId: doc.id,
        userId: options.userId || 'system-daemon',
        userName: options.userName || 'Inactive Document Purge Daemon',
        userRole: options.userRole || 'System Daemon',
        action: 'Permanently Removed',
        objectType: 'document',
        objectId: doc.id,
        objectName: doc.title || doc.display_name,
        oldValue: `Status: ${doc.status}, Active: ${doc.active}, InactiveDays: ${Math.round(doc.inactive_days || 0)}`,
        newValue: 'PURGED',
        detail: `Document permanently purged per retention policy REMOVE_ALL_INACTIVE_DOCUMENTS (${effectiveDays} days retention exceeded). Disk file and child records removed.`,
      });
    }

    purgedDocumentIds.push(doc.id);
  }

  const result = {
    success: true,
    tenant_id: tenantId || 'all',
    retention_days: effectiveDays,
    eligible_count: candidates.length,
    purged_count: purgedDocumentIds.length,
    purged_document_ids: purgedDocumentIds,
    document_ids: purgedDocumentIds, // Convenient alias for tests
    audit_locked_count: auditLockedDocumentIds.length,
    audit_locked_document_ids: auditLockedDocumentIds,
    dry_run: dryRun,
    timestamp: new Date().toISOString(),
  };

  daemonState.purgeJob.lastRun = result.timestamp;
  daemonState.purgeJob.lastResult = result;

  return result;
}

/**
 * Determines target recipient user ID for document workflow tasks
 */
export function getAssigneeForStatus(doc) {
  const status = doc.status;
  if (['Pending Review', 'Under Review', 'Review Complete'].includes(status)) {
    if (doc.reviewer_id) return doc.reviewer_id;
  } else if (status === 'Pending Approval') {
    if (doc.approver_id) return doc.approver_id;
  } else if (status === 'Pending Signoff') {
    if (doc.signoff_id) return doc.signoff_id;
    if (doc.approver_id) return doc.approver_id;
  } else if (status === 'Pending Publish') {
    if (doc.publisher_id) return doc.publisher_id;
    if (doc.approver_id) return doc.approver_id;
  } else if (['Draft', 'More Info Requested'].includes(status)) {
    if (doc.author_id) return doc.author_id;
    if (doc.created_by) return doc.created_by;
  }

  // Graceful fallback to any assigned user, or default lead study manager / administrator
  return doc.reviewer_id || doc.approver_id || doc.author_id || doc.created_by || 'usr-001';
}

/**
 * SLA Reminder Notification Daemon (§8.5.2.12)
 * Evaluates active workflow tasks against SLA thresholds, sends Reminder 1 / Reminder 2
 */
export async function runSlaReminderCheck(tenantId = null, options = {}) {
  const db = getDB();
  const dryRun = Boolean(options.dryRun);
  const forceAll = Boolean(options.forceAll);

  // 1. Scan active documents in workflow states
  const candidateDocs = db.prepare(`
    SELECT d.*,
           (
             SELECT wh.created_at
             FROM workflow_history wh
             WHERE wh.document_id = d.id
             ORDER BY wh.created_at DESC LIMIT 1
           ) as last_transition_at,
           (
             julianday('now') - julianday(COALESCE(
               (SELECT wh.created_at FROM workflow_history wh WHERE wh.document_id = d.id ORDER BY wh.created_at DESC LIMIT 1),
               d.created_at,
               datetime('now')
             ))
           ) as age_in_days
    FROM documents d
    WHERE (d.tenant_id = :tenantId OR :tenantId IS NULL)
      AND d.active = 1
      AND d.status IN (
        'Pending Review',
        'Under Review',
        'Review Complete',
        'Pending Approval',
        'Pending Signoff',
        'Pending Publish',
        'Draft',
        'More Info Requested'
      )
    ORDER BY d.created_at ASC
  `).all({ tenantId: tenantId || null });

  let checkedTasks = 0;
  let remindersSent = 0;
  let remindersSkippedIdempotent = 0;
  const reminderDetails = [];

  for (const doc of candidateDocs) {
    checkedTasks++;
    const slaLimit = SLA_LIMITS[doc.status] || 5;
    // Compute integer age safely from SQL age_in_days
    const ageDays = Math.max(0, Math.floor(Number(doc.age_in_days || 0) + 0.001));

    let reminderLevel = null;
    if (ageDays >= slaLimit) {
      reminderLevel = 2; // Overdue / breached SLA limit
    } else if (ageDays >= Math.max(1, slaLimit - 2)) {
      reminderLevel = 1; // Approaching SLA deadline
    }

    // On-track tasks (age < limit - 2) generate no reminders
    if (!reminderLevel) continue;

    const recipientId = getAssigneeForStatus(doc);
    const link = `/documents/${doc.id}`;
    const todayStr = new Date().toISOString().slice(0, 10);

    // Idempotency & Anti-Spam Check:
    // Check if this reminder level was already marked on document or sent today
    if (!forceAll) {
      const alreadySentOnDoc = reminderLevel === 2
        ? Boolean(doc.sla_reminder_2_sent_at)
        : Boolean(doc.sla_reminder_1_sent_at);

      let alreadySentToday = false;
      if (!alreadySentOnDoc) {
        const existingNotif = db.prepare(`
          SELECT id FROM notifications
          WHERE tenant_id = ?
            AND user_id = ?
            AND link = ?
            AND type = ?
            AND date(created_at) = date('now')
        `).get(doc.tenant_id, recipientId, link, `sla_reminder_${reminderLevel}`);
        alreadySentToday = Boolean(existingNotif);
      }

      if (alreadySentOnDoc || alreadySentToday) {
        remindersSkippedIdempotent++;
        continue;
      }
    }

    // Dispatch notification
    const reminderTitlePrefix = reminderLevel === 2 ? '[URGENT SLA BREACH]' : '[SLA REMINDER]';
    const reminderTierLabel = reminderLevel === 2 ? 'Reminder 2 (Overdue SLA)' : 'Reminder 1 (Approaching SLA)';
    const notifTitle = `${reminderTitlePrefix} ${reminderTierLabel}: ${doc.title || doc.artifact_code} (${doc.status})`;
    const notifBody = reminderLevel === 2
      ? `Task "${doc.title || doc.artifact_code}" in "${doc.status}" is OVERDUE (age: ${ageDays} days, SLA limit: ${slaLimit} days). Immediate action required.`
      : `Task "${doc.title || doc.artifact_code}" in "${doc.status}" is approaching SLA deadline (age: ${ageDays} days, SLA limit: ${slaLimit} days).`;
    const priority = reminderLevel === 2 ? 'high' : 'medium';
    const metadataObj = {
      document_id: doc.id,
      reminder_level: reminderLevel,
      age_days: ageDays,
      sla_limit: slaLimit,
      status: doc.status,
    };

    if (!dryRun) {
      const notifId = uuid();
      db.prepare(`
        INSERT INTO notifications (id, tenant_id, user_id, type, title, body, priority, read, link, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))
      `).run(
        notifId,
        doc.tenant_id,
        recipientId,
        `sla_reminder_${reminderLevel}`,
        notifTitle,
        notifBody,
        priority,
        link,
        JSON.stringify(metadataObj)
      );

      // Update document timestamp
      if (reminderLevel === 2) {
        db.prepare("UPDATE documents SET sla_reminder_2_sent_at = datetime('now') WHERE id = ?").run(doc.id);
      } else {
        db.prepare("UPDATE documents SET sla_reminder_1_sent_at = datetime('now') WHERE id = ?").run(doc.id);
      }

      // Record 21 CFR Part 11 Audit Trail
      appendAudit({
        tenantId: doc.tenant_id,
        studyId: doc.study_id,
        documentId: doc.id,
        userId: options.userId || 'system-daemon',
        userName: options.userName || 'SLA Reminder Daemon',
        userRole: 'System Daemon',
        action: reminderLevel === 2 ? 'SLA Reminder 2 Sent' : 'SLA Reminder 1 Sent',
        objectType: 'document',
        objectId: doc.id,
        objectName: doc.title,
        detail: `Automated SLA reminder ${reminderLevel} dispatched to user ${recipientId}. Task age: ${ageDays} days, SLA: ${slaLimit} days.`,
      });
    }

    remindersSent++;
    reminderDetails.push({
      document_id: doc.id,
      title: doc.title,
      status: doc.status,
      recipient_id: recipientId,
      reminder_level: reminderLevel,
      age_days: ageDays,
      sla_limit: slaLimit,
      priority,
    });
  }

  const result = {
    success: true,
    tenant_id: tenantId || 'all',
    checked_tasks: checkedTasks,
    reminders_sent: remindersSent,
    reminders_skipped_idempotent: remindersSkippedIdempotent,
    reminder_details: reminderDetails,
    dry_run: dryRun,
    timestamp: new Date().toISOString(),
  };

  daemonState.slaJob.lastRun = result.timestamp;
  daemonState.slaJob.lastResult = result;

  return result;
}

/**
 * Starts background scheduler interval daemons
 */
export function startScheduler(options = {}) {
  if (daemonState.active) return;
  daemonState.active = true;
  daemonState.startedAt = new Date().toISOString();

  if (options.purgeIntervalMs) daemonState.purgeJob.intervalMs = options.purgeIntervalMs;
  if (options.slaIntervalMs) daemonState.slaJob.intervalMs = options.slaIntervalMs;

  // Inactive Document Purge Interval
  purgeTimer = setInterval(async () => {
    try {
      await runInactiveDocumentPurge(null);
    } catch (err) {
      console.error('⚠️ [Scheduler] Inactive Document Purge daemon error:', err);
    }
  }, daemonState.purgeJob.intervalMs);
  purgeTimer.unref();

  // SLA Reminder Interval
  slaTimer = setInterval(async () => {
    try {
      await runSlaReminderCheck(null);
    } catch (err) {
      console.error('⚠️ [Scheduler] SLA Reminder daemon error:', err);
    }
  }, daemonState.slaJob.intervalMs);
  slaTimer.unref();

  console.log('✅ Background Automation Daemons started (Inactive Doc Purge & SLA Reminders)');
}

/**
 * Stops background scheduler interval daemons
 */
export function stopScheduler() {
  if (purgeTimer) {
    clearInterval(purgeTimer);
    purgeTimer = null;
  }
  if (slaTimer) {
    clearInterval(slaTimer);
    slaTimer = null;
  }
  daemonState.active = false;
}

/**
 * Returns real-time scheduler metrics and execution history
 */
export function getSchedulerStatus() {
  return {
    active: daemonState.active,
    startedAt: daemonState.startedAt,
    uptime: process.uptime(),
    purgeJob: {
      intervalMs: daemonState.purgeJob.intervalMs,
      lastRun: daemonState.purgeJob.lastRun,
      lastResult: daemonState.purgeJob.lastResult,
    },
    slaJob: {
      intervalMs: daemonState.slaJob.intervalMs,
      lastRun: daemonState.slaJob.lastRun,
      lastResult: daemonState.slaJob.lastResult,
    },
  };
}
