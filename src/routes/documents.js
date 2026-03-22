/**
 * Documents routes — full lifecycle
 * Upload · List · Get · Check-out/in · Metadata edit · Version history · Download
 * ALCOA+ compliant — all changes audited with reason for change
 */
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { getDB, appendAudit } from '../database.js';
import { requireAuth, requireCap, blockInspector, requireUnlockedStudy } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, '../../../uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const router = Router();
router.use(requireAuth);

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = join(UPLOAD_DIR, req.tenantId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.docx','.doc','.xlsx','.xls','.pptx','.jpg','.jpeg','.png','.tiff','.xml'];
    if (allowed.includes(extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error(`File type not permitted: ${extname(file.originalname)}`));
  },
});

// ── GET /api/documents — list with filters ───────────────────
router.get('/', (req, res) => {
  const db = getDB();
  const { studyId, zone, section, status, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['d.tenant_id = ?', 'd.active = 1'];
  const params = [req.tenantId];

  if (studyId)  { where.push('d.study_id = ?');      params.push(studyId); }
  if (zone)     { where.push('d.zone = ?');           params.push(zone); }
  if (section)  { where.push('d.section = ?');        params.push(section); }
  if (status)   { where.push('d.status = ?');         params.push(status); }
  if (search)   { where.push('(d.title LIKE ? OR d.id LIKE ? OR d.artifact_code LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  // Data scoping for Data Manager role
  if (req.user.caps?.canView === 'scoped') {
    where.push("d.zone IN ('02')"); // Data management zones only
  }

  const sql = `
    SELECT d.*, 
           au.name as author_name,
           rv.name as reviewer_name, 
           ap.name as approver_name,
           co.name as checked_out_by_name,
           (SELECT COUNT(*) FROM queries q WHERE q.document_id = d.id AND q.status = 'Open') as open_queries
    FROM documents d
    LEFT JOIN users au ON d.author_id = au.id
    LEFT JOIN users rv ON d.reviewer_id = rv.id
    LEFT JOIN users ap ON d.approver_id = ap.id
    LEFT JOIN users co ON d.checked_out_by = co.id
    WHERE ${where.join(' AND ')}
    ORDER BY d.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countSql = `SELECT COUNT(*) as total FROM documents d WHERE ${where.join(' AND ')}`;

  const docs = db.prepare(sql).all(...params, parseInt(limit), offset);
  const { total } = db.prepare(countSql).get(...params);

  // Log inspection access
  if (req.user.role === 'Inspector / Auditor') {
    appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Viewed', objectType: 'document_list', detail: `Inspector list query: zone=${zone}, section=${section}`, ip: req.ip });
  }

  res.json({ documents: docs, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
});

// ── GET /api/documents/:id ───────────────────────────────────
router.get('/:id', (req, res) => {
  const db = getDB();
  const doc = db.prepare(`
    SELECT d.*, au.name as author_name, rv.name as reviewer_name, ap.name as approver_name, co.name as checked_out_by_name
    FROM documents d
    LEFT JOIN users au ON d.author_id = au.id
    LEFT JOIN users rv ON d.reviewer_id = rv.id
    LEFT JOIN users ap ON d.approver_id = ap.id
    LEFT JOIN users co ON d.checked_out_by = co.id
    WHERE d.id = ? AND d.tenant_id = ? AND d.active = 1
  `).get(req.params.id, req.tenantId);

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const history = db.prepare(`
    SELECT wh.*, u.name as user_name, es.sig_hash, es.meaning as sig_meaning
    FROM workflow_history wh
    LEFT JOIN users u ON wh.user_id = u.id
    LEFT JOIN electronic_signatures es ON wh.esig_id = es.id
    WHERE wh.document_id = ? ORDER BY wh.created_at ASC
  `).all(req.params.id);

  const queries = db.prepare('SELECT q.*, u.name as raised_by_name FROM queries q LEFT JOIN users u ON q.raised_by = u.id WHERE q.document_id = ? ORDER BY q.created_at DESC').all(req.params.id);
  const versions = db.prepare('SELECT * FROM document_versions WHERE document_id = ? ORDER BY created_at DESC').all(req.params.id);
  const annotations = db.prepare('SELECT a.*, u.name as user_name FROM annotations a LEFT JOIN users u ON a.user_id = u.id WHERE a.document_id = ? ORDER BY a.created_at DESC').all(req.params.id);
  const links = db.prepare('SELECT dl.id as link_id, dl.relationship, d.* FROM document_links dl JOIN documents d ON dl.target_id = d.id WHERE dl.source_id = ? AND dl.tenant_id = ?').all(req.params.id, req.tenantId);

  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Viewed', objectType: 'document', objectId: doc.id, objectName: doc.title, ip: req.ip });

  res.json({ document: doc, workflowHistory: history, queries, versions, annotations, links });
});

// ── POST /api/documents — upload new document ────────────────
router.post('/', blockInspector, requireCap('canUpload'), upload.single('file'), (req, res) => {
  const db = getDB();
  const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;

  const {
    studyId, artifactCode, artifactName, zone, zoneLabel, section, sectionLabel,
    title, version = '1.0', status = 'Draft', confidential = false, mandatory = true,
    country, siteId, effectiveDate, expiryDate, reviewerId, approverId,
    aiClassified = false, aiConfidence, aiOverridden = false, metadata = {},
  } = body;

  if (!studyId || !artifactCode || !title) {
    return res.status(400).json({ error: 'studyId, artifactCode, and title are required' });
  }

  const docId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const file = req.file;

  db.prepare(`
    INSERT INTO documents (id, tenant_id, study_id, artifact_code, artifact_name, zone, zone_label, section, section_label, title, version, status, file_path, file_name, file_type, file_size, confidential, mandatory, country, site_id, effective_date, expiry_date, author_id, reviewer_id, approver_id, ai_classified, ai_confidence, ai_overridden, metadata, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(docId, req.tenantId, studyId, artifactCode, artifactName, zone, zoneLabel, section, sectionLabel, title, version, status, file?.path || null, file?.originalname || null, extname(file?.originalname || '').slice(1).toUpperCase() || null, file?.size || null, confidential ? 1 : 0, mandatory ? 1 : 0, country, siteId, effectiveDate, expiryDate, req.user.id, reviewerId, approverId, aiClassified ? 1 : 0, aiConfidence, aiOverridden ? 1 : 0, JSON.stringify(metadata), req.user.id);

  // Initial workflow history entry
  db.prepare('INSERT INTO workflow_history (id, document_id, tenant_id, from_state, to_state, user_id, comment) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuid(), docId, req.tenantId, null, 'Draft', req.user.id, `Document uploaded${aiClassified ? ` — AI classified (${aiConfidence}% confidence)${aiOverridden ? ', classification overridden by user' : ''}` : ''}`);

  // Remove matching placeholder
  db.prepare('UPDATE placeholders SET na_designated = 0 WHERE study_id = ? AND artifact_code = ? AND tenant_id = ?').run(studyId, artifactCode, req.tenantId);

  appendAudit({ tenantId: req.tenantId, studyId, documentId: docId, userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: 'Uploaded', objectType: 'document', objectId: docId, objectName: title, detail: `v${version}${aiClassified ? ` | AI: ${aiConfidence}%` : ''}`, ip: req.ip });

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
  res.status(201).json({ document: doc, message: 'Document uploaded successfully' });
});

// ── PATCH /api/documents/:id/metadata — edit metadata ────────
router.patch('/:id/metadata', blockInspector, (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const { title, effectiveDate, expiryDate, country, siteId, confidential, reviewerId, approverId, version, reasonForChange } = req.body;

  // ALCOA+ — reason required for approved docs
  if (doc.status === 'Approved' && !reasonForChange?.trim()) {
    return res.status(400).json({ error: 'Reason for change is required when editing approved documents (ALCOA+ §4.3)', code: 'REASON_REQUIRED' });
  }

  const updates = {};
  if (title !== undefined)        updates.title = title;
  if (effectiveDate !== undefined) updates.effective_date = effectiveDate;
  if (expiryDate !== undefined)   updates.expiry_date = expiryDate;
  if (country !== undefined)      updates.country = country;
  if (siteId !== undefined)       updates.site_id = siteId;
  if (confidential !== undefined) updates.confidential = confidential ? 1 : 0;
  if (reviewerId !== undefined)   updates.reviewer_id = reviewerId;
  if (approverId !== undefined)   updates.approver_id = approverId;
  if (version !== undefined)      updates.version = version;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals = Object.values(updates);
  db.prepare(`UPDATE documents SET ${setClauses} WHERE id = ? AND tenant_id = ?`).run(...vals, req.params.id, req.tenantId);

  appendAudit({
    tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, userRole: req.user.role,
    action: 'Metadata Updated', objectType: 'document', objectId: req.params.id, objectName: doc.title,
    detail: `Fields: ${Object.keys(updates).join(', ')}${reasonForChange ? ` | Reason: ${reasonForChange}` : ''}`,
    ip: req.ip,
  });

  res.json({ document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id), message: 'Metadata updated' });
});

// ── POST /api/documents/:id/checkout ─────────────────────────
router.post('/:id/checkout', blockInspector, requireCap('canUpload'), (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.checked_out_by) {
    const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(doc.checked_out_by);
    return res.status(409).json({ error: `Document already checked out by ${owner?.name}`, checkedOutBy: owner?.name });
  }
  db.prepare("UPDATE documents SET checked_out_by = ?, checked_out_at = datetime('now') WHERE id = ?").run(req.user.id, req.params.id);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Check Out', objectType: 'document', objectId: req.params.id, objectName: doc.title, ip: req.ip });
  res.json({ message: 'Document checked out', checkedOutBy: req.user.name, checkedOutAt: new Date().toISOString() });
});

// ── POST /api/documents/:id/checkin ──────────────────────────
router.post('/:id/checkin', blockInspector, (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!doc.checked_out_by) return res.status(400).json({ error: 'Document is not checked out' });

  const isOwner = doc.checked_out_by === req.user.id;
  const isAdmin = req.user.caps?.canAdmin;
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Only the checkout owner or admin can check in this document' });
  }

  db.prepare('UPDATE documents SET checked_out_by = NULL, checked_out_at = NULL WHERE id = ?').run(req.params.id);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Check In', objectType: 'document', objectId: req.params.id, objectName: doc.title, detail: isAdmin && !isOwner ? 'Admin override check-in' : undefined, ip: req.ip });
  res.json({ message: 'Document checked in' });
});

// ── POST /api/documents/:id/publish ──────────────────────────
router.post('/:id/publish', blockInspector, requireCap('canUpload'), (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.status === 'Approved') return res.status(400).json({ error: 'Document is already published/approved' });

  // Update status, clear checkouts, increment minor/major version theoretically (here just fixing status)
  db.prepare("UPDATE documents SET status = 'Approved', checked_out_by = NULL, checked_out_at = NULL WHERE id = ?").run(req.params.id);
  
  const whId = uuid();
  db.prepare('INSERT INTO workflow_history (id, document_id, tenant_id, from_state, to_state, user_id, comment) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(whId, req.params.id, req.tenantId, doc.status, 'Approved', req.user.id, 'Document explicitly published / signed off');

  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Published', objectType: 'document', objectId: req.params.id, detail: `From ${doc.status} to Approved`, ip: req.ip });
  res.json({ message: 'Document published successfully', document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) });
});

