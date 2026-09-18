/**
 * ECO-ENGINE Client Application Controller
 * 
 * Aligned with SCREEN_SPECIFICATION.md:
 * - Left Sidebar Navigation (6 Screens: Dashboard, Data Intake, Emissions Compiler, Verification Queue, Audit Trail, Regulator Reports)
 * - Top Bar with Facility Selector & Role Switcher
 * - Standardized Status Chips: Gray = Draft, Gold = In Review, Deep Green = Verified
 * - Screen 1: Dashboard with 4 KPI cards, active alerts, and facility portfolio table
 * - Screen 2: Data Intake Hero Split View (Document Preview on left, Extracted Fields + 3-tier confidence bar + Approve/Edit/Return on right)
 * - Screen 3: Emissions Compiler with Scope tabs (Scope 1 / Scope 2 / Scope 3) and Traceability Banner
 * - Screen 5: Dedicated Audit Trail Screen with filters and CSV export
 */

// Application State
const state = {
  facilities: [],
  currentFacilityId: null,
  currentFacility: null,
  evidence: [],
  extractions: [],
  auditLogs: [],
  activeDocId: null,
  currentRole: 'Operator (HSE Lead)',
  activeView: 'view-dashboard',
  activeScopeFilter: 'all',
  systemSettings: {
    aiDegradedMode: false,
    simulateUploadDrop: false
  }
};

// DOM Cache
const dom = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  bindEvents();
  loadInitialData();
});

function cacheDom() {
  // Shell & Navigation
  dom.brandHomeBtn = document.getElementById('brand-home-btn');
  dom.sidebarNavItems = document.querySelectorAll('.sidebar-nav-item');
  dom.viewSections = document.querySelectorAll('.view-section');
  dom.topbarFacilityDropdown = document.getElementById('topbar-facility-dropdown');
  dom.topbarStatusChip = document.getElementById('topbar-status-chip');
  dom.topbarPeriodChip = document.getElementById('topbar-period-chip');
  dom.userRoleSelect = document.getElementById('user-role-select');
  dom.btnNotifications = document.getElementById('btn-notifications');
  dom.notifDot = document.getElementById('notif-dot');
  dom.sidebarPendingBadge = document.getElementById('sidebar-pending-badge');
  dom.sidebarAuditBadge = document.getElementById('sidebar-audit-badge');
  dom.btnQuickAuditDrawer = document.getElementById('btn-quick-audit-drawer');
  dom.degradedSystemBanner = document.getElementById('degraded-system-banner');

  // Screen 1: Dashboard
  dom.dashboardEmptyState = document.getElementById('dashboard-empty-state');
  dom.dashboardContentContainer = document.getElementById('dashboard-content-container');
  dom.btnEmptyStartFacility = document.getElementById('btn-empty-start-facility');
  dom.btnCreateFacilityDash = document.getElementById('btn-create-facility-dash');
  dom.kpiTotalEmissions = document.getElementById('kpi-total-emissions');
  dom.kpiFacilitiesCount = document.getElementById('kpi-facilities-count');
  dom.kpiFacilitiesSub = document.getElementById('kpi-facilities-sub');
  dom.kpiStatusDraft = document.getElementById('kpi-status-draft');
  dom.kpiStatusReview = document.getElementById('kpi-status-review');
  dom.kpiStatusVerified = document.getElementById('kpi-status-verified');
  dom.kpiCompleteness = document.getElementById('kpi-completeness');
  dom.kpiCompletenessMeta = document.getElementById('kpi-completeness-meta');
  dom.dashboardAlertsCard = document.getElementById('dashboard-alerts-card');
  dom.dashboardAlertsList = document.getElementById('dashboard-alerts-list');
  dom.dashboardFacilitiesTbody = document.getElementById('dashboard-facilities-tbody');

  // Screen 2: Data Intake
  dom.intakeProgressText = document.getElementById('intake-progress-text');
  dom.intakePendingCountChip = document.getElementById('intake-pending-count-chip');
  dom.btnTriggerAiBatch = document.getElementById('btn-trigger-ai-batch');
  dom.btnSeedIntakeFiles = document.getElementById('btn-seed-intake-files');
  dom.btnSeedUnreadableIntake = document.getElementById('btn-seed-unreadable-intake');
  dom.chkIntakeDrop = document.getElementById('chk-intake-drop');
  dom.chkIntakeDegraded = document.getElementById('chk-intake-degraded');
  dom.uploadDropzone = document.getElementById('upload-dropzone');
  dom.fileInputControl = document.getElementById('file-input-control');
  dom.btnBrowseFiles = document.getElementById('btn-browse-files');
  dom.uploadStatusAlert = document.getElementById('upload-status-alert');
  dom.previewActiveFilename = document.getElementById('preview-active-filename');
  dom.previewActiveStatus = document.getElementById('preview-active-status');
  dom.docPreviewScreen = document.getElementById('doc-preview-screen');
  dom.evidenceRosterChips = document.getElementById('evidence-roster-chips');
  dom.extractionsCardsContainer = document.getElementById('extractions-cards-container');
  dom.btnIntakeManualEntry = document.getElementById('btn-intake-manual-entry');
  dom.btnProceedToCompilerHero = document.getElementById('btn-proceed-to-compiler-hero');

  // Screen 3: Emissions Compiler
  dom.btnRecalculateEngine = document.getElementById('btn-recalculate-engine');
  dom.btnCompilerProceedSubmit = document.getElementById('btn-compiler-proceed-submit');
  dom.compilerFaultBanners = document.getElementById('compiler-fault-banners');
  dom.heroTotalEmissions = document.getElementById('hero-total-emissions');
  dom.heroScopeBreakdown = document.getElementById('hero-scope-breakdown');
  dom.calcVersionBadge = document.getElementById('calc-version-badge');
  dom.btnRunCalculation = document.getElementById('btn-run-calculation');
  dom.barGas = document.getElementById('bar-gas');
  dom.barFlare = document.getElementById('bar-flare');
  dom.barDiesel = document.getElementById('bar-diesel');
  dom.barGrid = document.getElementById('bar-grid');
  dom.pctGas = document.getElementById('pct-gas');
  dom.pctFlare = document.getElementById('pct-flare');
  dom.pctDiesel = document.getElementById('pct-diesel');
  dom.pctGrid = document.getElementById('pct-grid');
  dom.scopeTabBtns = document.querySelectorAll('.scope-tab-btn');
  dom.calculationSourcesTbody = document.getElementById('calculation-sources-tbody');

  // Screen 5: Audit Trail Dedicated
  dom.auditFilterAction = document.getElementById('audit-filter-action');
  dom.auditFilterRole = document.getElementById('audit-filter-role');
  dom.auditLogsCountText = document.getElementById('audit-logs-count-text');
  dom.auditTableScreenTbody = document.getElementById('audit-table-screen-tbody');
  dom.btnExportAuditCsv = document.getElementById('btn-export-audit-csv');

  // Submit Review View
  dom.submitCurrentStatusChip = document.getElementById('submit-current-status-chip');
  dom.submitValidationContainer = document.getElementById('submit-validation-container');
  dom.btnConfirmSubmitReview = document.getElementById('btn-confirm-submit-review');

  // Modals & Drawer
  dom.modalCreateFacility = document.getElementById('modal-create-facility');
  dom.inpFacilityName = document.getElementById('inp-facility-name');
  dom.inpFacilityType = document.getElementById('inp-facility-type');
  dom.inpFacilityBoundaries = document.getElementById('inp-facility-boundaries');
  dom.inpFacilityPeriod = document.getElementById('inp-facility-period');
  dom.inpFacilityState = document.getElementById('inp-facility-state');
  dom.facilityModalError = document.getElementById('facility-modal-error');
  dom.btnSubmitFacilityModal = document.getElementById('btn-submit-facility-modal');
  dom.btnCancelFacilityModal = document.getElementById('btn-cancel-facility-modal');
  dom.btnCloseFacilityModal = document.getElementById('btn-close-facility-modal');

  dom.modalEditExtraction = document.getElementById('modal-edit-extraction');
  dom.editRecordId = document.getElementById('edit-record-id');
  dom.editModalActorDisplay = document.getElementById('edit-modal-actor-display');
  dom.editFieldName = document.getElementById('edit-field-name');
  dom.editOrigVal = document.getElementById('edit-orig-val');
  dom.editNewVal = document.getElementById('edit-new-val');
  dom.editReason = document.getElementById('edit-reason');
  dom.btnConfirmEditSave = document.getElementById('btn-confirm-edit-save');
  dom.btnCancelEditModal = document.getElementById('btn-cancel-edit-modal');
  dom.btnCloseEditModal = document.getElementById('btn-close-edit-modal');

  dom.modalReturnExtraction = document.getElementById('modal-return-extraction');
  dom.returnRecordId = document.getElementById('return-record-id');
  dom.returnReasonSelect = document.getElementById('return-reason-select');
  dom.btnConfirmReturn = document.getElementById('btn-confirm-return');
  dom.btnCancelReturnModal = document.getElementById('btn-cancel-return-modal');
  dom.btnCloseReturnModal = document.getElementById('btn-close-return-modal');

  dom.modalManualEntry = document.getElementById('modal-manual-entry');
  dom.manualDocName = document.getElementById('manual-doc-name');
  dom.manualSourceType = document.getElementById('manual-source-type');
  dom.manualFieldName = document.getElementById('manual-field-name');
  dom.manualValue = document.getElementById('manual-value');
  dom.manualUnit = document.getElementById('manual-unit');
  dom.btnConfirmManualSave = document.getElementById('btn-confirm-manual-save');
  dom.btnCancelManualModal = document.getElementById('btn-cancel-manual-modal');
  dom.btnCloseManualModal = document.getElementById('btn-close-manual-modal');

  dom.modalDuplicateAlert = document.getElementById('modal-duplicate-alert');
  dom.duplicateDetailsBox = document.getElementById('duplicate-details-box');
  dom.btnDuplicateDiscard = document.getElementById('btn-duplicate-discard');
  dom.btnDuplicateKeep = document.getElementById('btn-duplicate-keep');
  dom.btnCloseDuplicateModal = document.getElementById('btn-close-duplicate-modal');

  dom.auditDrawer = document.getElementById('audit-drawer');
  dom.auditDrawerOverlay = document.getElementById('audit-drawer-overlay');
  dom.btnCloseAuditDrawer = document.getElementById('btn-close-audit-drawer');
  dom.auditTimelineContainer = document.getElementById('audit-timeline-container');
}

