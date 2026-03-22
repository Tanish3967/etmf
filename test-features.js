async function testFeatures() {
  console.log('--- STARTING eTMF BACKEND INTEGRATION TESTS ---');
  
  const baseUrl = 'http://localhost:3001/api';
  let token = '';

  try {
    // -----------------------------------------------------------------
    // 1. JWT Authentication
    // -----------------------------------------------------------------
    console.log('\n[1] Testing Authentication Pipeline (POST /api/auth/login)...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e.vasquez@pharma.com', password: 'Admin1234!' })
    });
    
    if (loginRes.ok) {
      const data = await loginRes.json();
      token = data.token;
      console.log('✅ Auth success! Received JWT Token.');
    } else {
      console.log(`❌ Auth failed: ${loginRes.status}`);
      const err = await loginRes.text();
      console.log('Error payload:', err);
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': 'tenant-001'
    };

    // -----------------------------------------------------------------
    // 2. Core Screen & Navigation
    // -----------------------------------------------------------------
    console.log('\n[2] Testing Core Document Retrieval (GET /api/documents)...');
    const docsRes = await fetch(`${baseUrl}/documents?studyId=study-001`, { headers });
    if (docsRes.ok) {
      const docsData = await docsRes.json();
      console.log(`✅ Retrieved ${docsData.documents?.length || 0} documents.`);
    } else {
      console.log(`❌ Core docs failed: ${docsRes.status}`);
    }

    // -----------------------------------------------------------------
    // 3. Phase 5: Placeholders (Folder Actions)
    // -----------------------------------------------------------------
    console.log('\n[3] Testing Folder Placeholders (POST /api/folders/placeholders)...');
    const plRes = await fetch(`${baseUrl}/folders/placeholders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        study_id: 'study-001',
        artifact_code: 'TMF-09.01.001',
        artifact_name: 'Test Setup Protocol',
        is_mandatory: true
      })
    });
    if (plRes.status === 201) {
      console.log('✅ Placeholder created successfully (Phase 5).');
    } else {
       const err = await plRes.text();
      console.log(`❌ Placeholder failed: ${plRes.status} - ${err}`);
    }

    // -----------------------------------------------------------------
    // 4. Phase 6: Workflow & Absence Management
    // -----------------------------------------------------------------
    console.log('\n[4] Testing Auto-Reassign execution (POST /api/admin/auto-reassign)...');
    const reRes = await fetch(`${baseUrl}/admin/auto-reassign`, {
      method: 'POST', headers
    });
    if (reRes.ok) {
      const reData = await reRes.json();
      console.log(`✅ Auto-reassign processed (Phase 6). Docs reassigned: ${reData.reassignedDocs}`);
    } else {
      const err = await reRes.text();
      console.log(`❌ Auto-reassign failed: ${reRes.status} - ${err}`);
    }

    // -----------------------------------------------------------------
    // 5. Phase 7: Dynamic Reporting
    // -----------------------------------------------------------------
    console.log('\n[5] Testing Timeliness / SLA Report (GET /api/reports/timeliness)...');
    const repRes = await fetch(`${baseUrl}/reports/timeliness`, { headers });
    if (repRes.ok) {
      const repData = await repRes.json();
      console.log(`✅ SLA Report retrieved successfully (Phase 7). Avg Days: ${repData.averageDaysToApprove}`);
    } else {
     const err = await repRes.text();
      console.log(`❌ SLA Report failed: ${repRes.status} - ${err}`);
    }

    // -----------------------------------------------------------------
    // 6. Phase 4: Document Engine (Annotations / Redaction)
    // -----------------------------------------------------------------
    console.log('\n[6] Testing Metadata Redaction/Annotations (POST /api/documents/doc-001/annotations)...');
    const annRes = await fetch(`${baseUrl}/documents/doc-001/annotations`, {
      method: 'POST', headers,
      body: JSON.stringify({ type: 'Redaction', text: '[REDACTED NAME]', page: 1 })
    });
    if (annRes.ok) {
      console.log(`✅ Annotation applied successfully (Phase 4).`);
    } else {
      const err = await annRes.text();
      console.log(`❌ Annotation failed: ${annRes.status} - ${err}`);
    }
  } catch(e) {
    console.log(`❌ Test Exception: ${e.message}`);
  }

  console.log('\n--- ALL E2E INTEGRATION TESTS COMPLETED ---');
}

testFeatures();
