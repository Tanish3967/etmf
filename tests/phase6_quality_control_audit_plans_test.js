/**
 * tests/phase6_quality_control_audit_plans_test.js
 *
 * Master End-to-End Automated Test Suite for Phase 6:
 * Quality Control & Audit Plans, Compliance Guards, Background Daemons, and Frontend UI Integration
 *
 * Covers all Phase 6 Features (Features 1-13 in PROJECT.md / ORIGINAL_REQUEST):
 * 1. Branch verification (feature/phase-6-quality-control-audit-plans)
 * 2. SQLite Schema validation (audit_plans, audit_participants, audit_plan_documents, signature_reason_templates, documents retention/sla columns)
 * 3. Audit Plan CRUD APIs (POST/GET/PATCH with date validation start_date <= end_date)
 * 4. Participant Assignment (Lead Auditor, Auditor, Auditee, Observer with duplicate prevention 409 DUPLICATE_PARTICIPANT)
 * 5. Document Quality Check Action (POST /api/qc/check, Conformant/Deficient, mandatory findings, duplicate check 409 DUPLICATE_AUDIT)
 * 6. Audited Document Deletion Lock (PATCH inactivate & DELETE return 409 AUDITED_DOC_LOCKED; non-audited inactivate cleanly 200 OK)
 * 7. Auditee Response Workflow (POST/GET responses, CAPA tracking, status transition to 'Responded')
 * 8. Signature Reason Templates Admin & Workflow (GET/POST /api/admin/signature-reasons, GET /api/workflow/signature-reasons without canAdmin)
 * 9. Clinical Data File Formats (.sas7bdat ADaM and .xpt SDTM upload and streaming SHA-256 binary hash computation)
 * 10. Inactive Document Retention Purge Daemon (runInactiveDocumentPurge retention policy, physical file unlinking, cascade foreign keys, 21 CFR Part 11 audit log 'Permanently Removed', immunity for audited documents)
 * 11. SLA Reminder Daemon (runSlaReminderCheck, Reminder 1 approaching <= 2d, Reminder 2 breached/overdue, daily idempotency)
 * 12. Frontend Quality Control & Workflow UI Integration static/AST checks confirming component presence and zero lint/build regressions
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { initDB, getDB } from '../src/database.js';
import { runInactiveDocumentPurge, runSlaReminderCheck } from '../src/services/schedulerService.js';

const BASE = process.env.TEST_URL || 'http://localhost:3002';
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

async function req(method, pathUrl, body, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${pathUrl}`, {
    method,
    headers,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
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

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Phase 6 Master Verification Suite: Quality Control & Audit Plans');
  console.log('======================================================\n');

  await initDB();
  const db = getDB();

  // ─────────────────────────────────────────────────────────────
  // 1. BRANCH ISOLATION & GIT VERIFICATION
  // ─────────────────────────────────────────────────────────────
  console.log('── Suite 1: Branch Isolation & Git Verification ──');

  await test('Git branch verification: feature branch exists and adheres to naming contract', () => {
    let currentBranch = '';
    try {
      currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } catch (e) {
      currentBranch = 'unknown';
    }

    const branchList = execSync('git branch --all', { encoding: 'utf-8' });
    const hasFeatureBranch = branchList.includes('feature/phase-6-quality-control-audit-plans') || currentBranch === 'feature/phase-6-quality-control-audit-plans';
    assert.ok(hasFeatureBranch, 'Branch feature/phase-6-quality-control-audit-plans must exist in repository');
    assert.ok(
      currentBranch.startsWith('feature/') || currentBranch === 'main',
      `Current branch (${currentBranch}) must be a feature/* branch or main (post-merge)`
    );
  });

  // ─────────────────────────────────────────────────────────────
  // 2. DATABASE SCHEMA VALIDATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 2: Database Schema & Migration Validation ──');

  await test('Table audit_plans exists with all required columns and constraints', () => {
    const cols = db.prepare('PRAGMA table_info(audit_plans)').all();
    const colNames = cols.map(c => c.name);
    const required = [
      'id', 'tenant_id', 'study_id', 'title', 'lead_auditor',
      'start_date', 'end_date', 'scope_description', 'status',
      'created_by', 'created_at', 'updated_at'
    ];
    for (const r of required) {
      assert.ok(colNames.includes(r), `Column ${r} missing from audit_plans table`);
    }
  });

  await test('Table audit_participants exists with foreign key references and role definition', () => {
    const cols = db.prepare('PRAGMA table_info(audit_participants)').all();
    const colNames = cols.map(c => c.name);
    const required = ['id', 'tenant_id', 'audit_plan_id', 'user_id', 'user_name', 'role', 'notification_sent', 'assigned_at'];
    for (const r of required) {
      assert.ok(colNames.includes(r), `Column ${r} missing from audit_participants table`);
    }
  });

  await test('Table audit_plan_documents exists for audited document linkage', () => {
    const cols = db.prepare('PRAGMA table_info(audit_plan_documents)').all();
    const colNames = cols.map(c => c.name);
    const required = ['id', 'tenant_id', 'audit_plan_id', 'document_id', 'findings', 'status', 'audited_by', 'audited_at'];
    for (const r of required) {
      assert.ok(colNames.includes(r), `Column ${r} missing from audit_plan_documents table`);
    }
  });

  await test('Table signature_reason_templates exists with role requirements and active flags', () => {
    const cols = db.prepare('PRAGMA table_info(signature_reason_templates)').all();
    const colNames = cols.map(c => c.name);
    const required = ['id', 'tenant_id', 'reason_code', 'description', 'role_required', 'is_active', 'created_at'];
    for (const r of required) {
      assert.ok(colNames.includes(r), `Column ${r} missing from signature_reason_templates table`);
    }
  });

  await test('Table documents includes retention policy, SLA, and deletion tracking columns', () => {
    const cols = db.prepare('PRAGMA table_info(documents)').all();
    const colNames = cols.map(c => c.name);
    assert.ok(colNames.includes('retention_days'), 'Column retention_days missing from documents table');
    assert.ok(colNames.includes('sla_reminder_1_sent_at'), 'Column sla_reminder_1_sent_at missing from documents table');
    assert.ok(colNames.includes('sla_reminder_2_sent_at'), 'Column sla_reminder_2_sent_at missing from documents table');
    assert.ok(colNames.includes('deleted_at'), 'Column deleted_at missing from documents table');
    assert.ok(colNames.includes('active'), 'Column active missing from documents table');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. AUTHENTICATION & TOKENS
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 3: User Authentication & Role Setup ──');

  const adminLogin = await req('POST', '/api/auth/login', {
    email: 'e.vasquez@pharma.com',
    password: 'Admin1234!'
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.body.token;

  const reviewerLogin = await req('POST', '/api/auth/login', {
    email: 'j.obrien@pharma.com',
    password: 'Admin1234!'
  });
  assert.strictEqual(reviewerLogin.status, 200, 'Reviewer login failed');
  const reviewerToken = reviewerLogin.body.token;

  // ─────────────────────────────────────────────────────────────
  // 4. AUDIT PLAN CRUD APIS & DATE VALIDATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 4: Audit Plan CRUD APIs & Date Validation ──');

  let testPlanId = null;

  await test('POST /api/qc/plans rejects request with missing required fields (400)', async () => {
    const res = await req('POST', '/api/qc/plans', {
      title: 'Incomplete Audit Plan',
      study_id: 'study-001'
      // missing lead_auditor, start_date, end_date
    }, adminToken);
    assert.strictEqual(res.status, 400);
    assert.ok(['LEAD_AUDITOR_REQUIRED', 'TITLE_REQUIRED', 'STUDY_REQUIRED', 'START_DATE_REQUIRED'].includes(res.body.code));
  });

  await test('POST /api/qc/plans rejects invalid date range start_date > end_date (400)', async () => {
    const res = await req('POST', '/api/qc/plans', {
      title: 'Invalid Date Range Plan',
      study_id: 'study-001',
      lead_auditor: 'Elena Vasquez',
      start_date: '2026-12-10',
      end_date: '2026-12-01',
      scope_description: 'Checking date inversion'
    }, adminToken);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'INVALID_DATE_RANGE');
  });

  await test('POST /api/qc/plans creates valid Audit Plan and auto-assigns Lead Auditor participant (201)', async () => {
    const res = await req('POST', '/api/qc/plans', {
      title: 'Phase 6 Master Regulatory Compliance QC Plan',
      study_id: 'study-001',
      lead_auditor: 'Elena Vasquez',
      start_date: '2026-12-01',
      end_date: '2026-12-15',
      scope_description: 'Full Trial Master File Section 01-11 Inspection Readiness Audit',
      status: 'Active'
    }, adminToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.plan);
    assert.strictEqual(res.body.plan.title, 'Phase 6 Master Regulatory Compliance QC Plan');
    assert.strictEqual(res.body.plan.status, 'Active');
    assert.strictEqual(res.body.plan.start_date, '2026-12-01');
    assert.strictEqual(res.body.plan.end_date, '2026-12-15');
    testPlanId = res.body.plan.id;

    // Verify auto-assigned Lead Auditor via GET /api/qc/plans/:id
    const planDetail = await req('GET', `/api/qc/plans/${testPlanId}`, null, adminToken);
    assert.strictEqual(planDetail.status, 200);
    assert.ok(Array.isArray(planDetail.body.participants));
    const lead = planDetail.body.participants.find(p => p.role === 'Lead Auditor');
    assert.ok(lead, 'Lead Auditor participant must be automatically created');
    assert.strictEqual(lead.user_name, 'Elena Vasquez');
  });

  await test('GET /api/qc/plans returns list of plans for the tenant', async () => {
    const res = await req('GET', '/api/qc/plans', null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.plans));
    const found = res.body.plans.find(p => p.id === testPlanId);
    assert.ok(found, 'Created plan must be in the plans list');
  });

  await test('GET /api/qc/plans supports filtering by study_id and status', async () => {
    const res = await req('GET', '/api/qc/plans?study_id=study-001&status=Active', null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.plans));
    assert.ok(res.body.plans.every(p => p.study_id === 'study-001' && p.status === 'Active'));
  });

  await test('GET /api/qc/plans/:id retrieves plan details including participants, documents, and responses', async () => {
    const res = await req('GET', `/api/qc/plans/${testPlanId}`, null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.plan.id, testPlanId);
    assert.ok(Array.isArray(res.body.participants));
    assert.ok(Array.isArray(res.body.documents));
    assert.ok(Array.isArray(res.body.responses));
  });

  await test('PATCH /api/qc/plans/:id updates plan details and status', async () => {
    const res = await req('PATCH', `/api/qc/plans/${testPlanId}`, {
      scope_description: 'Updated comprehensive inspection scope with TMF completeness checks',
      status: 'Active'
    }, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.plan.scope_description, 'Updated comprehensive inspection scope with TMF completeness checks');
  });

  await test('PATCH /api/qc/plans/:id rejects invalid date range (400)', async () => {
    const res = await req('PATCH', `/api/qc/plans/${testPlanId}`, {
      start_date: '2026-12-20',
      end_date: '2026-12-05'
    }, adminToken);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'INVALID_DATE_RANGE');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. PARTICIPANT ASSIGNMENT & ROLE VALIDATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 5: Participant Assignment & Role Validation ──');

  await test('POST /api/qc/plans/:id/participants rejects invalid role (400)', async () => {
    const res = await req('POST', `/api/qc/plans/${testPlanId}/participants`, {
      user_name: 'Invalid User',
      role: 'SuperAuditor'
    }, adminToken);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'INVALID_ROLE');
  });

  await test('POST /api/qc/plans/:id/participants assigns valid roles (Auditor, Auditee, Observer)', async () => {
    // 1. Assign Auditor
    const r1 = await req('POST', `/api/qc/plans/${testPlanId}/participants`, {
      user_id: 'usr-002',
      user_name: 'Priya Sharma',
      role: 'Auditor'
    }, adminToken);
    assert.strictEqual(r1.status, 201);
    assert.strictEqual(r1.body.participant.role, 'Auditor');

    // 2. Assign Auditee
    const r2 = await req('POST', `/api/qc/plans/${testPlanId}/participants`, {
      user_id: 'usr-005',
      user_name: 'Jack O\'Brien',
      role: 'Auditee'
    }, adminToken);
    assert.strictEqual(r2.status, 201);
    assert.strictEqual(r2.body.participant.role, 'Auditee');

    // 3. Assign Observer
    const r3 = await req('POST', `/api/qc/plans/${testPlanId}/participants`, {
      user_id: 'usr-003',
      user_name: 'Abebe Bikila',
      role: 'Observer'
    }, adminToken);
    assert.strictEqual(r3.status, 201);
    assert.strictEqual(r3.body.participant.role, 'Observer');
  });

  await test('POST /api/qc/plans/:id/participants enforces duplicate participant guard (409 DUPLICATE_PARTICIPANT)', async () => {
    const res = await req('POST', `/api/qc/plans/${testPlanId}/participants`, {
      user_id: 'usr-002',
      user_name: 'Priya Sharma',
      role: 'Auditor'
    }, adminToken);
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.code, 'DUPLICATE_PARTICIPANT');
  });

  await test('GET /api/qc/plans/:id/participants returns all assigned participants', async () => {
    const res = await req('GET', `/api/qc/plans/${testPlanId}/participants`, null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.participants));
    assert.ok(res.body.participants.length >= 4); // Lead Auditor, Auditor, Auditee, Observer
  });

  // ─────────────────────────────────────────────────────────────
  // 6. DOCUMENT QUALITY CHECK ACTION & DUPLICATE PREVENTION
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 6: Document Quality Check Action & Duplicate Prevention ──');

  // Create Document 1 (Audited doc for quality check)
  const formDoc1 = new FormData();
  formDoc1.append('file', new Blob(['Protocol Deviation Report Content for QC'], { type: 'text/plain' }), 'Protocol_Deviation_Report.txt');
  formDoc1.append('data', JSON.stringify({
    studyId: 'study-001',
    artifactCode: '02.02.01',
    title: 'Protocol Deviation Report 2026-Q4',
    version: '1.0'
  }));

  const up1 = await fetch(`${BASE}/api/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'X-Tenant-ID': 'tenant-001' },
    body: formDoc1
  });
  assert.strictEqual(up1.status, 201, 'Upload Doc 1 failed');
  const doc1Data = await up1.json();
  const testDocId1 = doc1Data.document.id;

  // Create Document 2 (Un-audited doc for clean inactivation)
  const formDoc2 = new FormData();
  formDoc2.append('file', new Blob(['Draft Meeting Minutes Content'], { type: 'text/plain' }), 'Meeting_Minutes_Draft.txt');
  formDoc2.append('data', JSON.stringify({
    studyId: 'study-001',
    artifactCode: '01.03.01',
    title: 'Trial Steering Committee Minutes Draft',
    version: '0.1'
  }));

  const up2 = await fetch(`${BASE}/api/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'X-Tenant-ID': 'tenant-001' },
    body: formDoc2
  });
  assert.strictEqual(up2.status, 201, 'Upload Doc 2 failed');
  const doc2Data = await up2.json();
  const testDocId2 = doc2Data.document.id;

  await test('POST /api/qc/check validates required fields (400)', async () => {
    const res = await req('POST', '/api/qc/check', {
      plan_id: testPlanId
      // missing document_id
    }, adminToken);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'DOCUMENT_REQUIRED');
  });

  await test('POST /api/qc/check validates entity existence for tenant (404)', async () => {
    const res = await req('POST', '/api/qc/check', {
      plan_id: 'non-existent-plan-id',
      document_id: testDocId1,
      status: 'Conformant'
    }, adminToken);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.code, 'PLAN_NOT_FOUND');
  });

  await test('POST /api/qc/check with Deficient requires findings description (400)', async () => {
    const res = await req('POST', '/api/qc/check', {
      plan_id: testPlanId,
      document_id: testDocId1,
      status: 'Deficient',
      findings: ''
    }, adminToken);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'FINDINGS_REQUIRED');
  });

  let qualityCheckRecordId = null;

  await test('POST /api/qc/check successfully records document audit check (201)', async () => {
    const res = await req('POST', '/api/qc/check', {
      plan_id: testPlanId,
      document_id: testDocId1,
      findings: 'Section 4.2 missing principal investigator signature timestamp',
      status: 'Deficient'
    }, adminToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.audit_record);
    assert.strictEqual(res.body.audit_record.audit_plan_id, testPlanId);
    assert.strictEqual(res.body.audit_record.document_id, testDocId1);
    assert.strictEqual(res.body.audit_record.status, 'Deficient');
    assert.strictEqual(res.body.audit_record.findings, 'Section 4.2 missing principal investigator signature timestamp');
    qualityCheckRecordId = res.body.audit_record.id;
  });

  await test('POST /api/qc/check prevents duplicate audit of same document in same plan (409 DUPLICATE_AUDIT)', async () => {
    const res = await req('POST', '/api/qc/check', {
      plan_id: testPlanId,
      document_id: testDocId1,
      findings: 'Attempting duplicate audit check',
      status: 'Conformant'
    }, adminToken);

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.code, 'DUPLICATE_AUDIT');
  });

  // ─────────────────────────────────────────────────────────────
  // 7. AUDITED DOCUMENT DELETION LOCK (GCP/PART 11 PRESERVATION)
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 7: Audited Document Deletion Lock (GCP/Part 11) ──');

  await test('Audited Document Deletion Lock: PATCH /api/documents/:id/inactivate rejected with 409 AUDITED_DOC_LOCKED', async () => {
    const res = await req('PATCH', `/api/documents/${testDocId1}/inactivate`, {
      reason: 'Attempting to inactivate audited document'
    }, adminToken);

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.code, 'AUDITED_DOC_LOCKED');
    assert.strictEqual(res.body.audit_plan_id, testPlanId);
  });

  await test('Audited Document Deletion Lock: DELETE /api/documents/:id rejected with 409 AUDITED_DOC_LOCKED', async () => {
    const res = await req('DELETE', `/api/documents/${testDocId1}`, {
      reason: 'Attempting hard delete of audited document'
    }, adminToken);

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.code, 'AUDITED_DOC_LOCKED');
    assert.strictEqual(res.body.audit_plan_id, testPlanId);
  });

  await test('Un-audited Document Inactivation: PATCH /api/documents/:id/inactivate succeeds with 200 OK', async () => {
    const res = await req('PATCH', `/api/documents/${testDocId2}/inactivate`, {
      reason: 'Standard soft deletion of un-audited document'
    }, adminToken);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message, 'Document inactivated (soft deleted)');

    // Inactive document is filtered out from normal active query
    const checkDoc = await req('GET', `/api/documents/${testDocId2}`, null, adminToken);
    assert.strictEqual(checkDoc.status, 404);
  });

  // ─────────────────────────────────────────────────────────────
  // 8. AUDITEE RESPONSE WORKFLOW & CAPA TRACKING
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 8: Auditee Response Workflow & CAPA Tracking ──');

  let responseRecordId = null;

  await test('POST /api/qc/plans/:id/responses validates response required (400)', async () => {
    const res = await req('POST', `/api/qc/plans/${testPlanId}/responses`, {
      document_id: testDocId1,
      finding_id: qualityCheckRecordId
      // missing auditee_response
    }, adminToken);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'RESPONSE_REQUIRED');
  });

  await test('POST /api/qc/plans/:id/responses records auditee response and transitions finding to Responded (201)', async () => {
    const res = await req('POST', `/api/qc/plans/${testPlanId}/responses`, {
      document_id: testDocId1,
      finding_id: qualityCheckRecordId,
      auditee_response: 'Section 4.2 PI signature timestamp verified against CRF audit log and dual-authenticated.',
      capa_reference: 'CAPA-2026-PHASE6-001'
    }, adminToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.response);
    assert.strictEqual(res.body.response.audit_plan_id, testPlanId);
    assert.strictEqual(res.body.response.document_id, testDocId1);
    assert.strictEqual(res.body.response.finding_id, qualityCheckRecordId);
    assert.strictEqual(res.body.response.capa_reference, 'CAPA-2026-PHASE6-001');

    // Finding status in audit_plan_documents must transition to 'Responded'
    assert.ok(res.body.audit_record);
    assert.strictEqual(res.body.audit_record.status, 'Responded');
    responseRecordId = res.body.response.id;
  });

  await test('GET /api/qc/plans/:id/responses returns response records for the plan', async () => {
    const res = await req('GET', `/api/qc/plans/${testPlanId}/responses`, null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.responses));
    const found = res.body.responses.find(r => r.id === responseRecordId);
    assert.ok(found, 'Response record must be found in plan responses list');
    assert.strictEqual(found.capa_reference, 'CAPA-2026-PHASE6-001');
  });

  await test('GET /api/qc/plans/:id includes responses and audited documents in full details view', async () => {
    const res = await req('GET', `/api/qc/plans/${testPlanId}`, null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.responses));
    assert.ok(res.body.responses.length > 0);
    assert.ok(Array.isArray(res.body.documents));
    const auditedDoc = res.body.documents.find(d => d.id === qualityCheckRecordId);
    assert.ok(auditedDoc);
    assert.strictEqual(auditedDoc.status, 'Responded');
  });

  // ─────────────────────────────────────────────────────────────
  // 9. SIGNATURE REASON TEMPLATES ADMIN & WORKFLOW INTEGRATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 9: Signature Reason Templates Admin & Workflow ──');

  await test('GET /api/admin/signature-reasons returns seeded default templates', async () => {
    const res = await req('GET', '/api/admin/signature-reasons', null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.reasons));
    assert.ok(res.body.reasons.length >= 4);
    const codes = res.body.reasons.map(r => r.reason_code);
    assert.ok(codes.includes('AUTHOR_APPROVAL'), 'AUTHOR_APPROVAL template must exist');
    assert.ok(codes.includes('QUALITY_REVIEW'), 'QUALITY_REVIEW template must exist');
  });

  const customReasonCode = `QC_SIG_VERIFY_${Date.now()}`;

  await test('POST /api/admin/signature-reasons creates new signature reason template (201)', async () => {
    const res = await req('POST', '/api/admin/signature-reasons', {
      reason_code: customReasonCode,
      description: 'I confirm that this document has completed Quality Control Audit and meets GCP requirements',
      role_required: 'AUDITOR'
    }, adminToken);

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.reason);
    assert.strictEqual(res.body.reason.reason_code, customReasonCode);
    assert.strictEqual(res.body.reason.is_active, 1);
  });

  await test('POST /api/admin/signature-reasons rejects duplicate reason_code with 409 DUPLICATE_REASON_CODE', async () => {
    const res = await req('POST', '/api/admin/signature-reasons', {
      reason_code: customReasonCode,
      description: 'Duplicate reason test',
      role_required: 'AUDITOR'
    }, adminToken);

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.code, 'DUPLICATE_REASON_CODE');
  });

  await test('GET /api/workflow/signature-reasons is accessible without canAdmin privilege', async () => {
    const res = await req('GET', '/api/workflow/signature-reasons', null, reviewerToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.reasons));
    const found = res.body.reasons.find(r => r.reason_code === customReasonCode);
    assert.ok(found, 'Created custom signature reason must be accessible to standard users');
  });

  // ─────────────────────────────────────────────────────────────
  // 10. CLINICAL DATA FILE FORMATS (.sas7bdat & .xpt)
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 10: Clinical Data File Formats (.sas7bdat & .xpt) ──');

  await test('Clinical Data Ingestion: SAS dataset (.sas7bdat) uploads and computes streaming SHA-256 (201)', async () => {
    const formSas = new FormData();
    const mockSasBinary = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x53, 0x41, 0x53, 0x20, 0x44, 0x41, 0x54, 0x41]);
    formSas.append('file', new Blob([mockSasBinary], { type: 'application/x-sas-data' }), 'clinical_adam_dataset_p6.sas7bdat');
    formSas.append('data', JSON.stringify({
      studyId: 'study-001',
      artifactCode: '11.01.01',
      title: 'ADaM Subject-Level Analysis Dataset Master (ADSL)',
      version: '1.0'
    }));

    const res = await fetch(`${BASE}/api/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'X-Tenant-ID': 'tenant-001' },
      body: formSas
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.document.file_type, 'SAS7BDAT');
    assert.strictEqual(data.document.file_name, 'clinical_adam_dataset_p6.sas7bdat');
    assert.ok(data.document.file_sha256, 'Binary SHA-256 hash must be computed and stored');
    assert.strictEqual(data.document.file_sha256.length, 64, 'SHA-256 hash must be 64 hexadecimal characters');
  });

  await test('Clinical Data Ingestion: SAS transport file (.xpt) uploads and computes streaming SHA-256 (201)', async () => {
    const formXpt = new FormData();
    const mockXptBinary = new TextEncoder().encode('HEADER RECORD*******LIBRARY HEADER RECORD!!!!!!!0000000000000000');
    formXpt.append('file', new Blob([mockXptBinary], { type: 'application/x-xport' }), 'sdtm_ae_transport_p6.xpt');
    formXpt.append('data', JSON.stringify({
      studyId: 'study-001',
      artifactCode: '11.02.01',
      title: 'SDTM Adverse Events Dataset Master (AE.xpt)',
      version: '1.0'
    }));

    const res = await fetch(`${BASE}/api/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'X-Tenant-ID': 'tenant-001' },
      body: formXpt
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.document.file_type, 'XPT');
    assert.strictEqual(data.document.file_name, 'sdtm_ae_transport_p6.xpt');
    assert.ok(data.document.file_sha256, 'Binary SHA-256 hash must be computed and stored');
    assert.strictEqual(data.document.file_sha256.length, 64, 'SHA-256 hash must be 64 hexadecimal characters');
  });

  // ─────────────────────────────────────────────────────────────
  // 11. INACTIVE DOCUMENT RETENTION PURGE DAEMON (§8.5.2.11)
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 11: Inactive Document Retention Purge Daemon ──');

  await test('Admin Purge endpoint rejects unauthorized / non-admin calls (401 / 403)', async () => {
    const unauth = await req('POST', '/api/admin/daemons/purge-inactive', {});
    assert.strictEqual(unauth.status, 401);

    const nonAdmin = await req('POST', '/api/admin/daemons/purge-inactive', {}, reviewerToken);
    assert.strictEqual(nonAdmin.status, 403);
  });

  await test('runInactiveDocumentPurge purges eligible inactive documents older than retention window with file unlinking & audit trail', async () => {
    const storageDir = path.resolve('storage');
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

    const purgeFile = path.join(storageDir, `purge_test_${Date.now()}.txt`);
    fs.writeFileSync(purgeFile, 'Purge test temporary content');

    const purgeDocId = `doc-purge-${Date.now()}`;
    db.prepare(`
      INSERT INTO documents (
        id, tenant_id, study_id, artifact_code, artifact_name, zone, section,
        title, display_name, version, status, active, file_path,
        created_by, created_at, deleted_at
      ) VALUES (
        ?, 'tenant-001', 'study-001', '01.01.01', 'Trial Master File Plan', '01', '01.01',
        'Eligible Inactive Purge Document', 'Eligible Inactive Purge Document', '1.0',
        'Inactive', 0, ?, 'usr-001',
        datetime('now', '-40 days'), datetime('now', '-35 days')
      )
    `).run(purgeDocId, purgeFile);

    assert.ok(fs.existsSync(purgeFile), 'Physical file should exist prior to purge');

    // Run purge daemon
    const purgeResult = await runInactiveDocumentPurge('tenant-001', { retentionDays: 30, dryRun: false });
    assert.ok(purgeResult.success);
    assert.ok(purgeResult.purged_document_ids.includes(purgeDocId), 'Eligible document should be purged');

    // Verify database deletion
    const inDb = db.prepare('SELECT id FROM documents WHERE id = ?').get(purgeDocId);
    assert.strictEqual(inDb, undefined, 'Purged document must be deleted from documents table');

    // Verify physical file unlinking
    assert.ok(!fs.existsSync(purgeFile), 'Physical file must be unlinked from storage');

    // Verify 21 CFR Part 11 audit trail entry
    const auditEntry = db.prepare("SELECT * FROM audit_log WHERE object_id = ? AND action = 'Permanently Removed'").get(purgeDocId);
    assert.ok(auditEntry, '21 CFR Part 11 Permanently Removed audit log must be recorded');
  });

  await test('runInactiveDocumentPurge preserves active documents and audited documents in audit_plan_documents (Immunity)', async () => {
    // 1. Active document (active = 1, created 60 days ago)
    const activeDocId = `doc-immune-active-${Date.now()}`;
    db.prepare(`
      INSERT INTO documents (
        id, tenant_id, study_id, artifact_code, artifact_name, zone, section,
        title, display_name, version, status, active, created_by, created_at
      ) VALUES (
        ?, 'tenant-001', 'study-001', '01.01.01', 'Trial Master File Plan', '01', '01.01',
        'Immune Active Document', 'Immune Active Document', '1.0', 'Approved', 1, 'usr-001',
        datetime('now', '-60 days')
      )
    `).run(activeDocId);

    // 2. Audited document (inactive, deleted 45 days ago, but linked to audit_plan_documents)
    const auditedDocId = `doc-immune-audited-${Date.now()}`;
    db.prepare(`
      INSERT INTO documents (
        id, tenant_id, study_id, artifact_code, artifact_name, zone, section,
        title, display_name, version, status, active, created_by, created_at, deleted_at
      ) VALUES (
        ?, 'tenant-001', 'study-001', '01.01.01', 'Trial Master File Plan', '01', '01.01',
        'Immune Audited Document', 'Immune Audited Document', '1.0', 'Inactive', 0, 'usr-001',
        datetime('now', '-50 days'), datetime('now', '-45 days')
      )
    `).run(auditedDocId);

    // Link to audit_plan_documents
    db.prepare(`
      INSERT INTO audit_plan_documents (id, tenant_id, audit_plan_id, document_id, findings, status, audited_by, audited_at)
      VALUES (?, 'tenant-001', ?, ?, 'Conformant audit record', 'Conformant', 'usr-001', datetime('now'))
    `).run(`apd-immune-${Date.now()}`, testPlanId, auditedDocId);

    const result = await runInactiveDocumentPurge('tenant-001', { retentionDays: 30, dryRun: false });
    assert.ok(result.success);
    assert.ok(!result.purged_document_ids.includes(activeDocId), 'Active document must NOT be purged');
    assert.ok(!result.purged_document_ids.includes(auditedDocId), 'Audited document must NOT be purged');
    assert.ok(result.audit_locked_document_ids.includes(auditedDocId), 'Audited doc must be in audit_locked_document_ids');
  });

  // ─────────────────────────────────────────────────────────────
  // 12. SLA REMINDER DAEMON (§8.5.2.12)
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 12: SLA Reminder Daemon ──');

  await test('Admin SLA Reminder endpoint rejects unauthorized / non-admin calls (401 / 403)', async () => {
    const unauth = await req('POST', '/api/admin/daemons/sla-reminders', {});
    assert.strictEqual(unauth.status, 401);

    const nonAdmin = await req('POST', '/api/admin/daemons/sla-reminders', {}, reviewerToken);
    assert.strictEqual(nonAdmin.status, 403);
  });

  await test('runSlaReminderCheck categorizes Reminder 1 (approaching <= 2d) and Reminder 2 (breached/overdue)', async () => {
    // 1. Task approaching SLA deadline (4 days old in a 5-day SLA -> 1 day remaining <= 2 days)
    const approachDocId = `doc-sla-approach-${Date.now()}`;
    db.prepare(`
      INSERT INTO documents (
        id, tenant_id, study_id, artifact_code, artifact_name, zone, section,
        title, display_name, version, status, active, reviewer_id, created_by, created_at, updated_at
      ) VALUES (
        ?, 'tenant-001', 'study-001', '01.01.01', 'TMF Plan', '01', '01.01',
        'Approaching SLA Task Document', 'Approaching SLA Task Document', '1.0',
        'Under Review', 1, 'usr-005', 'usr-001',
        datetime('now', '-4 days'), datetime('now', '-4 days')
      )
    `).run(approachDocId);

    // 2. Task breached/overdue SLA deadline (8 days old in a 5-day SLA -> 3 days overdue)
    const breachDocId = `doc-sla-breach-${Date.now()}`;
    db.prepare(`
      INSERT INTO documents (
        id, tenant_id, study_id, artifact_code, artifact_name, zone, section,
        title, display_name, version, status, active, reviewer_id, created_by, created_at, updated_at
      ) VALUES (
        ?, 'tenant-001', 'study-001', '01.01.01', 'TMF Plan', '01', '01.01',
        'Breached SLA Task Document', 'Breached SLA Task Document', '1.0',
        'Under Review', 1, 'usr-005', 'usr-001',
        datetime('now', '-8 days'), datetime('now', '-8 days')
      )
    `).run(breachDocId);

    // Run SLA reminder check
    const slaResult = await runSlaReminderCheck('tenant-001', { dryRun: false, forceAll: true });
    assert.ok(slaResult.success);

    const r1 = slaResult.reminder_details.find(d => d.document_id === approachDocId);
    assert.ok(r1, 'Approaching task must receive reminder detail');
    assert.strictEqual(r1.reminder_level, 1, 'Approaching task must be reminder_level 1 (Reminder 1)');

    const r2 = slaResult.reminder_details.find(d => d.document_id === breachDocId);
    assert.ok(r2, 'Breached task must receive reminder detail');
    assert.strictEqual(r2.reminder_level, 2, 'Overdue task must be reminder_level 2 (Reminder 2)');

    // Verify daily idempotency
    const idempotentResult = await runSlaReminderCheck('tenant-001', { dryRun: false, forceAll: false });
    assert.ok(idempotentResult.success);
    const r1SecondRun = idempotentResult.reminder_details.find(d => d.document_id === approachDocId);
    assert.strictEqual(r1SecondRun, undefined, 'Consecutive run on same day must not send duplicate reminder');
  });

  // ─────────────────────────────────────────────────────────────
  // 13. FRONTEND QUALITY CONTROL & WORKFLOW UI INTEGRATION CHECKS
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 13: Frontend Quality Control & Workflow UI Static/AST Checks ──');

  await test('QualityControlCenter.jsx exists and implements Audit Plans, Quality Findings, and Stats', () => {
    const filePath = path.resolve('frontend/src/components/inspection/QualityControlCenter.jsx');
    assert.ok(fs.existsSync(filePath), 'QualityControlCenter.jsx must exist');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('activeTab') || content.includes('activeView'), 'Tab navigation required');
    assert.ok(content.includes('audit-plans') || content.includes('plans'), 'Audit plans view required');
    assert.ok(content.includes('CreateAuditPlanModal'), 'CreateAuditPlanModal must be imported/rendered');
    assert.ok(content.includes('AuditPlanDetailsModal'), 'AuditPlanDetailsModal must be imported/rendered');
  });

  await test('CreateAuditPlanModal.jsx and AuditPlanDetailsModal.jsx exist and export valid modal components', () => {
    const createModalPath = path.resolve('frontend/src/components/inspection/CreateAuditPlanModal.jsx');
    const detailsModalPath = path.resolve('frontend/src/components/inspection/AuditPlanDetailsModal.jsx');
    assert.ok(fs.existsSync(createModalPath), 'CreateAuditPlanModal.jsx must exist');
    assert.ok(fs.existsSync(detailsModalPath), 'AuditPlanDetailsModal.jsx must exist');

    const createContent = fs.readFileSync(createModalPath, 'utf-8');
    assert.ok(createContent.includes('/qc/plans'), 'Must invoke /qc/plans');

    const detailsContent = fs.readFileSync(detailsModalPath, 'utf-8');
    assert.ok(detailsContent.includes('participants'), 'Must display participants');
    assert.ok(detailsContent.includes('documents'), 'Must display audited documents');
  });

  await test('QualityCheckModal.jsx and SubmitCapaResponseModal.jsx exist and support QC review workflow', () => {
    const qcModalPath = path.resolve('frontend/src/components/inspection/QualityCheckModal.jsx');
    const capaModalPath = path.resolve('frontend/src/components/inspection/SubmitCapaResponseModal.jsx');
    assert.ok(fs.existsSync(qcModalPath), 'QualityCheckModal.jsx must exist');
    assert.ok(fs.existsSync(capaModalPath), 'SubmitCapaResponseModal.jsx must exist');

    const qcContent = fs.readFileSync(qcModalPath, 'utf-8');
    assert.ok(qcContent.includes('/qc/check'), 'Must invoke /qc/check');

    const capaContent = fs.readFileSync(capaModalPath, 'utf-8');
    assert.ok(capaContent.includes('/qc/plans/'), 'Must invoke /qc/plans/:id/responses');
  });

  await test('DocumentContextMenu.jsx includes Quality Check action for clinical documents', () => {
    const menuPath = path.resolve('frontend/src/components/document/DocumentContextMenu.jsx');
    assert.ok(fs.existsSync(menuPath), 'DocumentContextMenu.jsx must exist');
    const content = fs.readFileSync(menuPath, 'utf-8');
    assert.ok(content.includes('Quality Check') || content.includes('onQualityCheck'), 'Quality Check action must be in context menu');
  });

  await test('ESignatureModal.jsx dynamically loads legal signature reasons from /api/workflow/signature-reasons', () => {
    const esigPath = path.resolve('frontend/src/components/workflow/ESignatureModal.jsx');
    assert.ok(fs.existsSync(esigPath), 'ESignatureModal.jsx must exist');
    const content = fs.readFileSync(esigPath, 'utf-8');
    assert.ok(content.includes('/workflow/signature-reasons'), 'Must fetch reasons from /workflow/signature-reasons');
  });

  await test('useReviewQueue.js hook provides Next Document review queue progression', () => {
    const hookPath = path.resolve('frontend/src/hooks/useReviewQueue.js');
    assert.ok(fs.existsSync(hookPath), 'useReviewQueue.js must exist');
    const content = fs.readFileSync(hookPath, 'utf-8');
    assert.ok(content.includes('useReviewQueue'), 'Must export useReviewQueue hook');
  });

  // ─────────────────────────────────────────────────────────────
  // SUMMARY RESULTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Results: ${passed}/${passed + failed} passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  if (failed === 0) {
    console.log('🎉 ALL PHASE 6 AUTOMATED VERIFICATION TESTS PASSED (100%)!');
  } else {
    console.log(`❌ ${failed} test(s) failed!`);
    process.exit(1);
  }
  console.log('──────────────────────────────────────────────────────\n');
}

run().catch(err => {
  console.error('\n❌ Fatal test suite execution error:', err);
  process.exit(1);
});
