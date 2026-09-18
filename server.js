const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getAllFactors, getFactorById, getFactorBySourceType } = require('./lib/emission_factors');
const { runDeterministicCalculation } = require('./lib/calculator');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Body parser & static assets
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/healthz', (req, res) => res.json({ status: 'ok', mode: 'prototype' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Database state & initialization
let db = {
  facilities: [],
  evidence: [],
  extractions: [],
  auditLogs: [],
  systemSettings: {
    aiDegradedMode: false,
    simulateUploadDrop: false
  }
};

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
    } catch (e) {
      console.error('Error loading db.json, initializing fresh store:', e);
      saveDb();
    }
  } else {
    saveDb();
  }
}

loadDb();

// Append-only audit logger helper
function logAuditEvent({ facilityId, actor = 'Operator (HSE Lead)', role = 'operator', action, details, metadata = {} }) {
  const previousLog = db.auditLogs.length > 0 ? db.auditLogs[db.auditLogs.length - 1] : null;
  const prevHash = previousLog ? previousLog.hash : 'GENESIS_HASH_0000000000000000';
  
  const timestamp = new Date().toISOString();
  const rawData = `${prevHash}|${facilityId}|${actor}|${role}|${action}|${timestamp}|${JSON.stringify(details)}`;
  const hash = crypto.createHash('sha256').update(rawData).digest('hex');

  const logEntry = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    facilityId,
    timestamp,
    actor,
    role,
    action,
    details,
    metadata,
    prevHash,
    hash
  };

  db.auditLogs.push(logEntry);
  saveDb();
  return logEntry;
}

// Multer storage config with file type verification
const allowedMimeTypes = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
  'image/webp'
];

const allowedExtensions = ['.pdf', '.csv', '.png', '.jpg', '.jpeg', '.webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext) && !allowedMimeTypes.includes(file.mimetype)) {
      const err = new Error(`Unsupported file type '${ext}'. Allowed types are: PDF, CSV, PNG, JPG`);
      err.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  }
});

// ==========================================
// API ROUTES
// ==========================================

// 1. GET /api/factors - Versioned emission factors
app.get('/api/factors', (req, res) => {
  res.json({
    success: true,
    count: getAllFactors().length,
    factors: getAllFactors()
  });
});

// 2. GET /api/facilities - List all facilities (Start Screen Landing)
app.get('/api/facilities', (req, res) => {
  res.json({
    success: true,
    count: db.facilities.length,
    facilities: db.facilities
  });
});

// 3. POST /api/facilities - Facility Registry Setup (H1, E1)
app.post('/api/facilities', (req, res) => {
  const { name, facilityType, boundaries, reportingPeriod, stateJurisdiction, actor = 'Operator (HSE Lead)' } = req.body;

  // E1 Validation: Missing facility type or required fields
  const missing = [];
  if (!name || !name.trim()) missing.push('Facility name is required');
  if (!facilityType || !facilityType.trim()) missing.push('Facility type is required');
  if (!boundaries || !boundaries.trim()) missing.push('Operational boundaries are required');
  if (!reportingPeriod || !reportingPeriod.trim()) missing.push('Reporting period is required (e.g. Q3 2026)');

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Facility setup validation failed',
      details: missing,
      primaryError: missing[0] // Inline error per E1
    });
  }

  const newFacility = {
    id: `FAC-${Date.now()}`,
    name: name.trim(),
    facilityType: facilityType.trim(),
    boundaries: boundaries.trim(),
    reportingPeriod: reportingPeriod.trim(),
    stateJurisdiction: stateJurisdiction || 'Rivers State (Port Harcourt)',
    status: 'Open', // H1: Period status = "Open"
    createdAt: new Date().toISOString(),
    thresholds: {
      autoSuggest: 90, // default 90% per U5
      flag: 70         // default 70% per U5
    },
    calculationVersion: 0,
    lastCalculation: null,
    reviewSubmission: null
  };

  db.facilities.unshift(newFacility);
  saveDb();

  logAuditEvent({
    facilityId: newFacility.id,
    actor,
    action: 'FACILITY_CREATED',
    details: {
      name: newFacility.name,
      facilityType: newFacility.facilityType,
      reportingPeriod: newFacility.reportingPeriod,
      boundaries: newFacility.boundaries,
      status: newFacility.status
    }
  });

  res.status(201).json({
    success: true,
    facility: newFacility,
    message: 'Facility profile created successfully in registry. Period status: Open.'
  });
});

