/**
 * Authentication & authorisation middleware
 * JWT + tenant header + role-based access control
 * 21 CFR Part 11 compliant session management
 */
import jwt from 'jsonwebtoken';
import { getDB } from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'etmf-dev-secret-change-in-production';

// Role capability map (Ref 1 screen-permissions + backward-compatible role aliases)
export const ROLE_CAPS = {
  'TMF Manager':            { canView:'all',    canUpload:true,  canReview:true,  canApprove:true,  canAdmin:true,  canLock:true,  canExport:true,  canSetMilestones:true,  canCreateStudy:true  },
  'Principal Investigator': { canView:'all',    canUpload:true,  canReview:false, canApprove:false, canAdmin:false, canLock:false, canExport:false, canSetMilestones:false, canCreateStudy:false },
  'CRA / Reviewer':         { canView:'all',    canUpload:false, canReview:true,  canApprove:false, canAdmin:false, canLock:false, canExport:false, canSetMilestones:false, canCreateStudy:false },
  'CRA':                    { canView:'all',    canUpload:true,  canReview:false, canApprove:false, canAdmin:false, canLock:false, canExport:false, canSetMilestones:false, canCreateStudy:false },
  'CRA / Author':           { canView:'all',    canUpload:true,  canReview:false, canApprove:false, canAdmin:false, canLock:false, canExport:false, canSetMilestones:false, canCreateStudy:false },
  'Reviewer':               { canView:'all',    canUpload:false, canReview:true,  canApprove:false, canAdmin:false, canLock:false, canExport:false, canSetMilestones:false, canCreateStudy:false },
  'Approver':               { canView:'all',    canUpload:false, canReview:false, canApprove:true,  canAdmin:false, canLock:false, canExport:false, canSetMilestones:false, canCreateStudy:false },
  'Regulatory Approver':    { canView:'all',    canUpload:false, canReview:false, canApprove:true,  canAdmin:false, canLock:false, canExport:false, canSetMilestones:false, canCreateStudy:false },
  'Sponsor Representative': { canView:'all',    canUpload:false, canReview:false, canApprove:false, canAdmin:false, canLock:false, canExport:true,  canSetMilestones:false, canCreateStudy:false, canViewAudit:true },
  'Sponsor Rep':            { canView:'all',    canUpload:false, canReview:false, canApprove:false, canAdmin:false, canLock:false, canExport:true,  canSetMilestones:false, canCreateStudy:false, canViewAudit:true },
  'Data Manager / Author':  { canView:'scoped', canUpload:true,  canReview:false, canApprove:false, canAdmin:false, canLock:false, canExport:false, canSetMilestones:false, canCreateStudy:false },
  'Site User':              { canView:'site',   canUpload:true,  canReview:false, canApprove:false, canAdmin:false, canLock:false, canExport:false, canSetMilestones:false, canCreateStudy:false },
  'System Administrator':   { canView:'all',    canUpload:true,  canReview:true,  canApprove:true,  canAdmin:true,  canLock:true,  canExport:true,  canSetMilestones:true,  canCreateStudy:true  },
  'Inspector / Auditor':    { canView:'all',    canUpload:false, canReview:false, canApprove:false, canAdmin:false, canLock:false, canExport:false, canSetMilestones:false, canCreateStudy:false, canViewAudit:true },
};

// Fixed Read-Only Permissions Matrix (Ref 1 screen-permissions: 8 permissions x 5 clinical roles)
export const FIXED_PERMISSIONS_MATRIX = {
  readOnly: true,
  rule: 'Role permissions are fixed by regulatory policy (21 CFR Part 11 & ICH E6 GCP) and cannot be modified by System Administrators (Ref 1 Screen 8).',
  roles: ['System Administrator', 'TMF Manager', 'CRA / Author', 'Reviewer', 'Approver', 'Sponsor Representative', 'Site User', 'Inspector / Auditor'],
  rows: [
    { permission: 'Upload documents',    systemAdmin: false, tmfManager: true,  cra: true,  reviewer: false, approver: false, sponsorRep: false },
    { permission: 'View documents',      systemAdmin: false, tmfManager: true,  cra: true,  reviewer: true,  approver: true,  sponsorRep: true  },
    { permission: 'Review documents',    systemAdmin: false, tmfManager: true,  cra: false, reviewer: true,  approver: false, sponsorRep: false },
    { permission: 'Approve documents',   systemAdmin: false, tmfManager: false, cra: false, reviewer: false, approver: true,  sponsorRep: false },
    { permission: 'Set milestone dates', systemAdmin: false, tmfManager: true,  cra: false, reviewer: false, approver: false, sponsorRep: false },
    { permission: 'Create study',        systemAdmin: false, tmfManager: true,  cra: false, reviewer: false, approver: false, sponsorRep: false },
    { permission: 'View audit trail',    systemAdmin: true,  tmfManager: true,  cra: false, reviewer: false, approver: false, sponsorRep: true  },
    { permission: 'Export documents',    systemAdmin: false, tmfManager: true,  cra: false, reviewer: false, approver: false, sponsorRep: true  },
  ]
};

