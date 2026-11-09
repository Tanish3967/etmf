/**
 * Automated Verification for Study Setup Wizard & Security Admin Console (§8.5)
 * Tests:
 * 1. Security Administration Workspace (§8.5.1)
 *    - User Management (§8.5.1.1): List, create, patch, reset password
 *    - User Groups & Privileges (§8.5.1.2): List, create with checkboxes matrix & folder assignments, update, delete
 *    - Functional Roles Setup (§8.5.1.3 & §8.5.1.4): Verify 21 standard clinical roles, assign users
 * 2. Study Setup Wizard & Application Administration (§8.5.2)
 *    - Study Setup Wizard: Protocol metadata, countries & sites, DIA folder structure, EDL initialization
 *    - Sites management: GET and POST sites for study
 *    - Department & Designation Masters: GET, POST, PUT, DELETE codelists
 */

import http from 'http';
import { initDB, getDB } from '../src/database.js';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3002';

function req(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': 'tenant-001',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const request = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch(e) { parsed = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    request.on('error', reject);
    if (data) request.write(data);
    request.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
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
  console.log('🧪 eTMF Pro — Study Setup Wizard & Security Admin (§8.5)');
  console.log('======================================================\n');

  await initDB();

  // Login as System Administrator / TMF Manager
  console.log('🔑 Authentication');
  const loginRes = await req('POST', '/api/auth/login', {
    email: 'a.patel@pharma.com',
    password: 'Admin1234!'
  });
  assert(loginRes.status === 200, 'Login failed');
  const token = loginRes.body.token;

  // ── 1. SECURITY ADMINISTRATION (§8.5.1) ───────────────────────────
  console.log('\n🛡️ User Management (§8.5.1.1)');

  let createdUserId = null;
  await test('GET /api/users returns users with functional roles & designation', async () => {
    const res = await req('GET', '/api/users', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.users), 'Users must be an array');
    assert(res.body.users.length >= 7, 'Expected at least 7 seeded users');
    const first = res.body.users[0];
    assert(first.id && first.name && first.email, 'User object missing required fields');
    assert(Array.isArray(first.functional_roles), 'functional_roles must be an array');
  });

  await test('POST /api/users creates a new clinical user with functional roles', async () => {
    const newUser = {
      name: 'Dr. Gregory House',
      email: `g.house.${Date.now()}@pharma.com`,
      role: 'Principal Investigator',
      dept: 'Clinical Operations',
      designation: 'Head of Clinical Investigation',
      password: 'Clinion@2026!',
      active: true,
      functional_roles: ['frole-005']
    };
    const res = await req('POST', '/api/users', newUser, token);
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.user && res.body.user.id, 'User ID not returned');
    assert(res.body.user.name === newUser.name, 'Name mismatch');
    createdUserId = res.body.user.id;
  });

  await test('PATCH /api/users/:id updates user designation and active status', async () => {
    assert(createdUserId, 'No created user ID');
    const res = await req('PATCH', `/api/users/${createdUserId}`, {
      designation: 'Senior Principal Investigator',
      dept: 'Oncology Research',
      active: true,
      functional_roles: ['frole-005', 'frole-001']
    }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.user.designation === 'Senior Principal Investigator', 'Designation not updated');
    assert(res.body.user.dept === 'Oncology Research', 'Dept not updated');
    assert(Array.isArray(res.body.user.functional_roles), 'functional_roles missing from updated user');
    assert(res.body.user.functional_roles.includes('frole-001'), 'frole-001 not in functional_roles');
  });

  await test('POST /api/users/:id/reset-password resets credential with 21 CFR Part 11 audit', async () => {
    assert(createdUserId, 'No created user ID');
    const res = await req('POST', `/api/users/${createdUserId}/reset-password`, {
      newPassword: 'TempPassword@2026!'
    }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.tempPassword === 'TempPassword@2026!', 'Temp password mismatch');
  });

  // ── 2. USER GROUPS & PRIVILEGES (§8.5.1.2) ─────────────────────────
  console.log('\n👥 User Groups & Privileges (§8.5.1.2)');

  let createdGroupId = null;
  await test('GET /api/admin/user-groups returns groups with parsed privileges and folder assignments', async () => {
    const res = await req('GET', '/api/admin/user-groups', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.groups), 'Groups must be an array');
    assert(res.body.groups.length >= 4, 'Expected seeded user groups');
    const g = res.body.groups[0];
    assert(Array.isArray(g.privileges), 'privileges must be parsed array');
    assert(Array.isArray(g.folder_assignments), 'folder_assignments must be parsed array');
    assert(Array.isArray(g.members), 'members must be parsed array');
  });

  await test('POST /api/admin/user-groups creates group with privileges checkboxes & folders', async () => {
    const newGroup = {
      name: `Global Quality Auditors ${Date.now()}`,
      description: 'Independent audit group with download and unblinded access',
      isActive: true,
      privileges: ['reviewer', 'downloader', 'blinded'],
      zones: ['01', '03', '07'],
      folderAssignments: ['01 Trial Management', '03 Regulatory', '07 Safety Reporting'],
      members: ['usr-001']
    };
    const res = await req('POST', '/api/admin/user-groups', newGroup, token);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.body.group && res.body.group.id, 'Group ID not returned');
    assert(res.body.group.privileges.includes('blinded'), 'Blinded privilege not saved');
    assert(res.body.group.folder_assignments.includes('03 Regulatory'), 'Folder assignment not saved');
    createdGroupId = res.body.group.id;
  });

  await test('PUT /api/admin/user-groups/:id updates group privileges and folder assignments', async () => {
    assert(createdGroupId, 'No created group ID');
    const res = await req('PUT', `/api/admin/user-groups/${createdGroupId}`, {
      name: 'Global Quality Auditors (Updated)',
      description: 'Updated audit group description',
      isActive: true,
      privileges: ['author', 'reviewer', 'approver', 'downloader'],
      zones: ['01', '02', '03'],
      folderAssignments: ['01 Trial Management', '02 Central Trial Documents', '03 Regulatory'],
      members: ['usr-001', 'usr-006']
    }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.group.privileges.includes('approver'), 'Approver privilege missing');
  });

  await test('DELETE /api/admin/user-groups/:id deletes group', async () => {
    assert(createdGroupId, 'No created group ID');
    const res = await req('DELETE', `/api/admin/user-groups/${createdGroupId}`, null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // ── 3. FUNCTIONAL ROLES (§8.5.1.3 & §8.5.1.4) ──────────────────────
  console.log('\n🎖️ Functional Roles Setup (§8.5.1.3 & §8.5.1.4)');

  await test('GET /api/admin/functional-roles returns the 21 standard clinical roles', async () => {
    const res = await req('GET', '/api/admin/functional-roles', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.roles), 'Roles must be an array');
    assert(res.body.roles.length >= 21, `Expected at least 21 standard clinical roles, got ${res.body.roles.length}`);
    const leadRole = res.body.roles.find(r => r.name.includes('Lead Study Manager'));
    assert(leadRole, 'Lead Study Manager role not found');
    assert(Array.isArray(leadRole.capabilities), 'Role capabilities must be array');
    assert(typeof leadRole.user_count === 'number', 'user_count must be number');
  });

  await test('POST /api/admin/functional-roles/:id/assign assigns users to clinical role', async () => {
    const res = await req('POST', '/api/admin/functional-roles/frole-002/assign', {
      userIds: ['usr-001', 'usr-003']
    }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // ── 4. STUDY SETUP WIZARD & SITES (§8.5.2) ─────────────────────────
  console.log('\n🚀 Study Setup Wizard & EDL Hierarchy (§8.5.2)');

  let createdStudyId = null;
  const newProtocolNumber = `PROT-WIZARD-${Date.now()}`;

  await test('POST /api/studies auto-initializes protocol, sites, and DIA EDL placeholders', async () => {
    const wizardPayload = {
      protocolNumber: newProtocolNumber,
      title: 'A Multi-Center Phase III Study of Oncology Candidate',
      phase: 'Phase III',
      therapeuticArea: 'Oncology',
      sponsorName: 'PharmaCo Global',
      croName: 'Clinical Research CRO',
      startDate: '2026-04-01',
      plannedEndDate: '2029-12-31',
      tmfModelVersion: 'DIA v3.2',
      countries: ['United States', 'Germany', 'United Kingdom'],
      sites: [
        { siteCode: 'Site-001', name: 'Johns Hopkins Oncology Center', country: 'United States', piName: 'Dr. John Doe', activationDate: '2026-04-01' },
        { siteCode: 'Site-002', name: 'Berlin University Hospital', country: 'Germany', piName: 'Dr. Hans Muller', activationDate: '2026-04-15' },
        { siteCode: 'Site-003', name: 'Oxford Clinical Trial Unit', country: 'United Kingdom', piName: 'Dr. Sarah Smith', activationDate: '2026-05-01' }
      ],
      initializeEDL: true,
      zones: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11']
    };

    const res = await req('POST', '/api/studies', wizardPayload, token);
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.study && res.body.study.id, 'Study not created');
    assert(res.body.sitesCount === 3, `Expected 3 sites, got ${res.body.sitesCount}`);
    assert(res.body.placeholdersCount >= 25, `Expected >= 25 EDL placeholders, got ${res.body.placeholdersCount}`);
    createdStudyId = res.body.study.id;
  });

  await test('GET /api/studies/:id/sites retrieves participating sites of new study', async () => {
    assert(createdStudyId, 'No created study ID');
    const res = await req('GET', `/api/studies/${createdStudyId}/sites`, null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.sites), 'Sites must be an array');
    assert(res.body.sites.length === 3, `Expected 3 sites, got ${res.body.sites.length}`);
    assert(res.body.sites[0].site_code === 'Site-001', 'First site code mismatch');
  });

  await test('POST /api/studies/:id/sites adds an additional site to the study', async () => {
    assert(createdStudyId, 'No created study ID');
    const res = await req('POST', `/api/studies/${createdStudyId}/sites`, {
      siteCode: 'Site-004',
      name: 'Tokyo Medical Center',
      country: 'Japan',
      piName: 'Dr. Kenji Sato',
      activationDate: '2026-06-01'
    }, token);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.body.site.site_code === 'Site-004', 'Site code mismatch');
  });

  // ── 5. DEPARTMENT & DESIGNATION MASTERS (§8.5.2.1 & §8.5.2.2) ──────
  console.log('\n🏢 Department & Designation Masters (§8.5.2.1 & §8.5.2.2)');

  let createdDeptId = null;
  await test('GET /api/admin/system-codelists?groupName=Department returns departments', async () => {
    const res = await req('GET', '/api/admin/system-codelists?groupName=Department', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.codelists), 'Codelists must be array');
    assert(res.body.codelists.length >= 7, 'Expected seeded departments');
  });

  await test('POST /api/admin/system-codelists creates a new Department', async () => {
    const deptCode = `DEPT-AUTO-${Date.now()}`;
    const res = await req('POST', '/api/admin/system-codelists', {
      code: deptCode,
      name: 'Translational Medicine',
      group_name: 'Department',
      is_active: true
    }, token);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.body.codelist.code === deptCode, 'Code mismatch');
    createdDeptId = res.body.codelist.id;
  });

  await test('DELETE /api/admin/system-codelists/:id deletes department', async () => {
    assert(createdDeptId, 'No created department ID');
    const res = await req('DELETE', `/api/admin/system-codelists/${createdDeptId}`, null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  let createdDesigId = null;
  await test('GET /api/admin/system-codelists?groupName=Designation returns designations', async () => {
    const res = await req('GET', '/api/admin/system-codelists?groupName=Designation', null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.codelists), 'Codelists must be array');
    assert(res.body.codelists.length >= 9, 'Expected seeded designations');
  });

  await test('POST /api/admin/system-codelists creates a new Designation', async () => {
    const desigCode = `DESIG-AUTO-${Date.now()}`;
    const res = await req('POST', '/api/admin/system-codelists', {
      code: desigCode,
      name: 'Associate Director of Clinical Monitoring',
      group_name: 'Designation',
      is_active: true
    }, token);
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.body.codelist.code === desigCode, 'Code mismatch');
    createdDesigId = res.body.codelist.id;
  });

  await test('DELETE /api/admin/system-codelists/:id deletes designation', async () => {
    assert(createdDesigId, 'No created designation ID');
    const res = await req('DELETE', `/api/admin/system-codelists/${createdDesigId}`, null, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // Teardown created test user and test study so standard test suites remain 100% clean
  const db = getDB();
  if (createdUserId) {
    db.prepare('DELETE FROM user_functional_roles WHERE user_id = ?').run(createdUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(createdUserId);
  }
  if (createdStudyId) {
    db.prepare('DELETE FROM placeholders WHERE study_id = ?').run(createdStudyId);
    db.prepare('DELETE FROM sites WHERE study_id = ?').run(createdStudyId);
    db.prepare('DELETE FROM studies WHERE id = ?').run(createdStudyId);
  }

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('──────────────────────────────────────────────────────\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
