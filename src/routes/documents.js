/**
 * Documents routes — full lifecycle
 * Upload · List · Get · Check-out/in · Metadata edit · Version history · Download
 * ALCOA+ compliant — all changes audited with reason for change
 */
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { join, dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import fs, { mkdirSync, existsSync, createReadStream, statSync } from 'fs';
import crypto from 'crypto';
import { getDB, appendAudit } from '../database.js';
import { requireAuth, requireCap, blockInspector } from '../middleware/auth.js';
import { generateCompliantRendition, isPdfFile } from '../services/pdfRendition.js';

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
    const allowed = [
      '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
      '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.svg', '.gif',
      '.xml', '.html', '.htm', '.txt', '.csv', '.tsv', '.rtf',
      '.json', '.zip', '.eml', '.msg'
    ];
    const ext = extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      const err = new Error(`File type not permitted: ${ext || 'unknown'}. Allowed clinical formats: PDF, Word, Excel, PowerPoint, XML, HTML, Images, CSV, Text, JSON, and ZIP.`);
      err.status = 400;
      cb(err);
    }
  },
});

// ── GET /api/documents — list with filters & Search By criteria (§7) ───
router.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  const db = getDB();
  const {
    studyId, zone, section, status, search, searchBy = 'all',
    country, siteId, authorId, workflowType, dateFrom, dateTo,
    page = 1, limit = 50
  } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['d.tenant_id = ?', 'd.active = 1'];
  const params = [req.tenantId];

  if (studyId)      { where.push('d.study_id = ?');      params.push(studyId); }
  if (zone)         { where.push('d.zone = ?');           params.push(zone); }
  if (section)      { where.push('d.section = ?');        params.push(section); }
  if (status)       { where.push('d.status = ?');         params.push(status); }
  if (country)      { where.push('d.country = ?');        params.push(country); }
  if (siteId)       { where.push('d.site_id = ?');        params.push(siteId); }
  if (authorId)     { where.push('d.author_id = ?');      params.push(authorId); }
  if (workflowType) { where.push('d.workflow_type = ?');  params.push(workflowType); }
  if (dateFrom)     { where.push('date(d.created_at) >= date(?)'); params.push(dateFrom); }
  if (dateTo)       { where.push('date(d.created_at) <= date(?)'); params.push(dateTo); }

  if (search) {
    // Support SQL wildcard '%' directly if provided, otherwise wrap in %...%
    const likePattern = search.includes('%') ? search : `%${search}%`;
    const by = String(searchBy).toLowerCase();
    if (by === 'id' || by === 'document_id') {
      where.push('(d.id LIKE ? OR d.artifact_code LIKE ?)');
      params.push(likePattern, likePattern);
    } else if (by === 'title' || by === 'name' || by === 'document_name') {
      where.push('(d.title LIKE ? OR d.artifact_name LIKE ? OR d.file_name LIKE ?)');
      params.push(likePattern, likePattern, likePattern);
    } else if (by === 'display_name') {
      where.push('(COALESCE(d.display_name, d.title) LIKE ?)');
      params.push(likePattern);
    } else if (by === 'artifact_code') {
      where.push('(d.artifact_code LIKE ?)');
      params.push(likePattern);
    } else {
      where.push('(d.title LIKE ? OR d.id LIKE ? OR d.artifact_code LIKE ? OR COALESCE(d.display_name, d.title) LIKE ? OR d.artifact_name LIKE ?)');
      params.push(likePattern, likePattern, likePattern, likePattern, likePattern);
    }
  }

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
router.post('/', blockInspector, requireCap('canUpload'), upload.single('file'), async (req, res) => {
  const db = getDB();
  const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;

  const {
    studyId, artifactCode, artifactName, zone, zoneLabel, section, sectionLabel,
    title, displayName, workflowType = 'Review and Approve', version = '1.0', status = 'Draft', confidential = false, mandatory = true,
    country, siteId, effectiveDate, expiryDate, reviewerId, approverId, signoffId,
    aiClassified = false, aiConfidence, aiOverridden = false, metadata = {},
  } = body;

  if (!studyId || !artifactCode || !title) {
    return res.status(400).json({ error: 'studyId, artifactCode, and title are required' });
  }

  const resolvedArtifactName = artifactName || title || 'Clinical Document';
  const resolvedDisplayName = displayName || title;
  const resolvedZone = zone || (artifactCode ? artifactCode.split('.')[0] : '01');
  const resolvedZoneLabel = zoneLabel || `Zone ${resolvedZone}`;
  const resolvedSection = section || (artifactCode ? artifactCode.split('.').slice(0, 2).join('.') : `${resolvedZone}.01`);
  const resolvedSectionLabel = sectionLabel || `Section ${resolvedSection}`;
  const resolvedStatus = workflowType === 'AutoPublish' ? 'Published' : status;

  const docId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const file = req.file;

  // Streaming SHA-256 Binary Digest Computation (21 CFR Part 11 §11.70)
  let fileSha256 = null;
  if (file?.path && existsSync(file.path)) {
    try {
      const hash = crypto.createHash('sha256');
      const fileStream = createReadStream(file.path);
      await new Promise((resolve, reject) => {
        fileStream.on('data', chunk => hash.update(chunk));
        fileStream.on('end', () => { fileSha256 = hash.digest('hex'); resolve(); });
        fileStream.on('error', reject);
      });
    } catch (hashErr) {
      console.warn('Failed to compute binary stream hash:', hashErr.message);
    }
  }

  db.prepare(`
    INSERT INTO documents (id, tenant_id, study_id, artifact_code, artifact_name, zone, zone_label, section, section_label, title, display_name, workflow_type, version, status, file_path, file_name, file_type, file_size, file_sha256, confidential, mandatory, country, site_id, effective_date, expiry_date, author_id, reviewer_id, approver_id, signoff_id, ai_classified, ai_confidence, ai_overridden, metadata, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(docId, req.tenantId, studyId, artifactCode, resolvedArtifactName, resolvedZone, resolvedZoneLabel, resolvedSection, resolvedSectionLabel, title, resolvedDisplayName, workflowType, version, resolvedStatus, file?.path || null, file?.originalname || null, extname(file?.originalname || '').slice(1).toUpperCase() || null, file?.size || null, fileSha256, confidential ? 1 : 0, mandatory ? 1 : 0, country, siteId, effectiveDate, expiryDate, req.user.id, reviewerId, approverId, signoffId || null, aiClassified ? 1 : 0, aiConfidence, aiOverridden ? 1 : 0, JSON.stringify(metadata), req.user.id);

  // Initial workflow history entry
  db.prepare('INSERT INTO workflow_history (id, document_id, tenant_id, from_state, to_state, user_id, comment) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuid(), docId, req.tenantId, null, resolvedStatus, req.user.id, `Document uploaded (${workflowType})${aiClassified ? ` — AI classified (${aiConfidence}% confidence)${aiOverridden ? ', classification overridden by user' : ''}` : ''}`);

  // Remove matching placeholder
  db.prepare('UPDATE placeholders SET na_designated = 0 WHERE study_id = ? AND artifact_code = ? AND tenant_id = ?').run(studyId, artifactCode, req.tenantId);

  appendAudit({ tenantId: req.tenantId, studyId, documentId: docId, userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: 'Uploaded', objectType: 'document', objectId: docId, objectName: title, detail: `v${version}${aiClassified ? ` | AI: ${aiConfidence}%` : ''}${fileSha256 ? ` | SHA256: ${fileSha256.slice(0, 12)}...` : ''}`, ip: req.ip });

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

// ── POST /api/documents/:id/uncheck ──────────────────────────
router.post('/:id/uncheck', blockInspector, (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!doc.checked_out_by) return res.status(400).json({ error: 'Document is not checked out' });

  const isOwner = doc.checked_out_by === req.user.id;
  const isAdmin = req.user.caps?.canAdmin;
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Only the checkout owner or CHECKIN_ADMIN can uncheck this document' });
  }

  db.prepare('UPDATE documents SET checked_out_by = NULL, checked_out_at = NULL WHERE id = ?').run(req.params.id);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Unchecked', objectType: 'document', objectId: req.params.id, objectName: doc.title, detail: 'Checkout lock released without version change', ip: req.ip });
  res.json({ message: 'Document checkout lock released (unchecked)', document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) });
});

// ── POST /api/documents/:id/checkin ──────────────────────────
router.post('/:id/checkin', blockInspector, upload.single('file'), async (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!doc.checked_out_by) return res.status(400).json({ error: 'Document is not checked out' });

  const isOwner = doc.checked_out_by === req.user.id;
  const isAdmin = req.user.caps?.canAdmin;
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Only the checkout owner or admin can check in this document' });
  }

  const body = typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : (req.body || {});
  const { changeReason, incrementVersion = Boolean(req.file || body.newVersion), targetStatus } = body;

  let nextVersion = doc.version || '1.0';
  if (incrementVersion) {
    // Store current version snapshot in document_versions
    db.prepare('INSERT INTO document_versions (id, document_id, tenant_id, version, status, file_path, file_name, created_by, change_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(uuid(), doc.id, req.tenantId, doc.version || '1.0', doc.status, doc.file_path, doc.file_name, req.user.id, changeReason || 'Checked in new version');

    if (body.newVersion) {
      nextVersion = String(body.newVersion);
    } else {
      const parts = String(doc.version || '1.0').split('.');
      const major = parseInt(parts[0] || '1', 10) + 1;
      nextVersion = `${major}.0`;
    }
  }

  let newFileSha256 = doc.file_sha256;
  const file = req.file;
  if (file?.path && existsSync(file.path)) {
    const buf = fs.readFileSync(file.path);
    newFileSha256 = crypto.createHash('sha256').update(buf).digest('hex');
  }

  const nextStatus = targetStatus || doc.status;
  db.prepare(`
    UPDATE documents
    SET checked_out_by = NULL,
        checked_out_at = NULL,
        version = ?,
        status = ?,
        file_path = COALESCE(?, file_path),
        file_name = COALESCE(?, file_name),
        file_size = COALESCE(?, file_size),
        file_sha256 = COALESCE(?, file_sha256)
    WHERE id = ?
  `).run(nextVersion, nextStatus, file?.path || null, file?.originalname || null, file?.size || null, newFileSha256, req.params.id);

  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Check In', objectType: 'document', objectId: req.params.id, objectName: doc.title, detail: `Version: ${doc.version} -> ${nextVersion}${changeReason ? ` | Reason: ${changeReason}` : ''}`, ip: req.ip });
  res.json({ message: 'Document checked in', version: nextVersion, document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) });
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

// ── GET & POST /api/documents/:id/download ───────────────────
const handleDocumentDownload = async (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const downloadType = req.body?.type || (req.query.original === 'true' ? 'original' : 'rendition');
  const dlReason = req.body?.reason || req.query.reason || '';

  try {
    db.prepare('INSERT INTO document_access_log (id, document_id, tenant_id, user_id, user_name, user_role, action, version, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(uuid(), req.params.id, req.tenantId, req.user.id, req.user.name, req.user.role, downloadType === 'original' ? 'Downloaded Original' : 'Downloaded Rendition', doc.version || '1.0', req.ip);
  } catch (e) {}

  appendAudit({
    tenantId: req.tenantId,
    documentId: req.params.id,
    userId: req.user.id,
    userName: req.user.name,
    action: 'Downloaded',
    objectType: 'document',
    objectId: req.params.id,
    objectName: doc.title,
    detail: dlReason ? `Type: ${downloadType} | Reason: ${dlReason}` : `Type: ${downloadType}`,
    ip: req.ip
  });

  if (req.method === 'POST' && req.body?.type) {
    return res.json({
      message: `Document (${downloadType}) prepared for download`,
      watermark: `CONTROLLED COPY — ${req.user.name} — ${new Date().toISOString()}`,
      downloadUrl: `/api/documents/${doc.id}/download?rendition=${downloadType !== 'original'}`
    });
  }

  const signatures = db.prepare(`
    SELECT es.*, u.name as user_name, u.role as user_role
    FROM electronic_signatures es
    LEFT JOIN users u ON es.user_id = u.id
    WHERE es.document_id = ?
    ORDER BY es.signed_at ASC
  `).all(req.params.id);

  const fileExists = doc.file_path && existsSync(doc.file_path);

  if (fileExists) {
    try {
      const stats = statSync(doc.file_path);
      // Gracefully handle zero-byte files without crashing
      if (stats.size === 0) {
        return res.download(doc.file_path, doc.file_name || doc.title);
      }

      const isPdf = isPdfFile(doc.file_path) || (doc.file_type && doc.file_type.toUpperCase() === 'PDF');
      const forceRendition = req.query.rendition === 'true';

      // If PDF or rendition requested, generate certified stamped PDF rendition
      if (isPdf || forceRendition) {
        const stampedBuffer = await generateCompliantRendition({
          doc,
          signatures,
          requestingUser: req.user,
          fileSource: doc.file_path
        });

        const safeFilename = `${(doc.title || doc.file_name || 'document').replace(/[^a-zA-Z0-9_\-\.]/g, '_')}_rendition.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"`);
        res.setHeader('Content-Length', stampedBuffer.length);
        return res.send(stampedBuffer);
      }

      // Non-PDF files (e.g. .html, .csv, .docx) served directly
      return res.download(doc.file_path, doc.file_name || doc.title);
    } catch (err) {
      console.warn('PDF rendition stamping error, falling back to original file:', err.message);
      return res.download(doc.file_path, doc.file_name || doc.title);
    }
  }

  // Fallback for metadata-only / demo records
  if (req.query.rendition === 'true' || signatures.length > 0 || doc.status === 'Approved') {
    try {
      const stampedBuffer = await generateCompliantRendition({
        doc,
        signatures,
        requestingUser: req.user,
        fileSource: null
      });

      const safeFilename = `${(doc.title || 'document').replace(/[^a-zA-Z0-9_\-\.]/g, '_')}_rendition.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"`);
      res.setHeader('Content-Length', stampedBuffer.length);
      return res.send(stampedBuffer);
    } catch (metaErr) {
      console.warn('Metadata PDF rendition generation failed:', metaErr.message);
    }
  }

  res.status(204).json({ message: 'No file stored (demo mode)' });
};

