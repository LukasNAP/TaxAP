import { isRetiredTaxBody, STATE_NAME_BY_CODE } from '../app/tax-body-policy.ts';
import { aggregateAlMatchDiagnostic } from './al-match-diagnostic.mjs';

const reasons = new Set(['missing_definition', 'missing_aplus_rate', 'retired', 'unsupported_assignment', 'missing_description', 'no_candidate', 'multiple_candidates', 'conflicting_rates', 'inconsistent_identity', 'official_rate_unavailable', 'name_mismatch', 'county_hint_not_found', 'jurisdiction_type_not_found', 'scope_not_supported', 'future_rate', 'address_required', 'cross_state', 'expected_code', 'policy_not_met', 'aggregate_unresolved', 'diagnostic_unavailable']);
const boundaryReasons = new Set(['missing ZIP code', 'conflicting address-level boundary rows', 'conflicting ZIP+4 boundary rows', 'conflicting ZIP-5 boundary rows', 'boundary rows exist for this ZIP but none are active as of the comparison date', 'ZIP+4 sub-ranges for this ZIP disagree on jurisdiction', 'no boundary row in the archive covers this ZIP code']);
const pick = (value, keys) => Object.fromEntries(keys.filter(key => ['string', 'number', 'boolean'].includes(typeof value?.[key]) && (typeof value[key] !== 'number' || Number.isFinite(value[key]))).map(key => [key, value[key]]));

// Aggregate-only evidence: never copy arbitrary adapter rows, addresses, or geometry.
export function aggregateMatchDiagnostic(value) {
  if (value?.stateCode === 'AL' && !value.version) return aggregateAlMatchDiagnostic(value);
  if (value?.version !== 1 || !STATE_NAME_BY_CODE.has(value.stateCode) || !reasons.has(value.reason)) return null;
  return {
    version: 1, stateCode: value.stateCode, reason: value.reason,
    inputs: pick(value.inputs, ['taxBody', 'description', 'lookup', 'countyHint', 'jurisdictionType']),
    source: pick(value.source, ['sourceUrl', 'machineReadableSourceUrl', 'retrievedAt', 'asOfDate', 'effectivePeriod', 'sourceHash']),
    ...(Array.isArray(value.reasonCounts) ? { reasonCounts: value.reasonCounts.filter(row => boundaryReasons.has(row.reason) && Number.isInteger(row.count) && row.count > 0).map(row => ({ reason: row.reason, count: row.count })) } : {}),
    candidates: (Array.isArray(value.candidates) ? value.candidates : []).map(row => pick(row, ['name', 'jurisdictionCode', 'locationCode', 'jurisdictionType', 'county', 'countyNumber', 'parish', 'totalGeneralRate', 'componentRate', 'beginDate', 'endDate', 'ambiguousArea', 'multiCounty', 'specialDistrict'])),
  };
}

export function assignmentGuardReason(row) {
  if (row.definitionStatus === 'missing') return 'missing_definition';
  if (row.currentRate == null || !Number.isFinite(Number(row.currentRate))) return 'missing_aplus_rate';
  if (isRetiredTaxBody(row)) return 'retired';
  if (!row.description) return 'missing_description';
  return 'unsupported_assignment';
}

export function createMatchDiagnostics(stateCode, source) {
  const entries = new Map();
  function record(row, reason, candidates = [], inputs = {}) {
    entries.set(row.taxBody, aggregateMatchDiagnostic({ version: 1, stateCode, reason,
      inputs: { taxBody: row.taxBody, description: row.description, ...inputs }, source, candidates }));
    return null;
  }
  return { record, get: row => entries.get(row.taxBody) };
}

export function defaultMatchDiagnostic(stateCode, row, reason, source = {}) {
  return aggregateMatchDiagnostic({ version: 1, stateCode, reason, inputs: { taxBody: row.taxBody, description: row.description }, source, candidates: [] });
}