function bindEvents() {
  // Sidebar Navigation
  dom.sidebarNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view) switchView(view);
    });
  });

  dom.brandHomeBtn.addEventListener('click', () => switchView('view-dashboard'));

  // Topbar Facility Selector
  dom.topbarFacilityDropdown.addEventListener('change', (e) => {
    if (e.target.value) {
      selectFacility(e.target.value);
    }
  });

  // User Role Switcher
  dom.userRoleSelect.addEventListener('change', (e) => {
    state.currentRole = e.target.value;
  });

  // Quick Audit Drawer
  dom.btnQuickAuditDrawer.addEventListener('click', openAuditDrawer);
  dom.btnCloseAuditDrawer.addEventListener('click', closeAuditDrawer);
  dom.auditDrawerOverlay.addEventListener('click', closeAuditDrawer);

  // Facility Registration Modal
  dom.btnEmptyStartFacility.addEventListener('click', openFacilityModal);
  dom.btnCreateFacilityDash.addEventListener('click', openFacilityModal);
  dom.btnCancelFacilityModal.addEventListener('click', closeFacilityModal);
  dom.btnCloseFacilityModal.addEventListener('click', closeFacilityModal);
  dom.btnSubmitFacilityModal.addEventListener('click', handleCreateFacilitySubmit);

  // Screen 2 Data Intake
  dom.btnBrowseFiles.addEventListener('click', () => dom.fileInputControl.click());
  dom.fileInputControl.addEventListener('change', handleFileInput);

  dom.uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.uploadDropzone.classList.add('dragover');
  });
  dom.uploadDropzone.addEventListener('dragleave', () => {
    dom.uploadDropzone.classList.remove('dragover');
  });
  dom.uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.uploadDropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFilesList(e.dataTransfer.files);
    }
  });

  dom.btnSeedIntakeFiles.addEventListener('click', seedSampleFixtures);
  dom.btnSeedUnreadableIntake.addEventListener('click', seedUnreadableFixture);
  dom.chkIntakeDrop.addEventListener('change', handleSimulationToggle);
  dom.chkIntakeDegraded.addEventListener('change', handleSimulationToggle);
  dom.btnTriggerAiBatch.addEventListener('click', handleTriggerExtraction);
  dom.btnProceedToCompilerHero.addEventListener('click', () => switchView('view-compiler'));

  // Manual Entry Modal
  dom.btnIntakeManualEntry.addEventListener('click', openManualEntryModal);
  dom.btnCancelManualModal.addEventListener('click', closeManualEntryModal);
  dom.btnCloseManualModal.addEventListener('click', closeManualEntryModal);
  dom.btnConfirmManualSave.addEventListener('click', handleManualEntrySubmit);
  dom.manualSourceType.addEventListener('change', updateManualUnits);

  // Edit Extraction Modal
  dom.btnCancelEditModal.addEventListener('click', closeEditModal);
  dom.btnCloseEditModal.addEventListener('click', closeEditModal);
  dom.btnConfirmEditSave.addEventListener('click', handleEditExtractionSubmit);

  // Return Extraction Modal
  dom.btnCancelReturnModal.addEventListener('click', closeReturnModal);
  dom.btnCloseReturnModal.addEventListener('click', closeReturnModal);
  dom.btnConfirmReturn.addEventListener('click', handleReturnExtractionSubmit);

  // Duplicate Modal
  dom.btnCloseDuplicateModal.addEventListener('click', () => dom.modalDuplicateAlert.classList.remove('active'));
  dom.btnDuplicateDiscard.addEventListener('click', () => dom.modalDuplicateAlert.classList.remove('active'));

  // Screen 3 Compiler
  dom.btnRunCalculation.addEventListener('click', handleRunCalculation);
  dom.btnRecalculateEngine.addEventListener('click', handleRunCalculation);
  dom.btnCompilerProceedSubmit.addEventListener('click', () => switchView('view-submit'));

  dom.scopeTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.scopeTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeScopeFilter = btn.dataset.scope;
      renderCompilerSourcesTable();
    });
  });

  // Screen 5 Audit Trail Dedicated
  dom.auditFilterAction.addEventListener('change', renderDedicatedAuditTable);
  dom.auditFilterRole.addEventListener('change', renderDedicatedAuditTable);
  dom.btnExportAuditCsv.addEventListener('click', exportAuditCsv);

  // Submit Review
  dom.btnConfirmSubmitReview.addEventListener('click', handleSubmitReview);
}

// ==========================================
// VIEW SWITCHING
// ==========================================