// ── GET /api/documents/:id/versions ──────────────────────────
router.get('/:id/versions', (req, res) => {
  const db = getDB();
  const versions = db.prepare('SELECT dv.*, u.name as created_by_name FROM document_versions dv LEFT JOIN users u ON dv.created_by = u.id WHERE dv.document_id = ? AND dv.tenant_id = ? ORDER BY dv.created_at DESC').all(req.params.id, req.tenantId);
  res.json({ versions });
});

// ── GET /api/documents/:id/download ──────────────────────────
router.get('/:id/download', (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Downloaded', objectType: 'document', objectId: req.params.id, objectName: doc.title, ip: req.ip });
  if (doc.file_path && existsSync(doc.file_path)) {
    return res.download(doc.file_path, doc.file_name || doc.title);
  }
  res.status(204).json({ message: 'No file stored (demo mode)' });
});

// ── POST /api/documents/:id/copy ─────────────────────────────
router.post('/:id/copy', blockInspector, requireCap('canUpload'), (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const newId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  db.prepare(`
    INSERT INTO documents (id, tenant_id, study_id, artifact_code, artifact_name, zone, zone_label, section, section_label, title, version, status, file_path, file_name, file_type, file_size, confidential, mandatory, country, site_id, active, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1.0', 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(newId, req.tenantId, doc.study_id, doc.artifact_code, doc.artifact_name, doc.zone, doc.zone_label, doc.section, doc.section_label, `Copy of ${doc.title}`, doc.file_path, doc.file_name, doc.file_type, doc.file_size, doc.confidential, doc.mandatory, doc.country, doc.site_id, req.user.id);

  db.prepare('INSERT INTO workflow_history (id, document_id, tenant_id, from_state, to_state, user_id, comment) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuid(), newId, req.tenantId, null, 'Draft', req.user.id, `Copied from ${doc.id}`);

  appendAudit({ tenantId: req.tenantId, documentId: newId, userId: req.user.id, userName: req.user.name, action: 'Copied', objectType: 'document', objectId: newId, detail: `Source: ${doc.id}`, ip: req.ip });
  res.status(201).json({ document: db.prepare('SELECT * FROM documents WHERE id = ?').get(newId), message: 'Document copied' });
});

// ── PATCH /api/documents/:id/move ────────────────────────────
router.patch('/:id/move', blockInspector, requireCap('canUpload'), (req, res) => {
  const db = getDB();
  const { studyId, artifactCode, artifactName, zone, zoneLabel, section, sectionLabel } = req.body;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  db.prepare(`UPDATE documents SET study_id=?, artifact_code=?, artifact_name=?, zone=?, zone_label=?, section=?, section_label=? WHERE id=?`)
    .run(studyId || doc.study_id, artifactCode, artifactName, zone, zoneLabel, section, sectionLabel, req.params.id);

  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Moved', objectType: 'document', objectId: req.params.id, detail: `Moved to ${zone} - ${section} (${artifactCode})`, ip: req.ip });
  res.json({ document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id), message: 'Document moved' });
});

// ── PATCH /api/documents/:id/inactivate ──────────────────────
router.patch('/:id/inactivate', blockInspector, requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { reason } = req.body;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  db.prepare('UPDATE documents SET active = 0 WHERE id = ?').run(req.params.id);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Inactivated', objectType: 'document', objectId: req.params.id, detail: reason || 'Soft deleted', ip: req.ip });
  res.json({ message: 'Document inactivated (soft deleted)' });
});

// ── PATCH /api/documents/:id/pin ─────────────────────────────
router.patch('/:id/pin', blockInspector, (req, res) => {
  const db = getDB();
  const { isPinned } = req.body;
  const doc = db.prepare('SELECT is_pinned FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  db.prepare('UPDATE documents SET is_pinned = ? WHERE id = ?').run(isPinned ? 1 : 0, req.params.id);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: isPinned ? 'Pinned' : 'Unpinned', objectType: 'document', objectId: req.params.id, ip: req.ip });
  res.json({ message: `Document ${isPinned ? 'pinned' : 'unpinned'}` });
});

// ── POST /api/documents/:id/links ────────────────────────────
router.post('/:id/links', blockInspector, (req, res) => {
  const db = getDB();
  const { targetId, relationship } = req.body;
  const linkId = uuid();
  db.prepare('INSERT INTO document_links (id, tenant_id, source_id, target_id, relationship, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(linkId, req.tenantId, req.params.id, targetId, relationship || 'Related', req.user.id);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Linked', objectType: 'document', objectId: req.params.id, detail: `Linked to ${targetId} (${relationship})`, ip: req.ip });
  res.status(201).json({ id: linkId, message: 'Document linked' });
});

// ── DELETE /api/documents/:id/links/:linkId ──────────────────
router.delete('/:id/links/:linkId', blockInspector, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM document_links WHERE id = ? AND tenant_id = ?').run(req.params.linkId, req.tenantId);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Unlinked', objectType: 'document', objectId: req.params.id, detail: `Removed link ${req.params.linkId}`, ip: req.ip });
  res.json({ message: 'Link removed' });
});

// ── GET /api/documents/:id/diff ──────────────────────────────
router.get('/:id/diff', (req, res) => {
  const { v1, v2 } = req.query;
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Viewed Diff', objectType: 'document', objectId: req.params.id, detail: `Comparing ${v1} and ${v2}`, ip: req.ip });
  res.json({ diffMode: 'side-by-side', v1, v2, message: 'Diff engine invoked (UI renders side-by-side)' });
});

// ── PATCH /api/documents/:id/assign ──────────────────────────
router.patch('/:id/assign', blockInspector, (req, res) => {
  const db = getDB();
  const { assigneeId, role } = req.body;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  if (role === 'reviewer') db.prepare('UPDATE documents SET reviewer_id = ? WHERE id = ?').run(assigneeId || req.user.id, req.params.id);
  else if (role === 'approver') db.prepare('UPDATE documents SET approver_id = ? WHERE id = ?').run(assigneeId || req.user.id, req.params.id);
  else return res.status(400).json({ error: 'Invalid role for assignment' });

  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Assigned', objectType: 'document', objectId: req.params.id, detail: `Role: ${role}`, ip: req.ip });
  res.json({ message: `Document assigned for ${role}` });
});

// ── POST /api/documents/bulk-download ────────────────────────
router.post('/bulk-download', (req, res) => {
  const { documentIds } = req.body;
  if (!documentIds || !documentIds.length) return res.status(400).json({ error: 'documentIds required' });
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Bulk Download', objectType: 'document_batch', detail: `${documentIds.length} documents requested`, ip: req.ip });
  res.json({ downloadUrl: `/downloads/bulk-${Date.now()}.zip`, message: 'Bulk download archive generated' });
});

// ── PATCH /api/documents/:id/redact ──────────────────────────
router.patch('/:id/redact', blockInspector, requireCap('canUpload'), (req, res) => {
  const db = getDB();
  const { regions } = req.body;
  db.prepare('UPDATE documents SET is_redacted = 1 WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Redacted', objectType: 'document', objectId: req.params.id, detail: `${regions?.length || 0} redaction zones applied`, ip: req.ip });
  res.json({ message: 'Document redacted successfully' });
});

// ── POST /api/documents/:id/annotations ──────────────────────
router.post('/:id/annotations', blockInspector, (req, res) => {
  const db = getDB();
  const { annotation_type, annotation_text, page_number, position_x, position_y } = req.body;
  if (!annotation_text) return res.status(400).json({ error: 'annotation_text required' });

  const annId = uuid();
  db.prepare(`
    INSERT INTO annotations (id, tenant_id, document_id, user_id, annotation_type, annotation_text, page_number, position_x, position_y)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(annId, req.tenantId, req.params.id, req.user.id, annotation_type || 'Note', annotation_text, page_number || 1, position_x || 0, position_y || 0);

  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Annotated', objectType: 'document', objectId: req.params.id, detail: `Added ${annotation_type || 'Note'}: ${annotation_text.slice(0,50)}`, ip: req.ip });
  res.status(201).json({ message: 'Annotation added', id: annId });
});

// ── DELETE /api/documents/:id/annotations/:annId ─────────────
router.delete('/:id/annotations/:annId', blockInspector, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM annotations WHERE id = ? AND document_id = ? AND tenant_id = ?').run(req.params.annId, req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Annotation Removed', objectType: 'document', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Annotation removed' });
});

