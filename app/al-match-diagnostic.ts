export type AlabamaCandidate = {
  name: string; jurisdictionCode?: string; localityCode?: string; jurisdictionType?: string;
  countyCode?: string | null; countyNumber?: number; componentRate?: number; beginDate?: string;
  countyReferences: { name: string; localityCode?: string; componentRate?: number }[];
};
export const alDiagnosticReasons = {
  multiple_locality_rows: { why: 'Multiple general-sales rows share this locality code. They can represent different county-tax references or tax scopes. The current matcher stops here; it has not selected a row or combined rate.', next: 'Confirm the destination’s county and city limits, then check which county-tax reference applies in the official source. Do not choose a row just because its city name or rate matches A+.' },
  locality_code_not_found: { why: 'No supported general-sales locality row has the numeric code taken from this A+ tax body.', next: 'Confirm the intended locality and its official code with the tax team. Do not substitute a similarly named place.' },
  unsupported_code: { why: 'The tax-body code does not have the supported AL-plus-numeric-code format.', next: 'Check the tax-body definition and the intended comparison scope in A+.' },
  name_mismatch: { why: 'The official row with this locality code does not pass the existing A+ description name check. A reused code alone is insufficient evidence.', next: 'Compare the A+ description with the rejected official row below. Confirm whether the assignment describes a city within a county instead of the county itself.' },
  empty_county_hint: { why: 'The A+ description contains an empty parenthetical county hint, so no county can be selected.', next: 'Confirm the intended county from the affected ship-tos and official evidence.' },
  county_hint_not_found: { why: 'The county hint in the A+ description does not identify an available, unambiguous county component in the official data.', next: 'Check the hint’s spelling and completeness and confirm the applicable county-tax scope in the official source.' },
  county_hint_ambiguous: { why: 'The county hint matches more than one available county name. TaxAP has not selected one.', next: 'Confirm the full county name and applicable tax scope. The prefix alone is insufficient.' },
  official_rate_unavailable: { why: 'A locality row was found, but its official combined rate is unavailable to this comparison.', next: 'Review the official component evidence and intended county scope before determining a combined rate.' },
  missing_definition: { why: 'The A+ definition for this assigned tax body is unavailable.', next: 'Confirm the tax-body definition in A+ before investigating an official rate.' },
  equipment_scope: { why: 'This equipment-rate tax body is excluded from the current general-sales comparison.', next: 'Confirm that the equipment assignment is intentional. Do not replace it with a general-sales rate based on this check.' },
  police_jurisdiction_scope: { why: 'The A+ description identifies a police-jurisdiction assignment, which is outside the current general-sales comparison scope.', next: 'Confirm whether the destination is within city limits or a police jurisdiction and review the appropriate official scope.' },
  excluded_code: { why: 'This tax body is excluded by Alabama’s existing supported-code policy.', next: 'Review the intended tax-body setup with the tax team; exclusion does not establish that the assignment is wrong.' },
};
export type AlabamaMatchDiagnostic = {
  componentEvidence?: import('./component-evidence-view').ComponentEvidence[];
  stateCode: 'AL'; reason: keyof typeof alDiagnosticReasons; candidateBasis: 'locality-code'|'county-hint'|'scope';
  localityCode: string|null; expectedName: string; nameCheckToken: string; countyHint: string|null;
  source: { sourceUrl?: string; machineReadableSourceUrl?: string; retrievedAt?: string; asOfDate?: string; sourceHash?: string };
  candidates: AlabamaCandidate[];
};
export function alDiagnosticCopy(diagnostic: AlabamaMatchDiagnostic) {
  return alDiagnosticReasons[diagnostic.reason];
}
export function alSourceLink(value: string|undefined) {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' && url.hostname === 'www.revenue.alabama.gov' ? url.href : null; }
  catch { return null; }
}