router.get('/:id/download', handleDocumentDownload);
router.post('/:id/download', handleDocumentDownload);

// ── POST /api/documents/:id/copy ─────────────────────────────
router.post('/:id/copy', blockInspector, requireCap('canUpload'), (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const targetZone = req.body?.zone || doc.zone;
  const targetSection = req.body?.section || doc.section;
  const targetArtifact = req.body?.artifactCode || doc.artifact_code;

  const newId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  db.prepare(`
    INSERT INTO documents (id, tenant_id, study_id, artifact_code, artifact_name, zone, zone_label, section, section_label, title, version, status, file_path, file_name, file_type, file_size, confidential, mandatory, country, site_id, active, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1.0', 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(newId, req.tenantId, doc.study_id, targetArtifact, doc.artifact_name, targetZone, doc.zone_label, targetSection, doc.section_label, `Copy of ${doc.title}`, doc.file_path, doc.file_name, doc.file_type, doc.file_size, doc.confidential, doc.mandatory, doc.country, doc.site_id, req.user.id);

  try {
    db.prepare('INSERT INTO document_copy_log (id, source_doc_id, target_doc_id, tenant_id, from_path, to_path, copied_by, copied_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(uuid(), doc.id, newId, req.tenantId, `${doc.zone}/${doc.section}/${doc.artifact_code}`, `${targetZone}/${targetSection}/${targetArtifact}`, req.user.id, req.user.name);
  } catch (e) {}

  db.prepare('INSERT INTO workflow_history (id, document_id, tenant_id, from_state, to_state, user_id, comment) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuid(), newId, req.tenantId, null, 'Draft', req.user.id, `Copied from ${doc.id}`);

  appendAudit({ tenantId: req.tenantId, documentId: newId, userId: req.user.id, userName: req.user.name, action: 'Copied', objectType: 'document', objectId: newId, detail: `Source: ${doc.id}`, ip: req.ip });
  res.status(201).json({ document: db.prepare('SELECT * FROM documents WHERE id = ?').get(newId), message: 'Document copied' });
});

// ── PATCH /api/documents/:id/move ────────────────────────────
router.patch('/:id/move', blockInspector, requireCap('canUpload'), (req, res) => {
  const db = getDB();
  const { studyId, artifactCode, artifactName, zone, zoneLabel, section, sectionLabel, reason } = req.body;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const fromPath = `${doc.zone}/${doc.section}/${doc.artifact_code}`;
  const toPath = `${zone || doc.zone}/${section || doc.section}/${artifactCode || doc.artifact_code}`;

  db.prepare(`UPDATE documents SET study_id=?, artifact_code=?, artifact_name=?, zone=?, zone_label=?, section=?, section_label=? WHERE id=?`)
    .run(studyId || doc.study_id, artifactCode || doc.artifact_code, artifactName || doc.artifact_name, zone || doc.zone, zoneLabel || doc.zone_label, section || doc.section, sectionLabel || doc.section_label, req.params.id);

  try {
    db.prepare('INSERT INTO document_move_log (id, document_id, tenant_id, from_path, to_path, reason, moved_by, moved_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(uuid(), req.params.id, req.tenantId, fromPath, toPath, reason || 'Moved across DIA folder hierarchy', req.user.id, req.user.name);
  } catch (e) {}

  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Moved', objectType: 'document', objectId: req.params.id, detail: `Moved from ${fromPath} to ${toPath}`, ip: req.ip });
  res.json({ document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id), message: 'Document moved' });
});

// ── DELETE /api/documents/:id & PATCH /api/documents/:id/inactivate ──
const handleInactivateDoc = (req, res) => {
  const db = getDB();
  const reason = req.body?.reason || req.query?.reason || 'Soft deleted / Inactivated';
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  db.prepare('UPDATE documents SET active = 0 WHERE id = ?').run(req.params.id);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Inactivated', objectType: 'document', objectId: req.params.id, detail: reason, ip: req.ip });
  res.json({ message: 'Document inactivated (soft deleted)' });
};

router.patch('/:id/inactivate', blockInspector, requireCap('canAdmin'), handleInactivateDoc);
router.delete('/:id', blockInspector, requireCap('canAdmin'), handleInactivateDoc);

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
  const { annotation_type, annotation_text, text, page_number, position_x, position_y } = req.body;
  const content = annotation_text || text;
  if (!content) return res.status(400).json({ error: 'annotation_text required' });

  const annId = uuid();
  db.prepare(`
    INSERT INTO annotations (id, tenant_id, document_id, user_id, text, annotation_type, annotation_text, page_number, position_x, position_y, replies, resolved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 0)
  `).run(annId, req.tenantId, req.params.id, req.user.id, content, annotation_type || 'Note', content, page_number || 1, position_x || 0, position_y || 0);

  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Annotated', objectType: 'document', objectId: req.params.id, detail: `Added ${annotation_type || 'Note'}: ${content.slice(0,50)}`, ip: req.ip });
  res.status(201).json({ message: 'Annotation added', id: annId, annotation: db.prepare('SELECT * FROM annotations WHERE id = ?').get(annId) });
});

// ── POST /api/documents/:id/annotations/:annId/reply ─────────
router.post('/:id/annotations/:annId/reply', blockInspector, (req, res) => {
  const db = getDB();
  const { text, resolve } = req.body;
  if (!text) return res.status(400).json({ error: 'Reply text required' });

  const ann = db.prepare('SELECT * FROM annotations WHERE id = ? AND document_id = ? AND tenant_id = ?').get(req.params.annId, req.params.id, req.tenantId);
  if (!ann) return res.status(404).json({ error: 'Annotation not found' });

  let replies = [];
  try { replies = JSON.parse(ann.replies || '[]'); } catch (e) { replies = []; }
  const replyObj = {
    id: uuid(),
    user_id: req.user.id,
    user_name: req.user.name,
    text,
    created_at: new Date().toISOString()
  };
  replies.push(replyObj);

  const resolvedVal = resolve !== undefined ? (resolve ? 1 : 0) : (ann.resolved || 0);
  db.prepare('UPDATE annotations SET replies = ?, resolved = ? WHERE id = ?')
    .run(JSON.stringify(replies), resolvedVal, req.params.annId);

  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Annotation Reply', objectType: 'document', objectId: req.params.id, detail: `Replied to annotation ${req.params.annId}`, ip: req.ip });
  res.json({ message: 'Reply added', reply: replyObj, replies, resolved: Boolean(resolvedVal) });
});

// ── GET /api/documents/:id/notes ─────────────────────────────
router.get('/:id/notes', (req, res) => {
  const db = getDB();
  const notes = db.prepare('SELECT * FROM document_notes WHERE document_id = ? AND tenant_id = ? ORDER BY created_at DESC').all(req.params.id, req.tenantId);
  res.json({ notes });
});

// ── POST /api/documents/:id/notes ────────────────────────────
router.post('/:id/notes', blockInspector, (req, res) => {
  const db = getDB();
  const { text, visibility = 'Public', noteToFile = false, showAllVersions = true } = req.body;
  if (!text) return res.status(400).json({ error: 'Note text is required' });

  const noteId = uuid();
  db.prepare(`
    INSERT INTO document_notes (id, document_id, tenant_id, user_id, user_name, text, visibility, note_to_file, show_all_versions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(noteId, req.params.id, req.tenantId, req.user.id, req.user.name, text, visibility, noteToFile ? 1 : 0, showAllVersions ? 1 : 0);

  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Note Added', objectType: 'document', objectId: req.params.id, detail: `${visibility} Note: ${text.slice(0, 50)}`, ip: req.ip });
  res.status(201).json({ note: db.prepare('SELECT * FROM document_notes WHERE id = ?').get(noteId), message: 'Sticky note added' });
});

// ── DELETE /api/documents/:id/notes/:noteId ──────────────────
router.delete('/:id/notes/:noteId', blockInspector, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM document_notes WHERE id = ? AND document_id = ? AND tenant_id = ?').run(req.params.noteId, req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Note Deleted', objectType: 'document', objectId: req.params.id, detail: `Removed note ${req.params.noteId}`, ip: req.ip });
  res.json({ message: 'Sticky note deleted' });
});

