/**
 * Workflow routes — document lifecycle state machine
 * Transitions · E-signatures (21 CFR Part 11) · SLA tracking · Task list
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { getDB, appendAudit } from '../database.js';
import { requireAuth, requireCap, blockInspector } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Workflow state machine — matches frontend WF_NEXT
const WF_TRANSITIONS = {
  'Draft':              ['Pending Review'],
  'Pending Review':     ['Review Complete', 'More Info Requested', 'Rejected'],
  'More Info Requested':['Pending Review'],
  'Review Complete':    ['Pending Approval'],
  'Pending Approval':   ['Approved', 'Rejected'],
  'Rejected':           ['Draft'],
  'Approved':           ['Superseded'],
};

// Role capability per transition
const TRANSITION_CAPS = {
  'Pending Review':     'canUpload',
  'More Info Requested':'canReview',
  'Review Complete':    'canReview',
  'Pending Approval':   'canReview',
  'Approved':           'canApprove',
  'Rejected':           'canReview',
  'Superseded':         'canAdmin',
};

// SLA limits (working days)
const SLA_LIMITS = {
  'Pending Review':   5,
  'Review Complete':  2,
  'Pending Approval': 3,
  'More Info Requested': 5,
};

// ── POST /api/workflow/:docId/transition ─────────────────────
router.post('/:docId/transition', blockInspector, async (req, res) => {
  const db = getDB();
  const { nextState, comment, credentials } = req.body;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.docId, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Validate transition
  const allowed = WF_TRANSITIONS[doc.status] || [];
  if (!allowed.includes(nextState)) {
    return res.status(400).json({ error: `Invalid transition: ${doc.status} → ${nextState}. Allowed: ${allowed.join(', ')}` });
  }

  // Check role capability
  const requiredCap = TRANSITION_CAPS[nextState];
  if (requiredCap && !req.user.caps?.[requiredCap]) {
    return res.status(403).json({ error: `Transition to '${nextState}' requires '${requiredCap}' capability. Your role: ${req.user.role}` });
  }

  let esigId = null;

  // E-signature required for Approval (21 CFR Part 11 §11.200)
  if (nextState === 'Approved') {
    if (!credentials?.password) {
      return res.status(400).json({ error: 'Re-authentication required for electronic signature (21 CFR Part 11)', code: 'ESIG_REQUIRED' });
    }
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    const valid = await bcrypt.compare(credentials.password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials — re-authentication failed', code: 'ESIG_FAILED' });
    }

    // Record electronic signature
    const sigHash = crypto.createHash('sha256').update(`${req.user.id}:${req.params.docId}:${new Date().toISOString()}:${credentials.meaning || 'Approved'}`).digest('hex');
    esigId = uuid();
    db.prepare('INSERT INTO electronic_signatures (id, document_id, tenant_id, user_id, meaning, sig_hash, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(esigId, req.params.docId, req.tenantId, req.user.id, credentials.meaning || 'Approved', sigHash, req.ip);
  }

  // Execute transition
  db.prepare("UPDATE documents SET status = ? WHERE id = ?").run(nextState, req.params.docId);

  // Record in workflow history
  const wfId = uuid();
  db.prepare('INSERT INTO workflow_history (id, document_id, tenant_id, from_state, to_state, user_id, comment, esig_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(wfId, req.params.docId, req.tenantId, doc.status, nextState, req.user.id, comment || `Status → ${nextState}`, esigId);

  // Notify assigned reviewer/approver
  if (nextState === 'Pending Review' && doc.reviewer_id) {
    db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(uuid(), req.tenantId, doc.reviewer_id, 'task', `${doc.title} awaiting your review`, 'high');
  }
  if (nextState === 'Pending Approval' && doc.approver_id) {
    db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(uuid(), req.tenantId, doc.approver_id, 'task', `${doc.title} awaiting your approval (e-signature required)`, 'high');
  }
  if (nextState === 'More Info Requested' && doc.author_id) {
    db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(uuid(), req.tenantId, doc.author_id, 'query', `More information requested on ${doc.title}`, 'medium');
  }

  appendAudit({
    tenantId: req.tenantId, documentId: req.params.docId, userId: req.user.id, userName: req.user.name, userRole: req.user.role,
    action: nextState, objectType: 'document', objectId: req.params.docId, objectName: doc.title,
    oldValue: doc.status, newValue: nextState,
    detail: [comment, esigId ? `E-Sig: ${esigId.slice(0,8).toUpperCase()}` : null].filter(Boolean).join(' | '),
    ip: req.ip,
  });

  res.json({
    message: `Document transitioned to ${nextState}`,
    document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.docId),
    esigId,
    workflowId: wfId,
  });
});

// ── GET /api/workflow/tasks — personalised task list ─────────
router.get('/tasks', (req, res) => {
  const db = getDB();
  const userId = req.user.id;
  const role = req.user.role;

  let tasks = [];

  // Reviewer tasks
  if (req.user.caps?.canReview) {
    const reviewTasks = db.prepare(`
      SELECT d.*, 'review' as task_type,
             CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as age_days
      FROM documents d
      WHERE d.tenant_id = ? AND d.reviewer_id = ? AND d.status IN ('Pending Review','More Info Requested','Review Complete')
      ORDER BY d.created_at ASC
    `).all(req.tenantId, userId);
    tasks.push(...reviewTasks);
  }

  // Approver tasks
  if (req.user.caps?.canApprove) {
    const approveTasks = db.prepare(`
      SELECT d.*, 'approve' as task_type,
             CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as age_days
      FROM documents d
      WHERE d.tenant_id = ? AND d.approver_id = ? AND d.status = 'Pending Approval'
      ORDER BY d.created_at ASC
    `).all(req.tenantId, userId);
    tasks.push(...approveTasks);
  }

  // Author tasks (draft + RFI)
  if (req.user.caps?.canUpload) {
    const authorTasks = db.prepare(`
      SELECT d.*, 'author' as task_type,
             CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as age_days
      FROM documents d
      WHERE d.tenant_id = ? AND d.author_id = ? AND d.status IN ('Draft','More Info Requested','Rejected')
      ORDER BY d.created_at ASC
    `).all(req.tenantId, userId);
    tasks.push(...authorTasks);
  }

  // Compute SLA levels
  const withSLA = tasks.map(t => {
    const limit = SLA_LIMITS[t.status] || 5;
    const level = t.age_days > limit ? 'red' : t.age_days >= limit - 1 ? 'amber' : 'green';
    return { ...t, slaLevel: level, slaLimit: limit };
  });

  // Expiring documents
  const expiring = db.prepare(`
    SELECT d.*, CAST(julianday(d.expiry_date) - julianday('now') AS INTEGER) as days_left
    FROM documents d WHERE d.tenant_id = ? AND d.expiry_date IS NOT NULL
    AND julianday(d.expiry_date) - julianday('now') <= 90
    AND julianday(d.expiry_date) - julianday('now') > 0
    ORDER BY d.expiry_date ASC
  `).all(req.tenantId);

  res.json({ tasks: withSLA, expiring, total: withSLA.length });
});

// ── GET /api/workflow/sla — SLA dashboard ───────────────────
router.get('/sla', (req, res) => {
  const db = getDB();
  const inWorkflow = db.prepare(`
    SELECT d.*,
           CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as age_days,
           u.name as reviewer_name
    FROM documents d
    LEFT JOIN users u ON d.reviewer_id = u.id
    WHERE d.tenant_id = ? AND d.status IN ('Pending Review','Review Complete','Pending Approval','More Info Requested')
    ORDER BY age_days DESC
  `).all(req.tenantId);

  const slaData = inWorkflow.map(d => {
    const limit = SLA_LIMITS[d.status] || 5;
    return {
      ...d,
      slaLevel: d.age_days > limit ? 'red' : d.age_days >= limit - 1 ? 'amber' : 'green',
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
});

export default router;