function switchView(viewId) {
  state.activeView = viewId;

  // Toggle View Sections
  dom.viewSections.forEach(section => {
    if (section.id === viewId) {
      section.classList.add('active-view');
    } else {
      section.classList.remove('active-view');
    }
  });

  // Update Sidebar Nav active state
  dom.sidebarNavItems.forEach(item => {
    if (item.dataset.view === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // View-specific refreshes
  if (viewId === 'view-dashboard') {
    fetchFacilities();
  } else if (viewId === 'view-audit') {
    fetchAuditTrailDedicated();
  } else if (state.currentFacilityId) {
    fetchFacilityDetails(state.currentFacilityId);
  }
}
window.switchView = switchView;

async function loadInitialData() {
  await fetchFacilities();
}

// ==========================================
// SCREEN 1: DASHBOARD (H1, E1)
// ==========================================

async function fetchFacilities() {
  try {
    const res = await fetch('/api/facilities');
    const data = await res.json();
    if (data.success) {
      state.facilities = data.facilities;
      populateTopbarDropdown();
      renderDashboardView();

      // If no current facility selected, default to first
      if (!state.currentFacilityId && state.facilities.length > 0) {
        selectFacility(state.facilities[0].id, false);
      }
    }
  } catch (err) {
    console.error('Failed to fetch facilities:', err);
  }
}

function populateTopbarDropdown() {
  if (state.facilities.length === 0) {
    dom.topbarFacilityDropdown.innerHTML = '<option value="">No Facilities Registered</option>';
    return;
  }

  dom.topbarFacilityDropdown.innerHTML = state.facilities.map(f => {
    const isSelected = f.id === state.currentFacilityId;
    return `<option value="${f.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(f.name)} (${f.reportingPeriod})</option>`;
  }).join('');
}

function renderDashboardView() {
  if (state.facilities.length === 0) {
    dom.dashboardEmptyState.style.display = 'block';
    dom.dashboardContentContainer.style.display = 'none';
    return;
  }

  dom.dashboardEmptyState.style.display = 'none';
  dom.dashboardContentContainer.style.display = 'block';

  // 1. Calculate KPI Metrics
  let totalEmissionsPeriod = 0;
  let draftCount = 0;
  let reviewCount = 0;
  let verifiedCount = 0;

  state.facilities.forEach(f => {
    if (f.lastCalculation && f.lastCalculation.summary) {
      totalEmissionsPeriod += f.lastCalculation.summary.totalEmissionsTonnes || 0;
    }
    if (f.status === 'In review') reviewCount++;
    else if (f.status === 'Verified') verifiedCount++;
    else draftCount++;
  });

  dom.kpiTotalEmissions.textContent = totalEmissionsPeriod.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  dom.kpiFacilitiesCount.textContent = state.facilities.length;
  dom.kpiFacilitiesSub.textContent = `${state.facilities.length} active reporting asset(s)`;

  dom.kpiStatusDraft.textContent = `${draftCount} Draft`;
  dom.kpiStatusReview.textContent = `${reviewCount} In Review`;
  dom.kpiStatusVerified.textContent = `${verifiedCount} Verified`;

  // 2. Render Facilities Table
  dom.dashboardFacilitiesTbody.innerHTML = state.facilities.map(fac => {
    const isCurrent = fac.id === state.currentFacilityId;
    const emissionsVal = fac.lastCalculation?.summary?.totalEmissionsTonnes
      ? `${fac.lastCalculation.summary.totalEmissionsTonnes.toFixed(2)} tCO₂e`
      : `<span style="color: var(--text-muted);">Uncalculated</span>`;

    let statusChipClass = 'status-chip-draft';
    if (fac.status === 'In review') statusChipClass = 'status-chip-review';
    if (fac.status === 'Verified') statusChipClass = 'status-chip-verified';

    return `
      <tr style="${isCurrent ? 'background-color: #f6faf6;' : ''}">
        <td>
          <strong>${escapeHtml(fac.name)}</strong>
          ${isCurrent ? '<span class="status-chip status-chip-verified" style="margin-left: 6px; font-size: 9px;">ACTIVE</span>' : ''}
        </td>
        <td>${escapeHtml(fac.facilityType)}</td>
        <td>${escapeHtml(fac.stateJurisdiction || 'Rivers State')}</td>
        <td><strong>${escapeHtml(fac.reportingPeriod)}</strong></td>
        <td><span class="status-chip ${statusChipClass}">${escapeHtml(fac.status)}</span></td>
        <td class="tabular-nums" style="font-weight: 700; color: var(--primary-deep);">${emissionsVal}</td>
        <td style="font-size: 12px;">
          ${fac.lastCalculation ? '✓ Deterministic v' + fac.calculationVersion : 'Requires Calculation'}
        </td>
        <td style="text-align: right;">
          <button class="btn btn-primary btn-sm" onclick="selectFacility('${fac.id}', true)">
            Open Workspace &rarr;
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function selectFacility(facilityId, navigateToIntake = false) {
  state.currentFacilityId = facilityId;
  state.currentFacility = state.facilities.find(f => f.id === facilityId);

  populateTopbarDropdown();
  updateTopbarStatus();

  if (state.currentFacilityId) {
    fetchFacilityDetails(state.currentFacilityId);
  }

  if (navigateToIntake) {
    switchView('view-intake');
  }
}
window.selectFacility = selectFacility;

function updateTopbarStatus() {
  if (!state.currentFacility) return;
  const fac = state.currentFacility;
  dom.topbarPeriodChip.textContent = fac.reportingPeriod;

  let chipClass = 'status-chip-draft';
  if (fac.status === 'In review') chipClass = 'status-chip-review';
  if (fac.status === 'Verified') chipClass = 'status-chip-verified';

  dom.topbarStatusChip.className = `status-chip ${chipClass}`;
  dom.topbarStatusChip.textContent = fac.status === 'Open' ? 'Draft' : fac.status;
}

// Facility Creation Modal (E1 Validation)
function openFacilityModal() {
  dom.facilityModalError.style.display = 'none';
  dom.inpFacilityName.value = '';
  dom.inpFacilityType.value = '';
  dom.inpFacilityBoundaries.value = 'Wellhead headers, separation train, gas flare stack, genset bank';
  dom.inpFacilityPeriod.value = 'Q3 2026';
  dom.modalCreateFacility.classList.add('active');
}

function closeFacilityModal() {
  dom.modalCreateFacility.classList.remove('active');
}

async function handleCreateFacilitySubmit() {
  const name = dom.inpFacilityName.value.trim();
  const facilityType = dom.inpFacilityType.value.trim();
  const boundaries = dom.inpFacilityBoundaries.value.trim();
  const reportingPeriod = dom.inpFacilityPeriod.value.trim();
  const stateJurisdiction = dom.inpFacilityState.value;

  // E1: Missing facility type validation
  if (!name) {
    showFacilityModalError('Facility name is required');
    return;
  }
  if (!facilityType) {
    showFacilityModalError('Facility type is required'); // E1 Inline error
    return;
  }
  if (!boundaries) {
    showFacilityModalError('Operational boundaries are required');
    return;
  }
  if (!reportingPeriod) {
    showFacilityModalError('Reporting period is required (e.g. Q3 2026)');
    return;
  }

  try {
    const res = await fetch('/api/facilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        facilityType,
        boundaries,
        reportingPeriod,
        stateJurisdiction,
        actor: state.currentRole
      })
    });

    const data = await res.json();
    if (data.success) {
      closeFacilityModal();
      await fetchFacilities();
      selectFacility(data.facility.id, true);
    } else {
      showFacilityModalError(data.primaryError || data.error);
    }
  } catch (err) {
    showFacilityModalError('Network error registering facility profile.');
  }
}

function showFacilityModalError(msg) {
  dom.facilityModalError.textContent = msg;
  dom.facilityModalError.style.display = 'block';
}

// ==========================================
// SCREEN 2: DATA INTAKE & SPLIT VIEW (H2, H3, H4, E2, E3, E4, F1, F2, F6)
// ==========================================

async function fetchFacilityDetails(facilityId) {
  try {
    const res = await fetch(`/api/facilities/${facilityId}`);
    const data = await res.json();
    if (data.success) {
      state.currentFacility = data.facility;
      state.evidence = data.evidence;
      state.extractions = data.extractions;

      updateTopbarStatus();
      updateIntakeProgressBar();
      renderEvidenceRosterChips();
      renderSplitViewPreview();
      renderExtractionsCards();
      renderCompilerView();
      renderSubmitView();

      dom.sidebarPendingBadge.textContent = `${data.unapprovedCount} Gate`;
      dom.sidebarAuditBadge.textContent = `${data.auditTrailCount} Logs`;

      // Active Alerts panel update on Dashboard
      updateDashboardAlerts(data.unapprovedCount);

      // F2 Banner toggle
      if (data.systemSettings.aiDegradedMode) {
        dom.degradedSystemBanner.style.display = 'flex';
        dom.chkIntakeDegraded.checked = true;
      } else {
        dom.degradedSystemBanner.style.display = 'none';
        dom.chkIntakeDegraded.checked = false;
      }
      dom.chkIntakeDrop.checked = data.systemSettings.simulateUploadDrop;
    }
  } catch (err) {
    console.error('Error fetching facility details:', err);
  }
}

function updateDashboardAlerts(unapprovedCount) {
  if (unapprovedCount > 0) {
    dom.dashboardAlertsCard.style.display = 'block';
    dom.notifDot.style.display = 'block';
    dom.dashboardAlertsList.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0;">
        <span style="font-size: 13px; color: var(--warning-text);">
          <strong>E7 Gate Alert:</strong> ${unapprovedCount} extracted activity record(s) require human Approve/Edit sign-off before submission.
        </span>
        <button class="btn btn-secondary btn-sm" onclick="switchView('view-intake')">
          Resolve Gate &rarr;
        </button>
      </div>
    `;
  } else {
    dom.dashboardAlertsCard.style.display = 'none';
    dom.notifDot.style.display = 'none';
  }
}

function updateIntakeProgressBar() {
  const total = state.extractions.length;
  const approved = state.extractions.filter(e => e.status === 'approved' || e.status === 'edited' || e.status === 'manual').length;
  const pending = state.extractions.filter(e => e.status === 'pending_approval' || e.status === 'needs_reupload').length;
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;

  dom.intakeProgressText.textContent = `${approved} of ${total} extractions approved (${pct}%)`;
  dom.intakePendingCountChip.textContent = `${pending} Awaiting Approval`;
  dom.intakePendingCountChip.className = `status-chip ${pending > 0 ? 'status-chip-review' : 'status-chip-verified'}`;
}

function renderEvidenceRosterChips() {
  if (state.evidence.length === 0) {
    dom.evidenceRosterChips.innerHTML = `<span style="font-size: 11px; color: var(--text-muted);">No evidence files uploaded yet.</span>`;
    return;
  }

  // Default active document to first if not set
  if (!state.activeDocId && state.evidence.length > 0) {
    state.activeDocId = state.evidence[0].id;
  }

  dom.evidenceRosterChips.innerHTML = state.evidence.map(doc => {
    const isDocActive = doc.id === state.activeDocId;
    return `
      <button class="btn btn-sm ${isDocActive ? 'btn-primary' : 'btn-secondary'}" onclick="selectEvidenceDoc('${doc.id}')" style="font-size: 11px; padding: 3px 9px;">
        ${escapeHtml(doc.originalName)}
      </button>
    `;
  }).join('');
}

function selectEvidenceDoc(docId) {
  state.activeDocId = docId;
  renderEvidenceRosterChips();
  renderSplitViewPreview();
}
window.selectEvidenceDoc = selectEvidenceDoc;

function renderSplitViewPreview() {
  const doc = state.evidence.find(d => d.id === state.activeDocId);
  if (!doc) {
    dom.previewActiveFilename.textContent = 'No document selected';
    dom.previewActiveStatus.textContent = 'Awaiting Upload';
    dom.previewActiveStatus.className = 'status-chip status-chip-draft';
    dom.docPreviewScreen.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
        Upload evidence records or load sample fixtures to view optical/digital records here.
      </div>
    `;
    return;
  }

  dom.previewActiveFilename.textContent = `${doc.originalName} (${formatBytes(doc.sizeBytes)})`;
  dom.previewActiveStatus.textContent = doc.status.replace('_', ' ');
  dom.previewActiveStatus.className = `status-chip ${doc.status === 'extracted' ? 'status-chip-verified' : 'status-chip-review'}`;

  // Simulated Document Optical Preview
  if (doc.isUnreadableScan) {
    dom.docPreviewScreen.innerHTML = `
      <div style="background: #fff5f5; border: 1px dashed #f87171; padding: 20px; border-radius: 6px; text-align: center; color: #991b1b;">
        <h4 style="margin-bottom: 6px;">E4: Scanned Bitmap — No OCR Text Layer Detected</h4>
        <p style="font-size: 12px; margin-bottom: 12px;">The thermal scan is degraded and unreadable by the automated AI extraction engine.</p>
        <span class="status-chip status-chip-review">Flagged for Manual Entry (E4 Compliance)</span>
      </div>
    `;
    return;
  }

  dom.docPreviewScreen.innerHTML = `
    <div style="border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 14px;">
      <div style="font-weight: 700; font-size: 13px; text-transform: uppercase;">FEDERAL REPUBLIC OF NIGERIA &bull; FACILITY LOG</div>
      <div style="font-size: 11px; color: #666;">DOCUMENT REF: ${escapeHtml(doc.originalName)} | SHA-256: ${doc.sha256Hash.substring(0, 18)}...</div>
    </div>
    <div style="font-size: 12px; line-height: 1.8;">
      <div><strong>Reporting Asset:</strong> ${escapeHtml(state.currentFacility?.name || 'Flow Station')}</div>
      <div><strong>Operational Period:</strong> ${escapeHtml(state.currentFacility?.reportingPeriod || 'Q3 2026')}</div>
      <div><strong>Ingested Date:</strong> ${new Date(doc.uploadTimestamp).toLocaleString()}</div>
      <div style="margin-top: 10px; padding: 8px; background: #f9f9f9; border-left: 3px solid var(--primary-forest);">
        [EXTRACTED TELEMETRY STREAM DETECTED]
        <br>Activity units parsed. Confidence matrix calculated against IPCC Tier 2 library.
      </div>
    </div>
  `;
}

// Render Extracted Fields with 3-Tier Confidence Bar (≥90% green, 70–89% gold, <70% red)
function renderExtractionsCards() {
  if (state.extractions.length === 0) {
    dom.extractionsCardsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
        No activity fields extracted yet. Click <strong>"Trigger AI Extraction"</strong> above or upload records.
      </div>
    `;
    return;
  }

  dom.extractionsCardsContainer.innerHTML = state.extractions.map(ext => {
    // 3-Tier Confidence Color Coding (SCREEN_SPECIFICATION.md requirement)
    let confColorClass = 'conf-green';
    let confLabel = 'Auto-suggest (&ge;90%)';
    let confScore = ext.confidence || 0;

    if (ext.isUnreadable) {
      confColorClass = 'conf-red';
      confLabel = 'Unreadable Scan (0%)';
    } else if (confScore >= 90) {
      confColorClass = 'conf-green';
      confLabel = `${confScore}% &bull; Auto-suggest`;
    } else if (confScore >= 70) {
      confColorClass = 'conf-gold';
      confLabel = `${confScore}% &bull; Review Required`;
    } else {
      confColorClass = 'conf-red';
      confLabel = `${confScore}% &bull; Flagged (&lt;70%)`;
    }

    // Status chip
    let statusChip = '<span class="status-chip status-chip-draft">Pending Gate</span>';
    if (ext.status === 'approved') statusChip = '<span class="status-chip status-chip-verified">Approved</span>';
    if (ext.status === 'edited') statusChip = '<span class="status-chip status-chip-verified">Edited &amp; Locked</span>';
    if (ext.status === 'manual') statusChip = '<span class="status-chip status-chip-verified">Manual Verified</span>';
    if (ext.status === 'needs_reupload') statusChip = '<span class="status-chip status-chip-review">Needs Re-upload</span>';

    // Values
    const displayVal = ext.approvedValue !== null && ext.approvedValue !== undefined
      ? `<strong style="font-size: 16px; color: var(--primary-deep);">${Number(ext.approvedValue).toLocaleString()}</strong> ${escapeHtml(ext.unit)}`
      : (ext.extractedValue !== null
          ? `<span style="font-size: 15px;">${Number(ext.extractedValue).toLocaleString()}</span> ${escapeHtml(ext.unit)}`
          : '<em style="color: #ef4444;">Unreadable Scan (E4)</em>');

    // Audit attribution display
    let auditNote = '';
    if (ext.status === 'edited') {
      auditNote = `<div style="font-size: 11px; color: #4338ca; margin-top: 4px;">Edited by <strong>${escapeHtml(ext.editorName)}</strong> at ${new Date(ext.editedTimestamp).toLocaleTimeString()} ("${escapeHtml(ext.editReason || '')}")</div>`;
    } else if (ext.status === 'approved' || ext.status === 'manual') {
      auditNote = `<div style="font-size: 11px; color: #166534; margin-top: 4px;">Approved by <strong>${escapeHtml(ext.approverName)}</strong> at ${new Date(ext.approvalTimestamp).toLocaleTimeString()}</div>`;
    } else if (ext.status === 'needs_reupload') {
      auditNote = `<div style="font-size: 11px; color: #991b1b; margin-top: 4px;">Returned: "${escapeHtml(ext.returnReason || '')}"</div>`;
    }

    const isLocked = ext.status === 'approved' || ext.status === 'edited' || ext.status === 'manual';

    return `
      <div class="extraction-card-item">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--primary-deep);">${escapeHtml(ext.fieldName)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(ext.documentName)} &bull; ${ext.sourceType}</div>
          </div>
          ${statusChip}
        </div>

        <div style="margin: 10px 0;">
          <div>${displayVal}</div>
        </div>

        <!-- 3-Tier Confidence Bar -->
        <div class="confidence-bar-wrap">
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="font-weight: 600;">Extraction Confidence:</span>
            <span style="font-weight: 700;">${confLabel}</span>
          </div>
          <div class="confidence-bar-track">
            <div class="confidence-bar-fill ${confColorClass}" style="width: ${Math.max(confScore, 5)}%;"></div>
          </div>
        </div>

        ${auditNote}

        <!-- Actions: Approve / Edit / Return (SCREEN_SPECIFICATION.md requirement) -->
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; border-top: 1px solid var(--surface-border-subtle); padding-top: 10px;">
          ${!ext.isUnreadable ? `
            <button class="btn btn-primary btn-sm" onclick="approveExtraction('${ext.id}')" ${isLocked ? 'disabled' : ''}>
              ${isLocked ? '✓ Approved' : 'Approve'}
            </button>
          ` : ''}
          <button class="btn btn-secondary btn-sm" onclick="openEditModal('${ext.id}')">
            Edit
          </button>
          <button class="btn btn-danger btn-sm" onclick="openReturnModal('${ext.id}')" ${ext.status === 'needs_reupload' ? 'disabled' : ''}>
            Return
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function handleFileInput(e) {
  if (e.target.files && e.target.files.length > 0) {
    uploadFilesList(e.target.files);
  }
}

async function uploadFilesList(files, forceDuplicate = false) {
  if (!state.currentFacilityId) {
    alert('Please select or create a facility first.');
    return;
  }

  // E3 validation: reject .zip/.exe
  const allowed = ['.pdf', '.csv', '.png', '.jpg', '.jpeg'];
  for (const file of files) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      showUploadAlert(`E3 Blocked: Unsupported file type '${ext}'. Allowed types: PDF, CSV, PNG, JPG. Nothing stored.`, 'danger');
      return;
    }
  }

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('evidenceFiles', files[i]);
  }
  formData.append('actor', state.currentRole);
  if (forceDuplicate) formData.append('forceDuplicate', 'true');

  try {
    showUploadAlert('Uploading evidence records to immutable vault...', 'info');

    const res = await fetch(`/api/facilities/${state.currentFacilityId}/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (res.status === 409 && data.duplicates) {
      // F6 Duplicate Upload
      openDuplicateModal(data.duplicates[0], files);
      showUploadAlert('F6 Warning: Probable duplicate detected (SHA-256 match). Please confirm keep or discard.', 'warning');
      return;
    }

    if (data.success) {
      showUploadAlert(`✓ ${data.message}`, 'success');
      await fetchFacilityDetails(state.currentFacilityId);
    } else {
      showUploadAlert(`Upload error: ${data.error || 'Failed to upload'}`, 'danger');
    }
  } catch (err) {
    // F1 Connection drop
    showUploadAlert('F1 Failure: Upload failed — connection dropped mid-transfer. Click to retry.', 'danger');
  }
}

function showUploadAlert(msg, type = 'info') {
  dom.uploadStatusAlert.innerHTML = `
    <div class="alert-banner alert-${type}">
      <span>${msg}</span>
    </div>
  `;
}

// Trigger AI Extraction
async function handleTriggerExtraction() {
  if (!state.currentFacilityId) return;

  // E2: Zero files check
  if (state.evidence.length === 0) {
    alert('E2 Blocked: Upload at least one evidence record before continuing.');
    return;
  }

  try {
    dom.btnTriggerAiBatch.disabled = true;
    dom.btnTriggerAiBatch.textContent = 'Extracting Fields (AI)...';

    const res = await fetch(`/api/facilities/${state.currentFacilityId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: state.currentRole })
    });

    const data = await res.json();

    if (res.status === 503 && data.isDegraded) {
      // F2 Degraded mode handled
      dom.degradedSystemBanner.style.display = 'flex';
      alert(`F2 AI Service Unavailable: ${data.bannerMessage}`);
      return;
    }

    if (data.success) {
      await fetchFacilityDetails(state.currentFacilityId);
    } else {
      alert(`Extraction notice: ${data.error}`);
    }
  } catch (err) {
    alert('Network error during AI extraction.');
  } finally {
    dom.btnTriggerAiBatch.disabled = false;
    dom.btnTriggerAiBatch.textContent = 'Trigger AI Extraction →';
  }
}

// Sample Seeders
async function seedSampleFixtures() {
  if (!state.currentFacilityId) return;
  const fixtureNames = [
    'gas_inflow_invoice_q3_2026.pdf',
    'routine_flaring_meter_log.csv',
    'diesel_ago_delivery_slip.pdf',
    'phed_electricity_bill_q3.pdf'
  ];

  const blobs = [];
  for (const name of fixtureNames) {
    let mime = 'application/pdf';
    let content = `%PDF-1.4 Simulated operational evidence file for ${name}`;
    if (name.endsWith('.csv')) {
      mime = 'text/csv';
      content = 'Date,Routine_Flaring_m3\n2026-07-01,124500';
    }
    blobs.push(new File([content], name, { type: mime }));
  }
  uploadFilesList(blobs);
}

async function seedUnreadableFixture() {
  if (!state.currentFacilityId) return;
  const file = new File(['%PDF-1.4 degraded scan'], 'unreadable_thermal_scanner_receipt.pdf', { type: 'application/pdf' });
  uploadFilesList([file]);
}

// F1 & F2 Simulation Toggles
async function handleSimulationToggle() {
  const simulateUploadDrop = dom.chkIntakeDrop.checked;
  const aiDegradedMode = dom.chkIntakeDegraded.checked;

  try {
    await fetch('/api/system/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulateUploadDrop, aiDegradedMode })
    });
    state.systemSettings.simulateUploadDrop = simulateUploadDrop;
    state.systemSettings.aiDegradedMode = aiDegradedMode;
    dom.degradedSystemBanner.style.display = aiDegradedMode ? 'flex' : 'none';
  } catch (err) {
    console.error('Error toggling simulations:', err);
  }
}

// F6 Duplicate Modal
let pendingDuplicateFiles = null;
function openDuplicateModal(dupInfo, files) {
  pendingDuplicateFiles = files;
  dom.duplicateDetailsBox.innerHTML = `
    <div><strong>File:</strong> ${escapeHtml(dupInfo.filename)}</div>
    <div><strong>Matches:</strong> ${escapeHtml(dupInfo.existingDocName)}</div>
    <div><strong>SHA-256:</strong> <code>${dupInfo.hash.substring(0, 24)}...</code></div>
  `;
  dom.modalDuplicateAlert.classList.add('active');

  dom.btnDuplicateKeep.onclick = () => {
    dom.modalDuplicateAlert.classList.remove('active');
    if (pendingDuplicateFiles) uploadFilesList(pendingDuplicateFiles, true);
  };
}

// Approve / Edit / Return (H4, AC 1, U1)
async function approveExtraction(recordId) {
  try {
    const res = await fetch(`/api/facilities/${state.currentFacilityId}/extractions/${recordId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approverName: state.currentRole })
    });
    const data = await res.json();
    if (data.success) await fetchFacilityDetails(state.currentFacilityId);
    else alert(data.error);
  } catch (err) {
    alert('Failed to approve extraction.');
  }
}
window.approveExtraction = approveExtraction;

function openEditModal(recordId) {
  const record = state.extractions.find(e => e.id === recordId);
  if (!record) return;

  dom.editRecordId.value = record.id;
  dom.editModalActorDisplay.textContent = state.currentRole;
  dom.editFieldName.value = record.fieldName;
  dom.editOrigVal.value = record.extractedValue !== null ? `${record.extractedValue} ${record.unit}` : 'None';
  dom.editNewVal.value = record.approvedValue || record.extractedValue || '';
  dom.editReason.value = '';
  dom.modalEditExtraction.classList.add('active');
}
window.openEditModal = openEditModal;

function closeEditModal() {
  dom.modalEditExtraction.classList.remove('active');
}

async function handleEditExtractionSubmit() {
  const recordId = dom.editRecordId.value;
  const editedValue = dom.editNewVal.value;
  const editReason = dom.editReason.value.trim();

  if (!editedValue || isNaN(Number(editedValue))) {
    alert('Please enter a valid numeric value.');
    return;
  }
  if (!editReason) {
    alert('Please provide a reason for editing this value (required for audit trail).');
    return;
  }

  try {
    const res = await fetch(`/api/facilities/${state.currentFacilityId}/extractions/${recordId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        editedValue,
        editReason,
        editorName: state.currentRole
      })
    });
    const data = await res.json();
    if (data.success) {
      closeEditModal();
      await fetchFacilityDetails(state.currentFacilityId);
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert('Error saving edited value.');
  }
}

function openReturnModal(recordId) {
  dom.returnRecordId.value = recordId;
  dom.modalReturnExtraction.classList.add('active');
}
window.openReturnModal = openReturnModal;

function closeReturnModal() {
  dom.modalReturnExtraction.classList.remove('active');
}

async function handleReturnExtractionSubmit() {
  const recordId = dom.returnRecordId.value;
  const returnReason = dom.returnReasonSelect.value;

  try {
    const res = await fetch(`/api/facilities/${state.currentFacilityId}/extractions/${recordId}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnReason, actor: state.currentRole })
    });
    const data = await res.json();
    if (data.success) {
      closeReturnModal();
      await fetchFacilityDetails(state.currentFacilityId);
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert('Error returning extraction.');
  }
}

// Manual Entry Fallback (E4, F2)
function openManualEntryModal() {
  dom.manualDocName.value = 'Operator Physical Gauge Slip';
  dom.manualFieldName.value = 'AGO Fuel Consumed';
  dom.manualValue.value = '';
  updateManualUnits();
  dom.modalManualEntry.classList.add('active');
}

function closeManualEntryModal() {
  dom.modalManualEntry.classList.remove('active');
}

function updateManualUnits() {
  const st = dom.manualSourceType.value;
  if (st === 'natural_gas_combustion' || st === 'flaring_venting') dom.manualUnit.value = 'm³';
  else if (st === 'diesel_ago_generation') dom.manualUnit.value = 'litres';
  else if (st === 'grid_electricity') dom.manualUnit.value = 'kWh';
}

async function handleManualEntrySubmit() {
  const documentName = dom.manualDocName.value.trim();
  const sourceType = dom.manualSourceType.value;
  const fieldName = dom.manualFieldName.value.trim();
  const value = dom.manualValue.value;
  const unit = dom.manualUnit.value.trim();

  if (!documentName || !fieldName || !value || !unit) {
    alert('All fields are required for manual entry.');
    return;
  }

  try {
    const res = await fetch(`/api/facilities/${state.currentFacilityId}/extractions/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentName,
        sourceType,
        fieldName,
        value,
        unit,
        actor: state.currentRole
      })
    });
    const data = await res.json();
    if (data.success) {
      closeManualEntryModal();
      await fetchFacilityDetails(state.currentFacilityId);
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert('Error saving manual entry.');
  }
}

// ==========================================
// SCREEN 3: EMISSIONS COMPILER (H5, E5, E6, F3)
// ==========================================

async function handleRunCalculation() {
  if (!state.currentFacilityId) return;

  const approved = state.extractions.filter(e => e.status === 'approved' || e.status === 'edited' || e.status === 'manual');
  if (approved.length === 0) {
    alert('Cannot calculate: No approved extractions exist. Please approve or edit extractions first.');
    return;
  }

  try {
    dom.btnRunCalculation.disabled = true;
    dom.btnRunCalculation.textContent = 'Calculating...';

    const res = await fetch(`/api/facilities/${state.currentFacilityId}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: state.currentRole })
    });
    const data = await res.json();
    if (data.success) {
      await fetchFacilityDetails(state.currentFacilityId);
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert('Error running deterministic calculation.');
  } finally {
    dom.btnRunCalculation.disabled = false;
    dom.btnRunCalculation.textContent = 'Run Calculation Engine';
  }
}

