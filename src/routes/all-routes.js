/**
 * Queries routes
 */
import { Router as R } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB, appendAudit } from '../database.js';
import { requireAuth, requireCap, blockInspector } from '../middleware/auth.js';

export const queryRoutes = R();
queryRoutes.use(requireAuth);

queryRoutes.get('/', (req, res) => {
  const db = getDB();
  const { studyId, status, severity, docId } = req.query;
  let where = ['q.tenant_id = ?']; const params = [req.tenantId];
  if (studyId)  { where.push('q.study_id = ?');    params.push(studyId); }
  if (status)   { where.push('q.status = ?');      params.push(status); }
  if (severity) { where.push('q.severity = ?');    params.push(severity); }
  if (docId)    { where.push('q.document_id = ?'); params.push(docId); }
  const queries = db.prepare(`SELECT q.*, u.name as raised_by_name, a.name as assigned_to_name, d.title as doc_title FROM queries q LEFT JOIN users u ON q.raised_by = u.id LEFT JOIN users a ON q.assigned_to = a.id LEFT JOIN documents d ON q.document_id = d.id WHERE ${where.join(' AND ')} ORDER BY q.created_at DESC`).all(...params);
  res.json({ queries });
});

queryRoutes.post('/', blockInspector, (req, res) => {
  const db = getDB();
  const { documentId, studyId, queryType, severity, text, assignedTo, dueDate } = req.body;
  if (!documentId || !queryType || !text) return res.status(400).json({ error: 'documentId, queryType, text required' });
  const id = uuid();
  db.prepare('INSERT INTO queries (id, tenant_id, document_id, study_id, query_type, severity, text, raised_by, assigned_to, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, req.tenantId, documentId, studyId, queryType, severity || 'Major', text, req.user.id, assignedTo, dueDate, 'Open');
  // Notify assigned user
  if (assignedTo) {
    db.prepare("INSERT INTO notifications (id,tenant_id,user_id,type,title,priority,created_at) VALUES (?,?,?,?,?,?,datetime('now'))").run(uuid(), req.tenantId, assignedTo, 'query', `Query raised: ${text.slice(0,60)}`, 'medium');
  }
  appendAudit({ tenantId: req.tenantId, documentId, userId: req.user.id, userName: req.user.name, action: 'Query Raised', objectType: 'query', objectId: id, detail: `${queryType} — ${severity}: ${text.slice(0,80)}`, ip: req.ip });
  res.status(201).json({ query: db.prepare('SELECT * FROM queries WHERE id = ?').get(id) });
});

queryRoutes.patch('/:id/close', blockInspector, (req, res) => {
  const db = getDB();
  const { resolution } = req.body;
  const q = db.prepare('SELECT * FROM queries WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!q) return res.status(404).json({ error: 'Query not found' });
  if (q.status === 'Closed') return res.status(400).json({ error: 'Query already closed' });
  db.prepare("UPDATE queries SET status = 'Closed', resolution = ?, closed_by = ?, closed_at = datetime('now') WHERE id = ?").run(resolution, req.user.id, req.params.id);
  appendAudit({ tenantId: req.tenantId, documentId: q.document_id, userId: req.user.id, userName: req.user.name, action: 'Query Closed', objectType: 'query', objectId: req.params.id, detail: resolution, ip: req.ip });
  res.json({ message: 'Query closed', query: db.prepare('SELECT * FROM queries WHERE id = ?').get(req.params.id) });
});

/**
 * Audit routes
 */
export const auditRoutes = R();
auditRoutes.use(requireAuth);

auditRoutes.get('/', (req, res) => {
  const db = getDB();
  const { studyId, userId, action, docId, from, to, page = 1, limit = 100 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = ['tenant_id = ?']; const params = [req.tenantId];
  if (studyId) { where.push('study_id = ?');    params.push(studyId); }
  if (userId)  { where.push('user_id = ?');     params.push(userId); }
  if (action)  { where.push('action LIKE ?');   params.push(`%${action}%`); }
  if (docId)   { where.push('document_id = ?'); params.push(docId); }
  if (from)    { where.push('created_at >= ?'); params.push(from); }
  if (to)      { where.push('created_at <= ?'); params.push(to); }
  const logs = db.prepare(`SELECT * FROM audit_log WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM audit_log WHERE ${where.join(' AND ')}`).get(...params);
  res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

/**
 * Users routes
 */
export const userRoutes = R();
userRoutes.use(requireAuth);

userRoutes.get('/', (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, name, email, role, dept, active, mfa_enabled, last_login, created_at FROM users WHERE tenant_id = ? ORDER BY name').all(req.tenantId);
  res.json({ users });
});

userRoutes.get('/:id', (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, name, email, role, dept, active, mfa_enabled, last_login, created_at FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

userRoutes.patch('/:id', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { role, dept, active } = req.body;
  const updates = {}; const user = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (role   !== undefined) updates.role   = role;
  if (dept   !== undefined) updates.dept   = dept;
  if (active !== undefined) updates.active = active ? 1 : 0;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });
  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${set} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'User Updated', objectType: 'user', objectId: req.params.id, objectName: user.name, detail: JSON.stringify(updates), ip: req.ip });
  res.json({ message: 'User updated', user: db.prepare('SELECT id,name,email,role,dept,active FROM users WHERE id = ?').get(req.params.id) });
});

userRoutes.delete('/:id', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot revoke your own access' });
  const user = db.prepare('SELECT name FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(req.params.id);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Access Revoked', objectType: 'user', objectId: req.params.id, objectName: user.name, ip: req.ip });
  res.json({ message: 'User access revoked' });
});