// 4. GET /api/facilities/:id - Single facility details with evidence & extractions
app.get('/api/facilities/:id', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) {
    return res.status(404).json({ success: false, error: 'Facility not found' });
  }

  const evidence = db.evidence.filter(e => e.facilityId === facility.id);
  const extractions = db.extractions.filter(ex => ex.facilityId === facility.id);
  const logs = db.auditLogs.filter(l => l.facilityId === facility.id);

  // Summarize extraction approval gates
  const unapprovedCount = extractions.filter(ex => ex.status === 'pending_approval' || ex.status === 'needs_reupload').length;
  const approvedCount = extractions.filter(ex => ex.status === 'approved' || ex.status === 'edited' || ex.status === 'manual').length;

  res.json({
    success: true,
    facility,
    evidence,
    extractions,
    unapprovedCount,
    approvedCount,
    totalExtractions: extractions.length,
    auditTrailCount: logs.length,
    systemSettings: db.systemSettings
  });
});

// 5. PATCH /api/facilities/:id/thresholds - Configurable thresholds per facility (U5)
app.patch('/api/facilities/:id/thresholds', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Facility not found' });

  const { autoSuggest, flag, actor = 'Operator (HSE Lead)' } = req.body;
  if (autoSuggest !== undefined) facility.thresholds.autoSuggest = Number(autoSuggest);
  if (flag !== undefined) facility.thresholds.flag = Number(flag);

  saveDb();

  logAuditEvent({
    facilityId: facility.id,
    actor,
    action: 'THRESHOLDS_UPDATED',
    details: facility.thresholds
  });

  res.json({
    success: true,
    facility,
    thresholds: facility.thresholds,
    message: 'Facility extraction confidence thresholds updated.'
  });
});

