/**
 * Auth routes — 21 CFR Part 11 §11.200 compliant
 * Login · Logout · MFA · Password change · Session management
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { v4 as uuid } from 'uuid';
import { getDB, appendAudit } from '../database.js';
import { requireAuth, ROLE_CAPS } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'etmf-dev-secret-change-in-production';
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '8');
const MAX_FAILED = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password, mfaCode } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    return res.status(423).json({ error: `Account locked. Try again in ${remaining} minutes.`, code: 'LOCKED' });
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const attempts = (user.failed_attempts || 0) + 1;
    const lockedUntil = attempts >= MAX_FAILED ? new Date(Date.now() + 30 * 60000).toISOString() : null;
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?')
      .run(attempts, lockedUntil, user.id);
    appendAudit({ tenantId: user.tenant_id, userId: user.id, userName: user.name, action: 'Login Failed', detail: `Attempt ${attempts}/${MAX_FAILED}`, ip: req.ip });
    if (lockedUntil) return res.status(423).json({ error: `Too many failed attempts. Account locked for 30 minutes.`, code: 'LOCKED' });
    return res.status(401).json({ error: 'Invalid credentials', attemptsLeft: MAX_FAILED - attempts });
  }

  // MFA check (if enabled)
  if (user.mfa_enabled && user.mfa_secret) {
    if (!mfaCode) return res.status(200).json({ requiresMFA: true, message: 'MFA code required' });
    const verified = speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token: mfaCode, window: 2 });
    if (!verified) {
      appendAudit({ tenantId: user.tenant_id, userId: user.id, userName: user.name, action: 'MFA Failed', ip: req.ip });
      return res.status(401).json({ error: 'Invalid MFA code' });
    }
  }

  // Reset failed attempts
  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = datetime(\'now\') WHERE id = ?').run(user.id);

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
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      dept: user.dept,
      tenantId: user.tenant_id,
      caps: ROLE_CAPS[user.role] || {},
    },
  });
});

// ── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  const db = getDB();
  const token = req.headers.authorization?.slice(7) || '';
  db.prepare('UPDATE sessions SET revoked = 1 WHERE token_hash = ?').run(token.slice(-32));
  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Logout', ip: req.ip, sessionId: req.user.sessionId });
  res.json({ message: 'Logged out successfully' });
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    dept: req.user.dept,
    tenantId: req.user.tenant_id,
    caps: req.user.caps,
  });
});

// ── POST /api/auth/change-password ──────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ?, password_changed = datetime(\'now\'), failed_attempts = 0 WHERE id = ?').run(hash, req.user.id);

  appendAudit({ tenantId: req.tenantId, userId: req.user.id, userName: req.user.name, action: 'Password Changed', detail: 'User changed own password', ip: req.ip });
  res.json({ message: 'Password changed successfully' });
});

// ── POST /api/auth/mfa/setup ─────────────────────────────────
router.post('/mfa/setup', requireAuth, (req, res) => {
  const secret = speakeasy.generateSecret({ name: `eTMF Pro (${req.user.email})`, length: 20 });
  const db = getDB();
  db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?').run(secret.base32, req.user.id);
  res.json({ secret: secret.base32, otpAuthUrl: secret.otpauth_url, message: 'Scan QR code with authenticator app, then verify' });
});

// ── POST /api/auth/mfa/verify ────────────────────────────────
router.post('/mfa/verify', requireAuth, (req, res) => {
  const { code } = req.body;
  const db = getDB();
  const user = db.prepare('SELECT mfa_secret FROM users WHERE id = ?').get(req.user.id);
  if (!user?.mfa_secret) return res.status(400).json({ error: 'MFA not configured' });
  const verified = speakeasy.totp.verify({ secret: user.mfa_secret, encoding: 'base32', token: code, window: 2 });
  if (!verified) return res.status(400).json({ error: 'Invalid code' });
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
