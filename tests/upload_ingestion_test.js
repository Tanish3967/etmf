import assert from 'assert';

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Testing Document Ingestion (HTML & Multi-format)');
  console.log('======================================================\n');

  // 1. Login as TMF Manager
  const loginRes = await fetch('http://localhost:3002/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e.vasquez@pharma.com', password: 'Admin1234!' })
  });
  assert.strictEqual(loginRes.status, 200, 'Login must succeed');
  const { token } = await loginRes.json();
  console.log('  ✅ Logged in successfully as Elena Vasquez (TMF Manager)');

  // 2. Test Uploading an HTML document (previously caused 500 error)
  const formHtml = new FormData();
  formHtml.append('file', new Blob(['<html><body>Clinical Study Report v1.0</body></html>'], { type: 'text/html' }), 'CSR_Protocol_Amendment.html');
  formHtml.append('data', JSON.stringify({
    studyId: 'study-001',
    artifactCode: '02.01.01',
    title: 'Clinical Study Report HTML',
    version: '1.0'
  }));

  const uploadHtmlRes = await fetch('http://localhost:3002/api/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': 'tenant-001'
    },
    body: formHtml
  });

  const uploadHtmlData = await uploadHtmlRes.json();
  assert(uploadHtmlRes.status === 200 || uploadHtmlRes.status === 201, `HTML upload must return 200/201, got ${uploadHtmlRes.status}: ${JSON.stringify(uploadHtmlData)}`);
  assert(uploadHtmlData.document.id, 'Document ID must be present');
  assert.strictEqual(uploadHtmlData.document.file_type, 'HTML', 'File type must be HTML');
  console.log(`  ✅ HTML upload succeeded with ${uploadHtmlRes.status} (Document ID: ${uploadHtmlData.document.id})`);

  // 3. Test Uploading a Text/CSV document
  const formCsv = new FormData();
  formCsv.append('file', new Blob(['SubjectID,AdverseEvent,Severity\nSUBJ-001,Headache,Mild\n'], { type: 'text/csv' }), 'Safety_Report_Data.csv');
  formCsv.append('data', JSON.stringify({
    studyId: 'study-001',
    artifactCode: '07.01.01',
    title: 'Safety Report CSV Dataset',
    version: '1.0'
  }));

  const uploadCsvRes = await fetch('http://localhost:3002/api/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': 'tenant-001'
    },
    body: formCsv
  });

  const uploadCsvData = await uploadCsvRes.json();
  assert(uploadCsvRes.status === 200 || uploadCsvRes.status === 201, `CSV upload must return 200/201, got ${uploadCsvRes.status}`);
  assert.strictEqual(uploadCsvData.document.file_type, 'CSV');
  console.log(`  ✅ CSV upload succeeded with ${uploadCsvRes.status} (Document ID: ${uploadCsvData.document.id})`);

  // 4. Test uploading an invalid executable (.exe) - must return 400 Bad Request, NOT 500!
  const formExe = new FormData();
  formExe.append('file', new Blob(['MZ...binary'], { type: 'application/octet-stream' }), 'malicious.exe');
  formExe.append('data', JSON.stringify({
    studyId: 'study-001',
    artifactCode: '01.01.01',
    title: 'Malicious Executable'
  }));

  const uploadExeRes = await fetch('http://localhost:3002/api/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': 'tenant-001'
    },
    body: formExe
  });

  assert.strictEqual(uploadExeRes.status, 400, `Unsupported file format must return 400 Bad Request, got ${uploadExeRes.status}`);
  const uploadExeData = await uploadExeRes.json();
  assert(uploadExeData.error.includes('File type not permitted'), 'Error message must clearly state permitted file types');
  console.log(`  ✅ Unsupported format (.exe) properly rejected with 400 Bad Request (not 500)`);

  console.log('\n──────────────────────────────────────────────────────');
  console.log('🎉 All file ingestion tests passed with 100% success!');
  console.log('──────────────────────────────────────────────────────\n');
}

run().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