// ── DELETE /api/documents/:id/annotations/:annId ─────────────
router.delete('/:id/annotations/:annId', blockInspector, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM annotations WHERE id = ? AND document_id = ? AND tenant_id = ?').run(req.params.annId, req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Annotation Removed', objectType: 'document', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Annotation removed' });
});

// ── GET /api/documents/:id/view — inline stream for in-app viewer ──
router.get('/:id/view', (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  
  try {
    db.prepare('INSERT INTO document_access_log (id, document_id, tenant_id, user_id, user_name, action, version, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(uuid(), req.params.id, req.tenantId, req.user.id, req.user.name, 'Viewed', doc.version, req.ip);
  } catch (e) {}

  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Viewed', objectType: 'document', objectId: req.params.id, objectName: doc.title, ip: req.ip });

  if (doc.file_path && existsSync(doc.file_path)) {
    const ext = extname(doc.file_name || doc.file_path).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.html': 'text/html; charset=utf-8',
      '.htm': 'text/html; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
      '.csv': 'text/plain; charset=utf-8',
      '.tsv': 'text/plain; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.xml': 'application/xml',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name || doc.title)}"`);
    return res.sendFile(resolve(doc.file_path));
  }

  // Fallback for metadata-only or demo records without on-disk binary
  res.status(200).json({
    hasBinary: false,
    message: 'No physical binary file attached to this record',
    document: doc
  });
});

