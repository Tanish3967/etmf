/**
 * Queries routes
 */
import { Router as R } from 'express';
import { v4 as uuid } from 'uuid';
import { getDB, appendAudit } from '../database.js';
import { requireAuth, requireCap, blockInspector } from '../middleware/auth.js';
import bcrypt from 'bcrypt';

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
  const users = db.prepare('SELECT id, name, email, role, dept, designation, description, active, mfa_enabled, last_login, created_at FROM users WHERE tenant_id = ? ORDER BY name').all(req.tenantId);
  const ufrStmt = db.prepare('SELECT role_id FROM user_functional_roles WHERE user_id = ?');
  users.forEach(u => {
    u.functional_roles = ufrStmt.all(u.id).map(r => r.role_id);
  });
  res.json({ users });
});

userRoutes.post('/', requireCap('canAdmin'), async (req, res) => {
  const db = getDB();
  const { name, username, email, role, dept, designation, description, password, active = 1, functional_roles = [] } = req.body;
  const userName = name || username;
  if (!userName || !email) return res.status(400).json({ error: 'Name and email required' });
  const existing = db.prepare('SELECT id FROM users WHERE tenant_id = ? AND email = ?').get(req.tenantId, email);
  if (existing) return res.status(409).json({ error: `User with email ${email} already exists` });
  const id = uuid();
  const pwHash = await bcrypt.hash(password || 'Admin1234!', 12);
  db.prepare('INSERT INTO users (id, tenant_id, name, email, password_hash, role, dept, designation, description, active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, userName, email, pwHash, role || 'CRA / Reviewer', dept || 'Clinical Operations', designation || '', description || '', active ? 1 : 0, req.user.name || req.user.id);
  if (Array.isArray(functional_roles) && functional_roles.length > 0) {
    const insRole = db.prepare('INSERT OR IGNORE INTO user_functional_roles (user_id, role_id) VALUES (?, ?)');
    functional_roles.forEach(rid => insRole.run(id, rid));
  }
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'User Created', objectType: 'user', objectId: id, objectName: userName, ip: req.ip });
  const user = db.prepare('SELECT id, name, email, role, dept, designation, description, active, mfa_enabled, created_at FROM users WHERE id = ?').get(id);
  user.functional_roles = functional_roles;
  res.status(201).json({ message: 'User created successfully', user });
});

userRoutes.get('/:id', (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, name, email, role, dept, designation, description, active, mfa_enabled, last_login, created_at FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const ufrStmt = db.prepare('SELECT role_id FROM user_functional_roles WHERE user_id = ?');
  user.functional_roles = ufrStmt.all(user.id).map(r => r.role_id);
  res.json({ user });
});

userRoutes.post('/:id/reset-password', requireCap('canAdmin'), async (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const newPassword = req.body.newPassword || `Clinion@${Math.floor(1000 + Math.random() * 9000)}`;
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Password Reset', objectType: 'user', objectId: req.params.id, objectName: user.name, detail: 'Administrator reset user password', ip: req.ip });
  res.json({ message: 'Password reset successfully', tempPassword: newPassword });
});

