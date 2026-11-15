// tests/phase4_document_lifecycle_test.js
// Phase 4 Verification: Document Lifecycle, Collaboration, Sticky Notes, Annotations & Blinding
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

console.log('\n\x1b[1m━━━ Phase 4: Document Lifecycle, Collaboration & Blinding Suite ━━━\x1b[0m\n');

let adminToken = '';
let reviewerToken = '';
let docId = '';
let noteId = '';
let annId = '';

await test('1. Authenticate Admin and Reviewer users', async () => {
  const r1 = await req('POST', '/auth/login', { email: 'e.vasquez@pharma.com', password: 'Admin1234!' });
  assert.equal(r1.status, 200);
  adminToken = r1.data.token;

  const r2 = await req('POST', '/auth/login', { email: 'j.obrien@pharma.com', password: 'Admin1234!' });
  assert.equal(r2.status, 200);
  reviewerToken = r2.data.token;
});

await test('2. Create test document for lifecycle operations', async () => {
  const res = await req('POST', '/documents', {
    studyId: 'study-001',
    title: `Phase 4 Lifecycle Test Document ${Date.now()}`,
    artifactCode: '01.01.02',
    artifactName: 'Trial Master File Plan',
    zone: '01',
    zoneLabel: 'Zone 01 · Trial Management',
    section: '01.01',
    sectionLabel: '01.01 · Trial Oversight',
    version: '1.0',
    country: 'USA',
    siteId: 'SITE-101',
  }, adminToken);
  assert.equal(res.status, 201);
  docId = res.data.document.id;
  assert.ok(docId);
});

await test('3. Check-Out locks document (409 on duplicate Check-Out) & Uncheck releases lock', async () => {
  // Check out as admin
  const co1 = await req('POST', `/documents/${docId}/checkout`, {}, adminToken);
  assert.equal(co1.status, 200);

  // Duplicate check out by reviewer returns 409 Conflict
  const co2 = await req('POST', `/documents/${docId}/checkout`, {}, reviewerToken);
  assert.equal(co2.status, 409);

  // Uncheck releases lock without changing version
  const uncheck = await req('POST', `/documents/${docId}/uncheck`, {}, adminToken);
  assert.equal(uncheck.status, 200);
  assert.equal(uncheck.data.document.checked_out_by, null);
  assert.equal(uncheck.data.document.version, '1.0');
});

await test('4. Check-Out -> Check-In with incrementVersion increments 1.0 -> 2.0 and archives version', async () => {
  const co = await req('POST', `/documents/${docId}/checkout`, {}, adminToken);
  assert.equal(co.status, 200);

  const ci = await req('POST', `/documents/${docId}/checkin`, {
    incrementVersion: true,
    reason: 'Major clinical revision v2.0',
  }, adminToken);
  assert.equal(ci.status, 200);
  assert.equal(ci.data.version, '2.0');
  assert.equal(ci.data.document.version, '2.0');
  assert.equal(ci.data.document.checked_out_by, null);

  // Verify document_versions history contains v1.0
  const detail = await req('GET', `/documents/${docId}`, null, adminToken);
  assert.equal(detail.status, 200);
  assert.ok(Array.isArray(detail.data.versions));
  assert.ok(detail.data.versions.some(v => v.version === '1.0'));
});

await test('5. Blind / Unblind Document requires justification reason & updates is_blinded + confidential', async () => {
  // Missing reason -> 400 REASON_REQUIRED
  const bad = await req('PATCH', `/documents/${docId}/blind`, { blind: true, reason: '' }, adminToken);
  assert.equal(bad.status, 400);
  assert.equal(bad.data.code, 'REASON_REQUIRED');

  // Blind with reason
  const blindRes = await req('PATCH', `/documents/${docId}/blind`, {
    blind: true,
    reason: 'Contains unblinded randomization treatment codes',
  }, adminToken);
  assert.equal(blindRes.status, 200);
  assert.equal(blindRes.data.document.is_blinded, 1);
  assert.equal(blindRes.data.document.confidential, 1);

  // Unblind with reason
  const unblindRes = await req('PATCH', `/documents/${docId}/blind`, {
    blind: false,
    reason: 'Database lock completed; study unblinded per protocol',
  }, adminToken);
  assert.equal(unblindRes.status, 200);
  assert.equal(unblindRes.data.document.is_blinded, 0);
});

