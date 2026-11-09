/**
 * eTMF Pro — Backend Test Suite
 * Run: node tests/run.js
 * Tests all routes, auth, workflow, ALCOA+, 21 CFR Part 11
 */
import http from 'http';
import { initDB, getDB } from '../src/database.js';

const BASE = process.env.TEST_URL || 'http://localhost:3002';
let passed = 0, failed = 0, token = null, testDocId = null, testQueryId = null;

async function req(method, path, body, authToken) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method, headers: {
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        ...(data && { 'Content-Length': Buffer.byteLength(data) }),
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

async function run() {
  console.log('\n🧪 eTMF Pro Backend Test Suite\n');

  try {
    initDB();
    const db = getDB();
    db.prepare("UPDATE documents SET status = 'Draft', title = 'Statistical Analysis Plan v1.0' WHERE id = 'doc-005'").run();
    db.prepare("DELETE FROM studies WHERE protocol_number = 'TEST-2025-099'").run();
    db.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL").run();
  } catch (e) {
    // ignore if db already open in process
  }

  // ── Health ────────────────────────────────────────────────
  console.log('Health & connectivity');
  await test('GET /health returns 200', async () => {
    const r = await req('GET', '/health');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.status === 'ok', 'Status not ok');
    assert(Array.isArray(r.body.compliance), 'Missing compliance array');
  });

  // ── Auth ──────────────────────────────────────────────────
  console.log('\nAuthentication (21 CFR Part 11)');

  await test('Login with wrong password returns 401', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'e.vasquez@pharma.com', password: 'wrong' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('Login with unknown email returns 401', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'nobody@test.com', password: 'anything' });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('Valid login returns JWT token and user', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'e.vasquez@pharma.com', password: 'Admin1234!' });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.token, 'No token in response');
    assert(r.body.user, 'No user in response');
    assert(r.body.user.caps, 'No caps in response');
    token = r.body.token;
  });

  await test('GET /me returns current user', async () => {
    const r = await req('GET', '/api/auth/me', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.name === 'Elena Vasquez', `Unexpected name: ${r.body.name}`);
  });

  await test('Protected route without token returns 401', async () => {
    const r = await req('GET', '/api/documents');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('GET /sessions returns active sessions', async () => {
    const r = await req('GET', '/api/auth/sessions', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.sessions), 'Sessions not array');
  });

  // ── Documents ─────────────────────────────────────────────
  console.log('\nDocument management');

  await test('List documents returns paginated results', async () => {
    const r = await req('GET', '/api/documents?studyId=study-001', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.documents), 'Documents not array');
    assert(typeof r.body.total === 'number', 'Missing total');
  });

  await test('List documents with status filter', async () => {
    const r = await req('GET', '/api/documents?status=Approved', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.documents.every(d => d.status === 'Approved'), 'Non-approved docs in results');
  });

  await test('Get single document returns full detail', async () => {
    const r = await req('GET', '/api/documents/doc-001', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.document, 'No document in response');
    assert(Array.isArray(r.body.workflowHistory), 'Missing workflowHistory');
    assert(Array.isArray(r.body.queries), 'Missing queries');
  });

  await test('Get non-existent document returns 404', async () => {
    const r = await req('GET', '/api/documents/nonexistent', null, token);
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test('Check out document successfully', async () => {
    const r = await req('POST', '/api/documents/doc-005/checkout', {}, token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.checkedOutBy, 'No checkedOutBy in response');
  });

  await test('Check out already checked-out document returns 409', async () => {
    const r = await req('POST', '/api/documents/doc-005/checkout', {}, token);
    assert(r.status === 409, `Expected 409, got ${r.status}`);
  });

  await test('Check in document successfully', async () => {
    const r = await req('POST', '/api/documents/doc-005/checkin', {}, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('Edit metadata of draft document (no reason required)', async () => {
    const r = await req('PATCH', '/api/documents/doc-005/metadata', { title: 'SAP Updated v1.0', country: 'UK' }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.document.title === 'SAP Updated v1.0', 'Title not updated');
  });

  await test('Edit approved doc metadata WITHOUT reason fails (ALCOA+)', async () => {
    const r = await req('PATCH', '/api/documents/doc-001/metadata', { title: 'Protocol v2.1' }, token);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
    assert(r.body.code === 'REASON_REQUIRED', `Expected REASON_REQUIRED, got ${r.body.code}`);
  });

  await test('Edit approved doc metadata WITH reason succeeds (ALCOA+)', async () => {
    const r = await req('PATCH', '/api/documents/doc-001/metadata', { title: 'Protocol and Amendments v2.0', reasonForChange: 'Correcting display title to match filed PDF' }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('Get document version history', async () => {
    const r = await req('GET', '/api/documents/doc-001/versions', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.versions), 'Versions not array');
  });

  // ── Workflow ──────────────────────────────────────────────
  console.log('\nWorkflow engine & state machine');

  await test('Get task list for current user', async () => {
    const r = await req('GET', '/api/workflow/tasks', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.tasks), 'Tasks not array');
    assert(Array.isArray(r.body.expiring), 'Expiring not array');
  });

  await test('Get SLA dashboard', async () => {
    const r = await req('GET', '/api/workflow/sla', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.summary, 'Missing SLA summary');
    assert(typeof r.body.summary.overdue === 'number', 'Missing overdue count');
  });

  await test('Transition draft → pending review', async () => {
    const r = await req('POST', '/api/workflow/doc-005/transition', { nextState: 'Pending Review', comment: 'Ready for QC review' }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.document.status === 'Pending Review', `Expected Pending Review, got ${r.body.document?.status}`);
  });

  await test('Invalid transition returns 400', async () => {
    const r = await req('POST', '/api/workflow/doc-005/transition', { nextState: 'Approved' }, token);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
    assert(r.body.error.includes('Invalid transition'), `Error: ${r.body.error}`);
  });

  await test('Approval without credentials returns 400 (21 CFR Part 11)', async () => {
    // First get it to Pending Approval state via review path
    await req('POST', '/api/workflow/doc-005/transition', { nextState: 'Review Complete' }, token);
    await req('POST', '/api/workflow/doc-005/transition', { nextState: 'Pending Approval' }, token);
    const r = await req('POST', '/api/workflow/doc-005/transition', { nextState: 'Approved' }, token);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
    assert(r.body.code === 'ESIG_REQUIRED', `Expected ESIG_REQUIRED, got ${r.body.code}`);
  });

  await test('Approval with wrong credentials returns 401 (21 CFR Part 11)', async () => {
    const r = await req('POST', '/api/workflow/doc-005/transition', { nextState: 'Approved', credentials: { password: 'wrongpass', meaning: 'Approved' } }, token);
    assert(r.status === 401, `Expected 401, got ${r.status}`);
    assert(r.body.code === 'ESIG_FAILED', `Expected ESIG_FAILED, got ${r.body.code}`);
  });

  await test('Approval with correct credentials succeeds (e-signature stored)', async () => {
    const r = await req('POST', '/api/workflow/doc-005/transition', { nextState: 'Approved', credentials: { password: 'Admin1234!', meaning: 'Approved' } }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.document.status === 'Approved', `Expected Approved, got ${r.body.document?.status}`);
    assert(r.body.esigId, 'No esigId in response');
  });

  // ── Queries ───────────────────────────────────────────────
  console.log('\nQuery management');

  await test('List queries returns array', async () => {
    const r = await req('GET', '/api/queries?studyId=study-001', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.queries), 'Queries not array');
  });

  await test('Raise a query', async () => {
    const r = await req('POST', '/api/queries', { documentId: 'doc-003', studyId: 'study-001', queryType: 'Content Issue', severity: 'Major', text: 'Site identifier missing from header', assignedTo: 'usr-002' }, token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.query.id, 'No query ID');
    testQueryId = r.body.query.id;
  });

  await test('Raise query without required fields returns 400', async () => {
    const r = await req('POST', '/api/queries', { documentId: 'doc-003' }, token);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Close a query with resolution', async () => {
    const r = await req('PATCH', `/api/queries/${testQueryId}/close`, { resolution: 'Site ID added to header on revised version' }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.query.status === 'Closed', `Expected Closed, got ${r.body.query?.status}`);
  });

  await test('Close already-closed query returns 400', async () => {
    const r = await req('PATCH', `/api/queries/${testQueryId}/close`, { resolution: 'Duplicate close' }, token);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // ── Audit ─────────────────────────────────────────────────
  console.log('\nAudit trail (21 CFR Part 11 / ALCOA+)');

  await test('Audit log is populated with events from tests', async () => {
    const r = await req('GET', '/api/audit', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.logs.length > 0, 'Audit log is empty');
    assert(r.body.logs[0].user_name, 'Missing user_name in audit entry');
    assert(r.body.logs[0].ip_address, 'Missing ip_address in audit entry');
  });

  await test('Audit log cannot be modified (read-only endpoint)', async () => {
    const r = await req('DELETE', '/api/audit', null, token);
    assert(r.status === 404 || r.status === 405, `Expected 404/405, got ${r.status}`);
  });

  await test('Audit log filter by action works', async () => {
    const r = await req('GET', '/api/audit?action=Approved', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    if (r.body.logs.length > 0) {
      assert(r.body.logs.every(l => l.action.includes('Approved') || l.action.includes('approved')), 'Non-approved entries in filtered results');
    }
  });

  // ── Studies & EDL ─────────────────────────────────────────
  console.log('\nStudies & EDL');

  await test('List studies for tenant', async () => {
    const r = await req('GET', '/api/studies', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.studies), 'Studies not array');
    assert(r.body.studies.length > 0, 'No studies seeded');
  });

  await test('Get study completeness', async () => {
    const r = await req('GET', '/api/studies/study-001/completeness', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.overall === 'number', 'Missing overall completeness');
  });

  await test('Create new study', async () => {
    const r = await req('POST', '/api/studies', { protocolNumber: 'TEST-2025-099', title: 'Test Study for API', phase: 'II', sponsorName: 'TestCo' }, token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.study.id, 'No study ID');
  });

  await test('Duplicate protocol number returns 409', async () => {
    const r = await req('POST', '/api/studies', { protocolNumber: 'TEST-2025-099', title: 'Duplicate', phase: 'I' }, token);
    assert(r.status === 409, `Expected 409, got ${r.status}`);
  });

  await test('Get EDL for study', async () => {
    const r = await req('GET', '/api/edl?studyId=study-001', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.missingMandatory === 'number', 'Missing missingMandatory');
  });

  // ── Reports ───────────────────────────────────────────────
  console.log('\nReports');

  await test('Completeness report', async () => {
    const r = await req('GET', '/api/reports/completeness?studyId=study-001', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.overall === 'number', 'Missing overall');
    assert(r.body.generatedBy, 'Missing generatedBy');
  });

  await test('Expiry report', async () => {
    const r = await req('GET', '/api/reports/expiry', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.documents), 'Documents not array');
  });

  await test('Workflow status report', async () => {
    const r = await req('GET', '/api/reports/workflow', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.overdue === 'number', 'Missing overdue count');
  });

  await test('Audit trail report', async () => {
    const r = await req('GET', '/api/reports/audit', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.logs), 'Logs not array');
    assert(r.body.logs.length > 0, 'No audit entries in report');
  });

  // ── Users ─────────────────────────────────────────────────
  console.log('\nUsers & permissions');

  await test('List all users', async () => {
    const r = await req('GET', '/api/users', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.users), 'Users not array');
    assert(r.body.users.length === 7, `Expected 7 seed users, got ${r.body.users.length}`);
  });

  await test('Update user role', async () => {
    const r = await req('PATCH', '/api/users/usr-005', { dept: 'Biostatistics' }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('Admin stats endpoint', async () => {
    const r = await req('GET', '/api/admin/stats', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(typeof r.body.stats.documents === 'number', 'Missing document count');
    assert(typeof r.body.stats.sessions === 'number', 'Missing session count');
  });

  // ── Notifications ─────────────────────────────────────────
  console.log('\nNotifications');

  await test('List notifications', async () => {
    const r = await req('GET', '/api/notifications', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.notifications), 'Notifications not array');
  });

  await test('Mark all notifications read', async () => {
    const r = await req('PATCH', '/api/notifications/read-all', {}, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // ── Security ──────────────────────────────────────────────
  console.log('\nSecurity & access control');

  await test('Reviewer cannot access admin endpoint', async () => {
    const loginR = await req('POST', '/api/auth/login', { email: 'm.williams@cro.com', password: 'Admin1234!' });
    const reviewerToken = loginR.body.token;
    const r = await req('GET', '/api/admin/stats', null, reviewerToken);
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  await test('Logout invalidates token', async () => {
    const loginR = await req('POST', '/api/auth/login', { email: 'e.vasquez@pharma.com', password: 'Admin1234!' });
    const tmpToken = loginR.body.token;
    await req('POST', '/api/auth/logout', {}, tmpToken);
    const r = await req('GET', '/api/documents', null, tmpToken);
    assert(r.status === 401, `Expected 401 after logout, got ${r.status}`);
  });

  // ── Summary ───────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  const total = passed + failed;
  const pct = Math.round((passed / total) * 100);
  console.log(`\n${pct === 100 ? '✅' : '⚠️ '} Results: ${passed}/${total} passed (${pct}%)\n`);
  if (failed > 0) {
    console.log(`${failed} test${failed !== 1 ? 's' : ''} failed — see ❌ above\n`);
    process.exit(1);
  } else {
    console.log('All tests passed — backend is fully functional\n');
  }
}

run().catch(err => { console.error('Test runner error:', err); process.exit(1); });