/**
 * Studies routes
 */
export const studyRoutes = R();
studyRoutes.use(requireAuth);

studyRoutes.get('/', (req, res) => {
  const db = getDB();
  const studies = db.prepare('SELECT s.*, (SELECT COUNT(*) FROM documents d WHERE d.study_id = s.id) as doc_count, (SELECT COUNT(*) FROM sites si WHERE si.study_id = s.id) as site_count FROM studies s WHERE s.tenant_id = ? ORDER BY s.created_at DESC').all(req.tenantId);
  res.json({ studies });
});

studyRoutes.post('/', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { protocolNumber, title, phase, therapeuticArea, sponsorName, croName, startDate, plannedEndDate, tmfModelVersion = 'DIA v3.2' } = req.body;
  if (!protocolNumber || !title || !phase) return res.status(400).json({ error: 'protocolNumber, title, phase required' });
  const existing = db.prepare('SELECT id FROM studies WHERE tenant_id = ? AND protocol_number = ?').get(req.tenantId, protocolNumber);
  if (existing) return res.status(409).json({ error: `Study ${protocolNumber} already exists` });
  const id = `study-${Date.now()}`;
  db.prepare('INSERT INTO studies (id,tenant_id,protocol_number,title,phase,therapeutic_area,sponsor_name,cro_name,start_date,planned_end_date,tmf_model_version,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, req.tenantId, protocolNumber, title, phase, therapeuticArea, sponsorName, croName, startDate, plannedEndDate, tmfModelVersion, 'Setup', req.user.id);
  appendAudit({ tenantId: req.tenantId, studyId: id, userId: req.user.id, userName: req.user.name, action: 'Study Created', objectType: 'study', objectId: id, objectName: title, ip: req.ip });
  res.status(201).json({ study: db.prepare('SELECT * FROM studies WHERE id = ?').get(id) });
});

