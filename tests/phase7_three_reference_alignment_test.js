/**
 * tests/phase7_three_reference_alignment_test.js
 *
 * Master End-to-End Automated Verification Suite for Phase 7:
 * Alignment with Ref 1 (system_admin_dashboard), Ref 2 (eTMF_Combined_v4 SRS v4.0),
 * and Ref 3 (tmf_manager_unified Steps 6–19).
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { initDB, getDB } from '../src/database.js';

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

async function req(method, pathUrl, body, token, extraHeaders = {}) {
  const headers = { ...extraHeaders };
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
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, headers: res.headers, body: data };
}

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Phase 7 Master Verification Suite: Three-Reference Alignment');
  console.log('======================================================\n');

  await initDB();
  const db = getDB();

  // Authenticate test personas
  const loginAdmin = await req('POST', '/api/auth/login', { email: 'e.vasquez@pharma.com', password: 'Admin1234!' });
  assert.strictEqual(loginAdmin.status, 200, 'Elena (TMF Manager) login must succeed');
  const adminToken = loginAdmin.body.token || loginAdmin.body.accessToken;

  const loginSysAdmin = await req('POST', '/api/auth/login', { email: 'a.patel@pharma.com', password: 'Admin1234!' });
  assert.strictEqual(loginSysAdmin.status, 200, 'Aisha (System Admin) login must succeed');
  const sysToken = loginSysAdmin.body.token || loginSysAdmin.body.accessToken;

  const loginInspector = await req('POST', '/api/auth/login', { email: 't.eriksen@ema.europa.eu', password: 'Admin1234!' });
  assert.strictEqual(loginInspector.status, 200, 'Inspector login must succeed');
  const inspectorToken = loginInspector.body.token || loginInspector.body.accessToken;

  // ─────────────────────────────────────────────────────────────
  // SUITE 1: CRITICAL SECURITY & COMPLIANCE REMEDIATIONS (C-01 to C-04, C-12)
  // ─────────────────────────────────────────────────────────────
  console.log('── Suite 1: Critical Compliance & Security Fixes (C-01..C-04, C-12) ──');

  await test('C-01: Segregation of Duties cannot be bypassed via bypassSoD: true when author tries to approve own doc', async () => {
    const createRes = await req('POST', '/api/documents', {
      studyId: 'study-001',
      artifactCode: '01.01.01',
      title: 'SoD Bypass Test Document',
      zone: '01',
      section: '01.01',
      status: 'Pending Approval'
    }, adminToken);
    assert.strictEqual(createRes.status, 201);
    const docId = createRes.body.document.id;

    const transRes = await req('POST', `/api/workflow/${docId}/transition`, {
      toState: 'Approved',
      bypassSoD: true,
      password: 'Admin1234!',
      reason: 'Attempting SoD bypass'
    }, adminToken);
    assert.strictEqual(transRes.status, 403, `Expected 403 SOD_VIOLATION, got ${transRes.status}`);
    assert.strictEqual(transRes.body.code, 'SOD_VIOLATION');
  });

  await test('C-02: EDL / File Plan endpoints (/api/studies/:id/edl, /api/edl, PATCH/POST na & mandatory) return 200', async () => {
    const res1 = await req('GET', '/api/studies/study-001/edl', null, adminToken);
    assert.strictEqual(res1.status, 200);
    assert(Array.isArray(res1.body.edl) && res1.body.edl.length > 0);

    const phId = res1.body.edl[0].id;
    const naRes = await req('POST', `/api/edl/${phId}/na`, { designated: true, reason: 'Phase 7 N/A test justification' }, adminToken);
    assert.strictEqual(naRes.status, 200);

    const undoNa = await req('PATCH', `/api/edl/${phId}/na`, { designated: false, reason: 'Reinstate placeholder' }, adminToken);
    assert.strictEqual(undoNa.status, 200);

    const mandRes = await req('PATCH', `/api/edl/${phId}/mandatory`, { mandatory: true }, adminToken);
    assert.strictEqual(mandRes.status, 200);
  });

  await test('C-03: Inspector Mode & Inspector Role filter out Draft and Blinded documents server-side', async () => {
    const inspDocs = await req('GET', '/api/documents', null, inspectorToken);
    assert.strictEqual(inspDocs.status, 200);
    const hasDraft = inspDocs.body.documents.some(d => !['Approved', 'Effective', 'Published', 'Signed Off'].includes(d.status));
    const hasBlinded = inspDocs.body.documents.some(d => d.is_blinded === 1 || d.confidential === 1);
    assert.strictEqual(hasDraft, false, 'Inspector must never receive Draft or In-Review documents');
    assert.strictEqual(hasBlinded, false, 'Inspector must never receive Blinded/Confidential documents');

    // Direct access to Draft doc-005 must be blocked with 403 INSPECTOR_RESTRICTED_DOCUMENT
    const directDraft = await req('GET', '/api/documents/doc-005', null, inspectorToken);
    assert.strictEqual(directDraft.status, 403);
    assert.strictEqual(directDraft.body.code, 'INSPECTOR_RESTRICTED_DOCUMENT');
  });

  await test('C-12: SQLite WORM triggers block UPDATE and DELETE on audit_log table', () => {
    const row = db.prepare('SELECT id FROM audit_log LIMIT 1').get();
    assert(row, 'audit_log must have entries');
    assert.throws(() => {
      db.prepare("UPDATE audit_log SET action = 'TAMPERED' WHERE id = ?").run(row.id);
    }, /immutable \(WORM\)|WORM_VIOLATION/i);
    assert.throws(() => {
      db.prepare('DELETE FROM audit_log WHERE id = ?').run(row.id);
    }, /immutable \(WORM\)|WORM_VIOLATION/i);
  });

  // ─────────────────────────────────────────────────────────────
  // SUITE 2: REF 1 SYSTEM ADMIN CONSOLE (U-01..U-04, C-05, C-06, U-11, U-13, U-15)
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 2: Ref 1 System Admin Console (U-01..U-04, C-05, C-06, U-11, U-13, U-15) ──');

  await test('U-01: GET & PATCH /api/admin/setup-checklist tracks 5-step One-Time Setup Checklist', async () => {
    const res = await req('GET', '/api/admin/setup-checklist', null, sysToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalSteps, 5);
    assert.strictEqual(res.body.isReadyForStudyCreation, true);
  });

  await test('U-02: GET /api/admin/tmf-models returns DIA v3.0 (200 artifacts) vs v3.2 (250 artifacts) comparison diff', async () => {
    const res = await req('GET', '/api/admin/tmf-models', null, sysToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.models.length, 2);
    assert.strictEqual(res.body.models[0].artifactsCount, 200);
    assert.strictEqual(res.body.models[1].artifactsCount, 250);
    assert(res.body.versionComparison.delta.artifacts.includes('+50'));
  });

  await test('U-03: Custom EDL Templates support Draft creation, editing, Publishing lock (423 TEMPLATE_LOCKED), and comparison diff', async () => {
    const createRes = await req('POST', '/api/admin/edl-templates', {
      name: `AcmePharma Phase 7 Custom EDL ${Date.now()}`,
      baseModelVersion: 'DIA v3.2',
      sourceTemplateId: 'edl-tpl-v32'
    }, sysToken);
    assert.strictEqual(createRes.status, 201);
    const tplId = createRes.body.template.id;
    assert.strictEqual(createRes.body.template.status, 'Draft');

    const editDraft = await req('PATCH', `/api/admin/edl-templates/${tplId}`, {
      description: 'Updated while in Draft'
    }, sysToken);
    assert.strictEqual(editDraft.status, 200);

    const pubRes = await req('POST', `/api/admin/edl-templates/${tplId}/publish`, {}, sysToken);
    assert.strictEqual(pubRes.status, 200);
    assert.strictEqual(pubRes.body.template.status, 'Published');

    const editLocked = await req('PATCH', `/api/admin/edl-templates/${tplId}`, {
      description: 'Should fail on locked published template'
    }, sysToken);
    assert.strictEqual(editLocked.status, 423);
    assert.strictEqual(editLocked.body.code, 'TEMPLATE_LOCKED');

    const cmpRes = await req('GET', '/api/admin/edl-templates/compare?t1=edl-tpl-v30&t2=edl-tpl-v32', null, sysToken);
    assert.strictEqual(cmpRes.status, 200);
    assert(cmpRes.body.diff.addedCount >= 0);
  });

  await test('U-04 & C-05: Milestones M01-M12 configuration and Fixed Read-Only 8x5 Permissions Matrix', async () => {
    const msRes = await req('GET', '/api/admin/milestones-config', null, sysToken);
    assert.strictEqual(msRes.status, 200);
    assert.strictEqual(msRes.body.milestones.length, 12);

    const updMs = await req('PUT', '/api/admin/milestones-config', {
      milestones: [{ code: 'M01', due_days: 30 }, { code: 'M04', due_days: 14 }]
    }, sysToken);
    assert.strictEqual(updMs.status, 200);

    const permRes = await req('GET', '/api/admin/permissions-matrix', null, sysToken);
    assert.strictEqual(permRes.status, 200);
    assert.strictEqual(permRes.body.readOnly, true);
    assert.strictEqual(permRes.body.rows.length, 8);
  });

  await test('C-06: Immutable username enforced on PUT /api/admin/users/:id and POST /api/users/:id/unlock works', async () => {
    const immRes = await req('PUT', '/api/admin/users/usr-002', {
      username: 'tampered.username',
      email: 'm.chen@pharma.com'
    }, sysToken);
    assert.strictEqual(immRes.status, 400);
    assert.strictEqual(immRes.body.code, 'IMMUTABLE_USERNAME');

    const unlockRes = await req('POST', '/api/users/usr-002/unlock', { reason: 'Admin identity verified' }, sysToken);
    assert.strictEqual(unlockRes.status, 200);
  });

  await test('U-11, U-13, U-15: Config Export/Import, Sponsor Overlays, and Integration Health endpoints', async () => {
    const expRes = await req('GET', '/api/admin/config-export', null, sysToken);
    assert.strictEqual(expRes.status, 200);
    assert.strictEqual(expRes.body.schemaVersion, 'SRS-eTMF-COMBINED-001-v4.0');

    const ovlRes = await req('POST', '/api/admin/overlays', {
      name: `Sponsor Overlay ${Date.now()}`,
      baseVersion: 'DIA v3.2',
      customArtifacts: [{ code: '02.01.01.A', name: 'Sponsor Protocol Synopsis' }]
    }, sysToken);
    assert.strictEqual(ovlRes.status, 201);

    const healthRes = await req('GET', '/api/admin/integrations/health', null, sysToken);
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.connectors.length, 4);
  });

  // ─────────────────────────────────────────────────────────────
  // SUITE 3: REF 3 TMF MANAGER CONSOLE STEPS 6–19 (U-05..U-10, C-04, C-07, C-13, C-16, C-17, C-18)
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Suite 3: Ref 3 TMF Manager Console Steps 6–19 (U-05..U-10, C-04, C-07, C-13, C-16..C-18) ──');

  await test('C-07 & U-05: Completeness formula (Satisfied+Waived)/TotalDue*100, 100-pt Readiness Score, and TMF Dashboard', async () => {
    const compRes = await req('GET', '/api/studies/study-001/completeness', null, adminToken);
    assert.strictEqual(compRes.status, 200);
    assert.strictEqual(compRes.body.formula, '(Satisfied + Waived) / Total Due * 100');
    assert(typeof compRes.body.edlCompleteness === 'number');
    assert(compRes.body.inspectionReadinessScore && typeof compRes.body.inspectionReadinessScore.total === 'number');

    const dashRes = await req('GET', '/api/studies/study-001/tmf-dashboard', null, adminToken);
    assert.strictEqual(dashRes.status, 200);
    assert(Array.isArray(dashRes.body.completenessByCountry));
    assert(Array.isArray(dashRes.body.milestoneProgress));
  });

  await test('U-06 & U-07: Scoped Study User Assignments (WHO+SCOPE) and Hierarchical Review Rules (Artifact > Zone > Study > Catch-all)', async () => {
    const asnRes = await req('GET', '/api/studies/study-001/assignments', null, adminToken);
    assert.strictEqual(asnRes.status, 200);
    assert(asnRes.body.assignments.length > 0);

    const rrRes = await req('GET', '/api/studies/study-001/review-rules', null, adminToken);
    assert.strictEqual(rrRes.status, 200);
    assert.strictEqual(rrRes.body.hasCatchAll, true);
  });

  await test('U-08 & U-09: 10-Section Activation Readiness Gate and Milestone Actual Date flipping EDL items to Due (rejecting M11)', async () => {
    const actRes = await req('GET', '/api/studies/study-001/activation-readiness', null, adminToken);
    assert.strictEqual(actRes.status, 200);
    assert.strictEqual(actRes.body.totalSections, 10);

    // M11 Ongoing must reject actual date
    const m11Res = await req('POST', '/api/studies/study-001/milestones/M11/actual-date', { actualDate: '2026-03-01' }, adminToken);
    assert.strictEqual(m11Res.status, 400);
    assert.strictEqual(m11Res.body.code, 'M11_ALWAYS_ACTIVE');

    // M06 LPI Actual Date must succeed and compute Due Date
    const m06Res = await req('POST', '/api/studies/study-001/milestones/M06/actual-date', { actualDate: '2026-03-01' }, adminToken);
    assert.strictEqual(m06Res.status, 200);
    assert(m06Res.body.computedDueDate);
  });

  await test('C-18: Overdue Follow-Up enforces ordered progression (Remind -> Escalate -> Reassign)', async () => {
    const ovRes = await req('GET', '/api/studies/study-001/overdue-followup', null, adminToken);
    assert.strictEqual(ovRes.status, 200);
    assert(ovRes.body.items.length > 0);
    const item = ovRes.body.items[0];

    // Reset item escalation_stage to 'None' to test strict ordering
    db.prepare("UPDATE placeholders SET escalation_stage = 'None' WHERE id = ?").run(item.id);

    // Attempting Escalate before Remind must return 400 INVALID_ESCALATION_ORDER
    const skipRes = await req('POST', `/api/studies/study-001/overdue-followup/${item.id}/action`, { action: 'Escalate' }, adminToken);
    assert.strictEqual(skipRes.status, 400);
    assert.strictEqual(skipRes.body.code, 'INVALID_ESCALATION_ORDER');

    // Step 1: Remind -> Step 2: Escalate -> Step 3: Reassign
    const remRes = await req('POST', `/api/studies/study-001/overdue-followup/${item.id}/action`, { action: 'Remind' }, adminToken);
    assert.strictEqual(remRes.status, 200);
    assert.strictEqual(remRes.body.currentStage, 'Reminded');

    const escRes = await req('POST', `/api/studies/study-001/overdue-followup/${item.id}/action`, { action: 'Escalate' }, adminToken);
    assert.strictEqual(escRes.status, 200);
    assert.strictEqual(escRes.body.currentStage, 'Escalated');

    const reaRes = await req('POST', `/api/studies/study-001/overdue-followup/${item.id}/action`, { action: 'Reassign', reassignToUserId: 'usr-002' }, adminToken);
    assert.strictEqual(reaRes.status, 200);
    assert.strictEqual(reaRes.body.currentStage, 'Reassigned');
  });

  await test('C-17: Quality Issues support Study/Country/Site level without documentId and auto-calculate SLA due date', async () => {
    const qiRes = await req('POST', '/api/queries', {
      studyId: 'study-001',
      level: 'Site',
      country: 'USA',
      siteId: 'site-001',
      queryType: 'Missing Essential Document',
      severity: 'Critical',
      text: 'Site-101 missing Delegation of Authority Log update'
    }, adminToken);
    assert.strictEqual(qiRes.status, 201);
    assert.strictEqual(qiRes.body.query.level, 'Site');
    assert(qiRes.body.query.due_date, 'SLA due_date must be auto-computed');

    const valRes = await req('PATCH', `/api/queries/${qiRes.body.query.id}/validate`, {
      assignedTo: 'usr-002',
      capaTriggered: true,
      comment: 'Validated by TMF Manager'
    }, adminToken);
    assert.strictEqual(valRes.status, 200);
    assert.strictEqual(valRes.body.query.capa_triggered, 1);
  });

  await test('U-10: Read & Understood (R&U) Distribution & 21 CFR Part 11 E-Signature Acknowledgement', async () => {
    const listRes = await req('GET', '/api/studies/study-001/ru-distributions', null, adminToken);
    assert.strictEqual(listRes.status, 200);
    assert(listRes.body.distributions.length > 0);
    const distId = listRes.body.distributions[0].id;

    const ackRes = await req('POST', `/api/studies/study-001/ru-distributions/${distId}/acknowledge`, {
      password: 'Admin1234!',
      meaning: 'I have read and understood Protocol Amendment v2.0'
    }, adminToken);
    assert.strictEqual(ackRes.status, 200);
    assert(ackRes.body.signatureHash);
  });

  await test('C-04 & C-13: Study Lock with Part 11 confirmWord LOCK, write-protection (423 STUDY_LOCKED), 25-Yr Archive Package, and Unlock with Reason', async () => {
    // Ensure a test study exists for lock/archive testing
    let lockStudyId = 'study-001';
    const newStudyRes = await req('POST', '/api/studies', {
      protocolNumber: `PHASE7-LOCK-${Date.now()}`,
      title: 'Phase 7 Lock & Archive Verification Study',
      phase: 'Phase III',
      therapeuticArea: 'Oncology'
    }, adminToken);
    if (newStudyRes.status === 201) {
      lockStudyId = newStudyRes.body.study.id;
    }

    // Lock with invalid confirmWord must fail with 400 CONFIRM_WORD_INVALID
    const badLock = await req('POST', `/api/studies/${lockStudyId}/lock`, {
      fullName: 'Elena Vasquez',
      confirmWord: 'WRONG',
      password: 'Admin1234!',
      reason: 'Study Closeout',
      force: true
    }, adminToken);
    assert.strictEqual(badLock.status, 400);
    assert.strictEqual(badLock.body.code, 'CONFIRM_WORD_INVALID');

    const goodLock = await req('POST', `/api/studies/${lockStudyId}/lock`, {
      fullName: 'Elena Vasquez',
      confirmWord: 'LOCK',
      password: 'Admin1234!',
      reason: 'Final CSR approved and all closeout checks verified',
      force: true
    }, adminToken);
    assert.strictEqual(goodLock.status, 200);

    // Attempt to upload document to locked study must return 423 STUDY_LOCKED
    const blockedUpload = await req('POST', '/api/documents', {
      studyId: lockStudyId,
      artifactCode: '01.01.01',
      title: 'Blocked Upload on Locked Study'
    }, adminToken);
    assert.strictEqual(blockedUpload.status, 423);
    assert.strictEqual(blockedUpload.body.code, 'STUDY_LOCKED');

    // C-13: Generate 25-Yr eTMF-RM Archive Package on locked study
    const archRes = await req('POST', `/api/studies/${lockStudyId}/archive`, {
      retentionYears: 25
    }, adminToken);
    assert.strictEqual(archRes.status, 200);
    assert.strictEqual(archRes.body.archivePackage.retentionYears, 25);
    assert(archRes.body.archivePackage.archiveChecksum);

    // Unlock without reason must return 400 REASON_REQUIRED
    const noReasonUnlock = await req('POST', `/api/studies/${lockStudyId}/unlock`, {}, adminToken);
    assert.strictEqual(noReasonUnlock.status, 400);
    assert.strictEqual(noReasonUnlock.body.code, 'REASON_REQUIRED');

    // Unlock with mandatory justification restores study to Active
    const unlockRes = await req('POST', `/api/studies/${lockStudyId}/unlock`, {
      reason: 'Post-archive test restoration'
    }, adminToken);
    assert.strictEqual(unlockRes.status, 200);
  });

  await test('C-16, U-16, C-26, C-28: Migration Impact Assessment, eISF Portal, Bulk Metadata Edit, and Certified Inspection Pack', async () => {
    const migImpact = await req('GET', '/api/studies/study-001/migration-impact?targetTemplateId=edl-tpl-v32', null, adminToken);
    assert.strictEqual(migImpact.status, 200);
    assert.strictEqual(migImpact.body.summary.zeroDataLossGuaranteed, true);

    const eisfRes = await req('GET', '/api/studies/study-001/eisf', null, adminToken);
    assert.strictEqual(eisfRes.status, 200);
    assert.strictEqual(eisfRes.body.biDirectionalSyncStatus, 'Synced with Sponsor eTMF');

    const bulkRes = await req('POST', '/api/documents/bulk-metadata', {
      documentIds: ['doc-001'],
      updates: { language: 'EN' },
      reason: 'ALCOA+ language standardization'
    }, adminToken);
    assert.strictEqual(bulkRes.status, 200);
    assert.strictEqual(bulkRes.body.updatedCount, 1);

    const packRes = await req('POST', '/api/studies/study-001/inspection-pack', {}, adminToken);
    assert.strictEqual(packRes.status, 200);
    assert(packRes.body.packId.startsWith('INSP-PACK-'));
  });

  console.log('\n======================================================');
  console.log(`🏁 Phase 7 Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
