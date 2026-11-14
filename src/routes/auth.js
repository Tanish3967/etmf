/**
 * Auth routes — 21 CFR Part 11 §11.200 compliant
 * Login · Logout · MFA · Password change · Session management
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { v4 as uuid } from 'uuid';
import { body, validationResult } from 'express-validator';
import { getDB, appendAudit } from '../database.js';
import { requireAuth, ROLE_CAPS } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'etmf-dev-secret-change-in-production';
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '8');
const MAX_FAILED = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '3');

export function validatePasswordPolicy(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password required').trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { email, password, mfaCode } = req.body;

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    return res.status(423).json({ error: `Account locked. Try again in ${remaining} minutes.`, code: 'LOCKED', remainingMinutes: remaining });
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const currentAttempts = (user.failed_login_attempts !== undefined && user.failed_login_attempts !== null) 
      ? user.failed_login_attempts 
      : (user.failed_attempts || 0);
    const attempts = currentAttempts + 1;
    const lockedUntil = attempts >= MAX_FAILED ? new Date(Date.now() + 30 * 60000).toISOString() : null;
    db.prepare('UPDATE users SET failed_attempts = ?, failed_login_attempts = ?, locked_until = ? WHERE id = ?')
      .run(attempts, attempts, lockedUntil, user.id);
    appendAudit({ tenantId: user.tenant_id, userId: user.id, userName: user.name, action: 'Login Failed', detail: `Attempt ${attempts}/${MAX_FAILED}`, ip: req.ip });
    if (lockedUntil) return res.status(423).json({ error: `Too many failed attempts. Account locked for 30 minutes.`, code: 'LOCKED', remainingMinutes: 30 });
    return res.status(401).json({ error: 'Invalid credentials', attemptsLeft: MAX_FAILED - attempts });
  }

  // MFA check (if enabled)
  if (user.mfa_enabled && user.mfa_secret) {
    if (!mfaCode) return res.status(200).json({ requiresMFA: true, message: 'MFA code required' });
    let verified = speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token: mfaCode, window: 2 });
    
    // Check backup recovery codes if TOTP failed
    if (!verified && user.mfa_recovery_codes) {
      try {
        const codes = JSON.parse(user.mfa_recovery_codes || '[]');
        const idx = codes.findIndex(c => c.toUpperCase() === mfaCode.trim().toUpperCase());
        if (idx !== -1) {
          verified = true;
          codes.splice(idx, 1);
          db.prepare('UPDATE users SET mfa_recovery_codes = ? WHERE id = ?').run(JSON.stringify(codes), user.id);
        }
      } catch (e) {}
    }

    if (!verified) {
      appendAudit({ tenantId: user.tenant_id, userId: user.id, userName: user.name, action: 'MFA Failed', ip: req.ip });
      return res.status(401).json({ error: 'Invalid MFA code' });
    }
  }

  // Reset failed attempts
  db.prepare('UPDATE users SET failed_attempts = 0, failed_login_attempts = 0, locked_until = NULL, last_login = datetime(\'now\') WHERE id = ?').run(user.id);

  // Issue token
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600000).toISOString();
  const token = jwt.sign({ sub: user.id, role: user.role, tenant: user.tenant_id }, JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
  const sessionId = uuid();
  db.prepare('INSERT INTO sessions (id, user_id, tenant_id, token_hash, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(sessionId, user.id, user.tenant_id, token.slice(-32), req.ip, req.headers['user-agent'] || '', expiresAt);

  appendAudit({ tenantId: user.tenant_id, userId: user.id, userName: user.name, userRole: user.role, action: 'Login', detail: 'Successful login', ip: req.ip, sessionId });

  res.json({
    token,
    expiresAt,
    sessionId,
    mustChangePassword: Boolean(user.must_change_password),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username || user.email,
      role: user.role,
      dept: user.dept,
      tenantId: user.tenant_id,
      must_change_password: user.must_change_password || 0,
      caps: ROLE_CAPS[user.role] || {},
    },
  });
});

// ── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  const db = getDB();
  const token = req.headers.authorization?.slice(7) || '';
  const tokenSuffix = token.slice(-32);

  // Calculate session duration in seconds
  const session = db.prepare('SELECT created_at FROM sessions WHERE token_hash = ? ORDER BY created_at DESC LIMIT 1').get(tokenSuffix);
  let durationSeconds = 0;
  let durationFormatted = '0s';
  if (session?.created_at) {
    const startTime = new Date(session.created_at).getTime();
    durationSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    durationFormatted = `${mins}m ${secs}s`;
  }

  db.prepare('UPDATE sessions SET revoked = 1 WHERE token_hash = ?').run(tokenSuffix);
  appendAudit({
    tenantId: req.tenantId,
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'Logout',
    detail: `Explicit user logout | Duration: ${durationFormatted} (${durationSeconds}s)`,
    ip: req.ip,
    sessionId: req.user.sessionId
  });
  res.json({ message: 'Logged out successfully', sessionDurationSeconds: durationSeconds });
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    username: req.user.username || req.user.email,
    role: req.user.role,
    dept: req.user.dept,
    tenantId: req.user.tenant_id,
    must_change_password: req.user.must_change_password || 0,
    caps: req.user.caps,
  });
});

// ── POST /api/auth/change-password ──────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both currentPassword and newPassword are required' });

  // 21 CFR Part 11 Password Complexity Enforcement
  if (!validatePasswordPolicy(newPassword)) {
    return res.status(400).json({
      error: 'Password does not meet complexity requirements. Must be at least 8 characters and include uppercase, lowercase, number, and special character.',
      code: 'PASSWORD_COMPLEXITY_FAILED'
    });
  }

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password incorrect', code: 'INVALID_CURRENT_PASSWORD' });

  // Prevent reuse of current password
  const matchesCurrent = await bcrypt.compare(newPassword, user.password_hash);
  if (matchesCurrent) {
    return res.status(400).json({
      error: 'Cannot reuse recent passwords. Prohibited from matching current password or last 5 passwords.',
      code: 'PASSWORD_REUSED'
    });
  }

  // Prevent reuse of last 5 passwords per user (21 CFR Part 11 §3)
  const history = db.prepare('SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(req.user.id);
  for (const item of history) {
    const isReused = await bcrypt.compare(newPassword, item.password_hash);
    if (isReused) {
      return res.status(400).json({
        error: 'Cannot reuse recent passwords. Prohibited from matching any of your last 5 passwords.',
        code: 'PASSWORD_REUSED'
      });
    }
  }

  const hash = await bcrypt.hash(newPassword, 12);
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET password_hash = ?, password_changed = ?, must_change_password = 0, failed_attempts = 0, failed_login_attempts = 0 WHERE id = ?')
    .run(hash, now, req.user.id);

  // Record in password history
  const histId = uuid();
  db.prepare('INSERT INTO password_history (id, user_id, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(histId, req.user.id, hash, now);

  appendAudit({
    tenantId: req.tenantId,
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'Password Changed',
    detail: 'User changed password in compliance with 21 CFR Part 11 password history and complexity policy',
    ip: req.ip
  });
  res.json({ message: 'Password changed successfully' });
});

// ── POST /api/auth/mfa/setup ─────────────────────────────────
router.post('/mfa/setup', requireAuth, (req, res) => {
  const secret = speakeasy.generateSecret({ name: `eTMF Pro (${req.user.email})`, length: 20 });
  
  // Generate 5 emergency recovery codes
  const recoveryCodes = Array.from({ length: 5 }, () => 
    `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  );

  const db = getDB();
  db.prepare('UPDATE users SET mfa_secret = ?, mfa_recovery_codes = ? WHERE id = ?')
    .run(secret.base32, JSON.stringify(recoveryCodes), req.user.id);

  res.json({
    secret: secret.base32,
    otpAuthUrl: secret.otpauth_url,
    recoveryCodes,
    message: 'Scan QR code with authenticator app, record recovery codes safely, then verify with code'
  });
});

// ── POST /api/auth/mfa/verify ────────────────────────────────
router.post('/mfa/verify', requireAuth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'MFA code required' });

  const db = getDB();
  const user = db.prepare('SELECT mfa_secret FROM users WHERE id = ?').get(req.user.id);
  if (!user?.mfa_secret) return res.status(400).json({ error: 'MFA not configured' });

  const verified = speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token: code, window: 2 });
  if (!verified) return res.status(400).json({ error: 'Invalid MFA verification code' });

  db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ?').run(req.user.id);
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'MFA Enabled', ip: req.ip });
  res.json({ message: 'MFA enabled successfully' });
});

// ── GET /api/auth/sessions ───────────────────────────────────
router.get('/sessions', requireAuth, (req, res) => {
  const db = getDB();
  const sessions = db.prepare('SELECT id, ip_address, user_agent, created_at, expires_at, revoked FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(req.user.id);
  res.json({ sessions });
});

export default router;
