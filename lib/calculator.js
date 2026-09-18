/**
 * Deterministic Calculation Engine for ECO-ENGINE
 * 
 * Rules:
 * 1. ZERO AI-generated numbers. Pure deterministic multiplication: Activity Data × Versioned Factor.
 * 2. 100% reproducible: identical inputs & factors always yield bit-for-bit identical results.
 * 3. Every single output maintains full traceability to source document ID, factor version, and mathematical formula.
 * 4. Missing factor: explicit error/stop for that source (E6) — never silently guesses.
 * 5. Missing required field: explicit incomplete status for that source (E5) — other sources still calculate.
 */

const { getFactorBySourceType, getFactorById } = require('./emission_factors');

/**
 * Execute deterministic calculation for a set of approved activity records
 * 
 * @param {Array} approvedRecords - Array of human-approved extraction records
 * @param {Object} factorOverrides - Optional map of recordId -> factorId
 * @param {number} calculationVersion - Version number of the calculation run (increments on re-run / correction)
 * @returns {Object} Calculation result with source breakdown, totals, and audit metadata
 */
function runDeterministicCalculation(approvedRecords, factorOverrides = {}, calculationVersion = 1) {
  const sourceBreakdowns = [];
  const errors = [];
  const warnings = [];

  let totalScope1Tonnes = 0;
  let totalScope2Tonnes = 0;

  for (const record of approvedRecords) {
    const recordId = record.id;
    const sourceType = record.sourceType || record.recordType;
    const sourceDocName = record.documentName || 'Unknown Evidence';
    const sourceDocId = record.documentId || record.id;

    // Check E5: Required activity field empty
    const quantity = record.approvedValue !== undefined && record.approvedValue !== null && record.approvedValue !== ''
      ? Number(record.approvedValue)
      : null;

    if (quantity === null || isNaN(quantity) || quantity < 0) {
      sourceBreakdowns.push({
        recordId,
        sourceType,
        sourceDocName,
        sourceDocId,
        status: 'incomplete_field',
        error: `Incomplete — 1 required field missing (${record.fieldName || 'activity quantity'})`,
        activityQuantity: null,
        activityUnit: record.unit || 'unknown',
        calculatedCO2eTonnes: 0,
        scope: 'Unknown',
        factorVersion: 'None'
      });
      warnings.push({
        recordId,
        message: `Calculation skipped for ${sourceDocName}: Required activity field missing.`
      });
      continue;
    }

    // Check E6: Emission factor mapped
    let factor = null;
    if (factorOverrides[recordId]) {
      factor = getFactorById(factorOverrides[recordId]);
    }
    if (!factor && record.factorId) {
      factor = getFactorById(record.factorId);
    }
    if (!factor && sourceType) {
      factor = getFactorBySourceType(sourceType, record.factorVersion);
    }

    if (!factor) {
      sourceBreakdowns.push({
        recordId,
        sourceType,
        sourceDocName,
        sourceDocId,
        status: 'missing_factor',
        error: `No factor mapped for source type '${sourceType}'. Operator selection required from versioned library.`,
        activityQuantity: quantity,
        activityUnit: record.unit || 'unknown',
        calculatedCO2eTonnes: 0,
        scope: 'Unknown',
        factorVersion: 'Unmapped'
      });
      warnings.push({
        recordId,
        message: `Calculation stopped for ${sourceDocName}: No emission factor mapped.`
      });
      continue;
    }

    // Deterministic rules-based calculation:
    // emissions_kg = quantity * factorValue
    // emissions_tCO2e = emissions_kg / 1000
    const emissionsKg = quantity * factor.factorValue;
    const emissionsTonnes = emissionsKg / 1000;

    // Rounding to 4 decimal places for precision reproducibility
    const roundedTonnes = Math.round(emissionsTonnes * 10000) / 10000;

    if (factor.scope === 'Scope 1') {
      totalScope1Tonnes += roundedTonnes;
    } else if (factor.scope === 'Scope 2') {
      totalScope2Tonnes += roundedTonnes;
    }

    sourceBreakdowns.push({
      recordId,
      sourceType,
      sourceDocName,
      sourceDocId,
      status: 'calculated',
      activityFieldName: record.fieldName || 'Activity Data',
      activityQuantity: quantity,
      activityUnit: factor.activityUnit,
      factorId: factor.id,
      factorName: factor.name,
      factorVersion: factor.factorVersion,
      factorValue: factor.factorValue,
      factorUnit: factor.unit,
      factorCitation: factor.citation,
      regulatoryAuthority: factor.regulatoryAuthority,
      scope: factor.scope,
      category: factor.category,
      calculatedCO2eKg: Math.round(emissionsKg * 100) / 100,
      calculatedCO2eTonnes: roundedTonnes,
      formula: `${quantity.toLocaleString()} ${factor.activityUnit} × ${factor.factorValue} ${factor.unit} ÷ 1,000 = ${roundedTonnes.toFixed(4)} tCO₂e`,
      approverName: record.approverName || 'Operator (HSE Lead)',
      approvalTimestamp: record.approvalTimestamp || new Date().toISOString()
    });
  }

  const totalEmissionsTonnes = Math.round((totalScope1Tonnes + totalScope2Tonnes) * 10000) / 10000;

  return {
    calculationVersion,
    timestamp: new Date().toISOString(),
    isDeterministic: true,
    engine: 'ECO-ENGINE Rules-Based v1.0.0 (Zero AI Numbers)',
    methodology: 'IPCC Tier 2 Defaults / NUPRC 2024.Q4 Guidelines',
    summary: {
      totalScope1Tonnes: Math.round(totalScope1Tonnes * 10000) / 10000,
      totalScope2Tonnes: Math.round(totalScope2Tonnes * 10000) / 10000,
      totalEmissionsTonnes,
      activeSourcesCount: sourceBreakdowns.filter(s => s.status === 'calculated').length,
      incompleteSourcesCount: sourceBreakdowns.filter(s => s.status !== 'calculated').length
    },
    sources: sourceBreakdowns,
    warnings,
    errors
  };
}

module.exports = {
  runDeterministicCalculation
};