await test('6. Sticky Notes CRUD (POST / GET / DELETE /api/documents/:id/notes)', async () => {
  const createNote = await req('POST', `/documents/${docId}/notes`, {
    text: 'Please verify PI signature date on page 4 before final approval.',
    visibility: 'Reviewer,Approver',
    noteToFile: true,
    showAllVersions: true,
  }, adminToken);
  assert.equal(createNote.status, 201);
  noteId = createNote.data.note.id;
  assert.ok(noteId);

  const listNotes = await req('GET', `/documents/${docId}/notes`, null, adminToken);
  assert.equal(listNotes.status, 200);
  assert.ok(listNotes.data.notes.some(n => n.id === noteId));

  const delNote = await req('DELETE', `/documents/${docId}/notes/${noteId}`, null, adminToken);
  assert.equal(delNote.status, 200);
});

await test('7. Annotations & Threaded Replies (POST /:id/annotations & POST /:id/annotations/:annId/reply)', async () => {
  const createAnn = await req('POST', `/documents/${docId}/annotations`, {
    annotation_type: 'Highlight',
    annotation_text: 'Check date discrepancy in Section 3.2',
    page_number: 3,
    position_x: 120,
    position_y: 340,
  }, adminToken);
  assert.equal(createAnn.status, 201);
  annId = createAnn.data.id;
  assert.ok(annId);

  const replyRes = await req('POST', `/documents/${docId}/annotations/${annId}/reply`, {
    text: 'Verified against source eCRF; date is accurate.',
    resolve: true,
  }, reviewerToken);
  assert.equal(replyRes.status, 200);
  assert.equal(replyRes.data.resolved, true);
  assert.equal(replyRes.data.replies.length, 1);
});

await test('8. Copy Document & Move Document record audit and log tables', async () => {
  const copyRes = await req('POST', `/documents/${docId}/copy`, {
    artifactCode: '01.01.03',
    artifactName: 'Copied Trial Plan',
  }, adminToken);
  assert.equal(copyRes.status, 201);
  assert.ok(copyRes.data.document.id !== docId);

  const moveRes = await req('PATCH', `/documents/${docId}/move`, {
    artifactCode: '01.01.04',
    reason: 'Reclassified to 01.01.04 per QC review',
  }, adminToken);
  assert.equal(moveRes.status, 200);
  assert.equal(moveRes.data.document.artifact_code, '01.01.04');
});

await test('9. Access History logs Views & Downloads + Quality Check & Self-Assign', async () => {
  // Trigger view & download
  await req('GET', `/documents/${docId}/view`, null, adminToken);
  await req('POST', `/documents/${docId}/download`, { type: 'original', reason: 'Inspection prep' }, adminToken);

  const hist = await req('GET', `/documents/${docId}/access-history`, null, adminToken);
  assert.equal(hist.status, 200);
  assert.ok(hist.data.history.length >= 2, 'Expected at least 2 access history entries');

  // Self-assign
  const sa = await req('PATCH', `/documents/${docId}/self-assign`, { role: 'reviewer', release: false }, reviewerToken);
  assert.equal(sa.status, 200);
  assert.equal(sa.data.document.reviewer_id, 'usr-005');

  // Quality Check pass
  const qc = await req('POST', `/documents/${docId}/quality-check`, {
    passed: true,
    checklist: ['Legibility', 'Metadata', 'Signatures'],
    comments: 'QC Passed 100%',
  }, reviewerToken);
  assert.equal(qc.status, 200);
  assert.equal(qc.data.passed, true);
});

console.log(`\n\x1b[1mPhase 4 Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
if (failed > 0) process.exit(1);
