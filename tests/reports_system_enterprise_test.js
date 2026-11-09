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
  console.log('🧪 eTMF Pro — Reports, System Admin & Enterprise (§13, §8.5.3, §14)');
  console.log('======================================================\n');

  console.log('🔑 Authentication');
  const loginRes = await req('POST', '/api/auth/login', {
    email: 'e.vasquez@pharma.com',
    password: 'Admin1234!'
  });
  assert(loginRes.status === 200, 'Login failed');
  const token = loginRes.body.token;

  // 1. Regulatory Reports Suite (§13)
  console.log('\n📊 Regulatory Reports & Analytics Suite (§13)');

  await test('GET /api/reports/completeness returns zone metrics & expected placeholders', async () => {
    const res = await req('GET', '/api/reports/completeness?studyId=study-001', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.body.overall === 'number', 'overall missing');
    assert(Array.isArray(res.body.zones), 'zones missing');
  });

  await test('GET /api/reports/timeliness calculates approval turnaround SLA', async () => {
    const res = await req('GET', '/api/reports/timeliness', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.metrics), 'metrics missing');
    assert(typeof res.body.averageDaysToApprove === 'number', 'averageDaysToApprove missing');
  });

  await test('GET /api/reports/expiry returns horizon document expiration list', async () => {
    const res = await req('GET', '/api/reports/expiry?days=90&studyId=study-001', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.documents), 'documents missing');
  });

  await test('GET /api/reports/workflow compiles document status queues', async () => {
    const res = await req('GET', '/api/reports/workflow?studyId=study-001', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.statusBreakdown), 'statusBreakdown missing');
  });

  await test('GET /api/reports/blinded audits unblinded & confidential records', async () => {
    const res = await req('GET', '/api/reports/blinded', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.documents), 'documents missing');
    assert(typeof res.body.blindedCount === 'number', 'blindedCount missing');
  });

  await test('GET /api/reports/inventory reports repository volume by zone', async () => {
    const res = await req('GET', '/api/reports/inventory', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.inventory), 'inventory missing');
  });

  await test('GET /api/reports/audit filters certified ALCOA+ audit entries', async () => {
    const res = await req('GET', '/api/reports/audit?limit=50', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.logs), 'logs missing');
  });

  await test('GET /api/reports/inactivated tracks decommissioned documents', async () => {
    const res = await req('GET', '/api/reports/inactivated', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.docs), 'docs missing');
  });

  // 2. System Administration Console (§8.5.3)
  console.log('\n⚙️ System Administration Console (§8.5.3)');

  await test('POST /api/admin/integrations/:system/sync synchronizes external trial system', async () => {
    const res = await req('POST', '/api/admin/integrations/CTMS/sync', {}, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.message.includes('CTMS'), 'message mismatch');
  });

  await test('POST /api/admin/lms/sync triggers training & GCP compliance sync', async () => {
    const res = await req('POST', '/api/admin/lms/sync', {}, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.message.includes('synced'), 'message mismatch');
  });

  await test('GET & POST /api/admin/numbering-format configures artifact barcode pattern', async () => {
    const postRes = await req('POST', '/api/admin/numbering-format', {
      numberingFormat: '{study}-{zone}-{artifact}-{seq4}'
    }, token);
    assert(postRes.status === 200, `Expected 200, got ${postRes.status}`);

    const getRes = await req('GET', '/api/admin/numbering-format', null, token);
    assert(getRes.status === 200, `Expected 200, got ${getRes.status}`);
    assert(getRes.body.numberingFormat === '{study}-{zone}-{artifact}-{seq4}', 'format mismatch');
  });

  let createdTemplateId = null;
  await test('GET & POST /api/admin/workflow-templates manages lifecycle templates', async () => {
    const postRes = await req('POST', '/api/admin/workflow-templates', {
      name: 'Test Clinical Template ' + Date.now(),
      description: 'Regulatory submission workflow',
      steps_json: JSON.stringify(['Draft', 'QC Review', 'Medical Review', 'Final Signoff'])
    }, token);
    assert(postRes.status === 201, `Expected 201, got ${postRes.status}`);
    createdTemplateId = postRes.body.id;

    const getRes = await req('GET', '/api/admin/workflow-templates', null, token);
    assert(getRes.status === 200, `Expected 200, got ${getRes.status}`);
    assert(Array.isArray(getRes.body.templates), 'templates array missing');
  });

  let createdDelegationId = null;
  await test('GET & POST /api/admin/delegations configures out-of-office DOA assignment', async () => {
    const postRes = await req('POST', '/api/admin/delegations', {
      delegator_id: 'usr-002',
      delegatee_id: 'usr-003',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10)
    }, token);
    assert(postRes.status === 201, `Expected 201, got ${postRes.status}`);
    createdDelegationId = postRes.body.id;

    const getRes = await req('GET', '/api/admin/delegations', null, token);
    assert(getRes.status === 200, `Expected 200, got ${getRes.status}`);
    assert(Array.isArray(getRes.body.delegations), 'delegations missing');
  });

  await test('PATCH /api/admin/security updates session timeout & IP CIDR', async () => {
    const res = await req('PATCH', '/api/admin/security', {
      sessionTimeoutMinutes: 45,
      ipAllowlist: '0.0.0.0/0'
    }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // 3. Manage Enterprise & Master Data (§14)
  console.log('\n🏢 Manage Enterprise & Master Data (§14)');

  await test('GET /api/admin/stats returns system telemetry and volume counts', async () => {
    const res = await req('GET', '/api/admin/stats', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.body.stats.documents === 'number', 'documents count missing');
    assert(typeof res.body.stats.users === 'number', 'users count missing');
    assert(typeof res.body.stats.studies === 'number', 'studies count missing');
  });

  let createdOrgId = null;
  await test('GET & POST /api/admin/organization-profiles manages external partners', async () => {
    const postRes = await req('POST', '/api/admin/organization-profiles', {
      name: 'Global Clinical Labs LLC ' + Date.now(),
      profile_type: 'Central Lab',
      description: 'Certified GCP central diagnostic testing laboratory'
    }, token);
    assert(postRes.status === 201, `Expected 201, got ${postRes.status}`);
    createdOrgId = postRes.body.id;

    const getRes = await req('GET', '/api/admin/organization-profiles', null, token);
    assert(getRes.status === 200, `Expected 200, got ${getRes.status}`);
    assert(Array.isArray(getRes.body.profiles), 'profiles missing');
  });

  await test('GET & PATCH /api/admin/tenant manages enterprise branding', async () => {
    const patchRes = await req('PATCH', '/api/admin/tenant', {
      name: 'BioPharm International Clinical Enterprise',
      primaryColor: '#0284c7'
    }, token);
    assert(patchRes.status === 200, `Expected 200, got ${patchRes.status}`);

    const getRes = await req('GET', '/api/admin/tenant', null, token);
    assert(getRes.status === 200, `Expected 200, got ${getRes.status}`);
    const tName = getRes.body.tenant?.name || getRes.body.name;
    assert(tName === 'BioPharm International Clinical Enterprise', 'name mismatch');
  });

  // TEARDOWN: Clean up created test entities
  if (createdOrgId) {
    try {
      const { getDB } = await import('../src/database.js');
      getDB().prepare('DELETE FROM organization_profiles WHERE id = ?').run(createdOrgId);
      if (createdTemplateId) getDB().prepare('DELETE FROM workflow_templates WHERE id = ?').run(createdTemplateId);
      if (createdDelegationId) getDB().prepare('DELETE FROM user_delegations WHERE id = ?').run(createdDelegationId);
    } catch (_) {}
  }

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('──────────────────────────────────────────────────────\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