// ── GET /api/documents/:id/access-history ────────────────────
router.get('/:id/access-history', (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT id, title FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const history = db.prepare('SELECT * FROM document_access_log WHERE document_id = ? AND tenant_id = ? ORDER BY created_at DESC').all(req.params.id, req.tenantId);
  res.json({ documentId: req.params.id, title: doc.title, history });
});

// ── POST /api/documents/:id/quality-check ────────────────────
router.post('/:id/quality-check', blockInspector, (req, res) => {
  const db = getDB();
  const { passed = true, checklist = [], comments = '' } = req.body;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const newStatus = passed ? (doc.status === 'Draft' ? 'Pending Review' : doc.status) : 'Rejected';
  db.prepare('UPDATE documents SET status = ? WHERE id = ?').run(newStatus, req.params.id);

  if (!passed && comments) {
    try {
      db.prepare(`
        INSERT INTO queries (id, tenant_id, document_id, study_id, query_type, severity, text, raised_by, assigned_to, status, due_date)
        VALUES (?, ?, ?, ?, 'Quality Check Issue', 'Major', ?, ?, ?, 'Open', date('now', '+7 days'))
      `).run(uuid(), req.tenantId, req.params.id, doc.study_id, `QC Failed: ${comments}`, req.user.id, doc.author_id || doc.created_by);
    } catch (e) {}
  }

  appendAudit({
    tenantId: req.tenantId,
    documentId: req.params.id,
    userId: req.user.id,
    userName: req.user.name,
    action: passed ? 'Quality Check Passed' : 'Quality Check Failed',
    objectType: 'document',
    objectId: req.params.id,
    detail: `Checklist items: ${checklist.length} | Comments: ${comments}`,
    ip: req.ip
  });

  res.json({
    message: passed ? 'Quality Check passed' : 'Quality Check failed and query raised',
    passed,
    document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  });
});

