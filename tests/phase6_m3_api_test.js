/**
 * Phase 6 Milestone M3 Automated Test Suite:
 * Background Automation Daemons (Inactive Document Purge & SLA Reminders)
 *
 * Suite 1: Admin Trigger REST API Endpoints Security & RBAC (6 Tests)
 * Suite 2: Inactive Document Retention Purge Daemon (§8.5.2.11) (6 Tests)
 * Suite 3: SLA Reminder Notification Daemon (§8.5.2.12) (6 Tests)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { getDB, initDB } from '../src/database.js';

const BASE = process.env.TEST_URL || 'http://localhost:3002';

async function req(method, pathUrl, body, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${pathUrl}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, body: data };
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${name}: ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Phase 6 Milestone M3: Background Automation Daemons');
  console.log('======================================================\n');

  await initDB();
  const db = getDB();

  // Helper to insert test documents safely with all required columns
  function insertTestDoc({
    id,
    tenant_id = 'tenant-001',
    study_id = 'study-001',
    artifact_code = '01.01.01',
    artifact_name = 'Trial Master File Plan',
    zone = '01',
    section = '01.01',
    title = 'Test Document',
    version = '1.0',
    status = 'Draft',
    active = 1,
    file_path = null,
    reviewer_id = null,
    approver_id = null,
    created_by = 'usr-001',
    created_days_ago = null,
    deleted_days_ago = null,
  }) {
    const createdAtSql = created_days_ago !== null ? `datetime('now', '-${created_days_ago} days')` : `datetime('now')`;
    const deletedAtSql = deleted_days_ago !== null ? `datetime('now', '-${deleted_days_ago} days')` : 'NULL';

    db.prepare(`
      INSERT INTO documents (
        id, tenant_id, study_id, artifact_code, artifact_name, zone, section,
        title, display_name, version, status, active, file_path, reviewer_id, approver_id,
        created_by, created_at, deleted_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ${createdAtSql}, ${deletedAtSql}
      )
    `).run(
      id, tenant_id, study_id, artifact_code, artifact_name, zone, section,
      title, title, version, status, active, file_path, reviewer_id, approver_id,
      created_by
    );
  }

  // Clean up any residual test data before running
  const cleanupTestFixtures = () => {
    try {
      db.prepare("DELETE FROM notifications WHERE link LIKE '%doc-m3-%'").run();
      db.prepare("DELETE FROM audit_plan_documents WHERE audit_plan_id = 'plan-m3-test'").run();
      db.prepare("DELETE FROM audit_plans WHERE id = 'plan-m3-test'").run();
      db.prepare("DELETE FROM documents WHERE id LIKE 'doc-m3-%'").run();
      db.prepare("DELETE FROM tenants WHERE id = 'tenant-m3-002'").run();
    } catch (e) {}
  };

  cleanupTestFixtures();

  // 1. Authenticate users
  const adminLogin = await req('POST', '/api/auth/login', {
    email: 'e.vasquez@pharma.com',
    password: 'Admin1234!',
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.body.token;

  const nonAdminLogin = await req('POST', '/api/auth/login', {
    email: 'j.obrien@pharma.com',
    password: 'Admin1234!',
  });
  assert.strictEqual(nonAdminLogin.status, 200, 'Non-admin login failed');
  const nonAdminToken = nonAdminLogin.body.token;

  // Setup test dummy file path
  const uploadsDir = path.resolve('uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const dummyFilePath = path.join(uploadsDir, 'doc-m3-past-retention-test.pdf');

  try {
    // ════════════════════════════════════════════════════════════
    // SUITE 1: Admin Trigger REST API Endpoints Security & RBAC (6 Tests)
    // ════════════════════════════════════════════════════════════
    console.log('── Suite 1: Admin Trigger REST API Endpoints Security & RBAC ──');

    await test('T01: POST /api/admin/daemons/purge-inactive rejects unauthenticated call (401)', async () => {
      const res = await req('POST', '/api/admin/daemons/purge-inactive', {});
      assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    });

    await test('T02: POST /api/admin/daemons/purge-inactive rejects non-admin role call without canAdmin (403)', async () => {
      const res = await req('POST', '/api/admin/daemons/purge-inactive', {}, nonAdminToken);
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    });

    await test('T03: POST /api/admin/daemons/sla-reminders rejects unauthenticated call (401)', async () => {
      const res = await req('POST', '/api/admin/daemons/sla-reminders', {});
      assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    });

    await test('T04: POST /api/admin/daemons/sla-reminders rejects non-admin role call without canAdmin (403)', async () => {
      const res = await req('POST', '/api/admin/daemons/sla-reminders', {}, nonAdminToken);
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    });

    await test('T05: POST /api/admin/daemons/purge-inactive accepts authorized admin and returns metadata (200)', async () => {
      const res = await req('POST', '/api/admin/daemons/purge-inactive', { dryRun: true }, adminToken);
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.purged_count === 'number', 'purged_count must be number');
      assert.ok(Array.isArray(res.body.document_ids || res.body.purged_document_ids), 'document_ids must be array');
    });

    await test('T06: POST /api/admin/daemons/sla-reminders accepts authorized admin and returns metadata (200)', async () => {
      const res = await req('POST', '/api/admin/daemons/sla-reminders', { dryRun: true }, adminToken);
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.checked_tasks === 'number', 'checked_tasks must be number');
      assert.ok(typeof res.body.reminders_sent === 'number', 'reminders_sent must be number');
    });

    // ════════════════════════════════════════════════════════════
    // SUITE 2: Inactive Document Retention Purge Daemon (§8.5.2.11) (6 Tests)
    // ════════════════════════════════════════════════════════════
    console.log('\n── Suite 2: Inactive Document Retention Purge Daemon (§8.5.2.11) ──');

    const docUnderRetention = 'doc-m3-under-retention';
    const docPastRetention = 'doc-m3-past-retention';
    const docActiveImmune = 'doc-m3-active-immune';
    const docAuditedLocked = 'doc-m3-audited-locked';
    const docConfigRetention = 'doc-m3-config-retention';

    fs.writeFileSync(dummyFilePath, '%PDF-1.4 test file content for M3 purge');

    await test('T07: Inactive document under retention window (2 days old < 30 days) is NOT purged', async () => {
      insertTestDoc({
        id: docUnderRetention,
        title: 'Under Retention Document',
        status: 'Inactive',
        active: 0,
        created_days_ago: 2,
        deleted_days_ago: 2,
      });

      const res = await req('POST', '/api/admin/daemons/purge-inactive', { retentionDays: 30 }, adminToken);
      assert.strictEqual(res.status, 200);

      const ids = res.body.purged_document_ids || res.body.document_ids || [];
      assert.ok(!ids.includes(docUnderRetention), 'Document under retention window must NOT be in purged IDs');

      const check = db.prepare('SELECT id, active FROM documents WHERE id = ?').get(docUnderRetention);
      assert.ok(check, 'Document under retention window must remain in database');
    });

    await test('T08: Inactive document past retention window (35 days old > 30 days) is PURGED with file unlinking', async () => {
      insertTestDoc({
        id: docPastRetention,
        title: 'Past Retention Document',
        status: 'Inactive',
        active: 0,
        file_path: dummyFilePath,
        created_days_ago: 35,
        deleted_days_ago: 35,
      });

      assert.ok(fs.existsSync(dummyFilePath), 'Dummy physical file must exist before purge');

      const res = await req('POST', '/api/admin/daemons/purge-inactive', { retentionDays: 30 }, adminToken);
      assert.strictEqual(res.status, 200);

      const ids = res.body.purged_document_ids || res.body.document_ids || [];
      assert.ok(ids.includes(docPastRetention), 'Document past retention window must be included in purged IDs');

      const check = db.prepare('SELECT id FROM documents WHERE id = ?').get(docPastRetention);
      assert.strictEqual(check, undefined, 'Purged document must be deleted from documents table');

      const getDocRes = await req('GET', `/api/documents/${docPastRetention}`, null, adminToken);
      assert.strictEqual(getDocRes.status, 404, 'Purged document endpoint must return 404 Not Found');

      assert.ok(!fs.existsSync(dummyFilePath), 'Physical file on disk must be unlinked');
    });

    await test('T09: Active document immunity: active document (active = 1, 60 days old) is NOT purged', async () => {
      insertTestDoc({
        id: docActiveImmune,
        title: 'Active Published Document',
        status: 'Published',
        active: 1,
        created_days_ago: 60,
      });

      const res = await req('POST', '/api/admin/daemons/purge-inactive', { retentionDays: 30 }, adminToken);
      assert.strictEqual(res.status, 200);

      const ids = res.body.purged_document_ids || res.body.document_ids || [];
      assert.ok(!ids.includes(docActiveImmune), 'Active document must never be purged');

      const check = db.prepare('SELECT id FROM documents WHERE id = ?').get(docActiveImmune);
      assert.ok(check, 'Active document must remain safely in repository');
    });

    await test('T10: GCP/Part 11 Retention Lock: Inactive document in audit_plan_documents is NEVER purged', async () => {
      insertTestDoc({
        id: docAuditedLocked,
        title: 'Audited Quality Plan Document',
        status: 'Inactive',
        active: 0,
        created_days_ago: 45,
        deleted_days_ago: 45,
      });

      // Create test audit plan and link document
      db.prepare(`
        INSERT OR IGNORE INTO audit_plans (id, tenant_id, title, study_id, lead_auditor, start_date, end_date, status, created_by)
        VALUES ('plan-m3-test', 'tenant-001', 'Milestone M3 Test Audit Plan', 'study-001', 'usr-001', '2026-11-01', '2026-12-01', 'Active', 'usr-001')
      `).run();

      db.prepare(`
        INSERT INTO audit_plan_documents (id, tenant_id, audit_plan_id, document_id, status)
        VALUES ('apd-m3-test', 'tenant-001', 'plan-m3-test', ?, 'Audited')
      `).run(docAuditedLocked);

      const res = await req('POST', '/api/admin/daemons/purge-inactive', { retentionDays: 30 }, adminToken);
      assert.strictEqual(res.status, 200);

      const ids = res.body.purged_document_ids || res.body.document_ids || [];
      assert.ok(!ids.includes(docAuditedLocked), 'Audited document must NOT be purged');
      assert.ok(res.body.audit_locked_count >= 1, 'audit_locked_count must be at least 1');
      assert.ok(res.body.audit_locked_document_ids.includes(docAuditedLocked), 'Audited document must be listed in audit_locked_document_ids');

      const check = db.prepare('SELECT id FROM documents WHERE id = ?').get(docAuditedLocked);
      assert.ok(check, 'Audited document must remain intact in database');
    });

    await test('T11: Configurable retention window support (retentionDays: 60 preserves, retentionDays: 10 purges)', async () => {
      insertTestDoc({
        id: docConfigRetention,
        title: 'Config Retention Test Document',
        status: 'Inactive',
        active: 0,
        created_days_ago: 15,
        deleted_days_ago: 15,
      });

      // Run with 60 days -> doc is only 15 days old, must NOT be purged
      const res60 = await req('POST', '/api/admin/daemons/purge-inactive', { retentionDays: 60 }, adminToken);
      assert.strictEqual(res60.status, 200);
      const ids60 = res60.body.purged_document_ids || res60.body.document_ids || [];
      assert.ok(!ids60.includes(docConfigRetention), 'Document 15 days old must NOT be purged with 60 days retention');

      // Run with 10 days -> doc is 15 days old, must be purged
      const res10 = await req('POST', '/api/admin/daemons/purge-inactive', { retentionDays: 10 }, adminToken);
      assert.strictEqual(res10.status, 200);
      const ids10 = res10.body.purged_document_ids || res10.body.document_ids || [];
      assert.ok(ids10.includes(docConfigRetention), 'Document 15 days old MUST be purged with 10 days retention');

      const check = db.prepare('SELECT id FROM documents WHERE id = ?').get(docConfigRetention);
      assert.strictEqual(check, undefined, 'Document must be deleted after 10-day retention purge');
    });

    await test('T12: 21 CFR Part 11 Audit Trail Logging: snapshot audit entry recorded for purge operations', async () => {
      const auditEntry = db.prepare(`
        SELECT * FROM audit_log
        WHERE object_type = 'document'
          AND document_id = ?
          AND action = 'Permanently Removed'
        ORDER BY created_at DESC LIMIT 1
      `).get(docPastRetention);

      assert.ok(auditEntry, 'Audit log must record Permanently Removed entry for purged document');
      assert.strictEqual(auditEntry.tenant_id, 'tenant-001');
      assert.strictEqual(auditEntry.object_id, docPastRetention);
      assert.strictEqual(auditEntry.new_value, 'PURGED');
      assert.ok(auditEntry.detail.includes('REMOVE_ALL_INACTIVE_DOCUMENTS'), 'Audit detail must reference retention policy');
      assert.ok(auditEntry.created_at, 'Timestamp must exist on audit record');
    });

    // ════════════════════════════════════════════════════════════
    // SUITE 3: SLA Reminder Notification Daemon (§8.5.2.12) (6 Tests)
    // ════════════════════════════════════════════════════════════
    console.log('\n── Suite 3: SLA Reminder Notification Daemon (§8.5.2.12) ──');

    const docSlaApproaching = 'doc-m3-sla-approaching';
    const docSlaBreached = 'doc-m3-sla-breached';
    const docSlaOnTrack = 'doc-m3-sla-ontrack';
    const docSlaPublished = 'doc-m3-sla-published';
    const docSlaInactiveDraft = 'doc-m3-sla-inactive-draft';
    const docSlaTenant2 = 'doc-m3-sla-tenant2';

    // Baseline: flush/mark existing non-test reminders so the test environment has a clean slate
    await req('POST', '/api/admin/daemons/sla-reminders', {}, adminToken);

    await test('T13: Task approaching SLA deadline generates Reminder 1 notification (priority: medium)', async () => {
      // Pending Review limit is 5 days. Age = 4 days (4 >= 5 - 2, 4 < 5)
      insertTestDoc({
        id: docSlaApproaching,
        title: 'Approaching SLA Doc',
        status: 'Pending Review',
        active: 1,
        reviewer_id: 'usr-003',
        created_days_ago: 4,
      });

      const res = await req('POST', '/api/admin/daemons/sla-reminders', {}, adminToken);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.reminders_sent >= 1, 'At least 1 reminder sent');

      const notif = db.prepare(`
        SELECT * FROM notifications
        WHERE tenant_id = 'tenant-001'
          AND user_id = 'usr-003'
          AND link = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(`/documents/${docSlaApproaching}`);

      assert.ok(notif, 'Notification must be inserted for reviewer usr-003');
      assert.strictEqual(notif.priority, 'medium');
      assert.strictEqual(notif.type, 'sla_reminder_1');
      assert.ok(notif.title.includes('[SLA REMINDER]') || notif.title.includes('Reminder 1'), 'Title must indicate SLA reminder');

      const docCheck = db.prepare('SELECT sla_reminder_1_sent_at FROM documents WHERE id = ?').get(docSlaApproaching);
      assert.ok(docCheck.sla_reminder_1_sent_at, 'Document sla_reminder_1_sent_at must be populated');
    });

    await test('T14: Task breached/overdue past SLA deadline generates Reminder 2 notification (priority: high)', async () => {
      // Pending Approval limit is 3 days. Age = 5 days (5 >= 3)
      insertTestDoc({
        id: docSlaBreached,
        title: 'Overdue SLA Doc',
        status: 'Pending Approval',
        active: 1,
        approver_id: 'usr-004',
        created_days_ago: 5,
      });

      const res = await req('POST', '/api/admin/daemons/sla-reminders', {}, adminToken);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.reminders_sent >= 1, 'Overdue reminder must be sent');

      const notif = db.prepare(`
        SELECT * FROM notifications
        WHERE tenant_id = 'tenant-001'
          AND user_id = 'usr-004'
          AND link = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(`/documents/${docSlaBreached}`);

      assert.ok(notif, 'Notification must be inserted for approver usr-004');
      assert.strictEqual(notif.priority, 'high');
      assert.strictEqual(notif.type, 'sla_reminder_2');
      assert.ok(notif.title.includes('[URGENT SLA BREACH]') || notif.title.includes('Reminder 2'), 'Title must indicate urgent breach');

      const docCheck = db.prepare('SELECT sla_reminder_2_sent_at FROM documents WHERE id = ?').get(docSlaBreached);
      assert.ok(docCheck.sla_reminder_2_sent_at, 'Document sla_reminder_2_sent_at must be populated');
    });

    await test('T15: On-track task within safe SLA window (1 day old in 5-day SLA) generates NO reminder', async () => {
      insertTestDoc({
        id: docSlaOnTrack,
        title: 'On Track SLA Doc',
        status: 'Pending Review',
        active: 1,
        reviewer_id: 'usr-003',
        created_days_ago: 1,
      });

      const res = await req('POST', '/api/admin/daemons/sla-reminders', {}, adminToken);
      assert.strictEqual(res.status, 200);

      const notif = db.prepare(`
        SELECT * FROM notifications WHERE link = ?
      `).get(`/documents/${docSlaOnTrack}`);

      assert.strictEqual(notif, undefined, 'On-track task must NOT generate any notification');
    });

    await test('T16: Completed, Published, and Inactive documents generate NO reminder notifications', async () => {
      insertTestDoc({
        id: docSlaPublished,
        title: 'Published Doc',
        status: 'Published',
        active: 1,
        reviewer_id: 'usr-003',
        created_days_ago: 20,
      });

      insertTestDoc({
        id: docSlaInactiveDraft,
        title: 'Inactive Draft Doc',
        status: 'Draft',
        active: 0,
        reviewer_id: 'usr-003',
        created_days_ago: 20,
      });

      const res = await req('POST', '/api/admin/daemons/sla-reminders', {}, adminToken);
      assert.strictEqual(res.status, 200);

      const notifPub = db.prepare('SELECT * FROM notifications WHERE link = ?').get(`/documents/${docSlaPublished}`);
      const notifInact = db.prepare('SELECT * FROM notifications WHERE link = ?').get(`/documents/${docSlaInactiveDraft}`);

      assert.strictEqual(notifPub, undefined, 'Published document must not generate reminder');
      assert.strictEqual(notifInact, undefined, 'Inactive draft must not generate reminder');
    });

    await test('T17: Idempotency & anti-spam: consecutive run on same day generates 0 new notifications', async () => {
      const res = await req('POST', '/api/admin/daemons/sla-reminders', {}, adminToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.reminders_sent, 0, 'Repeated same-day run must send 0 duplicate reminders');
      assert.ok(res.body.reminders_skipped_idempotent >= 1, 'reminders_skipped_idempotent must reflect suppressed reminders');
    });

    await test('T18: Multi-tenant isolation: tenant-001 daemon run leaves tenant-002 tasks isolated', async () => {
      db.prepare(`
        INSERT OR IGNORE INTO tenants (id, name, slug)
        VALUES ('tenant-m3-002', 'Second Clinical Tenant', 'tenant-m3-002')
      `).run();

      insertTestDoc({
        id: docSlaTenant2,
        tenant_id: 'tenant-m3-002',
        title: 'Tenant 2 Task Doc',
        status: 'Pending Review',
        active: 1,
        reviewer_id: 'usr-003',
        created_days_ago: 5,
      });

      // Trigger reminder check specifically for tenant-001
      const res = await req('POST', '/api/admin/daemons/sla-reminders', {}, adminToken);
      assert.strictEqual(res.status, 200);

      // Ensure no notification created for tenant-002 task under tenant-001
      const tenant2Notif = db.prepare(`
        SELECT * FROM notifications WHERE tenant_id = 'tenant-m3-002' AND link = ?
      `).get(`/documents/${docSlaTenant2}`);

      assert.strictEqual(tenant2Notif, undefined, 'Tenant-002 must not receive notifications from tenant-001 daemon');

      const docTenant2Check = db.prepare('SELECT sla_reminder_1_sent_at, sla_reminder_2_sent_at FROM documents WHERE id = ?').get(docSlaTenant2);
      assert.strictEqual(docTenant2Check.sla_reminder_1_sent_at, null, 'Tenant-002 document must remain untouched');
    });

  } finally {
    // Teardown test fixtures
    cleanupTestFixtures();
    try {
      if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);
    } catch (e) {}
  }

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Results: ${passed}/${passed + failed} passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  if (failed === 0) {
    console.log('🎉 ALL 18 PHASE 6 M3 API TESTS PASSED WITH 100% SUCCESS!');
  } else {
    console.log(`❌ ${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('──────────────────────────────────────────────────────\n');
}

run().catch(err => {
  console.error('\n❌ Test suite fatal error:', err);
  process.exit(1);
});
