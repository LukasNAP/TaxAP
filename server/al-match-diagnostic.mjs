// Aggregate evidence only. Never copy arbitrary official/A+ row properties.
import { aggregateComponentEvidence } from './component-evidence.mjs';
const reasons = new Set(['multiple_locality_rows', 'locality_code_not_found', 'unsupported_code', 'name_mismatch', 'empty_county_hint', 'county_hint_not_found', 'county_hint_ambiguous', 'official_rate_unavailable', 'missing_definition', 'equipment_scope', 'police_jurisdiction_scope', 'excluded_code']);
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
export function aggregateAlMatchDiagnostic(value) {
  if (!value || value.stateCode !== 'AL' || !reasons.has(value.reason)) return null;
  return {
    ...pick(value, ['stateCode', 'reason', 'candidateBasis', 'localityCode', 'expectedName', 'nameCheckToken', 'countyHint']),
    source: pick(value.source, ['sourceUrl', 'machineReadableSourceUrl', 'retrievedAt', 'asOfDate', 'sourceHash']),
    ...(aggregateComponentEvidence(value.componentEvidence).length ? { componentEvidence: aggregateComponentEvidence(value.componentEvidence) } : {}),
    candidates: (value.candidates ?? []).map(row => ({
      ...pick(row, ['name', 'jurisdictionCode', 'localityCode', 'jurisdictionType', 'countyCode', 'countyNumber', 'componentRate', 'beginDate']),
      countyReferences: (row.countyReferences ?? []).map(county => pick(county, ['name', 'localityCode', 'componentRate'])),
    })),
  };
}
