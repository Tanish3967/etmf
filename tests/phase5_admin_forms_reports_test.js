// tests/phase5_admin_forms_reports_test.js
// Phase 5 Verification: Application Admin, In-Use Codelist Guard, Dynamic Forms Runtime & 19 Clinical Reports Suite
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3002/api';
let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    \x1b[31m${e.message}\x1b[0m`);
    failed++;
  }
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

console.log('\n\x1b[1m━━━ Phase 5: Admin, Dynamic Forms & 19 Clinical Reports Suite ━━━\x1b[0m\n');

let adminToken = '';
let codelistId = '';
let schemaId = '';
let formDataId = '';

await test('1. Authenticate Admin User', async () => {
  const r = await req('POST', '/auth/login', { email: 'e.vasquez@pharma.com', password: 'Admin1234!' });
  assert.equal(r.status, 200);
  adminToken = r.data.token;
});

await test('2. System Codelists CRUD & In-Use Deletion Guard (409 CODELIST_IN_USE)', async () => {
  const code = `CL-${Date.now().toString().slice(-4)}`;
  const createRes = await req('POST', '/admin/system-codelists', {
    code,
    name: `Clinical Dept ${code}`,
    group_name: 'DEPARTMENT',
    is_active: true,
  }, adminToken);
  assert.equal(createRes.status, 201);
  codelistId = createRes.data.codelist.id;

  // Test In-Use Deletion Guard (forceInUse=true simulates active reference)
  const blockDel = await req('DELETE', `/admin/system-codelists/${codelistId}?forceInUse=true`, null, adminToken);
  assert.equal(blockDel.status, 409);
  assert.equal(blockDel.data.code, 'CODELIST_IN_USE');

  // Normal delete when not in use succeeds
  const okDel = await req('DELETE', `/admin/system-codelists/${codelistId}`, null, adminToken);
  assert.equal(okDel.status, 200);
});

await test('3. Application Admin: Document Classifications & Custom Metadata Setup (up to 30 fields)', async () => {
  const clsRes = await req('POST', '/admin/classifications', {
    code: `CLS-${Date.now().toString().slice(-4)}`,
    name: 'Investigator Brochure Classification',
    expiryDays: 365,
    quickUploadWorkflow: 'Review and Approve',
    watermarkText: 'CONTROLLED CLINICAL COPY',
    coverPage: true,
    revisionRule: 'Major.Minor',
    trueCopy: true,
  }, adminToken);
  assert.equal(clsRes.status, 201);

  const getCls = await req('GET', '/admin/classifications', null, adminToken);
  assert.equal(getCls.status, 200);
  assert.ok(getCls.data.classifications.length > 0);

  const metaRes = await req('POST', '/admin/metadata-setup', {
    customFields: [
      { name: 'protocol_amendment', type: 'AlphaNumeric', mandatory: true },
      { name: 'investigational_product', type: 'SelectList', mandatory: false },
    ],
    displayFormat: '{ARTIFACT_CODE} - {TITLE} (v{VERSION})',
    downloadFormat: '{STUDY}_{ARTIFACT_CODE}_{DOC_ID}_v{VERSION}',
  }, adminToken);
  assert.equal(metaRes.status, 200);
  assert.equal(metaRes.data.customFields.length, 2);
});

await test('4. Dynamic Forms & Logs: Submit -> Lock -> Unlock -> Freeze -> Push to eTMF Folder', async () => {
  const schemasRes = await req('GET', '/forms/schemas', null, adminToken);
  assert.equal(schemasRes.status, 200);
  assert.ok(schemasRes.data.schemas.length > 0);
  schemaId = schemasRes.data.schemas[0].id;

  const submitRes = await req('POST', `/forms/${schemaId}/data`, {
    study_id: 'study-001',
    data_json: {
      site_number: 'Site-101',
      pi_name: 'Dr. Elena Vasquez',
      records: [{ staff_name: 'James OBrien', study_role: 'Sub-Investigator', start_date: '2026-01-10' }],
    },
  }, adminToken);
  assert.equal(submitRes.status, 201);
  formDataId = submitRes.data.id;

  // Lock
  const lockRes = await req('PATCH', `/forms/data/${formDataId}/lock`, { reason: 'Monitoring review complete' }, adminToken);
  assert.equal(lockRes.status, 200);
  assert.equal(lockRes.data.is_locked, 1);

  // Unlock
  const unlockRes = await req('PATCH', `/forms/data/${formDataId}/unlock`, { reason: 'Add new sub-investigator row' }, adminToken);
  assert.equal(unlockRes.status, 200);
  assert.equal(unlockRes.data.is_locked, 0);

  // Freeze
  const freezeRes = await req('PATCH', `/forms/data/${formDataId}/freeze`, { freeze: true, reason: 'Interim database lock' }, adminToken);
  assert.equal(freezeRes.status, 200);
  assert.equal(freezeRes.data.is_frozen, 1);

  // Push to eTMF Folder
  const pushRes = await req('POST', `/forms/${formDataId}/push-to-etmf`, {}, adminToken);
  assert.equal(pushRes.status, 201);
  assert.ok(pushRes.data.documentId);
});

await test('5. Verify all 19 Clinevo Clinical Reports return 200 OK', async () => {
  const reportEndpoints = [
    '/reports/audit',
    '/reports/application-users',
    '/reports/blinded',
    '/reports/completeness?studyId=study-001',
    '/reports/compliance',
    '/reports/controlled-documents',
    '/reports/copy-log',
    '/reports/expiry?studyId=study-001',
    '/reports/exports',
    '/reports/workflow?studyId=study-001',
    '/reports/move-log',
    '/reports/inactivated',
    '/reports/inventory',
    '/reports/folder-history',
    '/reports/notes',
    '/reports/quality',
    '/reports/queries',
    '/reports/removed-documents',
    '/reports/scheduled-jobs',
    '/reports/timeliness',
  ];

  for (const ep of reportEndpoints) {
    const r = await req('GET', ep, null, adminToken);
    assert.equal(r.status, 200, `Report endpoint ${ep} returned ${r.status}`);
    assert.ok(r.data.report, `Report endpoint ${ep} missing report title`);
  }
});

console.log(`\n\x1b[1mPhase 5 Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
if (failed > 0) process.exit(1);