studyRoutes.post('/:id/lock', requireCap('canLock'), (req, res) => {
  const db = getDB();
  const study = db.prepare('SELECT * FROM studies WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!study) return res.status(404).json({ error: 'Study not found' });
  if (study.locked) return res.status(400).json({ error: 'Study already locked' });
  // Pre-lock checks
  const openTasks = db.prepare("SELECT COUNT(*) as c FROM documents WHERE study_id = ? AND status NOT IN ('Approved','Superseded','Archived')").get(req.params.id).c;
  const openQueries = db.prepare("SELECT COUNT(*) as c FROM queries WHERE study_id = ? AND status = 'Open'").get(req.params.id).c;
  if (openTasks > 0 && !req.body.force) return res.status(400).json({ error: `${openTasks} documents not yet approved`, code: 'PRELOCK_FAILED', openTasks, openQueries });
  if (openQueries > 0 && !req.body.force) return res.status(400).json({ error: `${openQueries} open queries must be resolved`, code: 'PRELOCK_FAILED', openTasks, openQueries });
  db.prepare("UPDATE studies SET locked = 1, locked_by = ?, locked_at = datetime('now'), status = 'Closed' WHERE id = ?").run(req.user.id, req.params.id);
  appendAudit({ tenantId: req.tenantId, studyId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Study Locked', objectType: 'study', objectId: req.params.id, objectName: study.title, ip: req.ip });
  res.json({ message: 'Study locked successfully' });
});

studyRoutes.get('/:id/completeness', (req, res) => {
  const db = getDB();
  const docs = db.prepare('SELECT zone, zone_label, status, mandatory FROM documents WHERE study_id = ? AND tenant_id = ?').all(req.params.id, req.tenantId);
  const zones = {};
  docs.forEach(d => {
    if (!zones[d.zone]) zones[d.zone] = { zone: d.zone, label: d.zone_label, total: 0, mandatory: 0, approved: 0 };
    zones[d.zone].total++;
    if (d.mandatory) zones[d.zone].mandatory++;
    if (d.status === 'Approved') zones[d.zone].approved++;
  });
  const overall = docs.length ? Math.round((docs.filter(d => d.status === 'Approved').length / docs.length) * 100) : 0;
  res.json({ overall, zones: Object.values(zones), totalDocs: docs.length, approved: docs.filter(d => d.status === 'Approved').length });
});

/**
 * EDL routes
 */
export const edlRoutes = R();
edlRoutes.use(requireAuth);

edlRoutes.get('/', (req, res) => {
  const db = getDB();
  const { studyId } = req.query;
  if (!studyId) return res.status(400).json({ error: 'studyId required' });
  const placeholders = db.prepare('SELECT ph.*, u.name as na_by_name FROM placeholders ph LEFT JOIN users u ON ph.na_by = u.id WHERE ph.study_id = ? AND ph.tenant_id = ? ORDER BY ph.zone, ph.section').all(studyId, req.tenantId);
  const docs = db.prepare("SELECT artifact_code, status FROM documents WHERE study_id = ? AND tenant_id = ? AND status != 'Superseded'").all(studyId, req.tenantId);
  const filed = {}; docs.forEach(d => { filed[d.artifact_code] = d.status; });
  const edl = placeholders.map(p => ({ ...p, filedStatus: filed[p.artifact_code] || null }));
  const missing = edl.filter(e => e.mandatory && !e.na_designated && !e.filedStatus);
  res.json({ edl, missing, total: edl.length, missingMandatory: missing.length });
});

edlRoutes.patch('/:id/na', blockInspector, (req, res) => {
  const db = getDB();
  const { reason, designated } = req.body;
  if (designated && !reason) return res.status(400).json({ error: 'Reason required for N/A designation' });
  const ph = db.prepare('SELECT * FROM placeholders WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!ph) return res.status(404).json({ error: 'Placeholder not found' });
  db.prepare("UPDATE placeholders SET na_designated = ?, na_reason = ?, na_by = ?, na_at = datetime('now') WHERE id = ?").run(designated ? 1 : 0, reason, req.user.id, req.params.id);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: designated ? 'N/A Designated' : 'N/A Removed', objectType: 'placeholder', objectId: req.params.id, objectName: ph.artifact_name, detail: reason, ip: req.ip });
  res.json({ message: `Placeholder ${designated ? 'designated N/A' : 'reinstated'}` });
});

edlRoutes.patch('/:id/optional', blockInspector, requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { mandatory } = req.body;
  db.prepare('UPDATE placeholders SET mandatory = ? WHERE id = ? AND tenant_id = ?').run(mandatory ? 1 : 0, req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Mandatory Toggled', objectType: 'placeholder', objectId: req.params.id, detail: `Mandatory: ${mandatory}`, ip: req.ip });
  res.json({ message: `Placeholder marked as ${mandatory ? 'mandatory' : 'optional'}` });
});

edlRoutes.delete('/:id', blockInspector, requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM placeholders WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Deleted', objectType: 'placeholder', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Placeholder removed' });
});

