/**
 * Versioned Emission Factors Library for ECO-ENGINE
 * 
 * Complies with NUPRC measurement-based reporting directives (IPCC Tier 2 defaults, rev 2024.Q4 / 2026).
 * All factors are deterministic, versioned, and include effective date ranges and official citations.
 */

const EMISSION_FACTORS = [
  {
    id: 'EF-NATGAS-T2-2024Q4',
    sourceType: 'natural_gas_combustion',
    name: 'Natural Gas Combustion (Stationary)',
    scope: 'Scope 1',
    category: 'Stationary Combustion',
    factorValue: 2.162, // kg CO2e per m3
    unit: 'kg CO2e / m³',
    activityUnit: 'm³',
    factorVersion: 'IPCC-2024.Q4-NG-T2',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2026-12-31',
    citation: 'IPCC Guidelines for National GHG Inventories (2019 Refinement), Vol 2 Energy, Ch 2 Table 2.2 / NUPRC Guidelines 2024',
    regulatoryAuthority: 'NUPRC / IPCC Tier 2',
    defaultUncertaintyPercent: 5.0
  },
  {
    id: 'EF-FLARE-T2-2024Q4',
    sourceType: 'flaring_venting',
    name: 'Process & Routine Gas Flaring',
    scope: 'Scope 1',
    category: 'Flaring & Fugitive',
    factorValue: 2.784, // kg CO2e per m3
    unit: 'kg CO2e / m³',
    activityUnit: 'm³',
    factorVersion: 'NUPRC-2024.Q4-FLARE-T2',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2026-12-31',
    citation: 'NUPRC Flare Gas (Prevention of Waste and Pollution) Regulations 2023 / IPCC Tier 2 Combustion Efficiency 98%',
    regulatoryAuthority: 'NUPRC (Gas Flaring Penalty Framework)',
    defaultUncertaintyPercent: 7.5
  },
  {
    id: 'EF-DIESEL-T2-2024Q4',
    sourceType: 'diesel_ago_generation',
    name: 'Diesel (AGO) Power Generation & Gensets',
    scope: 'Scope 1',
    category: 'Stationary / Mobile Gensets',
    factorValue: 2.680, // kg CO2e per litre
    unit: 'kg CO2e / L',
    activityUnit: 'litres',
    factorVersion: 'IPCC-2024.Q4-AGO-T2',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2026-12-31',
    citation: 'IPCC Guidelines Vol 2 Energy, Ch 3 Mobile & Stationary Combustion (Commercial Automotive Gas Oil)',
    regulatoryAuthority: 'IPCC / NMDPRA Standards',
    defaultUncertaintyPercent: 4.0
  },
  {
    id: 'EF-GRID-DISCO-2024Q4',
    sourceType: 'grid_electricity',
    name: 'National DisCo Grid Electricity Draw',
    scope: 'Scope 2',
    category: 'Purchased Electricity (Location-Based)',
    factorValue: 0.438, // kg CO2e per kWh
    unit: 'kg CO2e / kWh',
    activityUnit: 'kWh',
    factorVersion: 'NG-GRID-2024.Q4-REV3',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2026-12-31',
    citation: 'Nigerian Electricity Regulatory Commission (NERC) & National Grid Baseline Emission Factor Rev 2024.Q4',
    regulatoryAuthority: 'NERC / NUPRC',
    defaultUncertaintyPercent: 6.0
  }
];

/**
 * Find factor by source type and optional version
 */
function getFactorBySourceType(sourceType, version = null) {
  if (version) {
    return EMISSION_FACTORS.find(f => f.sourceType === sourceType && f.factorVersion === version) || null;
  }
  return EMISSION_FACTORS.find(f => f.sourceType === sourceType) || null;
}

/**
 * Find factor by factor ID
 */
function getFactorById(id) {
  return EMISSION_FACTORS.find(f => f.id === id) || null;
}

/**
 * Return all registered versioned factors
 */
function getAllFactors() {
  return [...EMISSION_FACTORS];
}

module.exports = {
  EMISSION_FACTORS,
  getFactorBySourceType,
  getFactorById,
  getAllFactors
};
