import http from 'http';
import assert from 'assert';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3002';

function req(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const client = http.request(url, { method, headers }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (_) { parsed = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    client.on('error', reject);
    if (data) client.write(data);
    client.end();
  });
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

async function runTests() {
  console.log('\n======================================================');
  console.log('🤖 eTMF Pro — Antigravity Document Orchestrator Test Suite');
  console.log('======================================================\n');

  console.log('🔑 Authentication');
  const loginRes = await req('POST', '/api/auth/login', {
    email: 'e.vasquez@pharma.com',
    password: 'Admin1234!'
  });
  assert(loginRes.status === 200, `Login failed: ${loginRes.status}`);
  const token = loginRes.body.token;

  // 1. Schema & Prompt Verification
  console.log('\n📐 Schema & Prompt Verification (Google AI Studio Specification)');

  await test('GET /api/ai/schema returns DIA v3.2 JSON Schema matching master prompt', async () => {
    const res = await req('GET', '/api/ai/schema', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const schema = res.body.responseSchema;
    assert(schema.type === 'object', 'schema type must be object');
    assert(schema.properties.dia_classification, 'dia_classification missing');
    assert(schema.properties.metadata, 'metadata missing');
    assert(schema.properties.smart_qc_flags, 'smart_qc_flags missing');
    assert(schema.properties.dia_classification.properties.confidence_score, 'confidence_score missing');
  });

  await test('GET /api/ai/prompts returns System Instructions & Persona', async () => {
    const res = await req('GET', '/api/ai/prompts', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.systemInstruction.includes('DIA TMF Reference Model v3.2'), 'Missing DIA standard reference');
    assert(res.body.systemInstruction.includes('confidence_score'), 'Missing confidence guidance');
  });

  // 2. Condition A: High Confidence & Flawless Document (>= 0.85 & empty QC flags)
  console.log('\n⚡ Execution Routing: Condition A (High Confidence >= 0.85 & Clean QC)');
  const docIdConditionA = `DOC-ORCH-A-${Date.now()}`;

  await test('Condition A: Route document to Pending Review, map Zone/Section/Artifact', async () => {
    const res = await req('POST', '/api/ai/orchestrate', {
      documentId: docIdConditionA,
      fileName: '02.01.01_Clinical_Study_Protocol_v3.pdf',
      documentText: 'CLINICAL STUDY PROTOCOL PROTO-2026-ONCO. Phase III Multi-Center Randomized Double-Blind Study. Effective Date: 2026-03-01. Sponsor: BioPharm International. Signed by Chief Medical Officer.',
      studyId: 'study-001'
    }, token);

    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.assigned_status === 'Pending Review', `Expected Pending Review, got ${res.body.assigned_status}`);
    assert(res.body.routing_condition.includes('Condition A'), 'Expected Condition A routing');
    assert(res.body.dia_classification.confidence_score >= 0.85, 'Confidence score must be >= 0.85');
    assert(res.body.smart_qc_flags.length === 0, 'smart_qc_flags must be empty');
    assert(res.body.dia_classification.zone_code === '02', 'Zone must be 02 Central Trial');
    assert(res.body.dia_classification.artifact_code === 'TMF-02.01.001', 'Artifact must be Protocol');
    assert(res.body.shadow_audit.immutable_hash, 'Missing 21 CFR Part 11 shadow audit hash');
  });

  // 3. Condition B: High Confidence with Quality Deficiencies (>= 0.85 & QC Flags Present)
  console.log('\n🔍 Execution Routing: Condition B (High Confidence >= 0.85 with Quality Issues)');
  const docIdConditionB = `DOC-ORCH-B-${Date.now()}`;

  await test('Condition B: Route document to Under Review & auto-generate Open Queries in QC Module', async () => {
    const res = await req('POST', '/api/ai/orchestrate', {
      documentId: docIdConditionB,
      fileName: 'FDA_Form_1572_Site001_Defective.pdf',
      documentText: 'FDA Form 1572 Statement of Investigator. Site-001. Principal Investigator Dr. Robert Chen. Warning: [signature line empty] - unsigned form and blurry illegible stamp on page 2.',
      studyId: 'study-001'
    }, token);

    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.assigned_status === 'Under Review', `Expected Under Review, got ${res.body.assigned_status}`);
    assert(res.body.routing_condition.includes('Condition B'), 'Expected Condition B routing');
    assert(res.body.smart_qc_flags.length > 0, 'Expected quality deficiency flags');
    assert(res.body.generated_queries.length > 0, 'Expected auto-generated QC queries');
    assert(res.body.generated_queries[0].severity === 'Major', 'Expected Major severity query');
    assert(res.body.generated_queries[0].status === 'Open', 'Expected Open query status');

    // Verify query exists in QC module
    const qcRes = await req('GET', `/api/qc?docId=${docIdConditionB}`, null, token);
    assert(qcRes.status === 200, `Expected 200 from QC endpoint, got ${qcRes.status}`);
    assert(qcRes.body.queries.length > 0, 'Query not found in QC table');
  });

  // 4. Condition C: Low Confidence / Ambiguous Document (< 0.85)
  console.log('\n⚠️ Execution Routing: Condition C (Low Confidence < 0.85 - Manual Triage)');
  const docIdConditionC = `DOC-ORCH-C-${Date.now()}`;

  await test('Condition C: Route document to Draft with Requires Manual Triage (Do not auto-file)', async () => {
    const res = await req('POST', '/api/ai/orchestrate', {
      documentId: docIdConditionC,
      fileName: 'Scanned_Receipt_Notes_Ambiguous.pdf',
      documentText: 'scanned receipt draft notes ambiguous handwritten expense item memo with unclear trial reference.',
      studyId: 'study-001'
    }, token);

    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.assigned_status === 'Draft', `Expected Draft, got ${res.body.assigned_status}`);
    assert(res.body.manual_triage_required === true, 'manual_triage_required must be true');
    assert(res.body.routing_condition.includes('Condition C'), 'Expected Condition C routing');
    assert(res.body.dia_classification.confidence_score < 0.85, 'Confidence score must be < 0.85');
  });

  // 5. 21 CFR Part 11 Shadow Audit & Immutable Trail Verification
  console.log('\n📜 21 CFR Part 11 Shadow Audit Trail Verification');

  await test('Audit trail records immutable AI classification decisions and parameters', async () => {
    const auditRes = await req('GET', `/api/ai/audit`, null, token);
    assert(auditRes.status === 200, `Expected 200, got ${auditRes.status}`);
    assert(Array.isArray(auditRes.body.logs), 'Missing audit logs array');
    const entry = auditRes.body.logs.find(l => l.document_id === docIdConditionA);
    assert(entry, 'Missing audit log entry for Condition A');
    assert(entry.suggested_code === 'TMF-02.01.001', 'Audit log must record suggested code');
    assert(entry.action.includes('Condition A'), 'Audit log must record routing condition');
  });

  // TEARDOWN: Clean up test documents and queries
  try {
    const { getDB } = await import('../src/database.js');
    const db = getDB();
    db.prepare('DELETE FROM queries WHERE document_id IN (?, ?, ?)').run(docIdConditionA, docIdConditionB, docIdConditionC);
    db.prepare('DELETE FROM ai_audit WHERE document_id IN (?, ?, ?)').run(docIdConditionA, docIdConditionB, docIdConditionC);
    db.prepare('DELETE FROM documents WHERE id IN (?, ?, ?)').run(docIdConditionA, docIdConditionB, docIdConditionC);
  } catch (_) {}

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('──────────────────────────────────────────────────────\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