edlRoutes.get('/export-index', (req, res) => {
  const db = getDB();
  const { studyId } = req.query;
  const docs = db.prepare("SELECT artifact_code, artifact_name, zone, section, version, status, created_at FROM documents WHERE study_id = ? AND tenant_id = ? AND active = 1 ORDER BY zone, section, artifact_code").all(studyId, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Exported TMF Index', objectType: 'study', objectId: studyId, ip: req.ip });
  res.json({ message: 'TMF Index generated successfully', downloadUrl: `/downloads/tmf-index-${studyId}-${Date.now()}.xlsx`, totalItems: docs.length });
});

/**
 * Reports routes
 */
export const reportRoutes = R();
reportRoutes.use(requireAuth);

reportRoutes.get('/completeness', (req, res) => {
  const db = getDB();
  const { studyId, zoneId } = req.query;
  let where = ['tenant_id = ?']; const params = [req.tenantId];
  if (studyId) { where.push('study_id = ?'); params.push(studyId); }
  if (zoneId)  { where.push('zone = ?');     params.push(zoneId); }
  const docs = db.prepare(`SELECT zone, zone_label, section, section_label, status, mandatory FROM documents WHERE ${where.join(' AND ')}`).all(...params);
  const zMap = {};
  docs.forEach(d => {
    if (!zMap[d.zone]) zMap[d.zone] = { zone: d.zone, label: d.zone_label, total: 0, approved: 0, mandatory: 0, mandatoryApproved: 0 };
    zMap[d.zone].total++;
    if (d.mandatory) zMap[d.zone].mandatory++;
    if (d.status === 'Approved') { zMap[d.zone].approved++; if (d.mandatory) zMap[d.zone].mandatoryApproved++; }
  });
  const zones = Object.values(zMap).map(z => ({ ...z, pct: z.total ? Math.round((z.approved / z.total) * 100) : 0, mandatoryPct: z.mandatory ? Math.round((z.mandatoryApproved / z.mandatory) * 100) : 100 }));
  const total = docs.length;
  const approved = docs.filter(d => d.status === 'Approved').length;
  res.json({ report: 'TMF Completeness', overall: total ? Math.round((approved / total) * 100) : 0, zones, total, approved, generatedAt: new Date().toISOString(), generatedBy: req.user.name });
});

reportRoutes.get('/expiry', (req, res) => {
  const db = getDB();
  const { days = 90, studyId } = req.query;
  let where = ["d.expiry_date IS NOT NULL AND julianday(d.expiry_date) - julianday('now') <= ? AND d.tenant_id = ?"]; const params = [parseInt(days), req.tenantId];
  if (studyId) { where.push('d.study_id = ?'); params.push(studyId); }
  const docs = db.prepare(`SELECT d.*, CAST(julianday(d.expiry_date) - julianday('now') AS INTEGER) as days_left FROM documents d WHERE ${where.join(' AND ')} ORDER BY d.expiry_date ASC`).all(...params);
  res.json({ report: 'Expiry & Renewal', documents: docs, total: docs.length, critical: docs.filter(d => d.days_left <= 14).length, generatedAt: new Date().toISOString() });
});

reportRoutes.get('/workflow', (req, res) => {
  const db = getDB();
  const { studyId } = req.query;
  let where = ['d.tenant_id = ?']; const params = [req.tenantId];
  if (studyId) { where.push('d.study_id = ?'); params.push(studyId); }
  const inWorkflow = db.prepare(`SELECT d.status, COUNT(*) as count FROM documents d WHERE ${where.join(' AND ')} AND d.status IN ('Draft','Pending Review','More Info Requested','Review Complete','Pending Approval','Rejected') GROUP BY d.status`).all(...params);
  const overdue = db.prepare(`SELECT COUNT(*) as c FROM documents d WHERE d.tenant_id = ? AND d.status IN ('Pending Review','Pending Approval') AND julianday('now') - julianday(d.created_at) > 5`).get(req.tenantId).c;
  res.json({ report: 'Workflow Status', statusBreakdown: inWorkflow, overdue, generatedAt: new Date().toISOString() });
});

reportRoutes.get('/audit', (req, res) => {
  const db = getDB();
  const { studyId, from, to, action, limit = 500 } = req.query;
  let where = ['tenant_id = ?']; const params = [req.tenantId];
  if (studyId) { where.push('study_id = ?'); params.push(studyId); }
  if (from)    { where.push('created_at >= ?'); params.push(from); }
  if (to)      { where.push('created_at <= ?'); params.push(to); }
  if (action)  { where.push('action LIKE ?'); params.push(`%${action}%`); }
  const logs = db.prepare(`SELECT * FROM audit_log WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...params, parseInt(limit));
  res.json({ report: 'Audit Trail', logs, total: logs.length, generatedAt: new Date().toISOString(), generatedBy: req.user.name });
});

/**
 * AI routes
 */
export const aiRoutes = R();
aiRoutes.use(requireAuth);

// AI classification audit retrieval
aiRoutes.get('/audit', (req, res) => {
  const db = getDB();
  const logs = db.prepare('SELECT a.*, u.name as user_name FROM ai_audit a LEFT JOIN users u ON a.user_id = u.id WHERE a.tenant_id = ? ORDER BY a.created_at DESC LIMIT 200').all(req.tenantId);
  res.json({ logs });
});

// Save AI classification result
aiRoutes.post('/classify/audit', blockInspector, (req, res) => {
  const db = getDB();
  const { documentId, fileName, suggestedCode, finalCode, confidence, action, qcResults } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO ai_audit (id, tenant_id, document_id, user_id, file_name, suggested_code, final_code, confidence, action, qc_results) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, req.tenantId, documentId, req.user.id, fileName, suggestedCode, finalCode, confidence, action, JSON.stringify(qcResults));
  res.status(201).json({ id, message: 'AI audit entry recorded' });
});

// AI search (save searches for analytics)
aiRoutes.post('/search', (req, res) => {
  const { query, results } = req.body;
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'AI Search', detail: `Query: "${query}" — ${results} results`, ip: req.ip });
  res.json({ logged: true });
});

/**
 * Notifications routes
 */
export const notifRoutes = R();
notifRoutes.use(requireAuth);

notifRoutes.get('/', (req, res) => {
  const db = getDB();
  const notifs = db.prepare('SELECT * FROM notifications WHERE user_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id, req.tenantId);
  const unread = notifs.filter(n => !n.read).length;
  res.json({ notifications: notifs, unread });
});

notifRoutes.patch('/:id/read', (req, res) => {
  const db = getDB();
  db.prepare("UPDATE notifications SET read = 1, read_at = datetime('now') WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

notifRoutes.patch('/read-all', (req, res) => {
  const db = getDB();
  db.prepare("UPDATE notifications SET read = 1, read_at = datetime('now') WHERE user_id = ? AND tenant_id = ?").run(req.user.id, req.tenantId);
  res.json({ message: 'All notifications marked as read' });
});

/**
 * Admin routes
 */
export const adminRoutes = R();
adminRoutes.use(requireAuth, requireCap('canAdmin'));

adminRoutes.get('/tenant', (req, res) => {
  const db = getDB();
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.tenantId);
  res.json({ tenant });
});

adminRoutes.patch('/tenant', (req, res) => {
  const db = getDB();
  const { name, primaryColor, settings } = req.body;
  const updates = {};
  if (name)         updates.name          = name;
  if (primaryColor) updates.primary_color = primaryColor;
  if (settings)     updates.settings      = JSON.stringify(settings);
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });
  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE tenants SET ${set} WHERE id = ?`).run(...Object.values(updates), req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Config Change', objectType: 'tenant', objectName: 'Tenant Settings', detail: JSON.stringify(updates), ip: req.ip });
  res.json({ message: 'Tenant updated', tenant: db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.tenantId) });
});

adminRoutes.get('/stats', (req, res) => {
  const db = getDB();
  const stats = {
    users:        db.prepare('SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND active = 1').get(req.tenantId).c,
    studies:      db.prepare('SELECT COUNT(*) as c FROM studies WHERE tenant_id = ?').get(req.tenantId).c,
    documents:    db.prepare('SELECT COUNT(*) as c FROM documents WHERE tenant_id = ?').get(req.tenantId).c,
    approved:     db.prepare("SELECT COUNT(*) as c FROM documents WHERE tenant_id = ? AND status = 'Approved'").get(req.tenantId).c,
    openQueries:  db.prepare("SELECT COUNT(*) as c FROM queries WHERE tenant_id = ? AND status = 'Open'").get(req.tenantId).c,
    auditEntries: db.prepare('SELECT COUNT(*) as c FROM audit_log WHERE tenant_id = ?').get(req.tenantId).c,
    sessions:     db.prepare("SELECT COUNT(*) as c FROM sessions WHERE tenant_id = ? AND revoked = 0 AND expires_at > datetime('now')").get(req.tenantId).c,
  };
  res.json({ stats });
});

adminRoutes.get('/user-groups', (req, res) => {
  const db = getDB();
  const groups = db.prepare('SELECT ug.*, COUNT(ugm.user_id) as member_count FROM user_groups ug LEFT JOIN user_group_members ugm ON ug.id = ugm.group_id WHERE ug.tenant_id = ? GROUP BY ug.id ORDER BY ug.name').all(req.tenantId);
  res.json({ groups });
});

adminRoutes.post('/user-groups', (req, res) => {
  const db = getDB();
  const { name, description, isActive, zones, members = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name required' });
  const id = uuid();
  const activeFlag = isActive === false ? 0 : 1;
  db.prepare('INSERT INTO user_groups (id, tenant_id, name, description, is_active, zones, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, name, description || '', activeFlag, JSON.stringify(zones || []), req.user.id);
  const ins = db.prepare('INSERT OR IGNORE INTO user_group_members (group_id, user_id) VALUES (?, ?)');
  members.forEach(uid => ins.run(id, uid));
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'User Group Created', objectType: 'user_group', objectId: id, objectName: name, ip: req.ip });
  res.status(201).json({ group: db.prepare('SELECT * FROM user_groups WHERE id = ?').get(id) });
});

adminRoutes.put('/user-groups/:id', (req, res) => {
  const db = getDB();
  const { name, description, isActive, zones, members = [] } = req.body;
  const activeFlag = isActive === false ? 0 : 1;
  db.prepare("UPDATE user_groups SET name = ?, description = ?, is_active = ?, zones = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ? AND tenant_id = ?")
    .run(name, description || '', activeFlag, JSON.stringify(zones || []), req.user.name, req.params.id, req.tenantId);
  db.prepare('DELETE FROM user_group_members WHERE group_id = ?').run(req.params.id);
  const ins = db.prepare('INSERT OR IGNORE INTO user_group_members (group_id, user_id) VALUES (?, ?)');
  members.forEach(uid => ins.run(req.params.id, uid));
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'User Group Updated', objectType: 'user_group', objectId: req.params.id, objectName: name, ip: req.ip });
  res.json({ message: 'User group updated', group: db.prepare('SELECT * FROM user_groups WHERE id = ?').get(req.params.id) });
});

