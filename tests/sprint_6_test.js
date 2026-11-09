import http from 'http';
import { initDB, getDB } from '../src/database.js';

const PORT = 3002;
let token = '';
let doaSchemaId = '';
let createdFormEntryId = '';
let pushedDocId = '';

function req(method, path, body = null, authToken = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        ...customHeaders
      }
    };

    const request = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (e) {
          parsed = { raw: data };
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
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

async function runSprint6TestSuite() {
  console.log('\n======================================================');
  console.log('🧪 eTMF Pro — Automated Verification for Sprint 6');
  console.log('======================================================\n');

  initDB();
  const db = getDB();

  // Authentication Setup
  console.log('🔑 Authentication Setup');
  await test('Login as TMF Manager (Elena Vasquez)', async () => {
    const r = await req('POST', '/api/auth/login', { email: 'e.vasquez@pharma.com', password: 'Admin1234!' });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.token, 'No token in response');
    token = r.body.token;
  });

  // ── SPRINT 6 PART 1: MY TASKS & SLA DASHBOARD (§8.2 & §8.3) ─────────────
  console.log('\n📋 Sprint 6 Part 1: Task Grid & SLA Reminders (§8.2 & §8.3)');

  await test('Task Grid: GET /api/workflow/tasks returns personalized assigned documents', async () => {
    const r = await req('GET', '/api/workflow/tasks', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.tasks), 'tasks is not array');
    assert(Array.isArray(r.body.expiring), 'expiring is not array');
    
    // Check SLA tagging
    if (r.body.tasks.length > 0) {
      const first = r.body.tasks[0];
      assert(['red', 'amber', 'green'].includes(first.slaLevel), `Invalid SLA level: ${first.slaLevel}`);
      assert(typeof first.slaLimit === 'number', 'slaLimit missing');
    }
  });

  await test('SLA Performance: GET /api/workflow/sla returns aggregated compliance metrics', async () => {
    const r = await req('GET', '/api/workflow/sla', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body.summary, 'Missing summary');
    assert(typeof r.body.summary.total === 'number', 'total is not number');
    assert(typeof r.body.summary.overdue === 'number', 'overdue is not number');
    assert(typeof r.body.summary.atRisk === 'number', 'atRisk is not number');
    assert(typeof r.body.summary.onTrack === 'number', 'onTrack is not number');
  });

  // ── SPRINT 6 PART 2: DYNAMIC CLINICAL FORMS & LOGS (§12) ───────────────
  console.log('\n📝 Sprint 6 Part 2: Dynamic Clinical Forms & One-Click eTMF Push (§12)');

  await test('Forms Registry: GET /api/forms returns standard ICH GCP clinical templates', async () => {
    const r = await req('GET', '/api/forms', null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.schemas), 'schemas is not array');
    assert(r.body.schemas.length >= 3, `Expected at least 3 clinical schemas, got ${r.body.schemas.length}`);
    
    const doa = r.body.schemas.find(s => s.name.includes('Delegation of Authority'));
    assert(doa, 'Site Delegation of Authority Log not found');
    assert(doa.zone === '05' && doa.section === '05.02', 'DOA Zone or Section mapping mismatch');
    doaSchemaId = doa.id;
  });

  await test('Forms Submission: POST /api/forms/:schemaId/data submits clinical log record', async () => {
    assert(doaSchemaId, 'No DOA schema ID from previous test');
    const newRecordPayload = {
      study_id: 'study-001',
      data_json: {
        protocol_number: 'TRIAL-2024-001',
        site_number: 'Site-002',
        pi_name: 'Dr. Sarah Chen',
        records: [
          { staff_name: 'Robert Taylor, MD', study_role: 'Sub-Investigator', delegated_tasks: 'Informed Consent, Adverse Events, Physical Exams', start_date: '2024-03-01', end_date: '', pi_initials: 'SC' }
        ]
      }
    };

    const r = await req('POST', `/api/forms/${doaSchemaId}/data`, newRecordPayload, token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.id, 'No form data ID returned');
    createdFormEntryId = r.body.id;
  });

  await test('Forms Retrieval: GET /api/forms/:schemaId/data returns submissions for DOA log', async () => {
    assert(doaSchemaId, 'No DOA schema ID');
    const r = await req('GET', `/api/forms/${doaSchemaId}/data`, null, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(Array.isArray(r.body.data), 'data is not array');
    assert(r.body.data.length >= 1, 'Expected at least 1 form record');
  });

  await test('21 CFR Part 11: PATCH /api/forms/data/:dataId/lock locks form submission against changes', async () => {
    assert(createdFormEntryId, 'No created form entry ID');
    const r = await req('PATCH', `/api/forms/data/${createdFormEntryId}/lock`, { reason: 'Monitoring closeout freeze' }, token);
    assert(r.status === 200, `Expected 200, got ${r.status}`);

    const record = db.prepare('SELECT is_locked, locked_by FROM forms_data WHERE id = ?').get(createdFormEntryId);
    assert(record && record.is_locked === 1, 'Form is not locked in database');
  });

  await test('One-Click eTMF Push: POST /api/forms/:dataId/push-to-etmf files form directly into DIA Zone 05', async () => {
    assert(createdFormEntryId, 'No created form entry ID');
    const r = await req('POST', `/api/forms/${createdFormEntryId}/push-to-etmf`, {}, token);
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.documentId, 'No documentId returned in response');
    assert(r.body.zone === '05', `Expected Zone 05, got ${r.body.zone}`);
    assert(r.body.section === '05.02', `Expected Section 05.02, got ${r.body.section}`);
    pushedDocId = r.body.documentId;

    // Verify record in documents SQLite table
    const filedDoc = db.prepare('SELECT * FROM documents WHERE id = ?').get(pushedDocId);
    assert(filedDoc, 'Pushed document not found in documents table');
    assert(filedDoc.status === 'Approved', `Pushed document should be Approved, got ${filedDoc.status}`);
    assert(filedDoc.artifact_code === '05.02.01', `Expected artifact code 05.02.01, got ${filedDoc.artifact_code}`);

    // Verify ALCOA+ Audit Log
    const audit = db.prepare("SELECT * FROM audit_log WHERE object_id = ? AND action = 'Form Pushed to eTMF'").get(createdFormEntryId);
    assert(audit, 'ALCOA+ audit log record for Form Pushed to eTMF not found');
  });

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('──────────────────────────────────────────────────────\n');

  if (failed > 0) {
    console.error(`❌ Verification failed: ${failed} tests failed.`);
    process.exit(1);
  } else {
    console.log('✅ All tests passed! Sprint 6 verified with 100% compliance.\n');
    process.exit(0);
  }
}

runSprint6TestSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
