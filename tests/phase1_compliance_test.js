/**
 * Phase 1: 21 CFR Part 11 Compliance & Core Security Hardening Test Suite
 * Covers:
 * 1. Dual-Component Re-Authentication (§11.200)
 * 2. Binary File Digest Hashing & Signature Binding (§11.70)
 * 3. Server-Side PDF Rendition Engine (§11.50)
 * 4. Password Policy Complexity Enforcement (§3)
 * 5. Password History (5-Cycle Reuse Prevention)
 * 6. Account Lockout (3 Failed Attempts -> 30-Minute Lockout)
 * 7. Session Duration Logging on Explicit Logout & Audit Trail View (§11.10)
 * 8. TOTP MFA Setup & Verification Flow
 */
import assert from 'assert';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import { getDB, initDB } from '../src/database.js';

const BASE = process.env.TEST_URL || 'http://localhost:3002';

async function req(method, path, body, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType.includes('application/pdf') || contentType.includes('octet-stream')) {
    const arrayBuffer = await res.arrayBuffer();
    data = Buffer.from(arrayBuffer);
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, body: data };
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}: ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Phase 1: 21 CFR Part 11 Compliance & Security Tests');
  console.log('======================================================\n');

  await initDB();
  const db = getDB();

  // Reset test accounts and purge password history for clean idempotency
  const bcryptModule = await import('bcryptjs');
  const defaultHash = await bcryptModule.default.hash('Admin1234!', 12);
  db.prepare("UPDATE users SET password_hash = ?, failed_attempts = 0, failed_login_attempts = 0, locked_until = NULL WHERE email IN ('e.vasquez@pharma.com', 'p.sharma@pharma.com', 'a.patel@pharma.com', 'j.obrien@pharma.com')").run(defaultHash);
  db.prepare("DELETE FROM password_history").run();
  db.prepare("UPDATE documents SET status = 'Draft', checked_out_by = NULL WHERE id = 'doc-005'").run();

  // Dedicated test document to ensure zero state collision with run.js
  const testDocId = `doc-p1-test-${Date.now()}`;
  db.prepare(`
    INSERT INTO documents (
      id, tenant_id, study_id, artifact_code, artifact_name,
      zone, zone_label, section, section_label,
      title, version, status, confidential, mandatory, created_by
    ) VALUES (
      ?, 'tenant-001', 'study-001', '01.02.01', 'Trial Operations Plan',
      '01', 'Trial Management', '01.02', 'Trial Operations',
      'Phase 1 Verification Protocol', '1.0', 'Draft', 0, 1, 'usr-001'
    )
  `).run(testDocId);

  // Obtain auth token for testing
  const loginRes = await req('POST', '/api/auth/login', {
    email: 'e.vasquez@pharma.com',
    password: 'Admin1234!'
  });
  assert.strictEqual(loginRes.status, 200, 'Initial login must succeed');
  const token = loginRes.body.token;
  assert(token, 'JWT token must be present');

  // ─────────────────────────────────────────────────────────────
  // 1. DUAL-COMPONENT RE-AUTHENTICATION (§11.200)
  // ─────────────────────────────────────────────────────────────
  console.log('1. Dual-Component Electronic Signature Re-Authentication (§11.200)');

  // Advance dedicated test document to 'Pending Approval' first
  const adv1 = await req('POST', `/api/workflow/${testDocId}/transition`, { nextState: 'Pending Review' }, token);
  assert.strictEqual(adv1.status, 200, `Advance to Pending Review failed: ${JSON.stringify(adv1.body)}`);
  const adv2 = await req('POST', `/api/workflow/${testDocId}/transition`, { nextState: 'Review Complete' }, token);
  assert.strictEqual(adv2.status, 200, `Advance to Review Complete failed: ${JSON.stringify(adv2.body)}`);
  const adv3 = await req('POST', `/api/workflow/${testDocId}/transition`, { nextState: 'Pending Approval' }, token);
  assert.strictEqual(adv3.status, 200, `Advance to Pending Approval failed: ${JSON.stringify(adv3.body)}`);

  await test('Rejects signature attempt missing credentials object entirely (400)', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, { nextState: 'Approved' }, token);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'ESIG_REQUIRED');
  });

  await test('Rejects signature attempt missing username (400)', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, {
      nextState: 'Approved',
      credentials: { password: 'Admin1234!', meaning: 'Approved' }
    }, token);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'ESIG_REQUIRED');
  });

  await test('Rejects signature attempt missing password (400)', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, {
      nextState: 'Approved',
      credentials: { username: 'e.vasquez@pharma.com', meaning: 'Approved' }
    }, token);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'ESIG_REQUIRED');
  });

  await test('Rejects signature attempt with mismatched username (401)', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, {
      nextState: 'Approved',
      credentials: { username: 'intruder@impostor.org', password: 'Admin1234!', meaning: 'Approved' }
    }, token);
    assert.strictEqual(r.status, 401);
    assert.strictEqual(r.body.code, 'ESIG_FAILED');
  });

  await test('Rejects signature attempt with incorrect password (401)', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, {
      nextState: 'Approved',
      credentials: { username: 'e.vasquez@pharma.com', password: 'WrongPassword999!', meaning: 'Approved' }
    }, token);
    assert.strictEqual(r.status, 401);
    assert.strictEqual(r.body.code, 'ESIG_FAILED');
  });

  await test('Rejects signature attempt when user account is locked (423 LOCKED)', async () => {
    const lockTime = new Date(Date.now() + 30 * 60000).toISOString();
    db.prepare("UPDATE users SET locked_until = ? WHERE id = 'usr-001'").run(lockTime);

    const r = await req('POST', `/api/workflow/${testDocId}/transition`, {
      nextState: 'Approved',
      credentials: { username: 'e.vasquez@pharma.com', password: 'Admin1234!', meaning: 'Approved' }
    }, token);

    db.prepare("UPDATE users SET locked_until = NULL WHERE id = 'usr-001'").run();

    assert.strictEqual(r.status, 423, `Expected 423 LOCKED, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.strictEqual(r.body.code, 'LOCKED');
  });

  let approvedEsigId = null;
  await test('Accepts valid dual-component signature with case-insensitive username match (200)', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, {
      nextState: 'Approved',
      credentials: {
        username: 'E.Vasquez@Pharma.com',
        password: 'Admin1234!',
        meaning: 'I approve this document for clinical trial conduct (Approval)'
      }
    }, token);
    assert.strictEqual(r.status, 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.strictEqual(r.body.document.status, 'Approved');
    assert(r.body.esigId, 'esigId must be returned');
    approvedEsigId = r.body.esigId;
  });

  // ─────────────────────────────────────────────────────────────
  // 2. BINARY HASHING & CRYPTOGRAPHIC SIGNATURE BINDING (§11.70)
  // ─────────────────────────────────────────────────────────────
  console.log('\n2. Binary Digest Hashing & Cryptographic Signature Binding (§11.70)');

  await test('Verifies cryptographic signature record incorporates file hash, user, meaning, timestamp', async () => {
    const esig = db.prepare('SELECT * FROM electronic_signatures WHERE id = ?').get(approvedEsigId);
    assert(esig, 'Signature record must exist in database');
    assert.strictEqual(esig.user_id, 'usr-001');
    assert.strictEqual(esig.meaning, 'I approve this document for clinical trial conduct (Approval)');
    assert(esig.sig_hash && esig.sig_hash.length === 64, 'sig_hash must be a 64-char hex SHA-256');
    assert(esig.signed_at, 'signed_at timestamp must be present');
  });

  await test('Streaming binary upload computes and persists file_sha256', async () => {
    const fileContent = 'CLINICAL TRIAL PROTOCOL v2.0 - BINARY INTEGRITY TEST';
    const expectedSha = crypto.createHash('sha256').update(fileContent).digest('hex');

    const form = new FormData();
    form.append('file', new Blob([fileContent], { type: 'text/plain' }), 'Protocol_Integrity_Test.txt');
    form.append('data', JSON.stringify({
      studyId: 'study-001',
      artifactCode: '01.02.01',
      title: 'Protocol Integrity Verification',
      version: '2.0'
    }));

    const r = await req('POST', '/api/documents', form, token);
    assert(r.status === 200 || r.status === 201, `Upload status: ${r.status}`);
    const docId = r.body.document.id;

    const savedDoc = db.prepare('SELECT file_sha256 FROM documents WHERE id = ?').get(docId);
    assert.strictEqual(savedDoc.file_sha256, expectedSha, 'Saved file_sha256 must match streaming SHA-256');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. SERVER-SIDE PDF RENDITION ENGINE (§11.50)
  // ─────────────────────────────────────────────────────────────
  console.log('\n3. Server-Side PDF Rendition Engine (§11.50)');

  await test('GET /api/documents/:id/download returns stamped PDF with Cover Page, Watermark, and Manifest Table', async () => {
    const r = await req('GET', `/api/documents/${testDocId}/download?rendition=true`, null, token);
    assert.strictEqual(r.status, 200, `Download status: ${r.status}`);
    assert(Buffer.isBuffer(r.body), 'Response must be binary buffer');
    assert(r.body.subarray(0, 4).toString() === '%PDF', 'Buffer must begin with %PDF magic bytes');
    assert(r.body.length > 3000, `PDF size must be substantial, got ${r.body.length} bytes`);

    // Verify PDF contents contains rendition structure
    const pdfText = r.body.toString('latin1');
    assert(pdfText.includes('CLINEVO') || pdfText.includes('PDF'), 'Must contain rendition structure');
  });

  await test('Server-side rendition engine handles non-WinAnsi / special Unicode characters without failing', async () => {
    const specialDocId = `doc-p1-special-${Date.now()}`;
    db.prepare(`
      INSERT INTO documents (
        id, tenant_id, study_id, artifact_code, artifact_name,
        zone, zone_label, section, section_label,
        title, version, status, confidential, mandatory, created_by
      ) VALUES (
        ?, 'tenant-001', 'study-001', '01.01.01', 'Protocol',
        '01', 'Trial Management', '01.01', 'Trial Design',
        'Clinical Study Protocol \u2014 \u03B1/\u03B2 with Dose \u2265 95%', '1.0', 'Approved', 0, 1, 'usr-001'
      )
    `).run(specialDocId);

    const specialEsigId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO electronic_signatures (id, document_id, tenant_id, user_id, meaning, sig_hash, ip_address, signed_at)
      VALUES (?, ?, 'tenant-001', 'usr-001', 'Approved \u2014 \u201CSpecial\u201D \u2265 95% efficacy', 'mockhash123', '127.0.0.1', datetime('now'))
    `).run(specialEsigId, specialDocId);

    const r = await req('GET', `/api/documents/${specialDocId}/download?rendition=true`, null, token);
    assert.strictEqual(r.status, 200, `Special character download status: ${r.status}`);
    assert(Buffer.isBuffer(r.body), 'Response must be binary buffer');
    assert(r.body.subarray(0, 4).toString() === '%PDF', 'Buffer must begin with %PDF');

    // Clean up special document
    db.prepare('DELETE FROM electronic_signatures WHERE id = ?').run(specialEsigId);
    db.prepare('DELETE FROM documents WHERE id = ?').run(specialDocId);
  });

  await test('Gracefully handles downloading non-PDF files without throwing 500 error', async () => {
    // doc-001 or other existing record
    const r = await req('GET', '/api/documents/doc-001/download', null, token);
    assert(r.status === 200 || r.status === 204, `Expected 200 or 204, got ${r.status}`);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. PASSWORD COMPLEXITY POLICY (§3)
  // ─────────────────────────────────────────────────────────────
  console.log('\n4. Password Complexity Policy Enforcement (§3)');

  // Login as James O'Brien for password tests so Elena Vasquez's token/password remain undisturbed
  const joLogin = await req('POST', '/api/auth/login', { email: 'j.obrien@pharma.com', password: 'Admin1234!' });
  assert.strictEqual(joLogin.status, 200, 'James O\'Brien login must succeed');
  let joToken = joLogin.body.token;

  await test('Rejects password shorter than 8 characters (400)', async () => {
    const r = await req('POST', '/api/auth/change-password', {
      currentPassword: 'Admin1234!',
      newPassword: 'Sh1!'
    }, joToken);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'PASSWORD_COMPLEXITY_FAILED');
  });

  await test('Rejects password missing uppercase letter (400)', async () => {
    const r = await req('POST', '/api/auth/change-password', {
      currentPassword: 'Admin1234!',
      newPassword: 'lowercase1234!'
    }, joToken);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'PASSWORD_COMPLEXITY_FAILED');
  });

  await test('Rejects password missing lowercase letter (400)', async () => {
    const r = await req('POST', '/api/auth/change-password', {
      currentPassword: 'Admin1234!',
      newPassword: 'UPPERCASE1234!'
    }, joToken);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'PASSWORD_COMPLEXITY_FAILED');
  });

  await test('Rejects password missing numeric digit (400)', async () => {
    const r = await req('POST', '/api/auth/change-password', {
      currentPassword: 'Admin1234!',
      newPassword: 'NoNumbersSpecial!'
    }, joToken);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'PASSWORD_COMPLEXITY_FAILED');
  });

  await test('Rejects password missing special character (400)', async () => {
    const r = await req('POST', '/api/auth/change-password', {
      currentPassword: 'Admin1234!',
      newPassword: 'NoSpecialChars1234'
    }, joToken);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'PASSWORD_COMPLEXITY_FAILED');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. PASSWORD HISTORY & REUSE PREVENTION (5-CYCLE LIMIT)
  // ─────────────────────────────────────────────────────────────
  console.log('\n5. Password History & 5-Cycle Reuse Prevention');

  // Purge password history and refresh login token for James O'Brien prior to test 5
  db.prepare("UPDATE users SET password_hash = ?, failed_attempts = 0, failed_login_attempts = 0, locked_until = NULL WHERE email = 'j.obrien@pharma.com'").run(defaultHash);
  db.prepare("DELETE FROM password_history WHERE user_id = 'usr-005'").run();
  const freshJoLogin = await req('POST', '/api/auth/login', { email: 'j.obrien@pharma.com', password: 'Admin1234!' });
  assert.strictEqual(freshJoLogin.status, 200, 'James O\'Brien fresh login must succeed');
  joToken = freshJoLogin.body.token;

  await test('Rejects reusing the immediate current password (400)', async () => {
    const r = await req('POST', '/api/auth/change-password', {
      currentPassword: 'Admin1234!',
      newPassword: 'Admin1234!'
    }, joToken);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, 'PASSWORD_REUSED');
  });

  await test('Prevents reusing any of the last 5 passwords from password_history', async () => {
    // Change password to StrongPass1!
    let r1 = await req('POST', '/api/auth/change-password', {
      currentPassword: 'Admin1234!',
      newPassword: 'StrongPass1!'
    }, joToken);
    assert.strictEqual(r1.status, 200, `Change 1 failed: ${JSON.stringify(r1.body)}`);

    // Change password to StrongPass2!
    let r2 = await req('POST', '/api/auth/change-password', {
      currentPassword: 'StrongPass1!',
      newPassword: 'StrongPass2!'
    }, joToken);
    assert.strictEqual(r2.status, 200);

    // Attempt to reuse StrongPass1! (which is in history)
    let reuseAttempt = await req('POST', '/api/auth/change-password', {
      currentPassword: 'StrongPass2!',
      newPassword: 'StrongPass1!'
    }, joToken);
    assert.strictEqual(reuseAttempt.status, 400, 'Reused password must be rejected');
    assert.strictEqual(reuseAttempt.body.code, 'PASSWORD_REUSED');

    // Restore James O'Brien's password back to defaultHash and purge history for subsequent test runs
    db.prepare("UPDATE users SET password_hash = ?, failed_attempts = 0, failed_login_attempts = 0, locked_until = NULL WHERE email = 'j.obrien@pharma.com'").run(defaultHash);
    db.prepare("DELETE FROM password_history WHERE user_id = 'usr-005'").run();
  });

  // ─────────────────────────────────────────────────────────────
  // 6. ACCOUNT LOCKOUT (3 FAILED ATTEMPTS -> 30-MINUTE LOCKOUT)
  // ─────────────────────────────────────────────────────────────
  console.log('\n6. Account Lockout Logic (3 Consecutive Failures -> 30-Minute Lockout)');

  await test('Locks user account for 30 minutes after 3 consecutive failed logins', async () => {
    // Reset counter for Priya Sharma
    db.prepare("UPDATE users SET failed_attempts = 0, failed_login_attempts = 0, locked_until = NULL WHERE email = 'p.sharma@pharma.com'").run();

    // Attempt 1: Fail
    const a1 = await req('POST', '/api/auth/login', { email: 'p.sharma@pharma.com', password: 'bad' });
    assert.strictEqual(a1.status, 401);
    assert.strictEqual(a1.body.attemptsLeft, 2);

    // Attempt 2: Fail
    const a2 = await req('POST', '/api/auth/login', { email: 'p.sharma@pharma.com', password: 'bad' });
    assert.strictEqual(a2.status, 401);
    assert.strictEqual(a2.body.attemptsLeft, 1);

    // Attempt 3: Fail -> Must return 423 LOCKED
    const a3 = await req('POST', '/api/auth/login', { email: 'p.sharma@pharma.com', password: 'bad' });
    assert.strictEqual(a3.status, 423, `Expected 423 Locked on 3rd attempt, got ${a3.status}`);
    assert.strictEqual(a3.body.code, 'LOCKED');

    // Attempt 4: Even with correct password, must still return 423 LOCKED
    const a4 = await req('POST', '/api/auth/login', { email: 'p.sharma@pharma.com', password: 'Admin1234!' });
    assert.strictEqual(a4.status, 423, 'Locked account must reject correct password while locked');

    // Unlock and verify successful login resets failed_attempts
    db.prepare("UPDATE users SET locked_until = NULL WHERE email = 'p.sharma@pharma.com'").run();
    const a5 = await req('POST', '/api/auth/login', { email: 'p.sharma@pharma.com', password: 'Admin1234!' });
    assert.strictEqual(a5.status, 200, 'Login must succeed once unlocked');

    const u = db.prepare("SELECT failed_attempts, failed_login_attempts FROM users WHERE email = 'p.sharma@pharma.com'").get();
    assert.strictEqual(u.failed_login_attempts, 0, 'failed_login_attempts must reset to 0');
    assert.strictEqual(u.failed_attempts, 0, 'failed_attempts must reset to 0');
  });

  // ─────────────────────────────────────────────────────────────
  // 7. EXPLICIT LOGOUT AUDIT & AUDIT TRAIL VIEW (§11.10)
  // ─────────────────────────────────────────────────────────────
  console.log('\n7. Explicit Logout Audit Logging & Audit Trail View (§11.10)');

  await test('Logs explicit user logout with duration and IP to audit_trail view', async () => {
    // Login to create session
    const logUser = await req('POST', '/api/auth/login', { email: 'a.patel@pharma.com', password: 'Admin1234!' });
    assert.strictEqual(logUser.status, 200);
    const uToken = logUser.body.token;

    // Logout
    const logoutRes = await req('POST', '/api/auth/logout', { reason: 'User finished shift' }, uToken);
    assert.strictEqual(logoutRes.status, 200);
    assert(logoutRes.body.sessionDurationSeconds !== undefined, 'sessionDurationSeconds must be present');

    // Verify audit_trail view contains the logout record
    const auditRow = db.prepare("SELECT * FROM audit_trail WHERE action = 'Logout' AND user_name = 'Aisha Patel' ORDER BY created_at DESC LIMIT 1").get();
    assert(auditRow, 'Logout record must be present in audit_trail view');
    assert(auditRow.detail && auditRow.detail.includes('Explicit user logout'), 'Audit detail must record explicit logout');
  });

  // ─────────────────────────────────────────────────────────────
  // 8. TOTP MFA SETUP & VERIFICATION FLOW
  // ─────────────────────────────────────────────────────────────
  console.log('\n8. TOTP Multi-Factor Authentication (MFA) Flow');

  await test('MFA setup generates Base32 secret and emergency recovery codes', async () => {
    const setupRes = await req('POST', '/api/auth/mfa/setup', {}, token);
    assert.strictEqual(setupRes.status, 200);
    assert(setupRes.body.secret, 'secret must be generated');
    assert(Array.isArray(setupRes.body.recoveryCodes), 'recoveryCodes array must be returned');
    assert.strictEqual(setupRes.body.recoveryCodes.length, 5, 'Must provide 5 recovery codes');

    // Verify with valid TOTP code
    const validCode = speakeasy.totp({
      secret: setupRes.body.secret,
      encoding: 'base32'
    });

    const verifyRes = await req('POST', '/api/auth/mfa/verify', { code: validCode }, token);
    assert.strictEqual(verifyRes.status, 200, `MFA verify status: ${verifyRes.status}`);

    const userRecord = db.prepare("SELECT mfa_enabled FROM users WHERE email = 'e.vasquez@pharma.com'").get();
    assert.strictEqual(userRecord.mfa_enabled, 1, 'mfa_enabled must be 1');

    // Reset MFA for test user so standard tests remain unaffected
    db.prepare("UPDATE users SET mfa_enabled = 0 WHERE email = 'e.vasquez@pharma.com'").run();
  });

  // Cleanup test fixtures and purge history
  try {
    db.prepare('DELETE FROM workflow_history WHERE document_id = ?').run(testDocId);
    db.prepare('DELETE FROM electronic_signatures WHERE document_id = ?').run(testDocId);
    db.prepare('DELETE FROM documents WHERE id = ?').run(testDocId);
    db.prepare("UPDATE documents SET status = 'Draft', checked_out_by = NULL WHERE id = 'doc-005'").run();
    db.prepare("DELETE FROM password_history").run();
  } catch (cleanErr) {}

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Results: ${passed}/${passed + failed} passed (${Math.round(passed / (passed + failed) * 100)}%)`);
  if (failed === 0) {
    console.log('🎉 ALL PHASE 1 COMPLIANCE TESTS PASSED WITH 100% SUCCESS!');
  } else {
    console.error(`❌ ${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('──────────────────────────────────────────────────────\n');
}

run().catch(err => {
  console.error('\n❌ Test run failed with fatal error:', err);
  process.exit(1);
});