// ── FUNCTIONAL ROLES ─────────────────────────────────────────────────
adminRoutes.get('/functional-roles', (req, res) => {
  const db = getDB();
  const roles = db.prepare('SELECT * FROM functional_roles WHERE tenant_id = ? ORDER BY name ASC').all(req.tenantId);
  res.json({ roles });
});

adminRoutes.post('/functional-roles', (req, res) => {
  const db = getDB();
  const { name, description, capabilities } = req.body;
  if (!name) return res.status(400).json({ error: 'Role name required' });
  const id = uuid();
  db.prepare('INSERT INTO functional_roles (id, tenant_id, name, description, capabilities) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.tenantId, name, description || '', JSON.stringify(capabilities || []));
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Functional Role Created', objectType: 'functional_role', objectId: id, objectName: name, ip: req.ip });
  res.status(201).json({ role: db.prepare('SELECT * FROM functional_roles WHERE id = ?').get(id) });
});

adminRoutes.put('/functional-roles/:id', (req, res) => {
  const db = getDB();
  const { name, description, capabilities } = req.body;
  db.prepare('UPDATE functional_roles SET name = ?, description = ?, capabilities = ? WHERE id = ? AND tenant_id = ?')
    .run(name, description || '', JSON.stringify(capabilities || []), req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Functional Role Updated', objectType: 'functional_role', objectId: req.params.id, objectName: name, ip: req.ip });
  res.json({ message: 'Functional role updated', role: db.prepare('SELECT * FROM functional_roles WHERE id = ?').get(req.params.id) });
});

// ── SYSTEM CODELISTS ─────────────────────────────────────────────────
adminRoutes.get('/system-codelists', (req, res) => {
  const db = getDB();
  const { groupName } = req.query;
  let q = 'SELECT * FROM system_codelists WHERE tenant_id = ?';
  const params = [req.tenantId];
  if (groupName) { q += ' AND group_name = ?'; params.push(groupName); }
  q += ' ORDER BY group_name, code';
  const codelists = db.prepare(q).all(...params);
  res.json({ codelists });
});

adminRoutes.post('/system-codelists', (req, res) => {
  const db = getDB();
  const { code, name, group_name, is_active } = req.body;
  if (!code || !name || !group_name) return res.status(400).json({ error: 'Code, name and group_name required' });
  const id = uuid();
  const activeFlag = is_active === false ? 0 : 1;
  db.prepare('INSERT INTO system_codelists (id, tenant_id, code, name, group_name, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, code, name, group_name, activeFlag, req.user.name);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Codelist Created', objectType: 'system_codelist', objectId: id, objectName: code, ip: req.ip });
  res.status(201).json({ codelist: db.prepare('SELECT * FROM system_codelists WHERE id = ?').get(id) });
});

adminRoutes.put('/system-codelists/:id', (req, res) => {
  const db = getDB();
  const { code, name, group_name, is_active } = req.body;
  const activeFlag = is_active === false ? 0 : 1;
  db.prepare('UPDATE system_codelists SET code = ?, name = ?, group_name = ?, is_active = ? WHERE id = ? AND tenant_id = ?')
    .run(code, name, group_name, activeFlag, req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Codelist Updated', objectType: 'system_codelist', objectId: req.params.id, objectName: code, ip: req.ip });
  res.json({ message: 'Codelist updated', codelist: db.prepare('SELECT * FROM system_codelists WHERE id = ?').get(req.params.id) });
});

// ── ORGANIZATION PROFILES ────────────────────────────────────────────
adminRoutes.get('/organization-profiles', (req, res) => {
  const db = getDB();
  const profiles = db.prepare('SELECT * FROM organization_profiles WHERE tenant_id = ? ORDER BY profile_type, name').all(req.tenantId);
  res.json({ profiles });
});

adminRoutes.post('/organization-profiles', (req, res) => {
  const db = getDB();
  const { profile_type, name, description, value_str } = req.body;
  if (!profile_type || !name) return res.status(400).json({ error: 'Profile type and name required' });
  const id = uuid();
  db.prepare('INSERT INTO organization_profiles (id, tenant_id, profile_type, name, description, value_str, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, profile_type, name, description || '', value_str || '', req.user.name);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Org Profile Created', objectType: 'organization_profile', objectId: id, objectName: name, detail: profile_type, ip: req.ip });
  res.status(201).json({ profile: db.prepare('SELECT * FROM organization_profiles WHERE id = ?').get(id) });
});

adminRoutes.put('/organization-profiles/:id', (req, res) => {
  const db = getDB();
  const { value_str } = req.body;
  const p = db.prepare('SELECT * FROM organization_profiles WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if(!p) return res.status(404).json({ error:'Not found' });
  db.prepare('UPDATE organization_profiles SET value_str = ? WHERE id = ? AND tenant_id = ?')
    .run(value_str || '', req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Org Profile Updated', objectType: 'organization_profile', objectId: req.params.id, objectName: p.name, ip: req.ip });
  res.json({ message: 'Organization profile updated', profile: db.prepare('SELECT * FROM organization_profiles WHERE id = ?').get(req.params.id) });
});

/**
 * Folders routes
 */
export const folderRoutes = R();
folderRoutes.use(requireAuth);

folderRoutes.get('/', (req, res) => {
  const db = getDB();
  const { studyId } = req.query;
  if (!studyId) return res.status(400).json({ error: 'studyId required' });
  const folders = db.prepare('SELECT * FROM folder_configs WHERE study_id = ? AND tenant_id = ?').all(studyId, req.tenantId);
  res.json({ folders });
});

folderRoutes.post('/', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { studyId, path, allowedGroups, distList } = req.body;
  if (!studyId || !path) return res.status(400).json({ error: 'studyId and path required' });
  const id = uuid();
  try {
    db.prepare('INSERT INTO folder_configs (id, tenant_id, study_id, path, allowed_groups, dist_list) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.tenantId, studyId, path, JSON.stringify(allowedGroups || []), JSON.stringify(distList || []));
    appendAudit({ tenantId: req.tenantId, studyId, userId: req.user.id, userName: req.user.name, action: 'Folder Configured', objectType: 'folder', objectId: id, detail: path, ip: req.ip });
    res.status(201).json({ folder: db.prepare('SELECT * FROM folder_configs WHERE id = ?').get(id) });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Folder path already configured' });
    res.status(500).json({ error: 'Database error' });
  }
});

folderRoutes.patch('/:id/lock', requireCap('canLock'), (req, res) => {
  const db = getDB();
  const { locked } = req.body;
  const folder = db.prepare('SELECT * FROM folder_configs WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  
  const isLocked = locked ? 1 : 0;
  db.prepare(`UPDATE folder_configs SET locked = ?, locked_by = ?, locked_at = ${isLocked ? "datetime('now')" : "NULL"} WHERE id = ?`)
    .run(isLocked, isLocked ? req.user.id : null, req.params.id);
  
  appendAudit({ tenantId: req.tenantId, studyId: folder.study_id, userId: req.user.id, userName: req.user.name, action: isLocked ? 'Folder Locked' : 'Folder Unlocked', objectType: 'folder', objectId: req.params.id, detail: folder.path, ip: req.ip });
  res.json({ message: `Folder ${isLocked ? 'locked' : 'unlocked'}`, folder: db.prepare('SELECT * FROM folder_configs WHERE id = ?').get(req.params.id) });
});

folderRoutes.patch('/:id/groups', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { allowedGroups } = req.body;
  db.prepare('UPDATE folder_configs SET allowed_groups = ? WHERE id = ? AND tenant_id = ?').run(JSON.stringify(allowedGroups || []), req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Folder Groups Updated', objectType: 'folder', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Folder groups updated' });
});

folderRoutes.patch('/:id/distribute', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { distList } = req.body;
  db.prepare('UPDATE folder_configs SET dist_list = ? WHERE id = ? AND tenant_id = ?').run(JSON.stringify(distList || []), req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Distribution List Updated', objectType: 'folder', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Distribution list updated' });
});

folderRoutes.get('/:id/history', (req, res) => {
  const db = getDB();
  const logs = db.prepare('SELECT * FROM audit_log WHERE object_type = ? AND object_id = ? AND tenant_id = ? ORDER BY created_at DESC').all('folder', req.params.id, req.tenantId);
  res.json({ history: logs });
});

folderRoutes.get('/:id/inventory', (req, res) => {
  const db = getDB();
  const folder = db.prepare('SELECT * FROM folder_configs WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  
  const [zone, section] = folder.path.split('/');
  const docCount = db.prepare('SELECT COUNT(*) as c FROM documents WHERE study_id = ? AND zone = ? AND section = ? AND tenant_id = ?').get(folder.study_id, zone, section || '', req.tenantId).c;
  const approvedCount = db.prepare("SELECT COUNT(*) as c FROM documents WHERE study_id = ? AND zone = ? AND section = ? AND status = 'Approved' AND tenant_id = ?").get(folder.study_id, zone, section || '', req.tenantId).c;
  
  res.json({ inventory: { total: docCount, approved: approvedCount, pending: docCount - approvedCount } });
});