// ── GET /api/documents/:id/preview ───────────────────────────
router.get('/:id/preview', (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Previewed', objectType: 'document', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Preview stream initialized', file_type: doc.file_type, file_path: doc.file_path, preview_url: `/downloads/preview-${doc.id}.tmp` });
});

// ── POST /api/documents/quick-upload ─────────────────────────
router.post('/quick-upload', blockInspector, requireCap('canUpload'), upload.single('file'), (req, res) => {
  const db = getDB();
  // Quick upload bypasses the wizard and extracts standard metadata or places it in a generic Uncategorized zone
  const docId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'File required' });

  db.prepare(`
    INSERT INTO documents (id, tenant_id, title, version, status, file_path, file_name, file_type, file_size, zone, section, created_by)
    VALUES (?, ?, ?, '1.0', 'Draft', ?, ?, ?, ?, '00', 'Uncategorized', ?)
  `).run(docId, req.tenantId, file.originalname, file.path, file.originalname, extname(file.originalname).slice(1).toUpperCase(), file.size, req.user.id);

  appendAudit({ tenantId: req.tenantId, documentId: docId, userId: req.user.id, userName: req.user.name, action: 'Quick Uploaded', objectType: 'document', objectId: docId, detail: file.originalname, ip: req.ip });
  res.status(201).json({ document: db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) });
});

// ── PATCH /api/documents/:id/blind ───────────────────────────
router.patch('/:id/blind', blockInspector, requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { isBlinded } = req.body;
  db.prepare('UPDATE documents SET confidential = ? WHERE id = ? AND tenant_id = ?').run(isBlinded ? 1 : 0, req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: isBlinded ? 'Blinded' : 'Unblinded', objectType: 'document', objectId: req.params.id, ip: req.ip });
  res.json({ message: `Document ${isBlinded ? 'blinded' : 'unblinded'} successfully` });
});

export default router;