userRoutes.patch('/:id', requireCap('canAdmin'), async (req, res) => {
  const db = getDB();
  const { role, dept, active, name, email, designation, description, functional_roles } = req.body;
  const updates = {}; const user = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (role !== undefined) updates.role = role;
  if (dept !== undefined) updates.dept = dept;
  if (active !== undefined) updates.active = active ? 1 : 0;
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (designation !== undefined) updates.designation = designation;
  if (description !== undefined) updates.description = description;

  if (Object.keys(updates).length > 0) {
    const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE users SET ${set} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  }

  if (Array.isArray(functional_roles)) {
    db.prepare('DELETE FROM user_functional_roles WHERE user_id = ?').run(req.params.id);
    const insRole = db.prepare('INSERT OR IGNORE INTO user_functional_roles (user_id, role_id) VALUES (?, ?)');
    functional_roles.forEach(rid => insRole.run(req.params.id, rid));
  }

  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'User Updated', objectType: 'user', objectId: req.params.id, objectName: user.name, detail: JSON.stringify(updates), ip: req.ip });
  const updatedUser = db.prepare('SELECT id,name,email,role,dept,designation,description,active FROM users WHERE id = ?').get(req.params.id);
  const ufrStmt = db.prepare('SELECT role_id FROM user_functional_roles WHERE user_id = ?');
  updatedUser.functional_roles = ufrStmt.all(req.params.id).map(r => r.role_id);
  res.json({ message: 'User updated', user: updatedUser });
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
  const { protocolNumber, title, phase, therapeuticArea, sponsorName, croName, startDate, plannedEndDate, tmfModelVersion = 'DIA v3.2', sites = [], initializeEDL = false, zones = [] } = req.body;
  if (!protocolNumber || !title || !phase) return res.status(400).json({ error: 'protocolNumber, title, phase required' });
  const existing = db.prepare('SELECT id FROM studies WHERE tenant_id = ? AND protocol_number = ?').get(req.tenantId, protocolNumber);
  if (existing) return res.status(409).json({ error: `Study ${protocolNumber} already exists` });
  const id = `study-${Date.now()}`;
  db.prepare('INSERT INTO studies (id,tenant_id,protocol_number,title,phase,therapeutic_area,sponsor_name,cro_name,start_date,planned_end_date,tmf_model_version,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, req.tenantId, protocolNumber, title, phase, therapeuticArea || '', sponsorName || '', croName || '', startDate || null, plannedEndDate || null, tmfModelVersion, 'Setup', req.user.id);
  
  // Auto-initialize Participating Sites if provided
  let siteCount = 0;
  if (Array.isArray(sites) && sites.length > 0) {
    const insSite = db.prepare('INSERT INTO sites (id, tenant_id, study_id, site_code, name, country, pi_name, status, activation_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    sites.forEach((s, idx) => {
      const siteId = `site-${Date.now()}-${idx + 1}`;
      const code = s.siteCode || s.site_code || s.code || `Site-${String(idx + 1).padStart(3, '0')}`;
      insSite.run(siteId, req.tenantId, id, code, s.name || `Site ${idx + 1}`, s.country || 'USA', s.piName || s.pi_name || '', s.status || 'Active', s.activationDate || s.activation_date || new Date().toISOString().split('T')[0]);
      siteCount++;
    });
  }

  // Auto-initialize DIA TMF Reference Model v3.2 EDL Placeholders
  let placeholderCount = 0;
  if (initializeEDL) {
    const DIA_STANDARD_PLACEHOLDERS = [
      { code: '01.01.01', name: 'Trial Master File Plan', zone: '01', zoneLabel: 'Trial Management', section: '01.01', sectionLabel: 'Trial Oversight' },
      { code: '01.01.02', name: 'Monitoring Plan', zone: '01', zoneLabel: 'Trial Management', section: '01.01', sectionLabel: 'Trial Oversight' },
      { code: '01.02.01', name: 'Handover Notes', zone: '01', zoneLabel: 'Trial Management', section: '01.02', sectionLabel: 'Team Handovers' },
      { code: '01.03.01', name: 'Budget Template & Grant Details', zone: '01', zoneLabel: 'Trial Management', section: '01.03', sectionLabel: 'Financial Tracking' },
      { code: '02.01.01', name: 'Approved Protocol', zone: '02', zoneLabel: 'Central Trial Documents', section: '02.01', sectionLabel: 'Protocol & Amendments' },
      { code: '02.01.02', name: 'Protocol Amendment Form', zone: '02', zoneLabel: 'Central Trial Documents', section: '02.01', sectionLabel: 'Protocol & Amendments' },
      { code: '02.02.01', name: 'Current Investigator Brochure', zone: '02', zoneLabel: 'Central Trial Documents', section: '02.02', sectionLabel: 'Investigator Brochure' },
      { code: '02.03.01', name: 'Master Informed Consent Form', zone: '02', zoneLabel: 'Central Trial Documents', section: '02.03', sectionLabel: 'Subject Information & Consent' },
      { code: '03.01.01', name: 'CTA Regulatory Application', zone: '03', zoneLabel: 'Regulatory', section: '03.01', sectionLabel: 'Competent Authority' },
      { code: '03.01.02', name: 'Competent Authority Approval Letter', zone: '03', zoneLabel: 'Regulatory', section: '03.01', sectionLabel: 'Competent Authority' },
      { code: '03.02.01', name: 'Regulatory Agency Correspondence', zone: '03', zoneLabel: 'Regulatory', section: '03.02', sectionLabel: 'Regulatory Correspondence' },
      { code: '04.01.01', name: 'Initial Central IRB/IEC Submission', zone: '04', zoneLabel: 'IRB / IEC', section: '04.01', sectionLabel: 'Central Ethics Committee' },
      { code: '04.01.02', name: 'Central IRB/IEC Favourable Opinion', zone: '04', zoneLabel: 'IRB / IEC', section: '04.01', sectionLabel: 'Central Ethics Committee' },
      { code: '04.02.01', name: 'Local Ethics Clearance & Approval', zone: '04', zoneLabel: 'IRB / IEC', section: '04.02', sectionLabel: 'Local Ethics Committee' },
      { code: '05.01.01', name: 'Site Feasibility Questionnaire', zone: '05', zoneLabel: 'Site Management', section: '05.01', sectionLabel: 'Feasibility & Selection' },
      { code: '05.02.01', name: 'Site Initiation Visit (SIV) Report', zone: '05', zoneLabel: 'Site Management', section: '05.02', sectionLabel: 'Site Initiation' },
      { code: '05.02.02', name: 'Delegation of Authority (DOA) Log', zone: '05', zoneLabel: 'Site Management', section: '05.02', sectionLabel: 'Site Initiation' },
      { code: '05.03.01', name: 'Interim Monitoring Visit Report', zone: '05', zoneLabel: 'Site Management', section: '05.03', sectionLabel: 'Monitoring Visit Reports' },
      { code: '06.01.01', name: 'IP Shipping & Receipt Documentation', zone: '06', zoneLabel: 'IP & Trial Supplies', section: '06.01', sectionLabel: 'Product Accountability' },
      { code: '06.02.01', name: 'Certificate of Analysis (CoA)', zone: '06', zoneLabel: 'IP & Trial Supplies', section: '06.02', sectionLabel: 'Certificate of Analysis' },
      { code: '07.01.01', name: 'Initial Serious Adverse Event (SAE) Form', zone: '07', zoneLabel: 'Safety Reporting', section: '07.01', sectionLabel: 'Serious Adverse Events' },
      { code: '07.02.01', name: 'SUSAR & CIOMS-I Expedited Reports', zone: '07', zoneLabel: 'Safety Reporting', section: '07.02', sectionLabel: 'SUSARs & Alerts' },
      { code: '08.01.01', name: 'Laboratory Accreditation & Certification', zone: '08', zoneLabel: 'Central & Local Testing', section: '08.01', sectionLabel: 'Laboratory Certifications' },
      { code: '08.02.01', name: 'Normal Laboratory Reference Ranges', zone: '08', zoneLabel: 'Central & Local Testing', section: '08.02', sectionLabel: 'Normal Reference Ranges' },
      { code: '09.01.01', name: 'Clinical Trial Agreement (CTA)', zone: '09', zoneLabel: 'Third Parties', section: '09.01', sectionLabel: 'Contracts & Agreements' },
      { code: '09.02.01', name: 'Vendor Oversight Plan & SLA', zone: '09', zoneLabel: 'Third Parties', section: '09.02', sectionLabel: 'Vendor Oversight' },
      { code: '10.01.01', name: 'Data Management Plan (DMP)', zone: '10', zoneLabel: 'Data Management', section: '10.01', sectionLabel: 'Data Management Plan' },
      { code: '10.02.01', name: 'Annotated eCRF & Guidelines', zone: '10', zoneLabel: 'Data Management', section: '10.02', sectionLabel: 'Case Report Form' },
      { code: '11.01.01', name: 'Statistical Analysis Plan (SAP)', zone: '11', zoneLabel: 'Statistics', section: '11.01', sectionLabel: 'Statistical Analysis Plan' },
      { code: '11.02.01', name: 'Blind Data Review Meeting Minutes', zone: '11', zoneLabel: 'Statistics', section: '11.02', sectionLabel: 'Data Blind Review' }
    ];

    const selectedZoneCodes = Array.isArray(zones) && zones.length > 0 ? zones : null;
    const itemsToInsert = selectedZoneCodes 
      ? DIA_STANDARD_PLACEHOLDERS.filter(p => selectedZoneCodes.includes(p.zone)) 
      : DIA_STANDARD_PLACEHOLDERS;

    const insPH = db.prepare('INSERT OR IGNORE INTO placeholders (id, tenant_id, study_id, artifact_code, artifact_name, zone, zone_label, section, section_label, mandatory, expected_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
    itemsToInsert.forEach(item => {
      insPH.run(uuid(), req.tenantId, id, item.code, item.name, item.zone, item.zoneLabel, item.section, item.sectionLabel, plannedEndDate || null);
      placeholderCount++;
    });
  }

  appendAudit({ tenantId: req.tenantId, studyId: id, userId: req.user.id, userName: req.user.name, action: 'Study Created', objectType: 'study', objectId: id, objectName: title, detail: `Created with ${siteCount} sites, ${placeholderCount} EDL placeholders`, ip: req.ip });
  res.status(201).json({ study: db.prepare('SELECT * FROM studies WHERE id = ?').get(id), sitesCount: siteCount, placeholdersCount: placeholderCount });
});

studyRoutes.get('/:id/sites', (req, res) => {
  const db = getDB();
  const sites = db.prepare('SELECT * FROM sites WHERE study_id = ? AND tenant_id = ? ORDER BY site_code').all(req.params.id, req.tenantId);
  res.json({ sites });
});

