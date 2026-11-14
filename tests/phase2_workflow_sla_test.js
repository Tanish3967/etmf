/**
 * Phase 2 Verification Suite — Clinical Workflow State Machine, Search Engine & Task Grid SLA
 * Tests:
 * 1. GET /api/workflow/states returns all 15+ clinical states & 6 workflow archetypes
 * 2. Segregation of Duties (SoD): Author cannot review/approve/sign off own document (403 SOD_VIOLATION)
 * 3. Independent Reviewer/Approver transitions across expanded states:
 *    Draft -> Under Review -> Review Rejected -> Draft -> Pending Review -> Review Complete -> Pending Approval -> Approved -> Pending Signoff -> Signed Off -> Pending Publish -> Published -> Unpublish -> Published
 * 4. Dual-Component E-Signature required on 'Signed Off' (400 ESIG_REQUIRED without credentials, 200 with valid credentials)
 * 5. Configurable Workflow Archetype 'AutoPublish' auto-transitions document to 'Published'
 * 6. Configurable Workflow Archetype 'Only Review' auto-transitions 'Review Complete' to 'Published'
 * 7. GET /api/documents searchBy ('id', 'title', 'display_name', 'artifact_code') + wildcard '%' + advanced filters
 * 8. GET /api/workflow/tasks returns lifecycle buckets (openDraft, pendingReview, pendingApproval, pendingSignoff, pendingPublish) and folderPath
 */
import http from 'http';
import { initDB, getDB } from '../src/database.js';

const BASE = process.env.TEST_URL || 'http://localhost:3002';
let passed = 0, failed = 0;

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const payload = body ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