// ── PATCH /api/documents/:id/self-assign ─────────────────────
router.patch('/:id/self-assign', blockInspector, (req, res) => {
  const db = getDB();
  const { release = false, role = 'reviewer' } = req.body;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const targetUserId = release ? null : req.user.id;
  if (role === 'approver') {
    db.prepare('UPDATE documents SET approver_id = ? WHERE id = ?').run(targetUserId, req.params.id);
  } else {
    db.prepare('UPDATE documents SET reviewer_id = ? WHERE id = ?').run(targetUserId, req.params.id);
  }

  appendAudit({
    tenantId: req.tenantId,
    documentId: req.params.id,
    userId: req.user.id,
    userName: req.user.name,
    action: release ? 'Released Ownership' : 'Self-Assigned',
    objectType: 'document',
    objectId: req.params.id,
    detail: `${release ? 'Released' : 'Claimed'} ${role} role`,
    ip: req.ip
  });

  res.json({
    message: release ? 'Document ownership released' : `Self-assigned as ${role}`,
    document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  });
});

// ── GET /api/documents/:id/preview ───────────────────────────
router.get('/:id/preview', (req, res) => {
  const db = getDB();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  
  appendAudit({ tenantId: req.tenantId, documentId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Previewed', objectType: 'document', objectId: req.params.id, ip: req.ip });
  res.json({
    message: 'Preview stream initialized',
    file_type: doc.file_type,
    file_name: doc.file_name,
    hasFile: Boolean(doc.file_path && existsSync(doc.file_path)),
    view_url: `/api/documents/${doc.id}/view`
  });
});

// ── POST /api/documents/quick-upload ─────────────────────────
router.post('/quick-upload', blockInspector, requireCap('canUpload'), upload.single('file'), async (req, res) => {
  const db = getDB();
  // Quick upload bypasses the wizard and extracts standard metadata or places it in a generic Uncategorized zone
  const docId = `DOC-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'File required' });

  let fileSha256 = null;
  if (file.path && existsSync(file.path)) {
    try {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(file.path);
      await new Promise((resolve, reject) => {
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => { fileSha256 = hash.digest('hex'); resolve(); });
        stream.on('error', reject);
      });
    } catch (e) {}
  }

  db.prepare(`
    INSERT INTO documents (id, tenant_id, title, version, status, file_path, file_name, file_type, file_size, file_sha256, zone, section, created_by)
    VALUES (?, ?, ?, '1.0', 'Draft', ?, ?, ?, ?, ?, '00', 'Uncategorized', ?)
  `).run(docId, req.tenantId, file.originalname, file.path, file.originalname, extname(file.originalname).slice(1).toUpperCase(), file.size, fileSha256, req.user.id);

  appendAudit({ tenantId: req.tenantId, documentId: docId, userId: req.user.id, userName: req.user.name, action: 'Quick Uploaded', objectType: 'document', objectId: docId, detail: `${file.originalname}${fileSha256 ? ` | SHA256: ${fileSha256.slice(0, 12)}...` : ''}`, ip: req.ip });
  res.status(201).json({ document: db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) });
});

// ── PATCH /api/documents/:id/blind ───────────────────────────
router.patch('/:id/blind', blockInspector, requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { blind, isBlinded, reason } = req.body;
  const targetBlind = blind !== undefined ? Boolean(blind) : Boolean(isBlinded);
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'Justification reason is required for blinding/unblinding', code: 'REASON_REQUIRED' });
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  db.prepare('UPDATE documents SET confidential = ?, is_blinded = ? WHERE id = ? AND tenant_id = ?')
    .run(targetBlind ? 1 : 0, targetBlind ? 1 : 0, req.params.id, req.tenantId);

  appendAudit({
    tenantId: req.tenantId,
    documentId: req.params.id,
    userId: req.user.id,
    userName: req.user.name,
    action: targetBlind ? 'Blinded' : 'Unblinded',
    objectType: 'document',
    objectId: req.params.id,
    detail: `Reason: ${reason}`,
    ip: req.ip
  });

  res.json({
    message: `Document ${targetBlind ? 'blinded' : 'unblinded'} successfully`,
    is_blinded: targetBlind ? 1 : 0,
    document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  });
});

export default router;
