/**
 * Automated Verification Suite for ECO-ENGINE Day-3 MVP
 * 
 * Verifies Scenarios:
 * - H1, H2, H3, H4, H5, H6 (Happy Path)
 * - E1, E2, E3, E4, E5, E6, E7 (Empty / Missing Inputs)
 * - F1, F2, F6 (Failure Recovery & Edge Cases)
 * - Feature 5 / AC 5 (Audit Trail Foundation & Traceability)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { app, server } = require('./server');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

function request(method, pathUrl, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers }
    };

    let postBody = null;
    if (data && !(data instanceof Buffer) && typeof data === 'object' && !headers['Content-Type']?.includes('multipart/form-data')) {
      postBody = JSON.stringify(data);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postBody);
    } else if (data instanceof Buffer) {
      postBody = data;
      options.headers['Content-Length'] = postBody.length;
    }

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = body;
        try {
          parsed = JSON.parse(body);
        } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (postBody) req.write(postBody);
    req.end();
  });
}

// Multipart helper for file upload tests
function uploadFiles(facilityId, fileList, extraFields = {}) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const chunks = [];

  for (const [key, val] of Object.entries(extraFields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  for (const file of fileList) {
    const fileContent = fs.readFileSync(file.path);
    const mimeType = file.mime || 'application/octet-stream';
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="evidenceFiles"; filename="${file.filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
    chunks.push(fileContent);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const fullBody = Buffer.concat(chunks);

  return request('POST', `/api/facilities/${facilityId}/upload`, fullBody, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('  RUNNING ECO-ENGINE COMPREHENSIVE TEST SUITE');
  console.log('======================================================\n');

  let testFacilityId = null;

  try {
    // ----------------------------------------------------
    // TEST 1: E1 — Facility setup required field validation
    // ----------------------------------------------------
    console.log('\n--- [TEST E1] Missing Facility Type / Required Fields ---');
    const invalidFacilityRes = await request('POST', '/api/facilities', {
      name: 'OML-42 Flow Station',
      facilityType: '', // Missing!
      boundaries: 'Wellhead to custody transfer meter',
      reportingPeriod: 'Q3 2026'
    });
    assert(invalidFacilityRes.status === 400, 'E1: Status is 400 Bad Request');
    assert(invalidFacilityRes.body.primaryError === 'Facility type is required', 'E1: Returns inline error "Facility type is required"');

    // ----------------------------------------------------
    // TEST 2: H1 — Facility Registry Setup (Happy Path)
    // ----------------------------------------------------
    console.log('\n--- [TEST H1] Facility Setup Happy Path ---');
    const validFacilityRes = await request('POST', '/api/facilities', {
      name: 'Delta-1 Flow Station & Terminal',
      facilityType: 'Upstream Oil & Gas Flow Station',
      boundaries: 'Wellhead headers, separation train, gas flare stack, genset bank',
      reportingPeriod: 'Q3 2026',
      stateJurisdiction: 'Rivers State (Port Harcourt)'
    });
    assert(validFacilityRes.status === 201, 'H1: Facility created with 201 Created');
    assert(validFacilityRes.body.facility.status === 'Open', 'H1: Period status is initialized to "Open"');
    assert(validFacilityRes.body.facility.thresholds.autoSuggest === 90, 'U5: Default auto-suggest threshold is 90%');
    assert(validFacilityRes.body.facility.thresholds.flag === 70, 'U5: Default flag threshold is 70%');
    testFacilityId = validFacilityRes.body.facility.id;

    // ----------------------------------------------------
    // TEST 3: E2 — Evidence Upload with zero files
    // ----------------------------------------------------
    console.log('\n--- [TEST E2] Empty Upload Validation ---');
    const emptyUploadRes = await request('POST', `/api/facilities/${testFacilityId}/upload`, {});
    assert(emptyUploadRes.status === 400, 'E2: Zero files upload returns 400');
    assert(emptyUploadRes.body.error.includes('Upload at least one evidence record'), 'E2: Returns error "Upload at least one evidence record"');

    // ----------------------------------------------------
    // TEST 4: E3 — Unsupported file type rejection (.zip)
    // ----------------------------------------------------
    console.log('\n--- [TEST E3] Unsupported File Type Rejection ---');
    const unsupportedFileRes = await uploadFiles(testFacilityId, [
      {
        path: path.join(__dirname, 'fixtures', 'invalid_backup_archive.zip'),
        filename: 'archive_backup.zip',
        mime: 'application/zip'
      }
    ]);
    assert(unsupportedFileRes.status === 400, 'E3: Status is 400 Bad Request');
    assert(unsupportedFileRes.body.error.includes('Unsupported file type'), 'E3: Returns unsupported file type error message');

    // ----------------------------------------------------
    // TEST 5: F1 — Upload interrupted simulation
    // ----------------------------------------------------
    console.log('\n--- [TEST F1] Upload Connection Interruption ---');
    await request('POST', '/api/system/simulate', { simulateUploadDrop: true });
    const droppedUploadRes = await uploadFiles(testFacilityId, [
      {
        path: path.join(__dirname, 'fixtures', 'gas_inflow_invoice_q3_2026.pdf'),
        filename: 'gas_invoice_partial.pdf',
        mime: 'application/pdf'
      }
    ]);
    assert(droppedUploadRes.status === 500, 'F1: Returns 500 on dropped connection');
    assert(droppedUploadRes.body.recovery.includes('Upload failed — retry'), 'F1: Returns retry instruction without corrupting other state');
    await request('POST', '/api/system/simulate', { simulateUploadDrop: false });

    // ----------------------------------------------------
    // TEST 6: H2 — Evidence Upload (Happy Path)
    // ----------------------------------------------------
    console.log('\n--- [TEST H2] Evidence Upload Happy Path ---');
    const uploadRes = await uploadFiles(testFacilityId, [
      {
        path: path.join(__dirname, 'fixtures', 'gas_inflow_invoice_q3_2026.pdf'),
        filename: 'gas_inflow_invoice_q3_2026.pdf',
        mime: 'application/pdf'
      },
      {
        path: path.join(__dirname, 'fixtures', 'routine_flaring_meter_log.csv'),
        filename: 'routine_flaring_meter_log.csv',
        mime: 'text/csv'
      },
      {
        path: path.join(__dirname, 'fixtures', 'diesel_ago_delivery_slip.pdf'),
        filename: 'diesel_ago_delivery_slip.pdf',
        mime: 'application/pdf'
      },
      {
        path: path.join(__dirname, 'fixtures', 'phed_electricity_bill_q3.pdf'),
        filename: 'phed_electricity_bill_q3.pdf',
        mime: 'application/pdf'
      }
    ]);
    assert(uploadRes.status === 201, 'H2: Uploads stored with 201 Created');
    assert(uploadRes.body.uploadedCount === 4, 'H2: Exactly 4 files stored');
    assert(uploadRes.body.uploadedDocs.every(d => d.status === 'pending_extraction'), 'H2: All files show status "pending_extraction"');

    // ----------------------------------------------------
    // TEST 7: F6 — Duplicate Upload Detection (SHA-256 Hash)
    // ----------------------------------------------------
    console.log('\n--- [TEST F6] Duplicate Detection via Hash Match ---');
    const duplicateRes = await uploadFiles(testFacilityId, [
      {
        path: path.join(__dirname, 'fixtures', 'gas_inflow_invoice_q3_2026.pdf'),
        filename: 'gas_invoice_reuploaded_copy.pdf',
        mime: 'application/pdf'
      }
    ]);
    assert(duplicateRes.status === 409, 'F6: Duplicate upload detected with 409 Conflict');
    assert(duplicateRes.body.duplicates.length === 1, 'F6: Flags probable duplicate record');
    assert(duplicateRes.body.message.includes('SHA-256 hash match'), 'F6: Indicates SHA-256 hash match');

    // ----------------------------------------------------
    // TEST 8: F2 — AI Service Degradation & Fallback
    // ----------------------------------------------------
    console.log('\n--- [TEST F2] AI Service Down Degradation Mode ---');
    await request('POST', '/api/system/simulate', { aiDegradedMode: true });
    const degradedExtractRes = await request('POST', `/api/facilities/${testFacilityId}/extract`);
    assert(degradedExtractRes.status === 503, 'F2: Returns 503 Service Unavailable');
    assert(degradedExtractRes.body.isDegraded === true, 'F2: Flags degraded state');
    assert(degradedExtractRes.body.bannerMessage.includes('manual entry'), 'F2: Shows banner allowing manual entry fallback');
    await request('POST', '/api/system/simulate', { aiDegradedMode: false });

    // ----------------------------------------------------
    // TEST 9: H3 & E4 — AI Extraction with Confidence Scores & Unreadable Scan
    // ----------------------------------------------------
    console.log('\n--- [TEST H3 & E4] AI Extraction & Unreadable Scan ---');
    // Upload unreadable scan file
    await uploadFiles(testFacilityId, [
      {
        path: path.join(__dirname, 'fixtures', 'unreadable_thermal_scanner_receipt.pdf'),
        filename: 'unreadable_thermal_scanner_receipt.pdf',
        mime: 'application/pdf'
      }
    ]);

    const extractRes = await request('POST', `/api/facilities/${testFacilityId}/extract`);
    assert(extractRes.status === 200, 'H3: Extraction returned 200 OK');
    assert(extractRes.body.stats.highConfidenceCount >= 2, 'H3: High confidence (>=90%) extractions detected');
    assert(extractRes.body.stats.flaggedCount >= 1, 'H3: Flagged (<70%) extractions detected (Diesel slip)');
    assert(extractRes.body.stats.unreadableCount === 1, 'E4: Exactly 1 unreadable scan detected');
    assert(extractRes.body.unreadableDocs.includes('unreadable_thermal_scanner_receipt.pdf'), 'E4: Unreadable scan identified by name');

    // Verify unreadable scan did not block others
    const unreadableRecord = extractRes.body.extractions.find(e => e.isUnreadable);
    assert(unreadableRecord.status === 'needs_reupload', 'E4: Unreadable record status is "needs_reupload"');
    assert(unreadableRecord.confidence === 0, 'E4: Unreadable record confidence is 0%');

    // ----------------------------------------------------
    // TEST 10: E7 — Submit for Review Blocked by Unapproved Extractions
    // ----------------------------------------------------
    console.log('\n--- [TEST E7] Submit Blocked When Extractions Pending ---');
    const prematureSubmitRes = await request('POST', `/api/facilities/${testFacilityId}/submit-review`);
    assert(prematureSubmitRes.status === 400, 'E7: Submission blocked with 400 Bad Request');
    assert(prematureSubmitRes.body.unapprovedCount > 0, 'E7: Returns explicit count of pending items');
    assert(prematureSubmitRes.body.primaryError.includes('awaiting your approval'), 'E7: Contains alert message on pending approval');

    // ----------------------------------------------------
    // TEST 11: H4 — Extraction Approval Gate (Approve, Edit, Return)
    // ----------------------------------------------------
    console.log('\n--- [TEST H4 & AC 1] Human Approval Gate Operations ---');
    const gasRecord = extractRes.body.extractions.find(e => e.sourceType === 'natural_gas_combustion');
    const flareRecord = extractRes.body.extractions.find(e => e.sourceType === 'flaring_venting');
    const dieselRecord = extractRes.body.extractions.find(e => e.sourceType === 'diesel_ago_generation');
    const electricRecord = extractRes.body.extractions.find(e => e.sourceType === 'grid_electricity');

    // 11a: Approve high-confidence gas record
    const approveGasRes = await request('POST', `/api/facilities/${testFacilityId}/extractions/${gasRecord.id}/approve`, {
      approverName: 'Engr. B. Okonkwo (Lead HSE)'
    });
    assert(approveGasRes.status === 200, 'H4: Approve returned 200 OK');
    assert(approveGasRes.body.record.status === 'approved', 'H4: Record status is "approved"');
    assert(approveGasRes.body.record.approvedValue === 485200, 'H4: Approved value locked to 485200 m3');

    // 11b: Edit diesel record (correcting value)
    const editDieselRes = await request('POST', `/api/facilities/${testFacilityId}/extractions/${dieselRecord.id}/edit`, {
      editedValue: 36200, // Corrected from 34500
      editReason: 'Calibration adjustment from physical dipstick log',
      editorName: 'Engr. B. Okonkwo (Lead HSE)'
    });
    assert(editDieselRes.status === 200, 'H4: Edit returned 200 OK');
    assert(editDieselRes.body.record.status === 'edited', 'H4: Record status is "edited"');
    assert(editDieselRes.body.record.approvedValue === 36200, 'H4: New approved value locked');
    assert(editDieselRes.body.record.editorName === 'Engr. B. Okonkwo (Lead HSE)', 'AC 1: Shows editor name');
    assert(Boolean(editDieselRes.body.record.editedTimestamp), 'AC 1: Shows editor timestamp');

    // 11c: Approve flaring record
    await request('POST', `/api/facilities/${testFacilityId}/extractions/${flareRecord.id}/approve`, {
      approverName: 'Engr. B. Okonkwo (Lead HSE)'
    });

    // 11d: Approve electric record
    await request('POST', `/api/facilities/${testFacilityId}/extractions/${electricRecord.id}/approve`, {
      approverName: 'Engr. B. Okonkwo (Lead HSE)'
    });

    // 11e: Return unreadable scan (H4, U1)
    const returnRes = await request('POST', `/api/facilities/${testFacilityId}/extractions/${unreadableRecord.id}/return`, {
      returnReason: 'Illegible thermal scan. Dispatching site operator for digital meter photo.'
    });
    assert(returnRes.status === 200, 'H4: Return returned 200 OK');
    assert(returnRes.body.record.status === 'needs_reupload', 'H4: Record marked "needs_reupload"');

    // ----------------------------------------------------
    // TEST 12: Manual Entry Fallback (E4, F2)
    // ----------------------------------------------------
    console.log('\n--- [TEST E4/F2 Fallback] Manual Activity Data Entry ---');
    const manualEntryRes = await request('POST', `/api/facilities/${testFacilityId}/extractions/manual`, {
      documentName: 'Emergency Generator Run Log (Manual Photo)',
      sourceType: 'diesel_ago_generation',
      fieldName: 'AGO Diesel (Manual Log)',
      value: 1200,
      unit: 'litres',
      actor: 'Engr. B. Okonkwo (Lead HSE)'
    });
    assert(manualEntryRes.status === 201, 'Manual entry created with 201');
    assert(manualEntryRes.body.record.confidence === 100, 'Manual entry has 100% human confidence');
    assert(manualEntryRes.body.record.status === 'manual', 'Manual entry is ready for calculation');

    // ----------------------------------------------------
    // TEST 13: H5 & AC 2 — Deterministic Calculation Engine
    // ----------------------------------------------------
    console.log('\n--- [TEST H5 & AC 2] Deterministic Calculation Engine ---');
    const calcRun1 = await request('POST', `/api/facilities/${testFacilityId}/calculate`);
    assert(calcRun1.status === 200, 'H5: Calculation returned 200 OK');
    assert(calcRun1.body.calculationResult.isDeterministic === true, 'H5: Flagged as deterministic');
    assert(calcRun1.body.calculationResult.summary.totalEmissionsTonnes > 0, 'H5: Total emissions calculated');

    // Traceability verification: every source has factorVersion and sourceDocName/ID
    for (const source of calcRun1.body.calculationResult.sources) {
      if (source.status === 'calculated') {
        assert(Boolean(source.factorVersion), `Traceability: ${source.sourceDocName} has factorVersion (${source.factorVersion})`);
        assert(Boolean(source.sourceDocName), `Traceability: ${source.sourceDocName} has source document name`);
        assert(Boolean(source.formula), `Traceability: ${source.sourceDocName} has mathematical formula`);
      }
    }

    // AC 2: Two runs with identical inputs produce identical results
    console.log('\n--- [AC 2] Reproducibility Test (Run 2 vs Run 1) ---');
    const calcRun2 = await request('POST', `/api/facilities/${testFacilityId}/calculate`);
    assert(
      calcRun1.body.calculationResult.summary.totalEmissionsTonnes === calcRun2.body.calculationResult.summary.totalEmissionsTonnes,
      `AC 2: Reproducibility verified: Run 1 (${calcRun1.body.calculationResult.summary.totalEmissionsTonnes}) === Run 2 (${calcRun2.body.calculationResult.summary.totalEmissionsTonnes})`
    );

    // ----------------------------------------------------
    // TEST 14: E5 & E6 — Missing Required Field & Unmapped Factor Handling
    // ----------------------------------------------------
    console.log('\n--- [TEST E5 & E6] Calculation Fault Tolerance ---');
    const { runDeterministicCalculation } = require('./lib/calculator');

    // E5: Missing activity field
    const testRecordsE5 = [
      { id: '1', sourceType: 'natural_gas_combustion', documentName: 'Gas Log', approvedValue: null, fieldName: 'Gas Volume' }
    ];
    const resE5 = runDeterministicCalculation(testRecordsE5);
    assert(resE5.sources[0].status === 'incomplete_field', 'E5: Status is "incomplete_field" when quantity is missing');
    assert(resE5.sources[0].error.includes('Incomplete — 1 required field missing'), 'E5: Explicit error message per spec');

    // E6: Unmapped factor
    const testRecordsE6 = [
      { id: '2', sourceType: 'unmapped_biomass_feedstock', documentName: 'Biomass Invoice', approvedValue: 500 }
    ];
    const resE6 = runDeterministicCalculation(testRecordsE6);
    assert(resE6.sources[0].status === 'missing_factor', 'E6: Status is "missing_factor" when no factor mapped');
    assert(resE6.sources[0].error.includes('No factor mapped'), 'E6: Explicit stop without silent defaults');

    // ----------------------------------------------------
    // TEST 15: H6 — Submit for Review (Happy Path)
    // ----------------------------------------------------
    console.log('\n--- [TEST H6] Submit for Review Happy Path ---');
    // First, resolve the returned unreadable item so 100% of extractions are approved
    // In our test flow, we can delete or approve it via manual entry substitution (U1)
    // Let's approve the unreadable item by updating it or editing it with confirmed data
    await request('POST', `/api/facilities/${testFacilityId}/extractions/${unreadableRecord.id}/edit`, {
      editedValue: 450,
      editReason: 'Replaced with verified high-res photo from field supervisor',
      editorName: 'Engr. B. Okonkwo (Lead HSE)',
      factorId: 'EF-DIESEL-T2-2024Q4'
    });

    // Re-run calculation with all records approved
    await request('POST', `/api/facilities/${testFacilityId}/calculate`);

    const submitRes = await request('POST', `/api/facilities/${testFacilityId}/submit-review`, {
      actor: 'Engr. B. Okonkwo (Lead HSE)'
    });
    assert(submitRes.status === 200, 'H6: Submit for review returned 200 OK');
    assert(submitRes.body.status === 'In review', 'H6: Status transitioned to "In review"');
    assert(Boolean(submitRes.body.submissionHash), 'H6: Submission hash generated and saved');

    // ----------------------------------------------------
    // TEST 16: Feature 5 / AC 5 — Immutable Audit Trail
    // ----------------------------------------------------
    console.log('\n--- [TEST Feature 5 / AC 5] Immutable Audit Trail ---');
    const auditRes = await request('GET', `/api/facilities/${testFacilityId}/audit-trail`);
    assert(auditRes.status === 200, 'Audit trail returned 200 OK');
    assert(auditRes.body.count >= 8, `Audit trail recorded ${auditRes.body.count} events across the flow`);
    
    // Check hash chaining integrity
    const logs = auditRes.body.logs;
    for (let i = 1; i < logs.length; i++) {
      assert(logs[i].prevHash === logs[i - 1].hash, `Audit chain link ${i} has valid cryptographic parent hash`);
    }

    console.log('\n======================================================');
    console.log('  🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY (16/16)');
    console.log('======================================================\n');

  } catch (err) {
    console.error('\n❌ TEST RUN ABORTED DUE TO ERROR:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runAllTests();