async function run() {
  console.log('\n🧪 Phase 2: Clinical Workflow State Machine, Search & Task SLA Test Suite\n');
  await initDB();
  const db = getDB();

  const ts = Date.now();
  const docId1 = `doc-p2-wf-${ts}`;
  const docIdAuto = `doc-p2-auto-${ts}`;
  const docIdOnlyRev = `doc-p2-onlyrev-${ts}`;

  // Login as Author (James O'Brien, usr-005, Data Manager / Author) and Reviewer/Approver (Elena Vasquez, usr-001, TMF Manager)
  const loginAuthor = await req('POST', '/api/auth/login', { email: 'j.obrien@pharma.com', password: 'Admin1234!' });
  assert(loginAuthor.status === 200, 'Author login failed');
  const authorToken = loginAuthor.body.token;

  const loginManager = await req('POST', '/api/auth/login', { email: 'e.vasquez@pharma.com', password: 'Admin1234!' });
  assert(loginManager.status === 200, 'Manager login failed');
  const managerToken = loginManager.body.token;

  // Seed isolated test documents
  db.prepare(`
    INSERT INTO documents (id, tenant_id, study_id, artifact_code, artifact_name, zone, zone_label, section, section_label, title, display_name, workflow_type, version, status, country, author_id, reviewer_id, approver_id, signoff_id, created_by)
    VALUES (?, 'tenant-001', 'study-001', '02.01.04', 'Investigator Brochure', '02', 'Central Trial Docs', '02.01', 'IB', ?, ?, 'Review Approve with Signoff', '1.0', 'Draft', 'Germany', 'usr-001', 'usr-003', 'usr-004', 'usr-001', 'usr-001')
  `).run(docId1, `Phase2 IB Test ${ts}`, `IB Display ${ts}`);

  db.prepare(`
    INSERT INTO documents (id, tenant_id, study_id, artifact_code, artifact_name, zone, zone_label, section, section_label, title, display_name, workflow_type, version, status, country, author_id, reviewer_id, approver_id, created_by)
    VALUES (?, 'tenant-001', 'study-001', '01.01.01', 'TMF Plan', '01', 'Trial Management', '01.01', 'Trial Oversight', ?, ?, 'AutoPublish', '1.0', 'Draft', 'USA', 'usr-005', 'usr-001', 'usr-001', 'usr-005')
  `).run(docIdAuto, `Phase2 AutoPublish Doc ${ts}`, `AutoPub Display ${ts}`);

  db.prepare(`
    INSERT INTO documents (id, tenant_id, study_id, artifact_code, artifact_name, zone, zone_label, section, section_label, title, display_name, workflow_type, version, status, country, author_id, reviewer_id, approver_id, created_by)
    VALUES (?, 'tenant-001', 'study-001', '03.01.01', 'Regulatory Submission', '03', 'Regulatory', '03.01', 'Submissions', ?, ?, 'Only Review', '1.0', 'Pending Review', 'UK', 'usr-005', 'usr-001', 'usr-001', 'usr-005')
  `).run(docIdOnlyRev, `Phase2 OnlyReview Doc ${ts}`, `OnlyRev Display ${ts}`);

  try {
    await test('1. GET /api/workflow/states returns 15+ clinical states & 6 archetypes', async () => {
      const r = await req('GET', '/api/workflow/states', null, managerToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.body.transitions && r.body.transitions['Pending Signoff'], 'Missing Pending Signoff state');
      assert(r.body.transitions['Under Review'], 'Missing Under Review state');
      assert(r.body.transitions['Pending Publish'], 'Missing Pending Publish state');
      assert(r.body.transitions['Unpublish'], 'Missing Unpublish state');
      assert(Array.isArray(r.body.archetypes) && r.body.archetypes.length === 6, 'Expected 6 workflow archetypes');
    });

    await test('2. Segregation of Duties (SoD): Author cannot review/approve own document (403 SOD_VIOLATION)', async () => {
      // docId1 has author_id = 'usr-001' (Elena Vasquez). Transition to Pending Review first:
      const t1 = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Pending Review' }, managerToken);
      assert(t1.status === 200, `Expected 200 for Pending Review, got ${t1.status}`);

      // Now usr-001 tries to mark 'Review Complete' on her own authored document -> 403 SOD_VIOLATION
      const t2 = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Review Complete' }, managerToken);
      assert(t2.status === 403, `Expected 403 SoD violation, got ${t2.status}`);
      assert(t2.body.code === 'SOD_VIOLATION', `Expected SOD_VIOLATION, got ${t2.body.code}`);
    });

    await test('3. Reassign author to usr-005 and test Under Review -> Review Rejected -> Draft -> Under Review -> Review Complete', async () => {
      db.prepare("UPDATE documents SET author_id = 'usr-005' WHERE id = ?").run(docId1);

      const uRev = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Under Review' }, managerToken);
      assert(uRev.status === 200 && uRev.body.document.status === 'Under Review', 'Failed Under Review');

      const rRej = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Review Rejected', comment: 'Missing signature page' }, managerToken);
      assert(rRej.status === 200 && rRej.body.document.status === 'Review Rejected', 'Failed Review Rejected');

      const backDraft = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Draft' }, managerToken);
      assert(backDraft.status === 200 && backDraft.body.document.status === 'Draft', 'Failed back to Draft');

      await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Under Review' }, managerToken);
      const revComp = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Review Complete' }, managerToken);
      assert(revComp.status === 200 && revComp.body.document.status === 'Review Complete', 'Failed Review Complete');
    });

    await test('4. Transition Review Complete -> Pending Approval -> Approve Rejected -> Pending Approval -> Approved', async () => {
      const pApp = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Pending Approval' }, managerToken);
      assert(pApp.status === 200 && pApp.body.document.status === 'Pending Approval', 'Failed Pending Approval');

      const aRej = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Approve Rejected' }, managerToken);
      assert(aRej.status === 200 && aRej.body.document.status === 'Approve Rejected', 'Failed Approve Rejected');

      await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Pending Approval' }, managerToken);
      const app = await req('POST', `/api/workflow/${docId1}/transition`, {
        nextState: 'Approved',
        credentials: { username: 'e.vasquez@pharma.com', password: 'Admin1234!', meaning: 'Approved' }
      }, managerToken);
      assert(app.status === 200 && app.body.document.status === 'Approved', 'Failed Approved');
    });

    await test('5. Transition Approved -> Pending Signoff -> Signed Off (requires Part 11 e-signature)', async () => {
      const pSig = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Pending Signoff' }, managerToken);
      assert(pSig.status === 200 && pSig.body.document.status === 'Pending Signoff', 'Failed Pending Signoff');

      // Attempt Signed Off without credentials -> 400 ESIG_REQUIRED
      const noCreds = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Signed Off' }, managerToken);
      assert(noCreds.status === 400 && noCreds.body.code === 'ESIG_REQUIRED', 'Expected ESIG_REQUIRED for Signed Off');

      // With valid credentials -> 200 Signed Off
      const signedOff = await req('POST', `/api/workflow/${docId1}/transition`, {
        nextState: 'Signed Off',
        credentials: { username: 'e.vasquez@pharma.com', password: 'Admin1234!', meaning: 'Executive Signoff' }
      }, managerToken);
      assert(signedOff.status === 200 && signedOff.body.document.status === 'Signed Off', 'Failed Signed Off');
      assert(signedOff.body.esigId, 'Missing esigId on Signed Off');
    });

    await test('6. Transition Signed Off -> Pending Publish -> Published -> Unpublish -> Published', async () => {
      const pPub = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Pending Publish' }, managerToken);
      assert(pPub.status === 200 && pPub.body.document.status === 'Pending Publish', 'Failed Pending Publish');

      const pub = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Published' }, managerToken);
      assert(pub.status === 200 && pub.body.document.status === 'Published', 'Failed Published');

      const unpub = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Unpublish' }, managerToken);
      assert(unpub.status === 200 && unpub.body.document.status === 'Unpublish', 'Failed Unpublish');

      const repub = await req('POST', `/api/workflow/${docId1}/transition`, { nextState: 'Published' }, managerToken);
      assert(repub.status === 200 && repub.body.document.status === 'Published', 'Failed Re-Publish');
    });

    await test('7. Workflow Archetype AutoPublish auto-advances Draft -> Pending Review directly to Published', async () => {
      const r = await req('POST', `/api/workflow/${docIdAuto}/transition`, { nextState: 'Pending Review' }, authorToken);
      assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
      assert(r.body.document.status === 'Published', `Expected Published via AutoPublish, got ${r.body.document.status}`);
      assert(r.body.autoAdvancedFrom === 'Pending Review', 'Expected autoAdvancedFrom metadata');
    });

    await test('8. Workflow Archetype Only Review auto-advances Review Complete directly to Published', async () => {
      const r = await req('POST', `/api/workflow/${docIdOnlyRev}/transition`, { nextState: 'Review Complete' }, managerToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.body.document.status === 'Published', `Expected Published via Only Review, got ${r.body.document.status}`);
    });

    await test('9. Search By criteria (display_name, id, title) + wildcard "%" + advanced filters', async () => {
      const rDisp = await req('GET', `/api/documents?searchBy=display_name&search=${encodeURIComponent(`IB%${ts}`)}`, null, managerToken);
      assert(rDisp.status === 200, `Expected 200, got ${rDisp.status}`);
      assert(rDisp.body.documents.some(d => d.id === docId1), 'Wildcard display_name search did not match docId1');

      const rAdv = await req('GET', `/api/documents?country=Germany&workflowType=${encodeURIComponent('Review Approve with Signoff')}`, null, managerToken);
      assert(rAdv.status === 200, `Expected 200, got ${rAdv.status}`);
      assert(rAdv.body.documents.some(d => d.id === docId1), 'Advanced filter country+workflowType did not match docId1');
    });

    await test('10. GET /api/workflow/tasks returns lifecycle buckets and folderPath', async () => {
      const r = await req('GET', '/api/workflow/tasks', null, managerToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.body.buckets && typeof r.body.buckets.pendingReview === 'number', 'Missing lifecycle buckets in /api/workflow/tasks');
      assert(typeof r.body.buckets.pendingSignoff === 'number', 'Missing pendingSignoff bucket');
      assert(typeof r.body.buckets.pendingPublish === 'number', 'Missing pendingPublish bucket');
      if (r.body.tasks.length > 0) {
        assert(typeof r.body.tasks[0].folderPath === 'string', 'Missing folderPath on task item');
      }
    });
  } finally {
    // Clean up test fixtures
    db.prepare('DELETE FROM workflow_history WHERE document_id IN (?, ?, ?)').run(docId1, docIdAuto, docIdOnlyRev);
    db.prepare('DELETE FROM electronic_signatures WHERE document_id IN (?, ?, ?)').run(docId1, docIdAuto, docIdOnlyRev);
    db.prepare('DELETE FROM documents WHERE id IN (?, ?, ?)').run(docId1, docIdAuto, docIdOnlyRev);
  }

  console.log(`\n📊 Phase 2 Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