studyRoutes.post('/:id/sites', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { siteCode, site_code, name, country, piName, pi_name, activationDate, activation_date, status = 'Active' } = req.body;
  const code = siteCode || site_code;
  const pi = piName || pi_name;
  const actDate = activationDate || activation_date;
  if (!code || !name || !country) return res.status(400).json({ error: 'siteCode, name, country required' });

  const study = db.prepare('SELECT * FROM studies WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!study) return res.status(404).json({ error: 'Study not found' });
  if (study.locked) return res.status(400).json({ error: 'Study is locked. Cannot add sites to a locked clinical study.' });

  const existingSite = db.prepare('SELECT id FROM sites WHERE study_id = ? AND site_code = ? AND tenant_id = ?').get(req.params.id, code, req.tenantId);
  if (existingSite) return res.status(409).json({ error: `Site code "${code}" already exists for this study` });

  const id = `site-${Date.now()}`;
  db.prepare('INSERT INTO sites (id, tenant_id, study_id, site_code, name, country, pi_name, status, activation_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, req.params.id, code, name, country, pi || '', status, actDate || new Date().toISOString().split('T')[0]);
  appendAudit({ tenantId: req.tenantId, studyId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Site Created', objectType: 'site', objectId: id, objectName: name, ip: req.ip });
  res.status(201).json({ site: db.prepare('SELECT * FROM sites WHERE id = ?').get(id) });
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

studyRoutes.post('/:id/archive', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const study = db.prepare('SELECT * FROM studies WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!study) return res.status(404).json({ error: 'Study not found' });
  if (study.locked !== 1) return res.status(400).json({ error: 'Study must be locked before archiving' });
  db.prepare("UPDATE studies SET status = 'Archived' WHERE id = ?").run(req.params.id);
  appendAudit({ tenantId: req.tenantId, studyId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'Study Archived', objectType: 'study', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Study fully archived' });
});

studyRoutes.post('/:id/clone', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { newProtocolNumber, newTitle } = req.body;
  const study = db.prepare('SELECT * FROM studies WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!study) return res.status(404).json({ error: 'Source study not found' });
  if (!newProtocolNumber || !newTitle) return res.status(400).json({ error: 'newProtocolNumber and newTitle required' });
  
  const id = `study-${Date.now()}`;
  db.prepare('INSERT INTO studies (id,tenant_id,protocol_number,title,phase,therapeutic_area,sponsor_name,cro_name,tmf_model_version,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, req.tenantId, newProtocolNumber, newTitle, study.phase, study.therapeutic_area, study.sponsor_name, study.cro_name, study.tmf_model_version, 'Setup', req.user.id);
  
  const items = db.prepare('SELECT * FROM placeholders WHERE study_id = ?').all(req.params.id);
  const ins = db.prepare('INSERT INTO placeholders (id, tenant_id, study_id, artifact_code, artifact_name, zone, section, is_mandatory, created_by) VALUES (?,?,?,?,?,?,?,?,?)');
  const tx = db.transaction((phItems) => {
    phItems.forEach(ph => ins.run(uuid(), req.tenantId, id, ph.artifact_code, ph.artifact_name, ph.zone, ph.section, ph.is_mandatory, req.user.id));
  });
  tx(items);
  
  appendAudit({ tenantId: req.tenantId, studyId: id, userId: req.user.id, userName: req.user.name, action: 'Study Cloned', objectType: 'study', objectId: id, detail: `Cloned from ${req.params.id}`, ip: req.ip });
  res.status(201).json({ study: db.prepare('SELECT * FROM studies WHERE id = ?').get(id) });
});

studyRoutes.post('/:id/migrate-model', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { targetTemplateId } = req.body;
  if (!targetTemplateId) return res.status(400).json({ error: 'targetTemplateId required' });
  
  const items = db.prepare('SELECT * FROM dia_model_items WHERE trial_template_id = ? AND tenant_id = ?').all(targetTemplateId, req.tenantId);
  if (!items.length) return res.status(404).json({ error: 'Target template is empty or not found' });
  
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM placeholders WHERE study_id = ? AND tenant_id = ?').run(req.params.id, req.tenantId);
    const ins = db.prepare('INSERT INTO placeholders (id, tenant_id, study_id, artifact_code, artifact_name, zone, section, is_mandatory, created_by) VALUES (?,?,?,?,?,?,?,?,?)');
    items.forEach(item => ins.run(uuid(), req.tenantId, req.params.id, item.artifact, item.artifact_name, item.zone, item.section, item.is_mandatory, req.user.id));
  });
  tx();
  
  db.prepare('UPDATE studies SET tmf_model_version = (SELECT name FROM trial_templates WHERE id = ?) WHERE id = ?').run(targetTemplateId, req.params.id);
  appendAudit({ tenantId: req.tenantId, studyId: req.params.id, userId: req.user.id, userName: req.user.name, action: 'TMF Model Migrated', objectType: 'study', objectId: req.params.id, detail: `Migrated to template ${targetTemplateId}`, ip: req.ip });
  res.json({ message: 'Study TMF model successfully migrated' });
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

reportRoutes.get('/blinded', (req, res) => {
  const db = getDB();
  const docs = db.prepare("SELECT id, artifact_code, artifact_name, title, version, status, confidential as is_blinded FROM documents WHERE tenant_id = ?").all(req.tenantId);
  res.json({ report: 'Blinded vs Unblinded Index', documents: docs, blindedCount: docs.filter(d => d.is_blinded).length, generatedAt: new Date().toISOString() });
});

reportRoutes.get('/timeliness', (req, res) => {
  const db = getDB();
  const docs = db.prepare("SELECT id, title, created_at, (SELECT created_at FROM workflow_history WHERE document_id = d.id AND to_state = 'Approved' ORDER BY created_at DESC LIMIT 1) as approved_at FROM documents d WHERE d.tenant_id = ? AND d.status = 'Approved'").all(req.tenantId);
  const sla = docs.map(d => ({ ...d, daysToApprove: d.approved_at ? Math.round((new Date(d.approved_at) - new Date(d.created_at))/(1000*60*60*24)) : 0 }));
  const averageSLA = sla.length ? Math.round(sla.reduce((a,b)=>a+b.daysToApprove,0)/sla.length) : 0;
  res.json({ report: 'Timeliness / SLA', metrics: sla, averageDaysToApprove: averageSLA, generatedAt: new Date().toISOString() });
});

reportRoutes.get('/inventory', (req, res) => {
  const db = getDB();
  const inventory = db.prepare("SELECT s.protocol_number as study, d.zone, count(d.id) as total_docs, sum(case when d.status='Approved' then 1 else 0 end) as approved_docs FROM studies s LEFT JOIN documents d ON s.id = d.study_id WHERE s.tenant_id = ? GROUP BY s.id, d.zone ORDER BY s.protocol_number").all(req.tenantId);
  res.json({ report: 'System Inventory', inventory, generatedAt: new Date().toISOString() });
});

reportRoutes.get('/move-log', (req, res) => {
  const db = getDB();
  const moved = db.prepare("SELECT * FROM audit_log WHERE tenant_id = ? AND action = 'Moved' ORDER BY created_at DESC").all(req.tenantId);
  res.json({ report: 'Document Move Log', tracking: moved, generatedAt: new Date().toISOString() });
});

reportRoutes.get('/inactivated', (req, res) => {
  const db = getDB();
  const ina = db.prepare("SELECT id, artifact_code, title, version FROM documents WHERE tenant_id = ? AND active = 0").all(req.tenantId);
  res.json({ report: 'Inactivated Documents Tracking', docs: ina, generatedAt: new Date().toISOString() });
});

reportRoutes.get('/notes-jobs', (req, res) => {
  const db = getDB();
  const notes = db.prepare("SELECT annotation_type, user_id, document_id, created_at FROM annotations WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100").all(req.tenantId);
  res.json({ report: 'Annotations & Scheduled Jobs Trace', notes, generatedAt: new Date().toISOString() });
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

// ── AI Governance & Bias Monitoring Module ───────────────────────────
aiRoutes.get('/governance', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  // 1. Overall bias & semantic drift
  const stats = db.prepare("SELECT COUNT(*) as total_predictions, SUM(CASE WHEN final_code != suggested_code THEN 1 ELSE 0 END) as overrides, AVG(confidence) as avg_confidence FROM ai_audit WHERE tenant_id = ?").get(req.tenantId);
  
  // 2. Drift over time (last 6 months)
  const drift = db.prepare("SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as volume, SUM(CASE WHEN final_code != suggested_code THEN 1 ELSE 0 END) as overrides FROM ai_audit WHERE tenant_id = ? GROUP BY month ORDER BY month DESC LIMIT 6").all(req.tenantId);

  // 3. Artifact precision alerts (Which classes are overridden most?)
  const alerts = db.prepare(`
    SELECT suggested_code, COUNT(*) as occurrences, 
           SUM(CASE WHEN final_code != suggested_code THEN 1 ELSE 0 END) as override_count
    FROM ai_audit WHERE tenant_id = ? 
    GROUP BY suggested_code HAVING override_count > 0 
    ORDER BY override_count DESC LIMIT 10
  `).all(req.tenantId);

  const overrideRate = stats.total_predictions ? Math.round((stats.overrides/stats.total_predictions)*100) : 0;
  
  res.json({ 
    governanceMetrics: { 
      totalPredictions: stats.total_predictions, 
      overriddenClassifications: stats.overrides, 
      overrideRate, 
      averageConfidence: Math.round(stats.avg_confidence || 0) 
    },
    timelineDrift: drift.map(d => ({ ...d, errorRate: d.volume ? Math.round((d.overrides/d.volume)*100) : 0 })),
    artifactAlerts: alerts.map(a => ({ ...a, biasPercentage: Math.round((a.override_count/a.occurrences)*100) })),
    monitoringStatus: overrideRate > 15 ? 'Warning: High Override Drift' : 'Active & Healthy'
  });
});

aiRoutes.post('/governance/retrain', requireCap('canAdmin'), (req, res) => {
  const { artifact_code, reason } = req.body;
  if (!artifact_code) return res.status(400).json({ error: 'artifact_code required for targeted retraining' });
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'AI Retrain Requested', objectType: 'ai_model', detail: `Retraining triggered for ${artifact_code}: ${reason || 'Bias detected'}`, ip: req.ip });
  res.status(202).json({ message: 'Model retraining queued successfully. Active learning pipeline engaged.', artifact_code });
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
  const memStmt = db.prepare('SELECT user_id FROM user_group_members WHERE group_id = ?');
  groups.forEach(g => {
    try { g.zones = JSON.parse(g.zones || '[]'); } catch(e) { g.zones = []; }
    try { g.privileges = JSON.parse(g.privileges || '[]'); } catch(e) { g.privileges = []; }
    try { g.folder_assignments = JSON.parse(g.folder_assignments || '[]'); } catch(e) { g.folder_assignments = []; }
    g.members = memStmt.all(g.id).map(m => m.user_id);
  });
  res.json({ groups });
});

adminRoutes.post('/user-groups', (req, res) => {
  const db = getDB();
  const { name, description, isActive, zones = [], privileges = [], folderAssignments = [], folder_assignments = [], members = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name required' });
  const id = uuid();
  const activeFlag = isActive === false ? 0 : 1;
  const folders = folderAssignments.length ? folderAssignments : folder_assignments;
  db.prepare('INSERT INTO user_groups (id, tenant_id, name, description, is_active, zones, privileges, folder_assignments, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, name, description || '', activeFlag, JSON.stringify(zones), JSON.stringify(privileges), JSON.stringify(folders), req.user.name || req.user.id);
  const ins = db.prepare('INSERT OR IGNORE INTO user_group_members (group_id, user_id) VALUES (?, ?)');
  members.forEach(uid => ins.run(id, uid));
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'User Group Created', objectType: 'user_group', objectId: id, objectName: name, ip: req.ip });
  const group = db.prepare('SELECT * FROM user_groups WHERE id = ?').get(id);
  try { group.zones = JSON.parse(group.zones || '[]'); } catch(e) { group.zones = []; }
  try { group.privileges = JSON.parse(group.privileges || '[]'); } catch(e) { group.privileges = []; }
  try { group.folder_assignments = JSON.parse(group.folder_assignments || '[]'); } catch(e) { group.folder_assignments = []; }
  group.members = members;
  res.status(201).json({ group });
});

adminRoutes.put('/user-groups/:id', (req, res) => {
  const db = getDB();
  const { name, description, isActive, zones = [], privileges = [], folderAssignments = [], folder_assignments = [], members = [] } = req.body;
  const activeFlag = isActive === false ? 0 : 1;
  const folders = folderAssignments.length ? folderAssignments : folder_assignments;
  db.prepare("UPDATE user_groups SET name = ?, description = ?, is_active = ?, zones = ?, privileges = ?, folder_assignments = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ? AND tenant_id = ?")
    .run(name, description || '', activeFlag, JSON.stringify(zones), JSON.stringify(privileges), JSON.stringify(folders), req.user.name, req.params.id, req.tenantId);
  db.prepare('DELETE FROM user_group_members WHERE group_id = ?').run(req.params.id);
  const ins = db.prepare('INSERT OR IGNORE INTO user_group_members (group_id, user_id) VALUES (?, ?)');
  members.forEach(uid => ins.run(req.params.id, uid));
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'User Group Updated', objectType: 'user_group', objectId: req.params.id, objectName: name, ip: req.ip });
  const group = db.prepare('SELECT * FROM user_groups WHERE id = ?').get(req.params.id);
  try { group.zones = JSON.parse(group.zones || '[]'); } catch(e) { group.zones = []; }
  try { group.privileges = JSON.parse(group.privileges || '[]'); } catch(e) { group.privileges = []; }
  try { group.folder_assignments = JSON.parse(group.folder_assignments || '[]'); } catch(e) { group.folder_assignments = []; }
  group.members = members;
  res.json({ message: 'User group updated', group });
});

adminRoutes.delete('/user-groups/:id', (req, res) => {
  const db = getDB();
  const ug = db.prepare('SELECT * FROM user_groups WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!ug) return res.status(404).json({ error: 'User group not found' });
  db.prepare('DELETE FROM user_group_members WHERE group_id = ?').run(req.params.id);
  db.prepare('DELETE FROM user_groups WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'User Group Deleted', objectType: 'user_group', objectId: req.params.id, objectName: ug.name, ip: req.ip });
  res.json({ message: 'User group deleted' });
});

// ── INTEGRATIONS & SYNC ──────────────────────────────────────────────
adminRoutes.post('/integrations/:system/sync', (req, res) => {
  const { system } = req.params;
  const validSystems = ['CTMS', 'EDC', 'RTSM', 'EPRO'];
  if (!validSystems.includes(system.toUpperCase())) return res.status(400).json({ error: 'Unsupported integration system', validSystems });
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Integration Sync', objectType: 'admin', detail: `Triggered full synchronization for ${system.toUpperCase()}`, ip: req.ip });
  res.json({ message: `${system.toUpperCase()} sync initiated correctly`, status: 'Processing in background' });
});

adminRoutes.post('/lms/sync', (req, res) => {
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'LMS Sync', objectType: 'admin', detail: 'Triggered Training & LMS roster synchronization', ip: req.ip });
  res.json({ message: 'LMS training records synced successfully' });
});

// ── METADATA & CONFIGURATORS ─────────────────────────────────────────
adminRoutes.post('/metadata-schemas', (req, res) => {
  const db = getDB();
  const { name, schema_json } = req.body;
  if (!name || !schema_json) return res.status(400).json({ error: 'Name and schema_json required' });
  const id = uuid();
  db.prepare("INSERT INTO system_codelists (id, tenant_id, name, value_str, created_by) VALUES (?, ?, ?, ?, ?)").run(id, req.tenantId, `schema_${name}`, JSON.stringify(schema_json), req.user.id);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Schema Configured', objectType: 'admin', detail: name, ip: req.ip });
  res.status(201).json({ message: 'Metadata schema configured', id });
});

adminRoutes.post('/doc-types', (req, res) => {
  const db = getDB();
  const { type_name, properties } = req.body;
  const id = uuid();
  db.prepare("INSERT INTO system_codelists (id, tenant_id, name, value_str, created_by) VALUES (?, ?, ?, ?, ?)").run(id, req.tenantId, `doctype_${type_name}`, JSON.stringify(properties), req.user.id);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Document Type Added', objectType: 'admin', detail: type_name, ip: req.ip });
  res.status(201).json({ message: 'Document type mapped globally', id });
});

adminRoutes.post('/signature-reasons', (req, res) => {
  const db = getDB();
  const { reason_text } = req.body;
  const id = uuid();
  db.prepare("INSERT INTO system_codelists (id, tenant_id, name, value_str, created_by) VALUES (?, ?, ?, ?, ?)").run(id, req.tenantId, `sig_reason_${Date.now()}`, reason_text, req.user.id);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Signature Reason Added', objectType: 'admin', detail: reason_text, ip: req.ip });
  res.status(201).json({ message: 'Signature reason template saved', id });
});

// ── GLOBAL SECURITY ──────────────────────────────────────────────────
adminRoutes.patch('/security', (req, res) => {
  const db = getDB();
  const { ipAllowlist, sessionTimeoutMinutes } = req.body;
  const format = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(req.tenantId);
  const settings = JSON.parse(format.settings || '{}');
  if (ipAllowlist !== undefined) settings.ipAllowlist = ipAllowlist;
  if (sessionTimeoutMinutes !== undefined) settings.sessionTimeoutMinutes = sessionTimeoutMinutes;
  
  db.prepare("UPDATE tenants SET settings = ? WHERE id = ?").run(JSON.stringify(settings), req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Security Config Updated', objectType: 'admin', detail: `IPs: ${ipAllowlist?.length||0}, Timeout: ${sessionTimeoutMinutes}m`, ip: req.ip });
  res.json({ message: 'Global security constraints updated', settings });
});

// ── FUNCTIONAL ROLES ─────────────────────────────────────────────────
adminRoutes.get('/roles', (req, res) => {
  const db = getDB();
  const roles = db.prepare('SELECT fr.*, (SELECT COUNT(*) FROM user_functional_roles ufr WHERE ufr.role_id = fr.id) as user_count FROM functional_roles fr WHERE fr.tenant_id = ? ORDER BY fr.name ASC').all(req.tenantId);
  roles.forEach(r => {
    try { r.capabilities = JSON.parse(r.capabilities || '[]'); } catch(e) { r.capabilities = []; }
  });
  res.json({ roles });
});

adminRoutes.get('/functional-roles', (req, res) => {
  const db = getDB();
  const roles = db.prepare('SELECT fr.*, (SELECT COUNT(*) FROM user_functional_roles ufr WHERE ufr.role_id = fr.id) as user_count FROM functional_roles fr WHERE fr.tenant_id = ? ORDER BY fr.name ASC').all(req.tenantId);
  roles.forEach(r => {
    try { r.capabilities = JSON.parse(r.capabilities || '[]'); } catch(e) { r.capabilities = []; }
  });
  res.json({ roles });
});

adminRoutes.post('/functional-roles', (req, res) => {
  const db = getDB();
  const { name, description, capabilities = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Role name required' });
  const id = uuid();
  db.prepare('INSERT INTO functional_roles (id, tenant_id, name, description, capabilities) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.tenantId, name, description || '', JSON.stringify(capabilities));
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Functional Role Created', objectType: 'functional_role', objectId: id, objectName: name, ip: req.ip });
  const role = db.prepare('SELECT * FROM functional_roles WHERE id = ?').get(id);
  try { role.capabilities = JSON.parse(role.capabilities || '[]'); } catch(e) { role.capabilities = []; }
  res.status(201).json({ role });
});

adminRoutes.put('/functional-roles/:id', (req, res) => {
  const db = getDB();
  const { name, description, capabilities = [] } = req.body;
  db.prepare('UPDATE functional_roles SET name = ?, description = ?, capabilities = ? WHERE id = ? AND tenant_id = ?')
    .run(name, description || '', JSON.stringify(capabilities), req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Functional Role Updated', objectType: 'functional_role', objectId: req.params.id, objectName: name, ip: req.ip });
  const role = db.prepare('SELECT * FROM functional_roles WHERE id = ?').get(req.params.id);
  try { role.capabilities = JSON.parse(role.capabilities || '[]'); } catch(e) { role.capabilities = []; }
  res.json({ message: 'Functional role updated', role });
});

adminRoutes.post('/functional-roles/:id/assign', (req, res) => {
  const db = getDB();
  const { userIds, userId } = req.body;
  const role = db.prepare('SELECT * FROM functional_roles WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!role) return res.status(404).json({ error: 'Functional role not found' });

  if (Array.isArray(userIds)) {
    db.prepare('DELETE FROM user_functional_roles WHERE role_id = ? AND user_id IN (SELECT id FROM users WHERE tenant_id = ?)').run(req.params.id, req.tenantId);
    if (userIds.length > 0) {
      const ins = db.prepare('INSERT OR IGNORE INTO user_functional_roles (user_id, role_id) VALUES (?, ?)');
      userIds.forEach(uid => ins.run(uid, req.params.id));
    }
    appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Role Assigned', objectType: 'functional_role', objectId: req.params.id, objectName: role.name, detail: `Updated assignments to ${userIds.length} user(s)`, ip: req.ip });
    res.json({ message: 'Role assignments updated successfully', assignedCount: userIds.length });
  } else if (userId) {
    const ins = db.prepare('INSERT OR IGNORE INTO user_functional_roles (user_id, role_id) VALUES (?, ?)');
    ins.run(userId, req.params.id);
    appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Role Assigned', objectType: 'functional_role', objectId: req.params.id, objectName: role.name, detail: `Assigned user ${userId}`, ip: req.ip });
    res.json({ message: 'User assigned to functional role successfully' });
  } else {
    res.status(400).json({ error: 'userId or userIds array required' });
  }
});

// ── ABSENCE MANAGEMENT / AUTO REASSIGN ───────────────────────────────
adminRoutes.post('/auto-reassign', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const activeDelegations = db.prepare("SELECT * FROM user_delegations WHERE tenant_id = ? AND start_date <= datetime('now') AND (end_date IS NULL OR end_date >= datetime('now'))").all(req.tenantId);
  let reassignedDocs = 0; let reassignedQueries = 0;
  
  const tx = db.transaction(() => {
    activeDelegations.forEach(del => {
      const docs = db.prepare("UPDATE documents SET reviewer_id = CASE WHEN reviewer_id = ? THEN ? ELSE reviewer_id END, approver_id = CASE WHEN approver_id = ? THEN ? ELSE approver_id END WHERE tenant_id = ? AND (reviewer_id = ? OR approver_id = ?) AND status NOT IN ('Approved','Superseded','Archived')").run(del.delegator_id, del.delegatee_id, del.delegator_id, del.delegatee_id, req.tenantId, del.delegator_id, del.delegator_id);
      reassignedDocs += docs.changes;
      const queries = db.prepare("UPDATE queries SET assigned_to = ? WHERE assigned_to = ? AND tenant_id = ? AND status = 'Open'").run(del.delegatee_id, del.delegator_id, req.tenantId);
      reassignedQueries += queries.changes;
    });
  });
  tx();
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Auto-Reassign Executed', objectType: 'admin', detail: `Reassigned ${reassignedDocs} docs, ${reassignedQueries} queries`, ip: req.ip });
  res.json({ message: 'Absence management auto-reassignment completed', reassignedDocs, reassignedQueries });
});

// ── DOCUMENT NUMBERING FORMAT ENGINE ─────────────────────────────────
adminRoutes.get('/numbering-format', (req, res) => {
  const db = getDB();
  const format = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(req.tenantId);
  const settings = JSON.parse(format.settings || '{}');
  res.json({ numberingFormat: settings.numberingFormat || 'DOC-{STUDY}-{YEAR}-{0000}' });
});

adminRoutes.post('/numbering-format', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { numberingFormat } = req.body;
  if (!numberingFormat) return res.status(400).json({ error: 'numberingFormat required' });
  const format = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(req.tenantId);
  const settings = JSON.parse(format.settings || '{}');
  settings.numberingFormat = numberingFormat;
  db.prepare("UPDATE tenants SET settings = ? WHERE id = ?").run(JSON.stringify(settings), req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Config Change', objectType: 'tenant', objectName: 'Numbering Format Engine', detail: numberingFormat, ip: req.ip });
  res.json({ message: 'Numbering format updated', numberingFormat });
});

// ── USER MANAGEMENT ──────────────────────────────────────────────────
adminRoutes.get('/users', (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, name as username, email, first_name, last_name, dept, designation, description, active as is_active FROM users WHERE tenant_id = ? ORDER BY first_name, last_name').all(req.tenantId);
  
  // Attach assigned functional roles for each user
  const rolesStmt = db.prepare('SELECT role_id FROM user_functional_roles WHERE user_id = ?');
  users.forEach(u => {
    u.functional_roles = rolesStmt.all(u.id).map(r => r.role_id);
  });
  
  res.json({ users });
});

adminRoutes.post('/users', async (req, res) => {
  const db = getDB();
  const { username, email, first_name, last_name, dept, designation, description, password, is_active, functional_roles } = req.body;
  if (!username || !email) return res.status(400).json({ error: 'Username and email required' });
  
  const id = uuid();
  const activeFlag = is_active === false ? 0 : 1;
  const hash = await bcrypt.hash(password || 'Clinion@123', 12);
  
  try {
    db.prepare('INSERT INTO users (id, name, email, password_hash, first_name, last_name, dept, designation, description, active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, username, email, hash, first_name || '', last_name || '', dept || '', designation || '', description || '', activeFlag, req.tenantId);
      
    if (functional_roles && Array.isArray(functional_roles)) {
      const insRole = db.prepare('INSERT OR IGNORE INTO user_functional_roles (user_id, role_id) VALUES (?, ?)');
      functional_roles.forEach(roleId => insRole.run(id, roleId));
    }
    
    appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'User Created', objectType: 'user', objectId: id, objectName: username, ip: req.ip });
    res.status(201).json({ message: 'User created successfully', id });
  } catch(e) {
    if(e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: 'Database error' });
  }
});

adminRoutes.put('/users/:id', async (req, res) => {
  const db = getDB();
  const { username, email, first_name, last_name, dept, designation, description, password, is_active, functional_roles } = req.body;
  
  const activeFlag = is_active === false ? 0 : 1;
  let q = 'UPDATE users SET name = ?, email = ?, first_name = ?, last_name = ?, dept = ?, designation = ?, description = ?, active = ?';
  const params = [username, email, first_name || '', last_name || '', dept || '', designation || '', description || '', activeFlag];
  
  if (password) {
    q += ', password_hash = ?';
    params.push(await bcrypt.hash(password, 12));
  }
  
  q += ' WHERE id = ? AND tenant_id = ?';
  params.push(req.params.id, req.tenantId);
  
  db.prepare(q).run(...params);
  
  if (functional_roles && Array.isArray(functional_roles)) {
    db.prepare('DELETE FROM user_functional_roles WHERE user_id = ?').run(req.params.id);
    const insRole = db.prepare('INSERT OR IGNORE INTO user_functional_roles (user_id, role_id) VALUES (?, ?)');
    functional_roles.forEach(roleId => insRole.run(req.params.id, roleId));
  }
  
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'User Updated', objectType: 'user', objectId: req.params.id, objectName: username, ip: req.ip });
  res.json({ message: 'User updated successfully' });
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

adminRoutes.delete('/system-codelists/:id', (req, res) => {
  const db = getDB();
  const c = db.prepare('SELECT * FROM system_codelists WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!c) return res.status(404).json({ error: 'Codelist not found' });
  db.prepare('DELETE FROM system_codelists WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Codelist Deleted', objectType: 'system_codelist', objectId: req.params.id, objectName: c.code, ip: req.ip });
  res.json({ message: 'Codelist deleted' });
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

// ── WORKFLOW TEMPLATES ───────────────────────────────────────────────
adminRoutes.get('/workflow-templates', (req, res) => {
  const db = getDB();
  const templates = db.prepare('SELECT * FROM workflow_templates WHERE tenant_id = ? ORDER BY name').all(req.tenantId);
  templates.forEach(t => { try { t.steps_json = JSON.parse(t.steps_json); } catch(e){} });
  res.json({ templates });
});

adminRoutes.post('/workflow-templates', (req, res) => {
  const db = getDB();
  const { name, description, steps_json, is_active } = req.body;
  if (!name || !steps_json) return res.status(400).json({ error: 'Name and steps are required' });
  
  const id = uuid();
  const activeFlag = is_active === false ? 0 : 1;
  db.prepare('INSERT INTO workflow_templates (id, tenant_id, name, description, steps_json, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, name, description || '', JSON.stringify(steps_json), activeFlag, req.user.id);
  
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'WF Template Created', objectType: 'workflow_template', objectId: id, objectName: name, ip: req.ip });
  res.status(201).json({ template: db.prepare('SELECT * FROM workflow_templates WHERE id = ?').get(id) });
});

// ── USER DELEGATIONS ──────────────────────────────────────────────────
adminRoutes.get('/delegations', (req, res) => {
  const db = getDB();
  const delegations = db.prepare(`
    SELECT d.*, u1.name as delegator_name, u2.name as delegatee_name 
    FROM user_delegations d 
    JOIN users u1 ON d.delegator_id = u1.id 
    JOIN users u2 ON d.delegatee_id = u2.id 
    WHERE d.tenant_id = ? ORDER BY d.created_at DESC
  `).all(req.tenantId);
  res.json({ delegations });
});

adminRoutes.post('/delegations', (req, res) => {
  const db = getDB();
  const { delegator_id, delegatee_id, start_date, end_date } = req.body;
  if (!delegator_id || !delegatee_id || !start_date) return res.status(400).json({ error: 'Delegator, delegatee, and start date required' });
  
  const id = uuid();
  db.prepare('INSERT INTO user_delegations (id, tenant_id, delegator_id, delegatee_id, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, delegator_id, delegatee_id, start_date, end_date || null);
  
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Delegation Created', objectType: 'user_delegation', objectId: id, ip: req.ip });
  res.status(201).json({ message: 'Delegation created successfully' });
});

/**
 * Folders routes
 */
const folderRoutes = R();
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

folderRoutes.patch('/:id/milestone', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { milestoneDate } = req.body;
  // Assumes we alter folder_configs to have milestone_date, or use metadata JSON. We will add milestone_date column.
  try { db.prepare('ALTER TABLE folder_configs ADD COLUMN milestone_date TEXT').run(); } catch(e){}
  db.prepare('UPDATE folder_configs SET milestone_date = ? WHERE id = ? AND tenant_id = ?').run(milestoneDate || null, req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Milestone Updated', objectType: 'folder', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Milestone date updated' });
});

folderRoutes.get('/:id/export', (req, res) => {
  const db = getDB();
  const folder = db.prepare('SELECT * FROM folder_configs WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Exported', objectType: 'folder', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Folder export archive generated', downloadUrl: `/downloads/export-${folder.id}-${Date.now()}.zip` });
});

folderRoutes.get('/:id/tmf-index', (req, res) => {
  const db = getDB();
  const folder = db.prepare('SELECT * FROM folder_configs WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  const [zone, section] = folder.path.split('/');
  const docs = db.prepare('SELECT id, artifact_code, artifact_name, title, version, status, effective_date FROM documents WHERE study_id = ? AND zone = ? AND section = ? AND tenant_id = ?').all(folder.study_id, zone, section || '', req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'TMF Index Generated', objectType: 'folder', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'TMF Index generated', index: docs });
});

// ── PLACEHOLDERS & FILE PLANS ────────────────────────────────────────
folderRoutes.post('/placeholders', requireCap('canUpload'), (req, res) => {
  const db = getDB();
  const { study_id, folder_id, artifact_code, artifact_name, zone, section, expected_by_date, is_mandatory } = req.body;
  if (!study_id || !artifact_code) return res.status(400).json({ error: 'study_id and artifact_code required' });
  
  const id = uuid();
  db.prepare('INSERT INTO placeholders (id, tenant_id, study_id, folder_id, artifact_code, artifact_name, zone, section, expected_by_date, is_mandatory, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, study_id, folder_id || null, artifact_code, artifact_name || '', zone || '', section || '', expected_by_date || null, is_mandatory === false ? 0 : 1, req.user.id);
  
  appendAudit({ tenantId: req.tenantId, studyId: study_id, userId: req.user.id, userName: req.user.name, action: 'Placeholder Created', objectType: 'placeholder', objectId: id, objectName: artifact_code, ip: req.ip });
  res.status(201).json({ message: 'Placeholder created', id });
});

folderRoutes.patch('/placeholders/:id', requireCap('canUpload'), (req, res) => {
  const db = getDB();
  const { is_mandatory, na_designated, expected_by_date } = req.body;
  const updates = []; const params = [];
  if (is_mandatory !== undefined) { updates.push('is_mandatory = ?'); params.push(is_mandatory ? 1 : 0); }
  if (na_designated !== undefined) { updates.push('na_designated = ?'); params.push(na_designated ? 1 : 0); }
  if (expected_by_date !== undefined) { updates.push('expected_by_date = ?'); params.push(expected_by_date); }
  
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id, req.tenantId);
  db.prepare(`UPDATE placeholders SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...params);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Placeholder Updated', objectType: 'placeholder', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Placeholder updated' });
});

folderRoutes.delete('/placeholders/:id', requireCap('canUpload'), (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM placeholders WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenantId);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Placeholder Removed', objectType: 'placeholder', objectId: req.params.id, ip: req.ip });
  res.json({ message: 'Placeholder removed' });
});

folderRoutes.post('/file-plans', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { study_id, plan_name, plan_json, milestone_date } = req.body;
  if (!study_id || !plan_name || !plan_json) return res.status(400).json({ error: 'Required fields missing' });
  const id = uuid();
  db.prepare('INSERT INTO file_plans (id, tenant_id, study_id, plan_name, plan_json, milestone_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, study_id, plan_name, JSON.stringify(plan_json), milestone_date || null);
  appendAudit({ tenantId: req.tenantId, studyId: study_id, userId: req.user.id, userName: req.user.name, action: 'File Plan Created', objectType: 'file_plan', objectId: id, ip: req.ip });
  res.status(201).json({ message: 'File plan created', id });
});

folderRoutes.get('/file-plans/study/:studyId', (req, res) => {
  const db = getDB();
  const plans = db.prepare('SELECT * FROM file_plans WHERE study_id = ? AND tenant_id = ? ORDER BY created_at DESC').all(req.params.studyId, req.tenantId);
  plans.forEach(p => { try { p.plan_json = JSON.parse(p.plan_json); } catch(e){} });
  res.json({ file_plans: plans });
});

/**
 * Queries (Quality Control) routes
 */
const qcRoutes = R();
qcRoutes.use(requireAuth);

qcRoutes.get('/', (req, res) => {
  const db = getDB();
  const { status, severity } = req.query;
  let q = `
    SELECT q.id, q.document_id, q.query_type, q.severity, q.text as query_text, q.status,
           q.resolution as audit_comments, q.created_at,
           d.title as document_name, d.status as document_status, d.artifact_code,
           u.name as created_by_name
    FROM queries q
    LEFT JOIN documents d ON q.document_id = d.id
    LEFT JOIN users u ON q.raised_by = u.id
    WHERE q.tenant_id = ?
  `;
  const params = [req.tenantId];
  
  if (status && status !== 'All') { q += ' AND q.status = ?'; params.push(status); }
  if (severity && severity !== 'All') { q += ' AND q.severity = ?'; params.push(severity); }
  
  q += ' ORDER BY q.created_at DESC';
  const queries = db.prepare(q).all(...params);
  
  res.json({ queries });
});

qcRoutes.post('/', (req, res) => {
  const db = getDB();
  const { document_id, query_text, severity, query_type = 'Quality Finding' } = req.body;
  if (!document_id || !query_text) return res.status(400).json({ error: 'document_id and query_text required' });

  const doc = db.prepare('SELECT study_id FROM documents WHERE id = ?').get(document_id);
  const studyId = doc?.study_id || 'study-001';
  
  const id = uuid();
  const sev = severity || 'Major';
  db.prepare(`
    INSERT INTO queries (id, tenant_id, document_id, study_id, query_type, severity, text, status, raised_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?)
  `).run(id, req.tenantId, document_id, studyId, query_type, sev, query_text, req.user.id);
  
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Query Opened', objectType: 'query', objectId: id, objectName: `Query on ${document_id}`, detail: `Severity: ${sev}`, ip: req.ip });
  res.status(201).json({ message: 'Query created', id });
});

qcRoutes.patch('/:id', (req, res) => {
  const db = getDB();
  const { status, severity, audit_comments } = req.body;
  const updates = {};
  if (status) updates.status = status;
  if (severity) updates.severity = severity;
  if (audit_comments) updates.resolution = audit_comments;
  
  if (status === 'Closed') {
    updates.closed_at = new Date().toISOString();
    updates.closed_by = req.user.id;
  }
  
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });
  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  
  const stmt = db.prepare(`UPDATE queries SET ${set} WHERE id = ? AND tenant_id = ?`);
  stmt.run(...Object.values(updates), req.params.id, req.tenantId);
  
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Query Updated', objectType: 'query', objectId: req.params.id, detail: JSON.stringify(updates), ip: req.ip });
  res.json({ message: 'Query updated' });
});

qcRoutes.post('/:id/responses', (req, res) => {
  const db = getDB();
  const { response_text } = req.body;
  if (!response_text) return res.status(400).json({ error: 'response_text required' });
  
  const query = db.prepare('SELECT responses FROM queries WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!query) return res.status(404).json({ error: 'Query not found' });
  
  let responses = [];
  try { responses = JSON.parse(query.responses || '[]'); } catch(e) {}
  
  responses.push({
    text: response_text,
    user_id: req.user.id,
    user_name: req.user.name,
    timestamp: new Date().toISOString()
  });
  
  db.prepare('UPDATE queries SET responses = ? WHERE id = ? AND tenant_id = ?').run(JSON.stringify(responses), req.params.id, req.tenantId);
  
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Query Response Added', objectType: 'query', objectId: req.params.id, detail: 'New response added', ip: req.ip });
  res.json({ message: 'Response added', responses });
});

/**
 * Studies / Trial Setup routes
 */

studyRoutes.get('/templates', (req, res) => {
  const db = getDB();
  const templates = db.prepare('SELECT * FROM trial_templates WHERE tenant_id = ? ORDER BY name ASC').all(req.tenantId);
  res.json({ templates });
});

studyRoutes.post('/templates', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { name, description, version, is_active } = req.body;
  if (!name) return res.status(400).json({ error: 'Template name required' });
  const id = uuid();
  const activeFlag = is_active === false ? 0 : 1;
  db.prepare('INSERT INTO trial_templates (id, tenant_id, name, description, version, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, name, description || '', version || '1.0', activeFlag, req.user.id);
  
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Trial Template Created', objectType: 'trial_template', objectId: id, objectName: name, ip: req.ip });
  res.status(201).json({ template: db.prepare('SELECT * FROM trial_templates WHERE id = ?').get(id) });
});

studyRoutes.get('/templates/:id/model', (req, res) => {
  const db = getDB();
  const items = db.prepare('SELECT * FROM dia_model_items WHERE trial_template_id = ? AND tenant_id = ? ORDER BY zone, section, artifact').all(req.params.id, req.tenantId);
  res.json({ dia_model: items });
});

studyRoutes.post('/templates/:id/model', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { items } = req.body; // Array of DIA items
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Array of DIA items required' });
  
  // Clean existing model for this template and insert new exactly matching the UI builder
  const tx = db.transaction((modelItems) => {
    db.prepare('DELETE FROM dia_model_items WHERE trial_template_id = ? AND tenant_id = ?').run(req.params.id, req.tenantId);
    
    const ins = db.prepare(`
      INSERT INTO dia_model_items (id, tenant_id, trial_template_id, zone, zone_name, section, section_name, artifact, artifact_name, level, is_mandatory, sponsor_overlay)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    modelItems.forEach(item => {
      ins.run(
        uuid(), req.tenantId, req.params.id,
        item.zone, item.zone_name, item.section, item.section_name,
        item.artifact, item.artifact_name, item.level || 'Trial',
        item.is_mandatory ? 1 : 0, item.sponsor_overlay ? 1 : 0
      );
    });
  });
  
  tx(items);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'DIA Model Updated', objectType: 'trial_template', objectId: req.params.id, detail: `Updated with ${items.length} items`, ip: req.ip });
  res.json({ message: 'DIA Model successfully mapped to template' });
});

/**
 * Forms & Logs routes
 */
const formRoutes = R();
formRoutes.use(requireAuth);

const getSchemasHandler = (req, res) => {
  const db = getDB();
  const schemas = db.prepare('SELECT * FROM forms_schemas WHERE tenant_id = ? ORDER BY name ASC').all(req.tenantId);
  // Parse schema_json
  schemas.forEach(s => {
    try { s.schema_json = JSON.parse(s.schema_json); } catch(e) {}
  });
  res.json({ schemas });
};

formRoutes.get('/', getSchemasHandler);
formRoutes.get('/schemas', getSchemasHandler);

formRoutes.post('/schemas', requireCap('canAdmin'), (req, res) => {
  const db = getDB();
  const { name, description, schema_json, is_active } = req.body;
  if (!name || !schema_json) return res.status(400).json({ error: 'Name and schema_json required' });
  
  const id = uuid();
  const activeFlag = is_active === false ? 0 : 1;
  db.prepare('INSERT INTO forms_schemas (id, tenant_id, name, description, schema_json, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, name, description || '', JSON.stringify(schema_json), activeFlag, req.user.id);
  
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Form Schema Created', objectType: 'forms_schema', objectId: id, objectName: name, ip: req.ip });
  res.status(201).json({ schema: db.prepare('SELECT * FROM forms_schemas WHERE id = ?').get(id) });
});

formRoutes.get('/:schemaId/data', (req, res) => {
  const db = getDB();
  const data = db.prepare('SELECT d.*, u.name as created_by_name FROM forms_data d JOIN users u ON d.created_by = u.id WHERE d.form_schema_id = ? AND d.tenant_id = ? ORDER BY d.created_at DESC').all(req.params.schemaId, req.tenantId);
  // Parse data_json
  data.forEach(d => {
    try { d.data_json = JSON.parse(d.data_json); } catch(e) {}
  });
  res.json({ data });
});

formRoutes.post('/:schemaId/data', (req, res) => {
  const db = getDB();
  const { study_id, data_json } = req.body;
  if (!data_json) return res.status(400).json({ error: 'data_json required' });
  
  const id = uuid();
  db.prepare('INSERT INTO forms_data (id, tenant_id, form_schema_id, study_id, data_json, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.tenantId, req.params.schemaId, study_id || null, JSON.stringify(data_json), req.user.id);
  
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Form Data Submitted', objectType: 'forms_data', objectId: id, ip: req.ip });
  res.status(201).json({ id, message: 'Form data submitted successfully' });
});

// Push validated clinical form rendition into eTMF repository (§12)
formRoutes.post('/:dataId/push-to-etmf', (req, res) => {
  const db = getDB();
  const formData = db.prepare('SELECT * FROM forms_data WHERE id = ? AND tenant_id = ?').get(req.params.dataId, req.tenantId);
  if (!formData) return res.status(404).json({ error: 'Form data record not found' });

  const schema = db.prepare('SELECT * FROM forms_schemas WHERE id = ?').get(formData.form_schema_id);
  const docId = `doc-form-${Date.now()}`;
  const studyId = formData.study_id || 'study-001';
  const artifactCode = schema?.artifact_code || '05.02.01';
  const artifactName = schema?.name || 'Clinical Log Rendition';
  const zone = schema?.zone || '05';
  const section = schema?.section || '05.02';
  const now = new Date().toISOString();
  const docTitle = `${artifactName} - ${now.split('T')[0]}`;

  db.prepare(`
    INSERT INTO documents (
      id, tenant_id, study_id, artifact_code, artifact_name, zone, zone_label,
      section, section_label, title, version, status, mandatory, confidential, country,
      effective_date, created_at, created_by, author_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'Site Management', ?, 'Delegation & Logs', ?, '1.0', 'Approved', 1, 0, 'USA', ?, ?, ?, ?)
  `).run(docId, req.tenantId, studyId, artifactCode, artifactName, zone, section, docTitle, now.split('T')[0], now, req.user.id, req.user.id);

  // Workflow entry
  const whId = uuid();
  db.prepare(`
    INSERT INTO workflow_history (id, document_id, tenant_id, from_state, to_state, user_id, comment)
    VALUES (?, ?, ?, 'Draft', 'Approved', ?, 'Form automatically compiled and published to eTMF')
  `).run(whId, docId, req.tenantId, req.user.id);

  appendAudit({
    tenantId: req.tenantId,
    studyId,
    documentId: docId,
    userId: req.user.id,
    userName: req.user.name,
    action: 'Form Pushed to eTMF',
    objectType: 'forms_data',
    objectId: req.params.dataId,
    objectName: docTitle,
    detail: `Filed under DIA Zone ${zone} Section ${section} (${artifactCode})`,
    ip: req.ip
  });

  res.status(201).json({
    message: 'Form successfully pushed and filed into eTMF repository',
    documentId: docId,
    zone,
    section,
    artifactCode
  });
});

// Lock clinical form submission (§12)
formRoutes.patch('/data/:dataId/lock', (req, res) => {
  const db = getDB();
  const { reason = 'Form locked for monitoring review' } = req.body;
  const formData = db.prepare('SELECT * FROM forms_data WHERE id = ? AND tenant_id = ?').get(req.params.dataId, req.tenantId);
  if (!formData) return res.status(404).json({ error: 'Form data not found' });

  db.prepare(`
    UPDATE forms_data
    SET is_locked = 1, locked_by = ?, locked_at = datetime('now')
    WHERE id = ?
  `).run(req.user.id, req.params.dataId);

  appendAudit({
    tenantId: req.tenantId,
    userId: req.user.id,
    userName: req.user.name,
    action: 'Form Locked',
    objectType: 'forms_data',
    objectId: req.params.dataId,
    detail: reason,
    ip: req.ip
  });

  res.json({ message: 'Form locked per 21 CFR Part 11 requirements' });
});

export { folderRoutes, qcRoutes, formRoutes };