function renderCompilerView() {
  const calc = state.currentFacility ? state.currentFacility.lastCalculation : null;

  if (!calc || !calc.summary) {
    dom.heroTotalEmissions.innerHTML = `0.0000 <span style="font-size: 1.4rem; font-weight: 400;">tCO₂e</span>`;
    dom.heroScopeBreakdown.textContent = `Scope 1 Direct: 0.0000 tCO₂e | Scope 2 Grid: 0.0000 tCO₂e`;
    dom.calcVersionBadge.textContent = 'Version 0';
    dom.calculationSourcesTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 28px; color: var(--text-muted);">
          Calculations not executed yet. Click "Run Calculation Engine" above.
        </td>
      </tr>
    `;
    return;
  }

  const total = calc.summary.totalEmissionsTonnes;
  const s1 = calc.summary.totalScope1Tonnes;
  const s2 = calc.summary.totalScope2Tonnes;

  dom.heroTotalEmissions.innerHTML = `${total.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} <span style="font-size: 1.4rem; font-weight: 400;">tCO₂e</span>`;
  dom.heroScopeBreakdown.textContent = `Scope 1 Direct: ${s1.toFixed(4)} tCO₂e | Scope 2 Purchased Grid: ${s2.toFixed(4)} tCO₂e`;
  dom.calcVersionBadge.textContent = `Version ${calc.calculationVersion} (Deterministic)`;

  // Distribution Bar
  let gasTonnes = 0, flareTonnes = 0, dieselTonnes = 0, gridTonnes = 0;
  calc.sources.forEach(s => {
    if (s.status === 'calculated') {
      if (s.sourceType === 'natural_gas_combustion') gasTonnes += s.calculatedCO2eTonnes;
      else if (s.sourceType === 'flaring_venting') flareTonnes += s.calculatedCO2eTonnes;
      else if (s.sourceType === 'diesel_ago_generation') dieselTonnes += s.calculatedCO2eTonnes;
      else if (s.sourceType === 'grid_electricity') gridTonnes += s.calculatedCO2eTonnes;
    }
  });

  const pctGas = total > 0 ? ((gasTonnes / total) * 100).toFixed(1) : 0;
  const pctFlare = total > 0 ? ((flareTonnes / total) * 100).toFixed(1) : 0;
  const pctDiesel = total > 0 ? ((dieselTonnes / total) * 100).toFixed(1) : 0;
  const pctGrid = total > 0 ? ((gridTonnes / total) * 100).toFixed(1) : 0;

  dom.barGas.style.width = `${pctGas}%`;
  dom.barFlare.style.width = `${pctFlare}%`;
  dom.barDiesel.style.width = `${pctDiesel}%`;
  dom.barGrid.style.width = `${pctGrid}%`;

  dom.pctGas.textContent = `${pctGas}%`;
  dom.pctFlare.textContent = `${pctFlare}%`;
  dom.pctDiesel.textContent = `${pctDiesel}%`;
  dom.pctGrid.textContent = `${pctGrid}%`;

  // Fault Banners (E5 & E6)
  dom.compilerFaultBanners.innerHTML = '';
  const faultSources = calc.sources.filter(s => s.status !== 'calculated');
  if (faultSources.length > 0) {
    dom.compilerFaultBanners.innerHTML = faultSources.map(f => `
      <div class="alert-banner alert-warning" style="margin-bottom: 16px;">
        <div>
          <strong>${f.status === 'incomplete_field' ? 'E5 Warning (Incomplete Field):' : 'E6 Warning (Missing Factor):'}</strong>
          <div>${escapeHtml(f.error)}</div>
          <div style="font-size: 11px; margin-top: 4px; color: var(--text-muted);">
            Source: ${escapeHtml(f.sourceDocName)} &bull; Other sources calculate normally.
          </div>
        </div>
      </div>
    `).join('');
  }

  renderCompilerSourcesTable();
}

function renderCompilerSourcesTable() {
  const calc = state.currentFacility ? state.currentFacility.lastCalculation : null;
  if (!calc || !calc.sources) return;

  const filteredSources = calc.sources.filter(s => {
    if (state.activeScopeFilter === 'all') return true;
    return s.scope === state.activeScopeFilter;
  });

  if (filteredSources.length === 0) {
    dom.calculationSourcesTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">
          No activity records match the selected scope tab (${state.activeScopeFilter}).
        </td>
      </tr>
    `;
    return;
  }

  dom.calculationSourcesTbody.innerHTML = filteredSources.map(s => {
    if (s.status !== 'calculated') {
      return `
        <tr style="background: #fffbf0;">
          <td><strong>${escapeHtml(s.sourceDocName)}</strong></td>
          <td colspan="4" style="color: var(--warning-text); font-weight: 600;">${escapeHtml(s.error)}</td>
          <td><span class="status-chip status-chip-draft">Fault Flagged</span></td>
          <td>&mdash;</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--primary-deep);">${escapeHtml(s.sourceDocName)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">ID: ${s.sourceDocId}</div>
        </td>
        <td>
          <strong class="tabular-nums">${Number(s.activityQuantity).toLocaleString()}</strong> ${escapeHtml(s.activityUnit)}
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(s.activityFieldName)}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--primary-forest);">${escapeHtml(s.factorVersion)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(s.factorName)} (${s.factorValue} ${s.factorUnit})</div>
        </td>
        <td><span class="status-chip status-chip-verified">${escapeHtml(s.scope)}</span></td>
        <td>
          <code style="font-size: 11px; background: var(--canvas-bg); padding: 3px 6px; border-radius: 4px; display: inline-block;">
            ${escapeHtml(s.formula)}
          </code>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Ref: ${escapeHtml(s.factorCitation)}</div>
        </td>
        <td class="tabular-nums" style="font-size: 14px; font-weight: 700; color: var(--primary-deep);">
          ${s.calculatedCO2eTonnes.toFixed(4)} tCO₂e
        </td>
        <td style="font-size: 11.5px;">
          <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(s.approverName)}</div>
          <div style="font-size: 10px; color: var(--text-muted);">${new Date(s.approvalTimestamp).toLocaleTimeString()}</div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// SCREEN 5: AUDIT TRAIL (Dedicated Screen & Drawer)
// ==========================================

async function fetchAuditTrailDedicated() {
  if (!state.currentFacilityId) return;

  try {
    const res = await fetch(`/api/facilities/${state.currentFacilityId}/audit-trail`);
    const data = await res.json();
    if (data.success) {
      state.auditLogs = data.logs;
      dom.auditLogsCountText.textContent = `${data.count} total events recorded`;
      renderDedicatedAuditTable();
    }
  } catch (err) {
    console.error('Error fetching audit trail:', err);
  }
}

function renderDedicatedAuditTable() {
  const actionFilter = dom.auditFilterAction.value;
  const roleFilter = dom.auditFilterRole.value;

  const filtered = state.auditLogs.filter(log => {
    if (actionFilter && log.action !== actionFilter) return false;
    if (roleFilter && log.role !== roleFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    dom.auditTableScreenTbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 28px; color: var(--text-muted);">
          No audit records matching filters.
        </td>
      </tr>
    `;
    return;
  }

  // Reverse chronological
  const reversed = [...filtered].reverse();

  dom.auditTableScreenTbody.innerHTML = reversed.map(log => {
    return `
      <tr>
        <td style="white-space: nowrap; font-size: 12px;">${new Date(log.timestamp).toLocaleString()}</td>
        <td>
          <div style="font-weight: 600; color: var(--primary-deep);">${escapeHtml(log.actor)}</div>
          <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">${escapeHtml(log.role)}</div>
        </td>
        <td><span class="status-chip status-chip-draft">${escapeHtml(log.action)}</span></td>
        <td style="font-size: 12px; max-width: 320px; word-break: break-word;">
          ${escapeHtml(JSON.stringify(log.details))}
        </td>
        <td>
          <code style="font-size: 10px; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;" title="Previous: ${log.prevHash}">
            ${log.hash.substring(0, 18)}...
          </code>
        </td>
      </tr>
    `;
  }).join('');
}

function exportAuditCsv() {
  if (state.auditLogs.length === 0) {
    alert('No audit logs to export.');
    return;
  }

  const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Details', 'SHA-256 Hash', 'Previous Hash'];
  const rows = state.auditLogs.map(l => [
    l.timestamp,
    `"${l.actor}"`,
    l.role,
    l.action,
    `"${JSON.stringify(l.details).replace(/"/g, '""')}"`,
    l.hash,
    l.prevHash
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `ECO_ENGINE_AUDIT_LOG_${state.currentFacilityId}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Audit Drawer
async function openAuditDrawer() {
  if (!state.currentFacilityId) {
    alert('Please select a facility to view its audit trail.');
    return;
  }

  dom.auditDrawer.classList.add('active');
  dom.auditDrawerOverlay.classList.add('active');
  dom.auditTimelineContainer.innerHTML = '<div style="color: var(--text-muted);">Loading audit timeline...</div>';

  try {
    const res = await fetch(`/api/facilities/${state.currentFacilityId}/audit-trail`);
    const data = await res.json();
    if (data.success) renderAuditTimeline(data.logs);
  } catch (err) {
    dom.auditTimelineContainer.innerHTML = '<div style="color: var(--danger-text);">Error loading audit trail.</div>';
  }
}

function closeAuditDrawer() {
  dom.auditDrawer.classList.remove('active');
  dom.auditDrawerOverlay.classList.remove('active');
}

function renderAuditTimeline(logs) {
  if (!logs || logs.length === 0) {
    dom.auditTimelineContainer.innerHTML = '<div style="color: var(--text-muted);">No audit events recorded yet.</div>';
    return;
  }

  const reversed = [...logs].reverse();
  dom.auditTimelineContainer.innerHTML = reversed.map(item => `
    <div class="audit-timeline-item">
      <div class="audit-dot"></div>
      <div class="audit-time">${new Date(item.timestamp).toLocaleString()}</div>
      <div class="audit-action-title">${escapeHtml(item.action)}</div>
      <div class="audit-actor">Actor: <strong>${escapeHtml(item.actor)}</strong> (${item.role})</div>
      <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
        ${escapeHtml(JSON.stringify(item.details))}
      </div>
      <div class="audit-hash-block">
        <div><strong>SHA-256:</strong> ${item.hash}</div>
        <div style="color: #888;"><strong>Prev:</strong> ${item.prevHash.substring(0, 24)}...</div>
      </div>
    </div>
  `).join('');
}

// ==========================================
// SUBMISSION WORKFLOW (H6, E7)
// ==========================================

function renderSubmitView() {
  const fac = state.currentFacility;
  if (!fac) return;

  let chipClass = 'status-chip-draft';
  if (fac.status === 'In review') chipClass = 'status-chip-review';
  if (fac.status === 'Verified') chipClass = 'status-chip-verified';

  dom.submitCurrentStatusChip.textContent = fac.status === 'Open' ? 'Draft' : fac.status;
  dom.submitCurrentStatusChip.className = `status-chip ${chipClass}`;

  const unapproved = state.extractions.filter(e => e.status === 'pending_approval' || e.status === 'needs_reupload');
  const hasCalc = fac.lastCalculation && fac.lastCalculation.summary;

  if (fac.status === 'In review') {
    dom.submitValidationContainer.innerHTML = `
      <div class="alert-banner alert-success">
        <div>
          <strong>Facility Inventory Successfully Submitted for Verification (In Review)</strong>
          <div style="margin-top: 4px;">Status is locked in <strong>"In review"</strong>. Verifier review queue dispatched.</div>
          <div style="margin-top: 6px; font-size: 11.5px;">
            Submitted by: <strong>${escapeHtml(fac.reviewSubmission?.submittedBy || 'Operator')}</strong> at ${new Date(fac.reviewSubmission?.submittedAt || '').toLocaleString()}
          </div>
        </div>
      </div>
    `;
    dom.btnConfirmSubmitReview.disabled = true;
    dom.btnConfirmSubmitReview.textContent = '✓ Already In Review';
    return;
  }

  // E7 Check: Block if unapproved extractions exist
  if (unapproved.length > 0) {
    dom.submitValidationContainer.innerHTML = `
      <div class="alert-banner alert-danger">
        <div>
          <strong>E7 Blocked: ${unapproved.length} extraction(s) awaiting your approval</strong>
          <div style="margin-top: 4px;">
            All human gates must clear before submission. No figure reaches "In review" without recorded human approval.
          </div>
          <ul style="margin-top: 8px; margin-left: 20px; font-size: 12px;">
            ${unapproved.map(u => `<li><strong>${escapeHtml(u.documentName)}:</strong> ${escapeHtml(u.fieldName)} (${u.status})</li>`).join('')}
          </ul>
          <div style="margin-top: 10px;">
            <button class="btn btn-secondary btn-sm" onclick="switchView('view-intake')">
              &larr; Return to Approval Gate
            </button>
          </div>
        </div>
      </div>
    `;
    dom.btnConfirmSubmitReview.disabled = true;
  } else if (!hasCalc) {
    dom.submitValidationContainer.innerHTML = `
      <div class="alert-banner alert-warning">
        <div>
          <strong>Deterministic calculation required before submission.</strong>
          <div style="margin-top: 4px;">Run the emissions compiler to generate the verified activity ledger.</div>
          <div style="margin-top: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="switchView('view-compiler')">
              &larr; Open Emissions Compiler
            </button>
          </div>
        </div>
      </div>
    `;
    dom.btnConfirmSubmitReview.disabled = true;
  } else {
    dom.submitValidationContainer.innerHTML = `
      <div class="alert-banner alert-success">
        <div>
          <strong>✓ All Integrity Checks Cleared</strong>
          <ul style="margin-left: 20px; margin-top: 6px; font-size: 12.5px; line-height: 1.6;">
            <li>100% of activity extractions recorded with named human approval (${state.extractions.length} approved records).</li>
            <li>Zero unreadable or unverified scans remaining in docket.</li>
            <li>Deterministic calculation v${fac.calculationVersion} executed (${fac.lastCalculation.summary.totalEmissionsTonnes.toFixed(4)} tCO₂e).</li>
          </ul>
        </div>
      </div>
    `;
    dom.btnConfirmSubmitReview.disabled = false;
  }
}

async function handleSubmitReview() {
  if (!state.currentFacilityId) return;

  try {
    dom.btnConfirmSubmitReview.disabled = true;
    dom.btnConfirmSubmitReview.textContent = 'Submitting...';

    const res = await fetch(`/api/facilities/${state.currentFacilityId}/submit-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: state.currentRole })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Submission successful! Report status is now "In review". Cryptographic submission hash: ${data.submissionHash.substring(0, 16)}...`);
      await fetchFacilityDetails(state.currentFacilityId);
      renderSubmitView();
    } else {
      alert(`E7 Submission Blocked: ${data.primaryError || data.error}`);
    }
  } catch (err) {
    alert('Error submitting report for verification.');
  } finally {
    dom.btnConfirmSubmitReview.disabled = false;
    dom.btnConfirmSubmitReview.textContent = 'Confirm & Submit for Review →';
  }
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