export function requireAuth(req, res, next) {
  let token = null;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = getDB();

    // Validate session still active and not revoked
    const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND revoked = 0').get(token.slice(-32));
    if (!session || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired or revoked. Please log in again.' });
    }

    // Attach user context
    const user = db.prepare('SELECT id,name,email,role,dept,tenant_id,active FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'User account inactive or not found' });
    }

    // Ensure base capabilities from legacy string role
    const baseCaps = ROLE_CAPS[user.role] || {};
    
    // Fetch granular functional roles
    const fRoles = db.prepare('SELECT fr.capabilities FROM user_functional_roles ufr JOIN functional_roles fr ON ufr.role_id = fr.id WHERE ufr.user_id = ?').all(user.id);
    const dynamicCaps = {};
    fRoles.forEach(fr => {
      try {
        const caps = JSON.parse(fr.capabilities || '[]');
        caps.forEach(c => { dynamicCaps[c] = true; });
      } catch(e) {}
    });

    req.user = { 
      ...user, 
      caps: { ...baseCaps, ...dynamicCaps }, 
      sessionId: session.id 
    };
    req.tenantId = user.tenant_id;

    // C-10: Enforce tenant IP allowlist if configured in tenants.settings.ipAllowlist
    try {
      const tenantRow = db.prepare('SELECT settings FROM tenants WHERE id = ?').get(user.tenant_id);
      if (tenantRow?.settings) {
        const settings = JSON.parse(tenantRow.settings);
        if (Array.isArray(settings.ipAllowlist) && settings.ipAllowlist.length > 0) {
          const clientIp = (req.ip || req.connection?.remoteAddress || '127.0.0.1').replace('::ffff:', '');
          const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';
          if (!isLocal && !settings.ipAllowlist.includes(clientIp) && !settings.ipAllowlist.includes('*')) {
            return res.status(403).json({ error: `Access denied from IP ${clientIp} by tenant IP allowlist policy`, code: 'IP_NOT_ALLOWED' });
          }
        }
      }
    } catch (e) {}

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Insufficient permissions. Required: ${roles.join(' or ')}. Your role: ${req.user.role}`,
        code: 'FORBIDDEN',
      });
    }
    next();
  };
}

export function requireCap(cap) {
  return (req, res, next) => {
    if (!req.user?.caps?.[cap]) {
      return res.status(403).json({
        error: `Your role (${req.user?.role}) does not have the '${cap}' capability`,
        code: 'FORBIDDEN',
        required: cap,
      });
    }
    next();
  };
}

// Inspector read-only guard — all doc mutations blocked
export function blockInspector(req, res, next) {
  if (req.user?.role === 'Inspector / Auditor') {
    return res.status(403).json({ error: 'Inspectors have read-only access', code: 'INSPECTOR_READ_ONLY' });
  }
  next();
}

// Study lock guard — no writes to locked study
export function requireUnlockedStudy(req, res, next) {
  const db = getDB();
  let studyId = req.params.studyId || req.body?.studyId || req.body?.study_id || req.query?.studyId;
  if (!studyId && (req.params.id || req.params.docId)) {
    const docId = req.params.docId || req.params.id;
    const doc = db.prepare('SELECT study_id FROM documents WHERE id = ? AND tenant_id = ?').get(docId, req.tenantId);
    if (doc?.study_id) studyId = doc.study_id;
  }
  if (!studyId) return next();
  const study = db.prepare('SELECT locked, status FROM studies WHERE id = ? AND tenant_id = ?').get(studyId, req.tenantId);
  if (study?.locked || study?.status === 'Locked' || study?.status === 'Archived') {
    return res.status(423).json({ error: 'Study is locked. No modifications permitted.', code: 'STUDY_LOCKED' });
  }
  next();
}

export function generateTokens(user, ip, userAgent) {
  const JWT_SECRET = process.env.JWT_SECRET || 'etmf-dev-secret-change-in-production';
  const expiresIn = '8h';
  const token = jwt.sign({ sub: user.id, role: user.role, tenant: user.tenant_id }, JWT_SECRET, { expiresIn });

  // Store session
  const db = getDB();
  const sessionId = require('crypto').randomUUID?.() || Math.random().toString(36).slice(2);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, tenant_id, token_hash, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(sessionId, user.id, user.tenant_id, token.slice(-32), ip, userAgent, expiresAt);

  return { token, expiresAt, sessionId };
}
