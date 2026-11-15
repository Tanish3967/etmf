import assert from 'assert';

const BASE = process.env.TEST_URL || 'http://localhost:3002';

async function req(method, path, body, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
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
    console.log(`  ❌  ${name}: ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Phase 6 Milestone M2: Quality Check, Deletion Lock & Compliance Guards');
  console.log('======================================================\n');

  // 1. Authenticate as TMF Manager / Admin
  const loginRes = await req('POST', '/api/auth/login', {
    email: 'e.vasquez@pharma.com',
    password: 'Admin1234!'
  });
  assert.strictEqual(loginRes.status, 200, 'Login failed');
  const token = loginRes.body.token;

  // 2. Prepare test documents and audit plan
  // Create an audit plan for testing
  const planRes = await req('POST', '/api/qc/plans', {
    title: 'M2 Quality Assurance & GCP Inspection Audit Plan',
    study_id: 'study-001',
    lead_auditor: 'Tom Eriksen',
    start_date: '2026-11-20',
    end_date: '2026-11-28',
    scope_description: 'Milestone M2 Document Quality Verification',
    status: 'Active'
  }, token);
  assert.strictEqual(planRes.status, 201, 'Audit plan creation failed');
  const planId = planRes.body.plan.id;

  // Create Document A (for audited deletion lock test)
  const formDocA = new FormData();
  formDocA.append('file', new Blob(['Protocol Signature Page v1.0 Content'], { type: 'text/plain' }), 'Protocol_Signature_DocA.txt');
  formDocA.append('data', JSON.stringify({
    studyId: 'study-001',
    artifactCode: '01.01.02',
    title: 'Audited Protocol Signature Document A',
    version: '1.0'
  }));

  const uploadDocARes = await fetch(`${BASE}/api/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'tenant-001' },
    body: formDocA
  });
  assert.strictEqual(uploadDocARes.status, 201, 'Doc A upload failed');
  const docAData = await uploadDocARes.json();
  const docAId = docAData.document.id;

  // Create Document B (for un-audited document inactivation test)
  const formDocB = new FormData();
  formDocB.append('file', new Blob(['Investigator Brochure Draft Content'], { type: 'text/plain' }), 'IB_Draft_DocB.txt');
  formDocB.append('data', JSON.stringify({
    studyId: 'study-001',
    artifactCode: '01.02.01',
    title: 'Un-audited Investigator Brochure Document B',
    version: '1.0'
  }));

  const uploadDocBRes = await fetch(`${BASE}/api/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'tenant-001' },
    body: formDocB
  });
  assert.strictEqual(uploadDocBRes.status, 201, 'Doc B upload failed');
  const docBData = await uploadDocBRes.json();
  const docBId = docBData.document.id;

  // ── TEST SUITE: DOCUMENT QUALITY CHECK (POST /api/qc/check) ──────────

  await test('POST /api/qc/check validates required fields (400 Bad Request)', async () => {
    // Missing plan_id
    const res1 = await req('POST', '/api/qc/check', { document_id: docAId }, token);
    assert.strictEqual(res1.status, 400);
    assert.strictEqual(res1.body.code, 'PLAN_REQUIRED');

    // Missing document_id
    const res2 = await req('POST', '/api/qc/check', { plan_id: planId }, token);
    assert.strictEqual(res2.status, 400);
    assert.strictEqual(res2.body.code, 'DOCUMENT_REQUIRED');

    // Invalid status
    const res3 = await req('POST', '/api/qc/check', {
      plan_id: planId,
      document_id: docAId,
      status: 'InvalidStatus'
    }, token);
    assert.strictEqual(res3.status, 400);
    assert.strictEqual(res3.body.code, 'INVALID_STATUS');
  });

  await test('POST /api/qc/check validates entity existence for tenant (404 Not Found)', async () => {
    // Non-existent plan
    const res1 = await req('POST', '/api/qc/check', {
      plan_id: 'non-existent-plan-id',
      document_id: docAId,
      status: 'Conformant'
    }, token);
    assert.strictEqual(res1.status, 404);
    assert.strictEqual(res1.body.code, 'PLAN_NOT_FOUND');

    // Non-existent document
    const res2 = await req('POST', '/api/qc/check', {
      plan_id: planId,
      document_id: 'non-existent-doc-id',
      status: 'Conformant'
    }, token);
    assert.strictEqual(res2.status, 404);
    assert.strictEqual(res2.body.code, 'DOCUMENT_NOT_FOUND');
  });

  let auditRecordId = null;

  await test('POST /api/qc/check records document quality check with 201 Created', async () => {
    const res = await req('POST', '/api/qc/check', {
      plan_id: planId,
      document_id: docAId,
      findings: 'Missing PI e-signature manifestation on page 3',
      status: 'Deficient'
    }, token);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.message, 'Document quality check recorded');
    assert.ok(res.body.audit_record);
    assert.strictEqual(res.body.audit_record.audit_plan_id, planId);
    assert.strictEqual(res.body.audit_record.document_id, docAId);
    assert.strictEqual(res.body.audit_record.status, 'Deficient');
    assert.strictEqual(res.body.audit_record.findings, 'Missing PI e-signature manifestation on page 3');
    assert.ok(res.body.audit_record.audited_by);
    assert.ok(res.body.audit_record.audited_at);
    auditRecordId = res.body.audit_record.id;
  });

  await test('Duplicate Audit Prevention: POST /api/qc/check rejects duplicate document check with 409 Conflict', async () => {
    const res = await req('POST', '/api/qc/check', {
      plan_id: planId,
      document_id: docAId,
      findings: 'Attempting duplicate audit check',
      status: 'Conformant'
    }, token);

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.code, 'DUPLICATE_AUDIT');
    assert.strictEqual(res.body.error, 'Document already audited under this plan');
  });

  // ── TEST SUITE: AUDITED DOCUMENT DELETION LOCK ───────────────────────

  await test('Audited Document Deletion Lock: PATCH /api/documents/:id/inactivate rejects inactivation with 409 AUDITED_DOC_LOCKED', async () => {
    const res = await req('PATCH', `/api/documents/${docAId}/inactivate`, {
      reason: 'Attempting to retire audited document'
    }, token);

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.code, 'AUDITED_DOC_LOCKED');
    assert.strictEqual(res.body.audit_plan_id, planId);
    assert.ok(res.body.error.includes('GCP/Part 11 Retention Requirement'));
  });

  await test('Audited Document Deletion Lock: DELETE /api/documents/:id rejects deletion with 409 AUDITED_DOC_LOCKED', async () => {
    const res = await req('DELETE', `/api/documents/${docAId}`, null, token);

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.code, 'AUDITED_DOC_LOCKED');
    assert.strictEqual(res.body.audit_plan_id, planId);
  });

  await test('Un-audited Document Inactivation: PATCH /api/documents/:id/inactivate succeeds with 200 OK', async () => {
    const res = await req('PATCH', `/api/documents/${docBId}/inactivate`, {
      reason: 'Routine soft deletion of superseded draft'
    }, token);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message, 'Document inactivated (soft deleted)');

    // Verify document is inactive (GET returns 404 since active=1 filter applies)
    const getDocRes = await req('GET', `/api/documents/${docBId}`, null, token);
    assert.strictEqual(getDocRes.status, 404);
  });

  // ── TEST SUITE: AUDITEE RESPONSE WORKFLOW ────────────────────────────

  await test('POST /api/qc/plans/:id/responses validates auditee response required (400)', async () => {
    const res = await req('POST', `/api/qc/plans/${planId}/responses`, {
      document_id: docAId,
      finding_id: auditRecordId
    }, token);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'RESPONSE_REQUIRED');
  });

  let responseRecordId = null;

  await test('POST /api/qc/plans/:id/responses records auditee response and updates finding status (201)', async () => {
    const res = await req('POST', `/api/qc/plans/${planId}/responses`, {
      document_id: docAId,
      finding_id: auditRecordId,
      auditee_response: 'Page 3 PI signature verified and authenticated via 21 CFR Part 11 compliant digital certificate.',
      capa_reference: 'CAPA-2026-QC-0042'
    }, token);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.response);
    assert.strictEqual(res.body.response.audit_plan_id, planId);
    assert.strictEqual(res.body.response.document_id, docAId);
    assert.strictEqual(res.body.response.finding_id, auditRecordId);
    assert.strictEqual(res.body.response.capa_reference, 'CAPA-2026-QC-0042');
    assert.strictEqual(res.body.response.status, 'Submitted');

    // Verify finding status in audit_plan_documents updated to Responded
    assert.ok(res.body.audit_record);
    assert.strictEqual(res.body.audit_record.status, 'Responded');
    responseRecordId = res.body.response.id;
  });

  await test('GET /api/qc/plans/:id/responses returns responses for the plan', async () => {
    const res = await req('GET', `/api/qc/plans/${planId}/responses`, null, token);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.responses));
    assert.ok(res.body.responses.length > 0);
    const found = res.body.responses.find(r => r.id === responseRecordId);
    assert.ok(found, 'Response record must be found in plan responses');
    assert.strictEqual(found.capa_reference, 'CAPA-2026-QC-0042');
  });

  await test('GET /api/qc/plans/:id includes responses and audited documents', async () => {
    const res = await req('GET', `/api/qc/plans/${planId}`, null, token);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.responses));
    assert.ok(res.body.responses.length > 0);
    assert.ok(Array.isArray(res.body.documents));
    const auditedDoc = res.body.documents.find(d => d.id === auditRecordId);
    assert.ok(auditedDoc, 'Audited document must be listed in plan documents');
    assert.strictEqual(auditedDoc.status, 'Responded');
  });

  // ── TEST SUITE: CLINICAL DATA FILE FORMATS (.sas7bdat & .xpt) ───────

  await test('Clinical Data Ingestion: SAS dataset (.sas7bdat) uploads successfully with 201 Created', async () => {
    const formSas = new FormData();
    const mockSasBinary = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x53, 0x41, 0x53, 0x20, 0x44, 0x41, 0x54, 0x41]); // Mock SAS header
    formSas.append('file', new Blob([mockSasBinary], { type: 'application/x-sas-data' }), 'clinical_adam_dataset.sas7bdat');
    formSas.append('data', JSON.stringify({
      studyId: 'study-001',
      artifactCode: '11.01.01',
      title: 'ADaM Subject-Level Analysis Dataset (ADSL)',
      version: '1.0'
    }));

    const res = await fetch(`${BASE}/api/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'tenant-001' },
      body: formSas
    });

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.document.file_type, 'SAS7BDAT');
    assert.strictEqual(data.document.file_name, 'clinical_adam_dataset.sas7bdat');
    assert.ok(data.document.file_sha256, 'Binary SHA-256 hash must be computed');
  });

  await test('Clinical Data Ingestion: SAS transport file (.xpt) uploads successfully with 201 Created', async () => {
    const formXpt = new FormData();
    const mockXptBinary = new TextEncoder().encode('HEADER RECORD*******LIBRARY HEADER RECORD!!!!!!!0000000000000000');
    formXpt.append('file', new Blob([mockXptBinary], { type: 'application/x-xport' }), 'sdtm_ae_transport.xpt');
    formXpt.append('data', JSON.stringify({
      studyId: 'study-001',
      artifactCode: '11.02.01',
      title: 'SDTM Adverse Events Dataset (AE.xpt)',
      version: '1.0'
    }));

    const res = await fetch(`${BASE}/api/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'tenant-001' },
      body: formXpt
    });

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.document.file_type, 'XPT');
    assert.strictEqual(data.document.file_name, 'sdtm_ae_transport.xpt');
    assert.ok(data.document.file_sha256, 'Binary SHA-256 hash must be computed');
  });

  // ── TEST SUITE: 21 CFR PART 11 AUDIT TRAIL VERIFICATION ──────────────

  await test('21 CFR Part 11 Audit Trail records all M2 Quality & Compliance actions', async () => {
    const auditRes = await req('GET', '/api/audit?limit=100', null, token);
    assert.strictEqual(auditRes.status, 200);
    const logs = auditRes.body.logs || [];
    assert.ok(Array.isArray(logs), 'Audit trail must be an array');

    // Verify Quality Check audit log
    const qcLog = logs.find(l => l.action === 'Document Quality Check' && l.object_id === auditRecordId);
    assert.ok(qcLog, 'Document Quality Check audit log must be recorded');
    assert.strictEqual(qcLog.object_type, 'audit_plan_document');
    assert.ok(qcLog.created_at, 'Timestamp must exist');
    assert.ok(qcLog.user_name, 'User name must exist');

    // Verify Auditee Response audit log
    const respLog = logs.find(l => l.action === 'Audit Response Submitted' && l.object_id === responseRecordId);
    assert.ok(respLog, 'Audit Response Submitted audit log must be recorded');
    assert.strictEqual(respLog.object_type, 'audit_response');
    assert.ok(respLog.created_at, 'Timestamp must exist');

    // Verify Document Inactivation audit log
    const inactLog = logs.find(l => l.action === 'Inactivated' && l.object_id === docBId);
    assert.ok(inactLog, 'Inactivated document audit log must be recorded');
  });

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Results: ${passed}/${passed + failed} passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  if (failed === 0) {
    console.log('🎉 ALL PHASE 6 M2 API TESTS PASSED WITH 100% SUCCESS!');
  } else {
    console.log(`❌ ${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('──────────────────────────────────────────────────────\n');
}

run().catch(err => {
  console.error('\n❌ Test suite fatal error:', err);
  process.exit(1);
});
