/**
 * Dedicated Test Suite for Sprints 3, 4, and 5
 * Run: node tests/sprints_3_4_5_test.js
 * Validates:
 *   - Sprint 3: Workflow Transitions & 21 CFR Part 11 Electronic Signatures
 *   - Sprint 4: Ingestion Engine & Document Upload
 *   - Sprint 5: Regulatory Inspection Mode & Quality Control Lifecycle
 */
import http from 'http';
import { initDB, getDB } from '../src/database.js';

const BASE = process.env.TEST_URL || 'http://localhost:3002';
let passed = 0;
let failed = 0;
let token = null;
let inspectorToken = null;
let testDocId = 'doc-004'; // Lab Certification v1.0
let newUploadedDocId = null;
let qcQueryId = null;

async function req(method, path, body, authToken, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body && typeof body === 'object' ? JSON.stringify(body) : body;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        ...(typeof body === 'object' && { 'Content-Type': 'application/json' }),
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        ...(data && { 'Content-Length': Buffer.byteLength(data) }),
        ...customHeaders
      },
    };
    const r = http.request(options, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function test(name, fn) {
  return fn().then(r => {
    console.log(`  ✅  ${name}`);
    passed++;
    return r;
  }).catch(e => {
    console.log(`  ❌  ${name}: ${e.message}`);
    failed++;
  });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function runSprintsTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 eTMF Pro — Automated Verification for Sprints 3, 4, 5');
  console.log('======================================================\n');

  // Database Fixture Reset
  initDB();
  const db = getDB();

  // Reset doc-004 to Draft for workflow test
  db.pragma('foreign_keys = OFF');
  db.prepare("UPDATE documents SET status = 'Draft' WHERE id = 'doc-004'").run();
  db.prepare("DELETE FROM electronic_signatures WHERE document_id = 'doc-004'").run();
  db.prepare("DELETE FROM workflow_history WHERE document_id = 'doc-004' AND to_state != 'Draft'").run();
  db.prepare("DELETE FROM sessions WHERE user_id = 'usr-inspector'").run();
  db.prepare("DELETE FROM users WHERE id = 'usr-inspector'").run();
  db.pragma('foreign_keys = ON');

  // ── Step 0: Authenticate Elena (TMF Manager) ──────────────────────────
  console.log('🔑 Authentication Setup');
  await test('Login as TMF Manager (Elena Vasquez)', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'e.vasquez@pharma.com', password: 'Admin1234!' });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.token, 'No token in response');
    token = r.body.token;
  });

  await test('Login as Inspector / Auditor (Tom Eriksen)', async () => {
    const r = await req('POST', '/api/auth/login', { email: 't.eriksen@ema.europa.eu', password: 'Admin1234!' });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.token, 'No token in response');
    inspectorToken = r.body.token;
  });

  // ── SPRINT 3: WORKFLOW ORCHESTRATION & 21 CFR PART 11 E-SIGNATURE ────
  console.log('\n⚡ Sprint 3: Workflow State Machine & 21 CFR Part 11 e-Signatures');

  await test('Transition doc-004: Draft → Pending Review', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, { nextState: 'Pending Review', comment: 'Ready for QC audit' }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.document.status === 'Pending Review', `Expected Pending Review, got ${r.body.document?.status}`);
  });

  await test('Invalid direct transition: Pending Review → Approved without review rejected (400)', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, { nextState: 'Approved' }, token);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Transition doc-004: Pending Review → Review Complete', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, { nextState: 'Review Complete', comment: 'QC checks passed' }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.document.status === 'Review Complete', `Expected Review Complete, got ${r.body.document?.status}`);
  });

  await test('Transition doc-004: Review Complete → Pending Approval', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, { nextState: 'Pending Approval', comment: 'Awaiting manager signoff' }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.document.status === 'Pending Approval', `Expected Pending Approval, got ${r.body.document?.status}`);
  });

  await test('21 CFR Part 11: Transition to Approved WITHOUT credentials rejected (400 ESIG_REQUIRED)', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, { nextState: 'Approved' }, token);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
    assert(r.body.code === 'ESIG_REQUIRED', `Expected ESIG_REQUIRED, got ${r.body.code}`);
  });

  await test('21 CFR Part 11: Transition to Approved with WRONG password rejected (401 ESIG_FAILED)', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, {
      nextState: 'Approved',
      credentials: { password: 'WrongPassword123!', meaning: 'Approved' }
    }, token);
    assert(r.status === 401, `Expected 401, got ${r.status}`);
    assert(r.body.code === 'ESIG_FAILED', `Expected ESIG_FAILED, got ${r.body.code}`);
  });

  await test('21 CFR Part 11: Transition to Approved with VALID credentials succeeds & stores SHA-256 seal', async () => {
    const r = await req('POST', `/api/workflow/${testDocId}/transition`, {
      nextState: 'Approved',
      comment: 'Approved following regulatory audit verification',
      credentials: {
        password: 'Admin1234!',
        meaning: 'I approve this document for clinical trial conduct'
      }
    }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.document.status === 'Approved', `Expected Approved, got ${r.body.document?.status}`);
    assert(r.body.esigId, 'No esigId generated');

    // Verify cryptographic seal stored in electronic_signatures SQLite table
    const sig = db.prepare('SELECT * FROM electronic_signatures WHERE id = ?').get(r.body.esigId);
    assert(sig, 'Electronic signature record not found in database');
    assert(sig.sig_hash && sig.sig_hash.length === 64, 'Signature hash is not SHA-256');
    assert(sig.meaning.includes('approve'), 'Signature meaning not stored');
  });

  await test('Workflow Audit Lineage: GET /api/documents/:id returns full transition history', async () => {
    const r = await req('GET', `/api/documents/${testDocId}`, null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.workflowHistory), 'workflowHistory is not array');
    assert(r.body.workflowHistory.length >= 4, `Expected at least 4 transitions, got ${r.body.workflowHistory.length}`);
    const approvedStep = r.body.workflowHistory.find(h => h.to_state === 'Approved');
    assert(approvedStep && approvedStep.esig_id, 'Approved step does not reference esig_id');
  });

  // ── SPRINT 4: INGESTION ENGINE & BULK UPLOAD ──────────────────────────
  console.log('\n📥 Sprint 4: Ingestion Engine & Bulk Upload');

  await test('Ingestion Engine: Upload document with DIA v3.2 metadata payload', async () => {
    const docPayload = {
      studyId: 'study-001',
      artifactCode: '08.01.03',
      artifactName: 'Laboratory Equipment Calibration Certificate',
      zone: '08',
      section: '08.01',
      title: 'Lab Analyzer Calibration Certificate 2026',
      version: '1.0',
      country: 'USA',
      confidential: false,
      mandatory: true,
      status: 'Draft'
    };

    const r = await req('POST', '/api/documents', docPayload, token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.document, 'No document in response');
    assert(r.body.document.artifact_code === '08.01.03', 'Artifact code mismatch');
    assert(r.body.document.status === 'Draft', 'New document must start in Draft state');
    newUploadedDocId = r.body.document.id;
  });

  await test('Ingestion Audit: Upload generates initial Draft workflow entry and ALCOA+ audit record', async () => {
    assert(newUploadedDocId, 'No uploaded doc ID from previous test');
    const wf = db.prepare('SELECT * FROM workflow_history WHERE document_id = ?').all(newUploadedDocId);
    assert(wf.length >= 1, 'No workflow entry created on upload');
    assert(wf[0].to_state === 'Draft', 'Initial workflow state is not Draft');

    const audit = db.prepare("SELECT * FROM audit_log WHERE object_id = ? AND action = 'Uploaded'").get(newUploadedDocId);
    assert(audit, 'ALCOA+ Uploaded audit record not found');
  });

  await test('Document Blob Download: GET /api/documents/:id/download responds successfully', async () => {
    const r = await req('GET', '/api/documents/doc-001/download', null, token);
    assert(r.status === 200 || r.status === 204 || r.status === 302, `Expected 200, 204 or 302, got ${r.status}`);
  });

  // ── SPRINT 5: REGULATORY INSPECTION & QUALITY CONTROL ─────────────────
  console.log('\n🏛️ Sprint 5: Regulatory Inspection Mode & Quality Control Center');

  await test('Inspector Security Lockdown: Block modifications by inspector persona', async () => {
    // Attempt checkout as inspector role using inspectorToken
    const r = await req('POST', '/api/documents/doc-001/checkout', {}, inspectorToken);
    assert(r.status === 403, `Inspector checkout status: ${r.status}, expected 403`);
    assert(r.body.code === 'INSPECTOR_READ_ONLY', `Expected INSPECTOR_READ_ONLY, got ${r.body.code}`);
  });

  await test('Quality Control: GET /api/qc returns queries list', async () => {
    const r = await req('GET', '/api/qc', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.queries), 'Queries is not array');
  });

  await test('Quality Control: POST /api/qc logs a new non-conformance defect query', async () => {
    const r = await req('POST', '/api/qc', {
      document_id: testDocId,
      query_text: 'Verification of digital timestamp against NTP reference source',
      severity: 'Critical'
    }, token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.id, 'No query ID returned');
    qcQueryId = r.body.id;
  });

  await test('Quality Control: PATCH /api/qc/:id resolves finding with ALCOA+ audit comment', async () => {
    assert(qcQueryId, 'No query ID from previous test');
    const r = await req('PATCH', `/api/qc/${qcQueryId}`, {
      status: 'Closed',
      audit_comments: 'NTP sync verified with regulatory audit log.'
    }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);

    const q = db.prepare('SELECT * FROM queries WHERE id = ?').get(qcQueryId);
    assert(q && q.status === 'Closed', 'Query status not updated to Closed');
  });

  // ── FINAL SUMMARY ─────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('──────────────────────────────────────────────────────\n');

  if (failed > 0) {
    console.error(`❌ Verification failed: ${failed} tests failed.`);
    process.exit(1);
  } else {
    console.log('✅ All tests passed! Sprints 3, 4, and 5 verified with 100% compliance.\n');
    process.exit(0);
  }
}

runSprintsTestSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