// 6. POST /api/facilities/:id/upload - Evidence Upload (H2, E2, E3, F1, F6)
app.post('/api/facilities/:id/upload', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Facility not found' });

  // F1 Simulation check: upload drop mid-upload
  if (db.systemSettings.simulateUploadDrop) {
    return res.status(500).json({
      success: false,
      error: 'Upload failed — connection dropped mid-transfer. Partial file discarded.',
      recovery: 'Upload failed — retry. Other records unaffected.'
    });
  }

  // Multer handling with error capture
  upload.array('evidenceFiles', 20)(req, res, err => {
    if (err) {
      if (err.code === 'UNSUPPORTED_FILE_TYPE') {
        // E3: Unsupported file type rejected
        return res.status(400).json({
          success: false,
          error: err.message,
          rule: 'E3: Unsupported file type rejected. Allowed: PDF, CSV, PNG, JPG.'
        });
      }
      return res.status(400).json({ success: false, error: err.message });
    }

    // E2: Zero files check
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Upload at least one evidence record before continuing.',
        rule: 'E2: Empty upload blocked'
      });
    }

    const forceDuplicate = req.body.forceDuplicate === 'true' || req.body.forceDuplicate === true;
    const uploadedDocs = [];
    const duplicates = [];

    for (const file of req.files) {
      const fileBuffer = fs.readFileSync(file.path);
      const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // F6: Duplicate detection via SHA256 hash match within this facility
      const existingDuplicate = db.evidence.find(e => e.facilityId === facility.id && e.sha256Hash === sha256Hash);

      if (existingDuplicate && !forceDuplicate) {
        duplicates.push({
          filename: file.originalname,
          hash: sha256Hash,
          existingDocId: existingDuplicate.id,
          existingDocName: existingDuplicate.originalName,
          uploadedAt: existingDuplicate.uploadTimestamp
        });
        // Remove the temporary uploaded file
        try { fs.unlinkSync(file.path); } catch (e) {}
        continue;
      }

      const docRecord = {
        id: `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        facilityId: facility.id,
        originalName: file.originalname,
        storedFilename: file.filename,
        path: file.path,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sha256Hash,
        uploadTimestamp: new Date().toISOString(),
        status: 'pending_extraction', // H2: shows "Pending extraction"
        isUnreadableScan: file.originalname.toLowerCase().includes('unreadable') || file.originalname.toLowerCase().includes('degraded')
      };

      db.evidence.push(docRecord);
      uploadedDocs.push(docRecord);

      logAuditEvent({
        facilityId: facility.id,
        actor: req.body.actor || 'Operator (HSE Lead)',
        action: 'EVIDENCE_UPLOADED',
        details: {
          documentId: docRecord.id,
          filename: docRecord.originalName,
          sizeBytes: docRecord.sizeBytes,
          sha256Hash: docRecord.sha256Hash,
          status: docRecord.status
        }
      });
    }

    saveDb();

    // If duplicate found and nothing was stored
    if (duplicates.length > 0 && uploadedDocs.length === 0) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate evidence detected',
        duplicates,
        message: 'System flagged probable duplicate (SHA-256 hash match). Confirm keep or discard.',
        rule: 'F6: Duplicate upload detection'
      });
    }

    res.status(201).json({
      success: true,
      message: `${uploadedDocs.length} evidence file(s) stored successfully. All files show 'Pending extraction'.`,
      uploadedCount: uploadedDocs.length,
      uploadedDocs,
      duplicatesDetected: duplicates
    });
  });
});

// 7. POST /api/facilities/:id/extract - AI Extraction with Confidence Scoring (H3, E4, F2)
app.post('/api/facilities/:id/extract', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Facility not found' });

  // F2: AI Service degradation simulation
  if (db.systemSettings.aiDegradedMode) {
    // Records queue as "Extraction pending — will retry"
    const pendingDocs = db.evidence.filter(e => e.facilityId === facility.id && e.status === 'pending_extraction');
    pendingDocs.forEach(d => { d.status = 'degraded_queued'; });
    saveDb();

    return res.status(503).json({
      success: false,
      isDegraded: true,
      error: 'AI extraction service currently unavailable. Records queued as "Extraction pending — will retry".',
      bannerMessage: 'AI Service Degraded: You can proceed with manual entry while background retries are queued.',
      queuedCount: pendingDocs.length,
      rule: 'F2: AI service down fallback'
    });
  }

  const facilityDocs = db.evidence.filter(e => e.facilityId === facility.id && (e.status === 'pending_extraction' || e.status === 'degraded_queued'));

  if (facilityDocs.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No pending evidence documents found for extraction.'
    });
  }

  const newExtractions = [];
  const unreadableDocs = [];

  for (const doc of facilityDocs) {
    const filenameLower = doc.originalName.toLowerCase();

    // E4: Scanned image with no text layer / unreadable
    if (doc.isUnreadableScan || filenameLower.includes('unreadable') || filenameLower.includes('corrupt')) {
      doc.status = 'unreadable';
      unreadableDocs.push(doc.originalName);

      const extractionRecord = {
        id: `EXT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        facilityId: facility.id,
        documentId: doc.id,
        documentName: doc.originalName,
        sourceType: 'unmapped',
        fieldName: 'Activity Data (Unreadable)',
        extractedValue: null,
        approvedValue: null,
        unit: 'unknown',
        confidence: 0,
        status: 'needs_reupload', // E4: flagged for manual entry / re-upload
        isUnreadable: true,
        notes: 'E4: Scanned record contains no readable text layer. Flagged for manual entry.',
        extractedAt: new Date().toISOString()
      };

      db.extractions.push(extractionRecord);
      newExtractions.push(extractionRecord);

      logAuditEvent({
        facilityId: facility.id,
        actor: 'AI Extraction Agent',
        role: 'system',
        action: 'EXTRACTION_UNREADABLE',
        details: {
          documentId: doc.id,
          filename: doc.originalName,
          status: 'unreadable',
          resolution: 'Flagged for manual entry without blocking other records'
        }
      });
      continue;
    }

    // Realistic domain-specific field extraction based on document name & content
    let extractedField = {};

    if (filenameLower.includes('gas') || filenameLower.includes('invoice')) {
      extractedField = {
        sourceType: 'natural_gas_combustion',
        fieldName: 'Fuel Gas Inflow Volume',
        extractedValue: 485200,
        unit: 'm³',
        confidence: 96, // >=90% high confidence
        factorId: 'EF-NATGAS-T2-2024Q4'
      };
    } else if (filenameLower.includes('meter') || filenameLower.includes('flare')) {
      extractedField = {
        sourceType: 'flaring_venting',
        fieldName: 'Routine Flaring Flow Rate',
        extractedValue: 124500,
        unit: 'm³',
        confidence: 92, // >=90% high confidence
        factorId: 'EF-FLARE-T2-2024Q4'
      };
    } else if (filenameLower.includes('diesel') || filenameLower.includes('ago')) {
      extractedField = {
        sourceType: 'diesel_ago_generation',
        fieldName: 'AGO Diesel Fuel Consumed (Gensets)',
        extractedValue: 34500,
        unit: 'litres',
        confidence: 68, // <70% flagged for close inspection per H3
        factorId: 'EF-DIESEL-T2-2024Q4'
      };
    } else if (filenameLower.includes('electric') || filenameLower.includes('grid') || filenameLower.includes('disco')) {
      extractedField = {
        sourceType: 'grid_electricity',
        fieldName: 'DisCo Substation Inflow',
        extractedValue: 86400,
        unit: 'kWh',
        confidence: 91, // >=90% high confidence
        factorId: 'EF-GRID-DISCO-2024Q4'
      };
    } else {
      // Default extraction
      extractedField = {
        sourceType: 'diesel_ago_generation',
        fieldName: 'Fuel / Energy Intake Quantity',
        extractedValue: 15200,
        unit: 'litres',
        confidence: 85,
        factorId: 'EF-DIESEL-T2-2024Q4'
      };
    }

    doc.status = 'extracted';

    const extractionRecord = {
      id: `EXT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      facilityId: facility.id,
      documentId: doc.id,
      documentName: doc.originalName,
      sourceType: extractedField.sourceType,
      fieldName: extractedField.fieldName,
      extractedValue: extractedField.extractedValue,
      approvedValue: null, // Human gate: requires approval before calculation!
      unit: extractedField.unit,
      confidence: extractedField.confidence,
      factorId: extractedField.factorId,
      status: 'pending_approval', // H3 / H4: requires Approve / Edit / Return
      isUnreadable: false,
      extractedAt: new Date().toISOString()
    };

    db.extractions.push(extractionRecord);
    newExtractions.push(extractionRecord);

    logAuditEvent({
      facilityId: facility.id,
      actor: 'AI Extraction Engine v2.4',
      role: 'system',
      action: 'EXTRACTION_COMPLETED',
      details: {
        extractionId: extractionRecord.id,
        documentId: doc.id,
        fieldName: extractionRecord.fieldName,
        extractedValue: extractionRecord.extractedValue,
        confidence: extractionRecord.confidence
      }
    });
  }

  saveDb();

  const autoSuggestThreshold = facility.thresholds.autoSuggest || 90;
  const flagThreshold = facility.thresholds.flag || 70;

  const highConfidenceCount = newExtractions.filter(e => e.confidence >= autoSuggestThreshold).length;
  const flaggedCount = newExtractions.filter(e => e.confidence < flagThreshold && !e.isUnreadable).length;

  res.json({
    success: true,
    message: `Extraction completed for ${newExtractions.length} record(s). Human approval required before calculations.`,
    stats: {
      total: newExtractions.length,
      highConfidenceCount,
      flaggedCount,
      unreadableCount: unreadableDocs.length
    },
    unreadableDocs,
    extractions: newExtractions
  });
});

// 8. POST /api/facilities/:id/extractions/:recordId/approve - Human Gate Approval (H4)
app.post('/api/facilities/:id/extractions/:recordId/approve', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Facility not found' });

  const record = db.extractions.find(e => e.id === req.params.recordId && e.facilityId === facility.id);
  if (!record) return res.status(404).json({ success: false, error: 'Extraction record not found' });

  if (record.isUnreadable) {
    return res.status(400).json({
      success: false,
      error: 'Cannot approve an unreadable scan directly. Use manual entry or re-upload.'
    });
  }

  const approverName = req.body.approverName || 'Operator (HSE Lead)';
  record.status = 'approved';
  record.approvedValue = record.extractedValue;
  record.approverName = approverName;
  record.approvalTimestamp = new Date().toISOString();

  saveDb();

  logAuditEvent({
    facilityId: facility.id,
    actor: approverName,
    role: 'operator',
    action: 'EXTRACTION_APPROVED',
    details: {
      extractionId: record.id,
      documentName: record.documentName,
      fieldName: record.fieldName,
      approvedValue: record.approvedValue,
      unit: record.unit,
      confidence: record.confidence
    }
  });

  res.json({
    success: true,
    record,
    message: `Record '${record.fieldName}' approved by ${approverName}. Value locked to calculation input.`
  });
});

// 9. POST /api/facilities/:id/extractions/:recordId/edit - Human Gate Edit with Audit Trail (H4, Acceptance Criteria 1)
app.post('/api/facilities/:id/extractions/:recordId/edit', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Facility not found' });

  const record = db.extractions.find(e => e.id === req.params.recordId && e.facilityId === facility.id);
  if (!record) return res.status(404).json({ success: false, error: 'Extraction record not found' });

  const { editedValue, editReason, editorName = 'Operator (HSE Lead)', factorId } = req.body;

  if (editedValue === undefined || editedValue === null || editedValue === '') {
    return res.status(400).json({ success: false, error: 'Edited value is required' });
  }

  const numValue = Number(editedValue);
  if (isNaN(numValue) || numValue < 0) {
    return res.status(400).json({ success: false, error: 'Edited value must be a valid non-negative number' });
  }

  const previousValue = record.extractedValue;
  record.status = 'edited';
  record.approvedValue = numValue;
  record.editorName = editorName;
  record.editedTimestamp = new Date().toISOString();
  record.approverName = editorName;
  record.approvalTimestamp = record.editedTimestamp;
  record.editReason = editReason || 'Operator field correction';
  if (factorId) record.factorId = factorId;

  saveDb();

  logAuditEvent({
    facilityId: facility.id,
    actor: editorName,
    role: 'operator',
    action: 'EXTRACTION_EDITED',
    details: {
      extractionId: record.id,
      documentName: record.documentName,
      fieldName: record.fieldName,
      previousExtractedValue: previousValue,
      newApprovedValue: record.approvedValue,
      unit: record.unit,
      editorName: record.editorName,
      editedTimestamp: record.editedTimestamp,
      editReason: record.editReason
    }
  });

  res.json({
    success: true,
    record,
    message: `Record '${record.fieldName}' edited and approved. Editor name (${editorName}) and timestamp recorded in audit trail.`
  });
});

// 10. POST /api/facilities/:id/extractions/:recordId/return - Human Gate Return / Needs Re-upload (H4, U1)
app.post('/api/facilities/:id/extractions/:recordId/return', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Facility not found' });

  const record = db.extractions.find(e => e.id === req.params.recordId && e.facilityId === facility.id);
  if (!record) return res.status(404).json({ success: false, error: 'Extraction record not found' });

  const { returnReason = 'Illegible scan / incomplete record', actor = 'Operator (HSE Lead)' } = req.body;

  record.status = 'needs_reupload';
  record.returnReason = returnReason;
  record.returnedAt = new Date().toISOString();
  record.returnedBy = actor;

  saveDb();

  logAuditEvent({
    facilityId: facility.id,
    actor,
    role: 'operator',
    action: 'EXTRACTION_RETURNED',
    details: {
      extractionId: record.id,
      documentName: record.documentName,
      returnReason: record.returnReason,
      status: 'needs_reupload'
    }
  });

  res.json({
    success: true,
    record,
    message: `Extraction returned. Marked as 'Needs re-upload'. Re-entry path available via upload replacement or manual entry.`
  });
});

// 11. POST /api/facilities/:id/extractions/manual - Manual Entry Fallback (E4, F2)
app.post('/api/facilities/:id/extractions/manual', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Facility not found' });

  const {
    documentName = 'Manual Meter Log Entry',
    sourceType,
    fieldName,
    value,
    unit,
    factorId,
    actor = 'Operator (HSE Lead)'
  } = req.body;

  if (!sourceType || !fieldName || value === undefined || value === null || !unit) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields for manual entry (sourceType, fieldName, value, unit are mandatory).'
    });
  }

  const numValue = Number(value);
  if (isNaN(numValue) || numValue < 0) {
    return res.status(400).json({ success: false, error: 'Value must be a valid non-negative number' });
  }

  const manualRecord = {
    id: `EXT-MANUAL-${Date.now()}`,
    facilityId: facility.id,
    documentId: `DOC-MANUAL-${Date.now()}`,
    documentName,
    sourceType,
    fieldName,
    extractedValue: numValue,
    approvedValue: numValue,
    unit,
    confidence: 100, // 100% human-verified
    factorId: factorId || null,
    status: 'manual',
    isUnreadable: false,
    approverName: actor,
    approvalTimestamp: new Date().toISOString(),
    notes: 'Manual entry fallback (E4/F2 compliance)',
    extractedAt: new Date().toISOString()
  };

  db.extractions.push(manualRecord);
  saveDb();

  logAuditEvent({
    facilityId: facility.id,
    actor,
    role: 'operator',
    action: 'MANUAL_EXTRACTION_ADDED',
    details: {
      extractionId: manualRecord.id,
      fieldName: manualRecord.fieldName,
      approvedValue: manualRecord.approvedValue,
      unit: manualRecord.unit,
      sourceType: manualRecord.sourceType
    }
  });

  res.status(201).json({
    success: true,
    record: manualRecord,
    message: 'Manual activity entry added and approved for deterministic calculation.'
  });
});

// 12. POST /api/facilities/:id/calculate - Deterministic Calculation Engine (H5, E5, E6, F3)
app.post('/api/facilities/:id/calculate', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Facility not found' });

  // Gather all approved extractions
  const approvedExtractions = db.extractions.filter(
    e => e.facilityId === facility.id && (e.status === 'approved' || e.status === 'edited' || e.status === 'manual')
  );

  if (approvedExtractions.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot calculate emissions: No approved activity records exist. Human approval required first.'
    });
  }

  // F3: Increments calculation version on every run, preserving history
  facility.calculationVersion = (facility.calculationVersion || 0) + 1;

  const factorOverrides = (req.body && req.body.factorOverrides) || {};

  const calculationResult = runDeterministicCalculation(
    approvedExtractions,
    factorOverrides,
    facility.calculationVersion
  );

  facility.lastCalculation = calculationResult;
  saveDb();

  const actor = (req.body && req.body.actor) || 'Operator (HSE Lead)';

  logAuditEvent({
    facilityId: facility.id,
    actor,
    role: 'operator',
    action: 'CALCULATION_RUN',
    details: {
      calculationVersion: facility.calculationVersion,
      totalEmissionsTonnes: calculationResult.summary.totalEmissionsTonnes,
      activeSourcesCount: calculationResult.summary.activeSourcesCount,
      incompleteSourcesCount: calculationResult.summary.incompleteSourcesCount,
      isDeterministic: true
    },
    metadata: {
      sources: calculationResult.sources.map(s => ({
        sourceDocId: s.sourceDocId,
        factorVersion: s.factorVersion,
        calculatedCO2eTonnes: s.calculatedCO2eTonnes
      }))
    }
  });

  res.json({
    success: true,
    calculationVersion: facility.calculationVersion,
    calculationResult,
    message: `Deterministic calculation v${facility.calculationVersion} complete. Rules-based results reproducible across all runs.`
  });
});

// 13. POST /api/facilities/:id/submit-review - Submit for Verification (H6, E7)
app.post('/api/facilities/:id/submit-review', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Facility not found' });

  // E7: Block if any unapproved extractions pending
  const allFacilityExtractions = db.extractions.filter(e => e.facilityId === facility.id);
  const unapprovedExtractions = allFacilityExtractions.filter(
    e => e.status === 'pending_approval' || e.status === 'needs_reupload'
  );

  if (unapprovedExtractions.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Report submission blocked by human approval gate.',
      rule: 'E7 / Acceptance Criteria 1: No figure reaches "In review" without recorded human approval',
      unapprovedCount: unapprovedExtractions.length,
      primaryError: `${unapprovedExtractions.length} extraction(s) awaiting your approval before submission.`,
      pendingItems: unapprovedExtractions.map(u => ({
        id: u.id,
        documentName: u.documentName,
        fieldName: u.fieldName,
        status: u.status
      }))
    });
  }

  // Must have at least one calculation run
  if (!facility.lastCalculation || facility.lastCalculation.summary.totalEmissionsTonnes === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Cannot submit for review without running emissions calculation first.'
    });
  }

  // Submit for review: Status transition "Open" -> "In review" (H6)
  const actor = (req.body && req.body.actor) || 'Operator (HSE Lead)';
  const submissionTimestamp = new Date().toISOString();

  facility.status = 'In review';
  facility.reviewSubmission = {
    submittedBy: actor,
    submittedAt: submissionTimestamp,
    calculationVersion: facility.calculationVersion,
    totalEmissionsTonnes: facility.lastCalculation.summary.totalEmissionsTonnes,
    verifiedHumanGatesCount: allFacilityExtractions.length
  };

  saveDb();

  const submissionHash = crypto.createHash('sha256')
    .update(`${facility.id}|${facility.status}|${facility.calculationVersion}|${facility.lastCalculation.summary.totalEmissionsTonnes}|${submissionTimestamp}`)
    .digest('hex');

  logAuditEvent({
    facilityId: facility.id,
    actor,
    role: 'operator',
    action: 'SUBMITTED_FOR_REVIEW',
    details: {
      statusTransition: 'Open -> In review',
      calculationVersion: facility.calculationVersion,
      totalEmissionsTonnes: facility.lastCalculation.summary.totalEmissionsTonnes,
      approvedExtractionsCount: allFacilityExtractions.length,
      submissionHash
    }
  });

  res.json({
    success: true,
    facility,
    status: 'In review',
    submissionHash,
    message: 'Report submitted for review. Facility status is now "In review". Verifier queue notified.'
  });
});

// 14. GET /api/facilities/:id/audit-trail - Immutable Audit Trail (Feature 5, AC 5)
app.get('/api/facilities/:id/audit-trail', (req, res) => {
  const facility = db.facilities.find(f => f.id === req.params.id);
  if (!facility) return res.status(404).json({ success: false, error: 'Facility not found' });

  const logs = db.auditLogs.filter(l => l.facilityId === facility.id);

  res.json({
    success: true,
    facilityName: facility.name,
    count: logs.length,
    logs
  });
});

// 15. Scaffolded Placeholder Endpoints for Next Increment
app.get('/api/verification/queue', (req, res) => {
  res.json({
    status: 'scaffolded_placeholder',
    module: 'Verification Review Queue (Feature 3 / H7, E8, E9)',
    milestone: 'Next Increment — Verification and Regulator Sign-off',
    description: 'Scaffolded placeholder route per Day-3 handoff prompt instructions. Verifier role & queue arrives next increment.'
  });
});

app.get('/api/reports/preview', (req, res) => {
  res.json({
    status: 'scaffolded_placeholder',
    module: 'Regulator-Ready Report Generator (Feature 4 / H8, E10)',
    milestone: 'Next Increment — NUPRC Report Generator',
    description: 'Scaffolded placeholder route per Day-3 handoff prompt instructions. NUPRC template export arrives next increment.'
  });
});

// 16. System Simulation Controls (F1, F2)
app.post('/api/system/simulate', (req, res) => {
  const { aiDegradedMode, simulateUploadDrop } = req.body;
  if (aiDegradedMode !== undefined) db.systemSettings.aiDegradedMode = Boolean(aiDegradedMode);
  if (simulateUploadDrop !== undefined) db.systemSettings.simulateUploadDrop = Boolean(simulateUploadDrop);
  saveDb();

  res.json({
    success: true,
    systemSettings: db.systemSettings,
    message: 'System simulation flags updated.'
  });
});

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`ECO-ENGINE MRV Platform server running on http://localhost:${PORT}`);
});

module.exports = { app, server };
