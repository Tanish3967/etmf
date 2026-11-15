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
  console.log('🧪 Phase 6 Milestone M1: QC Audit Plans & Participants Tests');
  console.log('======================================================\n');

  // 1. Authenticate
  const loginRes = await req('POST', '/api/auth/login', {
    email: 'e.vasquez@pharma.com',
    password: 'Admin1234!'
  });
  assert.strictEqual(loginRes.status, 200, 'Login failed');
  const token = loginRes.body.token;

  // 2. Test GET /api/qc/plans
  await test('GET /api/qc/plans returns plans array', async () => {
    const res = await req('GET', '/api/qc/plans', null, token);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.plans), 'Expected plans to be an array');
  });

  // 3. Test POST /api/qc/plans validations
  await test('POST /api/qc/plans rejects missing required fields (400)', async () => {
    const res = await req('POST', '/api/qc/plans', {
      title: 'Missing other fields'
    }, token);
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });

  await test('POST /api/qc/plans rejects invalid date range start_date > end_date (400)', async () => {
    const res = await req('POST', '/api/qc/plans', {
      title: 'Invalid Date Plan',
      study_id: 'study-001',
      lead_auditor: 'Tom Eriksen',
      start_date: '2026-12-31',
      end_date: '2026-01-01',
      scope_description: 'Test invalid dates'
    }, token);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'INVALID_DATE_RANGE');
  });

  let createdPlanId = null;

  // 4. Test POST /api/qc/plans success
  await test('POST /api/qc/plans creates plan and auto-assigns lead auditor (201)', async () => {
    const res = await req('POST', '/api/qc/plans', {
      title: 'Phase III Good Clinical Practice Audit',
      study_id: 'study-001',
      lead_auditor: 'Tom Eriksen',
      start_date: '2026-11-20',
      end_date: '2026-11-25',
      scope_description: 'Comprehensive review of DIA Zone 01 & 03 files',
      status: 'Draft'
    }, token);
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.plan);
    assert.strictEqual(res.body.plan.title, 'Phase III Good Clinical Practice Audit');
    assert.strictEqual(res.body.plan.status, 'Draft');
    assert.strictEqual(res.body.plan.lead_auditor, 'Tom Eriksen');
    createdPlanId = res.body.plan.id;
  });

  // 5. Test GET /api/qc/plans/:id
  await test('GET /api/qc/plans/:id retrieves plan with participants and documents', async () => {
    const res = await req('GET', `/api/qc/plans/${createdPlanId}`, null, token);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.plan);
    assert.strictEqual(res.body.plan.id, createdPlanId);
    assert.ok(Array.isArray(res.body.participants));
    assert.ok(Array.isArray(res.body.documents));
    // Verify auto-assigned lead auditor participant
    const lead = res.body.participants.find(p => p.role === 'Lead Auditor');
    assert.ok(lead, 'Lead auditor participant should be present');
    assert.strictEqual(lead.user_name, 'Tom Eriksen');
  });

  // 6. Test GET /api/qc/plans filtering
  await test('GET /api/qc/plans filters by study_id and status', async () => {
    const res = await req('GET', '/api/qc/plans?study_id=study-001&status=Draft', null, token);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.plans.length > 0);
    const found = res.body.plans.find(p => p.id === createdPlanId);
    assert.ok(found, 'Created plan should be in filtered list');
  });

  // 7. Test PUT /api/qc/plans/:id
  await test('PUT /api/qc/plans/:id updates plan status and scope description', async () => {
    const res = await req('PUT', `/api/qc/plans/${createdPlanId}`, {
      status: 'Active',
      scope_description: 'Updated scope: All protocol amendments and ICFs'
    }, token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.plan.status, 'Active');
    assert.strictEqual(res.body.plan.scope_description, 'Updated scope: All protocol amendments and ICFs');
  });

  // 8. Test PUT /api/qc/plans/:id validates date range
  await test('PUT /api/qc/plans/:id rejects invalid date range (400)', async () => {
    const res = await req('PUT', `/api/qc/plans/${createdPlanId}`, {
      start_date: '2027-01-01',
      end_date: '2026-01-01'
    }, token);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'INVALID_DATE_RANGE');
  });

  // 9. Test POST /api/qc/plans/:id/participants
  await test('POST /api/qc/plans/:id/participants rejects invalid role (400)', async () => {
    const res = await req('POST', `/api/qc/plans/${createdPlanId}/participants`, {
      user_id: 'usr-002',
      role: 'InvalidRole'
    }, token);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'INVALID_ROLE');
  });

  await test('POST /api/qc/plans/:id/participants assigns Auditee (201)', async () => {
    const res = await req('POST', `/api/qc/plans/${createdPlanId}/participants`, {
      user_id: 'usr-002',
      role: 'Auditee',
      notification_sent: true
    }, token);
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.participant);
    assert.strictEqual(res.body.participant.role, 'Auditee');
    assert.strictEqual(res.body.participant.user_name, 'Dr. Sarah Chen');
  });

  await test('POST /api/qc/plans/:id/participants prevents duplicate participant assignment (409)', async () => {
    const res = await req('POST', `/api/qc/plans/${createdPlanId}/participants`, {
      user_id: 'usr-002',
      role: 'Auditee'
    }, token);
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.code, 'DUPLICATE_PARTICIPANT');
  });

  // 10. Test GET /api/qc/plans/:id/participants
  await test('GET /api/qc/plans/:id/participants returns all participants', async () => {
    const res = await req('GET', `/api/qc/plans/${createdPlanId}/participants`, null, token);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.participants));
    assert.strictEqual(res.body.participants.length, 2); // Lead Auditor + Auditee
  });

  // 11. Test Signature Reason Templates
  await test('GET /api/admin/signature-reasons returns seeded default templates', async () => {
    const res = await req('GET', '/api/admin/signature-reasons', null, token);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.reasons));
    assert.ok(res.body.reasons.length >= 4, 'Expected at least 4 default signature reasons');
    const authorReason = res.body.reasons.find(r => r.reason_code === 'AUTHOR_APPROVAL');
    assert.ok(authorReason, 'AUTHOR_APPROVAL template should be present');
    assert.strictEqual(authorReason.role_required, 'AUTHOR');
  });

  let customCode = null;
  await test('POST /api/admin/signature-reasons creates new custom template', async () => {
    customCode = `SITE_CLOSEOUT_${Date.now()}`;
    const res = await req('POST', '/api/admin/signature-reasons', {
      reason_code: customCode,
      description: 'I confirm all close-out reconciliation activities are complete',
      role_required: 'CRA'
    }, token);
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.reason);
    assert.strictEqual(res.body.reason.reason_code, customCode);
  });

  await test('POST /api/admin/signature-reasons rejects duplicate reason_code with 409 DUPLICATE_REASON_CODE and preserves audit log integrity', async () => {
    // 1. Snapshot audit log count before duplicate attempt
    const auditBefore = await req('GET', '/api/audit?action=Signature+Reason+Added', null, token);
    assert.strictEqual(auditBefore.status, 200);
    const countBefore = Array.isArray(auditBefore.body.logs) ? auditBefore.body.logs.length : 0;

    // 2. Submit duplicate reason_code
    const dupRes = await req('POST', '/api/admin/signature-reasons', {
      reason_code: customCode,
      description: 'Attempting duplicate reason template with identical code',
      role_required: 'AUDITOR'
    }, token);

    // 3. Verify HTTP 409 Conflict and DUPLICATE_REASON_CODE error code
    assert.strictEqual(dupRes.status, 409, 'Duplicate reason code should return HTTP 409 Conflict');
    assert.strictEqual(dupRes.body.code, 'DUPLICATE_REASON_CODE', 'Error code should be DUPLICATE_REASON_CODE');
    assert.ok(dupRes.body.error && dupRes.body.error.includes(customCode), 'Error message should reference the duplicate code');

    // 4. Assert audit log was NOT modified upon 409 rejection (21 CFR Part 11 integrity)
    const auditAfter = await req('GET', '/api/audit?action=Signature+Reason+Added', null, token);
    assert.strictEqual(auditAfter.status, 200);
    const countAfter = Array.isArray(auditAfter.body.logs) ? auditAfter.body.logs.length : 0;
    assert.strictEqual(countAfter, countBefore, 'Audit log count must not increment when duplicate signature reason is rejected');
  });

  await test('POST /api/qc/plans with external non-system lead auditor assigns null user_id (not creator)', async () => {
    const extPlanRes = await req('POST', '/api/qc/plans', {
      title: 'External Auditor FDA Inspection Review',
      study_id: 'study-001',
      lead_auditor: 'Dr. External GCP Auditor NonUser',
      start_date: '2026-11-20',
      end_date: '2026-11-25',
      scope_description: 'External regulatory audit'
    }, token);
    assert.strictEqual(extPlanRes.status, 201);
    const planDetail = await req('GET', `/api/qc/plans/${extPlanRes.body.plan.id}`, null, token);
    assert.strictEqual(planDetail.status, 200);
    const leadParticipant = planDetail.body.participants.find(p => p.role === 'Lead Auditor');
    assert.ok(leadParticipant, 'Lead Auditor participant must exist');
    assert.strictEqual(leadParticipant.user_id, null, 'External lead auditor user_id must be null, not creator ID');
    assert.strictEqual(leadParticipant.user_name, 'Dr. External GCP Auditor NonUser');
  });

  // 12. Verify Audit Trail for Plan and Participant creation
  await test('Audit trail records Audit Plan and Participant operations (21 CFR Part 11)', async () => {
    const res = await req('GET', `/api/audit?action=Audit+Plan`, null, token);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.logs.length > 0, 'Audit trail should log audit plan actions');
  });

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Results: ${passed}/${passed + failed} passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  if (failed === 0) {
    console.log('🎉 ALL PHASE 6 M1 API TESTS PASSED WITH 100% SUCCESS!');
  } else {
    console.log(`❌ ${failed} tests failed!`);
    process.exit(1);
  }
  console.log('──────────────────────────────────────────────────────\n');
}

run().catch(e => {
  console.error('Test execution error:', e);
  process.exit(1);
});
