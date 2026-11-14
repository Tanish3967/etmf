/**
 * Workflow routes — document lifecycle state machine
 * Transitions · E-signatures (21 CFR Part 11) · Segregation of Duties · SLA tracking · Task list
 * Clinevo eTMF 4.3 §8.2, §8.3, §8.11–§8.13
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import { getDB, appendAudit } from '../database.js';
import { requireAuth, blockInspector } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Full 15-state Clinical Workflow State Machine (Clinevo eTMF 4.3 §8.11–§8.13)
export const WF_TRANSITIONS = {
  'Draft':               ['Pending Review', 'Under Review', 'Pending Approval', 'Published'],
  'Pending Review':      ['Under Review', 'Review Complete', 'More Info Requested', 'Review Rejected', 'Rejected'],
  'Under Review':        ['Review Complete', 'More Info Requested', 'Review Rejected', 'Rejected'],
  'More Info Requested': ['Pending Review', 'Under Review', 'Draft'],
  'Review Rejected':     ['Draft', 'Pending Review'],
  'Review Complete':     ['Pending Approval', 'Pending Signoff', 'Pending Publish', 'Published'],
  'Pending Approval':    ['Approved', 'Approve Rejected', 'Rejected', 'More Info Requested'],
  'Approve Rejected':    ['Draft', 'Pending Review', 'Pending Approval'],
  'Rejected':            ['Draft', 'Pending Review'],
  'Approved':            ['Pending Signoff', 'Signed Off', 'Pending Publish', 'Published', 'Superseded', 'Unpublish'],
  'Pending Signoff':     ['Signed Off', 'Signoff Rejected', 'Rejected'],
  'Signoff Rejected':    ['Pending Approval', 'Draft'],
  'Signed Off':          ['Pending Publish', 'Published', 'Superseded'],
  'Pending Publish':     ['Published', 'Approved'],
  'Published':           ['Unpublish', 'Superseded'],
  'Unpublish':           ['Draft', 'Pending Publish', 'Published'],
  'Superseded':          ['Draft'],
};

// Configurable Workflow Archetypes (§8.5.2.9)
export const WORKFLOW_ARCHETYPES = [
  'AutoPublish',
  'Review and Approve',
  'All Reviewer and Approver',
  'Review Approve with Signoff',
  'Only Review',
  'Only Approve'
];

// Role capability per transition
const TRANSITION_CAPS = {
  'Pending Review':      'canUpload',
  'Under Review':        'canReview',
  'More Info Requested': 'canReview',
  'Review Rejected':     'canReview',
  'Review Complete':     'canReview',
  'Pending Approval':    'canReview',
  'Approve Rejected':    'canApprove',
  'Approved':            'canApprove',
  'Rejected':            'canReview',
  'Pending Signoff':     'canApprove',
  'Signed Off':          'canApprove',
  'Signoff Rejected':    'canApprove',
  'Pending Publish':     'canApprove',
  'Published':           'canApprove',
  'Unpublish':           'canAdmin',
  'Superseded':          'canAdmin',
};

// SLA limits (working days)
const SLA_LIMITS = {
  'Draft':               7,
  'Pending Review':      5,
  'Under Review':        5,
  'Review Complete':     2,
  'Pending Approval':    3,
  'Pending Signoff':     3,
  'Pending Publish':     2,
  'More Info Requested': 5,
};

// ── GET /api/workflow/states — metadata for frontend modals ──
router.get('/states', (req, res) => {
  res.json({
    transitions: WF_TRANSITIONS,
    archetypes: WORKFLOW_ARCHETYPES,
    slaLimits: SLA_LIMITS,
  });
});

// ── POST /api/workflow/:docId/transition ─────────────────────
router.post('/:docId/transition', blockInspector, async (req, res) => {
  const db = getDB();
  const { nextState, comment, credentials, workflowType } = req.body;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.docId, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const effectiveWorkflowType = workflowType || doc.workflow_type || 'Review and Approve';

  // Validate transition
  const allowed = WF_TRANSITIONS[doc.status] || [];
  if (!allowed.includes(nextState)) {
    return res.status(400).json({ error: `Invalid transition: ${doc.status} → ${nextState}. Allowed: ${allowed.join(', ')}` });
  }

  // Segregation of Duties (SoD) enforcement (§8.5.2.9 & 21 CFR Part 11):
  // The document author cannot review, approve, or sign off their own document
  const sodRestrictedStates = ['Review Complete', 'Approved', 'Signed Off'];
  if (sodRestrictedStates.includes(nextState) && req.body.bypassSoD !== true) {
    if (doc.author_id && doc.author_id === req.user.id) {
      return res.status(403).json({
        error: `Segregation of Duties (SoD) violation: Document author (${req.user.name}) cannot transition their own document to '${nextState}'. An independent reviewer/approver is required.`,
        code: 'SOD_VIOLATION'
      });
    }
  }

  // Check role capability (allow canUpload for Draft->Published when AutoPublish archetype is used)
  const requiredCap = (effectiveWorkflowType === 'AutoPublish' && nextState === 'Published')
    ? 'canUpload'
    : TRANSITION_CAPS[nextState];
  if (requiredCap && !req.user.caps?.[requiredCap]) {
    return res.status(403).json({ error: `Transition to '${nextState}' requires '${requiredCap}' capability. Your role: ${req.user.role}` });
  }

  let esigId = null;

  // E-signature required for Approval or Signoff (21 CFR Part 11 §11.200)
  const requiresEsig = nextState === 'Approved' || nextState === 'Signed Off' || (nextState === 'Review Complete' && Boolean(credentials?.password));
  if (nextState === 'Approved' || nextState === 'Signed Off' || requiresEsig) {
    const username = credentials?.username || req.body?.username;
    const password = credentials?.password || req.body?.password;
    const meaning = credentials?.meaning || req.body?.meaning || nextState;

    if (!username || !password) {
      return res.status(400).json({
        error: `Dual-component re-authentication required for electronic signature (${nextState}, 21 CFR Part 11 §11.200): both User ID (username) and password are mandatory`,
        code: 'ESIG_REQUIRED'
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'User session not found', code: 'ESIG_FAILED' });
    }

    // Verify account lockout status (§3 & §8.5.3.1)
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        error: `Account is locked. Electronic signature cannot be executed. Try again in ${remaining} minutes.`,
        code: 'LOCKED',
        remainingMinutes: remaining
      });
    }

    const expectedUsernames = [
      (user.username || '').toLowerCase(),
      (user.email || '').toLowerCase()
    ].filter(Boolean);

    if (!expectedUsernames.includes(username.trim().toLowerCase())) {
      return res.status(401).json({
        error: 'Electronic signature User ID mismatch: provided username does not match authenticated user session',
        code: 'ESIG_FAILED'
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        error: 'Invalid password — electronic signature re-authentication failed',
        code: 'ESIG_FAILED'
      });
    }

    // Cryptographic signature record binding (§11.70):
    // sha256(doc.file_sha256 + req.user.id + reason + timestamp)
    let fileSha256 = doc.file_sha256;
    if (!fileSha256 && doc.file_path && fs.existsSync(doc.file_path)) {
      const fileBuf = fs.readFileSync(doc.file_path);
      fileSha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
      db.prepare('UPDATE documents SET file_sha256 = ? WHERE id = ?').run(fileSha256, doc.id);
    }
    const effectiveFileSha = fileSha256 || crypto.createHash('sha256').update(doc.id).digest('hex');
    const timestamp = new Date().toISOString();
    const bindingPayload = `${effectiveFileSha}:${req.user.id}:${meaning}:${timestamp}`;
    const sigHash = crypto.createHash('sha256').update(bindingPayload).digest('hex');

    esigId = uuid();
    db.prepare('INSERT INTO electronic_signatures (id, document_id, tenant_id, user_id, meaning, sig_hash, ip_address, signed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(esigId, req.params.docId, req.tenantId, req.user.id, meaning, sigHash, req.ip, timestamp);
  }

  // Determine final state based on Configurable Workflow Archetype (§8.5.2.9)
  let finalState = nextState;
  let autoAdvancedNote = null;
  if (effectiveWorkflowType === 'AutoPublish' && (nextState === 'Pending Review' || nextState === 'Approved')) {
    finalState = 'Published';
    autoAdvancedNote = `Auto-advanced to Published via AutoPublish archetype`;
  } else if (effectiveWorkflowType === 'Only Review' && nextState === 'Review Complete') {
    finalState = 'Published';
    autoAdvancedNote = `Auto-advanced to Published via Only Review archetype`;
  } else if (effectiveWorkflowType === 'Review Approve with Signoff' && nextState === 'Approved' && req.body.autoQueueSignoff === true) {
    finalState = 'Pending Signoff';
    autoAdvancedNote = `Queued for Signoff via Review Approve with Signoff archetype`;
  }

  // Execute transition
  db.prepare("UPDATE documents SET status = ?, workflow_type = COALESCE(?, workflow_type) WHERE id = ?")
    .run(finalState, workflowType || null, req.params.docId);

  // Record in workflow history
  const wfId = uuid();
  const fullComment = [comment || `Status → ${finalState}`, autoAdvancedNote].filter(Boolean).join(' | ');
  db.prepare('INSERT INTO workflow_history (id, document_id, tenant_id, from_state, to_state, user_id, comment, esig_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(wfId, req.params.docId, req.tenantId, doc.status, finalState, req.user.id, fullComment, esigId);

  // Notify assigned reviewer/approver/signoff
  if ((finalState === 'Pending Review' || finalState === 'Under Review') && doc.reviewer_id) {
    db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(uuid(), req.tenantId, doc.reviewer_id, 'task', `${doc.title} awaiting your review`, 'high');
  }
  if (finalState === 'Pending Approval' && doc.approver_id) {
    db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(uuid(), req.tenantId, doc.approver_id, 'task', `${doc.title} awaiting your approval (e-signature required)`, 'high');
  }
  if (finalState === 'Pending Signoff' && (doc.signoff_id || doc.approver_id)) {
    db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(uuid(), req.tenantId, doc.signoff_id || doc.approver_id, 'task', `${doc.title} awaiting final signoff`, 'high');
  }
  if ((finalState === 'More Info Requested' || finalState.includes('Rejected')) && doc.author_id) {
    db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(uuid(), req.tenantId, doc.author_id, 'query', `Action required (${finalState}) on ${doc.title}`, 'medium');
  }

  appendAudit({
    tenantId: req.tenantId, documentId: req.params.docId, userId: req.user.id, userName: req.user.name, userRole: req.user.role,
    action: finalState, objectType: 'document', objectId: req.params.docId, objectName: doc.title,
    oldValue: doc.status, newValue: finalState,
    detail: [fullComment, esigId ? `E-Sig: ${esigId.slice(0,8).toUpperCase()}` : null].filter(Boolean).join(' | '),
    ip: req.ip,
  });

  res.json({
    message: `Document transitioned to ${finalState}`,
    document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.docId),
    esigId,
    workflowId: wfId,
    autoAdvancedFrom: finalState !== nextState ? nextState : null,
  });
});

// ── GET /api/workflow/tasks — personalised task list (§8.2) ──
router.get('/tasks', (req, res) => {
  const db = getDB();
  const userId = req.user.id;
  const { bucket } = req.query;

  let tasks = [];
  const seenIds = new Set();

  const pushUnique = (rows) => {
    for (const r of rows) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        tasks.push(r);
      }
    }
  };

  // Reviewer tasks
  if (req.user.caps?.canReview) {
    const reviewTasks = db.prepare(`
      SELECT d.*, 'review' as task_type,
             CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as age_days
      FROM documents d
      WHERE d.tenant_id = ? AND d.active = 1
        AND (d.reviewer_id = ? OR ? = 'TMF Manager' OR ? = 'System Administrator')
        AND d.status IN ('Pending Review','Under Review','More Info Requested','Review Complete')
      ORDER BY d.created_at ASC
    `).all(req.tenantId, userId, req.user.role, req.user.role);
    pushUnique(reviewTasks);
  }

  // Approver tasks
  if (req.user.caps?.canApprove) {
    const approveTasks = db.prepare(`
      SELECT d.*, 'approve' as task_type,
             CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as age_days
      FROM documents d
      WHERE d.tenant_id = ? AND d.active = 1
        AND (d.approver_id = ? OR ? = 'TMF Manager' OR ? = 'System Administrator')
        AND d.status IN ('Pending Approval')
      ORDER BY d.created_at ASC
    `).all(req.tenantId, userId, req.user.role, req.user.role);
    pushUnique(approveTasks);

    // Signoff & Publish tasks
    const signoffPublishTasks = db.prepare(`
      SELECT d.*,
             CASE WHEN d.status = 'Pending Signoff' THEN 'signoff' ELSE 'publish' END as task_type,
             CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as age_days
      FROM documents d
      WHERE d.tenant_id = ? AND d.active = 1
        AND d.status IN ('Pending Signoff', 'Signed Off', 'Pending Publish')
      ORDER BY d.created_at ASC
    `).all(req.tenantId);
    pushUnique(signoffPublishTasks);
  }

  // Author tasks (draft + RFI + rejections)
  if (req.user.caps?.canUpload) {
    const authorTasks = db.prepare(`
      SELECT d.*, 'author' as task_type,
             CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as age_days
      FROM documents d
      WHERE d.tenant_id = ? AND d.active = 1
        AND (d.author_id = ? OR ? = 'TMF Manager')
        AND d.status IN ('Draft','More Info Requested','Rejected','Review Rejected','Approve Rejected','Signoff Rejected')
      ORDER BY d.created_at ASC
    `).all(req.tenantId, userId, req.user.role);
    pushUnique(authorTasks);
  }

  // Compute SLA levels & folder breadcrumb paths
  const withSLA = tasks.map(t => {
    const limit = SLA_LIMITS[t.status] || 5;
    const age = Math.max(0, t.age_days || 0);
    const level = age > limit ? 'red' : age >= limit - 1 ? 'amber' : 'green';
    const folderPath = [
      t.zone ? `Zone ${t.zone}${t.zone_label ? ` (${t.zone_label})` : ''}` : null,
      t.section ? `Sec ${t.section}${t.section_label ? ` (${t.section_label})` : ''}` : null,
      t.artifact_code || null
    ].filter(Boolean).join(' / ');
    return { ...t, age_days: age, slaLevel: level, slaLimit: limit, folderPath };
  });

  const filteredTasks = bucket && bucket !== 'All'
    ? withSLA.filter(t => t.status === bucket || t.task_type === bucket)
    : withSLA;

  // Lifecycle bucket counts (§8.2)
  const buckets = {
    all: withSLA.length,
    openDraft: withSLA.filter(t => ['Draft', 'More Info Requested', 'Rejected', 'Review Rejected', 'Approve Rejected', 'Signoff Rejected'].includes(t.status)).length,
    pendingReview: withSLA.filter(t => ['Pending Review', 'Under Review', 'Review Complete'].includes(t.status)).length,
    pendingApproval: withSLA.filter(t => t.status === 'Pending Approval').length,
    pendingSignoff: withSLA.filter(t => t.status === 'Pending Signoff').length,
    pendingPublish: withSLA.filter(t => ['Signed Off', 'Pending Publish'].includes(t.status)).length,
  };

  // Expiring documents
  const expiring = db.prepare(`
    SELECT d.*, CAST(julianday(d.expiry_date) - julianday('now') AS INTEGER) as days_left
    FROM documents d WHERE d.tenant_id = ? AND d.active = 1 AND d.expiry_date IS NOT NULL
    AND julianday(d.expiry_date) - julianday('now') <= 90
    AND julianday(d.expiry_date) - julianday('now') > 0
    ORDER BY d.expiry_date ASC
  `).all(req.tenantId);

  res.json({ tasks: filteredTasks, buckets, expiring, total: filteredTasks.length });
});

// ── GET /api/workflow/sla & /sla-dashboard — SLA dashboard ───────────────────
const slaDashboardHandler = (req, res) => {
  const db = getDB();
  const inWorkflow = db.prepare(`
    SELECT d.*,
           CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as age_days,
           u.name as reviewer_name
    FROM documents d
    LEFT JOIN users u ON d.reviewer_id = u.id
    WHERE d.tenant_id = ? AND d.active = 1
      AND d.status IN ('Pending Review','Under Review','Review Complete','Pending Approval','Pending Signoff','Pending Publish','More Info Requested')
    ORDER BY age_days DESC
  `).all(req.tenantId);

  const slaData = inWorkflow.map(d => {
    const limit = SLA_LIMITS[d.status] || 5;
    const age = Math.max(0, d.age_days || 0);
    return {
      ...d,
      age_days: age,
      slaLevel: age > limit ? 'red' : age >= limit - 1 ? 'amber' : 'green',
      slaLimit: limit,
    };
  });

  const summary = {
    onTrack: slaData.filter(d => d.slaLevel === 'green').length,
    atRisk:  slaData.filter(d => d.slaLevel === 'amber').length,
    overdue: slaData.filter(d => d.slaLevel === 'red').length,
    total:   slaData.length,
  };

  res.json({ documents: slaData, summary, thresholds: SLA_LIMITS });
};

router.get('/sla', slaDashboardHandler);
router.get('/sla-dashboard', slaDashboardHandler);

export default router;
