/**
 * Authentication & authorisation middleware
 * JWT + tenant header + role-based access control
 * 21 CFR Part 11 compliant session management
 */
import jwt from 'jsonwebtoken';
import { getDB } from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'etmf-dev-secret-change-in-production';

// Role capability map
export const ROLE_CAPS = {
  'TMF Manager':            { canView:'all', canUpload:true,  canReview:true,  canApprove:true,  canAdmin:true,  canLock:true  },
  'Principal Investigator': { canView:'all', canUpload:true,  canReview:false, canApprove:false, canAdmin:false, canLock:false },
  'CRA / Reviewer':         { canView:'all', canUpload:false, canReview:true,  canApprove:false, canAdmin:false, canLock:false },
  'Regulatory Approver':    { canView:'all', canUpload:false, canReview:false, canApprove:true,  canAdmin:false, canLock:false },
  'Data Manager / Author':  { canView:'scoped', canUpload:true, canReview:false, canApprove:false, canAdmin:false, canLock:false },
  'System Administrator':   { canView:'all', canUpload:true,  canReview:true,  canApprove:true,  canAdmin:true,  canLock:true  },
  'Inspector / Auditor':    { canView:'all', canUpload:false, canReview:false, canApprove:false, canAdmin:false, canLock:false },
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
  const studyId = req.params.studyId || req.body.studyId;
  if (!studyId) return next();
  const db = getDB();
  const study = db.prepare('SELECT locked FROM studies WHERE id = ? AND tenant_id = ?').get(studyId, req.tenantId);
  if (study?.locked) {
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
