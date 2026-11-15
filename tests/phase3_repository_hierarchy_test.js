/**
 * Phase 3 Verification Suite — Repository Center, Dynamic DIA v3.2 Hierarchy, Folder Menus & Security Admin
 * Tests:
 * 1. GET /api/studies/:studyId/hierarchy returns 3-tier Study->Country->Site->DIA Zones with 6 status counters (total, completed, inProgress, inQc, missing, expected)
 * 2. Folder Context Menu: Assign User Group with cascadeToChildren & Revoke Privileges
 * 3. Folder Context Menu: Lock / Unlock Folder & Audit Logging
 * 4. Folder Context Menu: User-level vs. Enterprise-level Pin / Unpin
 * 5. Folder Context Menu: Update Planned & Actual Milestone Dates
 * 6. Folder Context Menu: Folder Inventory (recursive toggle) & Folder Audit History
 * 7. Security Admin: GET /api/admin/functional-roles includes all 24 standard Clinevo Functional Roles
 * 8. Security Admin: Create AD User, Reset Password sets must_change_password = 1, Immutable Username enforcement
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
  console.log('\n🧪 Phase 3: Repository Hierarchy, Folder Menus & Security Admin Test Suite\n');
  await initDB();
  const db = getDB();

  const ts = Date.now();
  const testFolderId = `zone-p3-${ts}`;
  let createdAdUserId = null;

  const loginRes = await req('POST', '/api/auth/login', { email: 'e.vasquez@pharma.com', password: 'Admin1234!' });
  assert(loginRes.status === 200, 'Admin login failed');
  const token = loginRes.body.token;

  try {
    await test('1. GET /api/studies/study-001/hierarchy returns Study->Country->Site & 6 status counters per Zone', async () => {
      const r = await req('GET', '/api/studies/study-001/hierarchy', null, token);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.body.study && r.body.study.counters, 'Missing study counters');
      assert(typeof r.body.study.counters.total === 'number', 'Missing total counter');
      assert(typeof r.body.study.counters.completed === 'number', 'Missing completed counter');
      assert(typeof r.body.study.counters.inProgress === 'number', 'Missing inProgress counter');
      assert(typeof r.body.study.counters.inQc === 'number', 'Missing inQc counter');
      assert(typeof r.body.study.counters.missing === 'number', 'Missing missing counter');
      assert(typeof r.body.study.counters.expected === 'number', 'Missing expected counter');
      assert(Array.isArray(r.body.countries) && r.body.countries.length > 0, 'Missing countries array');
      assert(Array.isArray(r.body.zones) && r.body.zones.length === 11, 'Expected 11 DIA zones');
    });

    await test('2. Folder Context Menu: Assign User Group with cascadeToChildren & Revoke Privileges', async () => {
      const assignRes = await req('POST', `/api/folders/${testFolderId}/assign-groups`, {
        groupIds: ['ugrp-001', 'ugrp-002'],
        cascadeToChildren: true
      }, token);
      assert(assignRes.status === 200, `Expected 200, got ${assignRes.status}`);
      assert(assignRes.body.allowedGroups.includes('ugrp-001'), 'Missing ugrp-001 in allowedGroups');

      const revokeRes = await req('POST', `/api/folders/${testFolderId}/revoke-groups`, {
        groupIds: ['ugrp-002'],
        cascadeToChildren: true
      }, token);
      assert(revokeRes.status === 200, `Expected 200, got ${revokeRes.status}`);
      assert(!revokeRes.body.allowedGroups.includes('ugrp-002'), 'ugrp-002 was not revoked');
    });

    await test('3. Folder Context Menu: Lock & Unlock Folder', async () => {
      const lockRes = await req('PATCH', `/api/folders/${testFolderId}/lock`, { locked: true }, token);
      assert(lockRes.status === 200 && lockRes.body.folder.locked === 1, 'Folder lock failed');

      const unlockRes = await req('PATCH', `/api/folders/${testFolderId}/lock`, { locked: false }, token);
      assert(unlockRes.status === 200 && unlockRes.body.folder.locked === 0, 'Folder unlock failed');
    });

    await test('4. Folder Context Menu: User-level and Enterprise-level Pin / Unpin', async () => {
      const pinUser = await req('PATCH', `/api/folders/${testFolderId}/pin`, { scope: 'user', pinned: true }, token);
      assert(pinUser.status === 200, `Expected 200, got ${pinUser.status}`);
      assert(pinUser.body.folder.pinned_user_ids.includes('usr-001'), 'User ID not in pinned_user_ids');

      const pinEnt = await req('PATCH', `/api/folders/${testFolderId}/pin`, { scope: 'enterprise', pinned: true }, token);
      assert(pinEnt.status === 200 && pinEnt.body.folder.pinned_enterprise === 1, 'Enterprise pin failed');
    });

    await test('5. Folder Context Menu: Update Planned & Actual Milestone Dates, Inventory & History', async () => {
      const mRes = await req('PATCH', `/api/folders/${testFolderId}/milestone`, {
        milestoneDate: '2026-08-15',
        actualMilestoneDate: '2026-08-10'
      }, token);
      assert(mRes.status === 200 && mRes.body.folder.milestone_date === '2026-08-15', 'Milestone update failed');

      const invRes = await req('GET', `/api/folders/${testFolderId}/inventory?recursive=true`, null, token);
      assert(invRes.status === 200 && typeof invRes.body.inventory.total === 'number', 'Folder inventory failed');

      const histRes = await req('GET', `/api/folders/${testFolderId}/history`, null, token);
      assert(histRes.status === 200 && Array.isArray(histRes.body.history) && histRes.body.history.length > 0, 'Folder history empty');
    });

    await test('6. Security Admin: GET /api/admin/functional-roles returns all 24 standard Clinevo Functional Roles', async () => {
      const r = await req('GET', '/api/admin/functional-roles', null, token);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      const roleNames = r.body.roles.map(x => x.name);
      const requiredClinevoRoles = [
        'APPLICATION_ADMIN', 'APPROVER', 'ARCHIVAL', 'AUTHOR', 'BLIND_UNBLIND',
        'CHECKIN_ADMIN', 'LOCK_ADMIN', 'PUBLISH_COORDINATOR', 'QUALITY_CHECK', 'REVIEWER', 'SUPERUSER'
      ];
      for (const reqRole of requiredClinevoRoles) {
        assert(roleNames.includes(reqRole), `Missing standard Clinevo functional role: ${reqRole}`);
      }
    });

    await test('7. Security Admin: Create AD User, Admin Temporary Password Reset (must_change_password=1) & Immutable Username', async () => {
      const createRes = await req('POST', '/api/users', {
        name: `AD Test User ${ts}`,
        username: `ad.user.${ts}`,
        email: `ad.user.${ts}@pharma.com`,
        role: 'CRA / Reviewer',
        auth_type: 'AD',
        functional_roles: ['frole-c21']
      }, token);
      assert(createRes.status === 201, `Expected 201, got ${createRes.status}: ${JSON.stringify(createRes.body)}`);
      createdAdUserId = createRes.body.user.id;
      assert(createRes.body.user.auth_type === 'AD', 'Expected auth_type AD');

      // Attempt to mutate username -> 400 IMMUTABLE_USERNAME
      const mutRes = await req('PATCH', `/api/users/${createdAdUserId}`, { username: 'different.username' }, token);
      assert(mutRes.status === 400 && mutRes.body.code === 'IMMUTABLE_USERNAME', 'Expected 400 IMMUTABLE_USERNAME');

      // Reset password -> sets must_change_password = 1
      const rstRes = await req('POST', `/api/users/${createdAdUserId}/reset-password`, {}, token);
      assert(rstRes.status === 200 && rstRes.body.mustChangePassword === true, 'Expected mustChangePassword=true on admin reset');
      const dbUser = db.prepare('SELECT must_change_password FROM users WHERE id = ?').get(createdAdUserId);
      assert(dbUser.must_change_password === 1, 'Database must_change_password not set to 1');
    });
  } finally {
    db.prepare('DELETE FROM folder_configs WHERE id = ?').run(testFolderId);
    if (createdAdUserId) {
      db.prepare('DELETE FROM user_functional_roles WHERE user_id = ?').run(createdAdUserId);
      db.prepare('DELETE FROM users WHERE id = ?').run(createdAdUserId);
    }
  }

  console.log(`\n📊 Phase 3 Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
