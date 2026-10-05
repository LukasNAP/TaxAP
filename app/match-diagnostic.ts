import type { AlabamaMatchDiagnostic } from './al-match-diagnostic.ts';

export const matchDiagnosticCopy = {
  missing_definition: ['The assigned tax-body definition is missing.', 'Confirm its definition in A+ before reviewing an official rate.'],
  missing_aplus_rate: ['The configured A+ rate is missing or invalid.', 'Check the assigned tax body and its configured rate.'],
  retired: ['This assignment is marked as retired under the existing tax-body policy.', 'Confirm whether an active ship-to should still use this tax body.'],
  unsupported_assignment: ['This tax body does not satisfy the adapter’s supported assignment rules.', 'Check the code format and intended tax scope in the state exclusions below.'],
  missing_description: ['The description does not supply the place text required by this lookup.', 'Confirm the intended locality and tax-body description.'],
  no_candidate: ['The supported lookup returned no eligible official jurisdiction.', 'Check the exact code, place name and jurisdiction type. Do not substitute a similarly named place.'],
  multiple_candidates: ['More than one official row satisfies the lookup. The evidence does not identify one unique jurisdiction, even if the rates agree.', 'Confirm the destination’s county, city limits and applicable tax scope before selecting a jurisdiction.'],
  conflicting_rates: ['The official rows considered have different rates. The assignment does not identify one applicable rate scope.', 'Check which jurisdiction or county slice applies using the affected ship-tos and official evidence. A matching rate alone does not establish identity.'],
  inconsistent_identity: ['At least one official record has inconsistent place identity labels.', 'Verify the conflicting official identity with the tax team. TaxAP has not repaired or guessed the identity.'],
  official_rate_unavailable: ['The supported lookup cannot supply a current, comparable official total.', 'Check the effective dates and the source’s rate scope. Unavailable rates are never treated as zero.'],
  name_mismatch: ['The official code exists, but its jurisdiction name does not pass the adapter’s description check.', 'Compare the A+ description with the official record and confirm the intended jurisdiction.'],
  county_hint_not_found: ['The supplied county hint cannot select an eligible county row.', 'Check the full county name and applicable county scope.'],
  jurisdiction_type_not_found: ['The place exists, but no eligible row has the jurisdiction type requested by the description.', 'Confirm whether the assignment represents a city or a county.'],
  scope_not_supported: ['The assignment or official record is outside this adapter’s supported rate scope.', 'Check special districts, category-specific taxes and sales/use differences in the state evidence.'],
  future_rate: ['The identified official rate is not yet effective for this comparison.', 'Check its effective date; do not apply a future rate to the current comparison.'],
  address_required: ['The jurisdiction or rate depends on location details that this assignment-level lookup cannot resolve.', 'Use the affected ship-to list and official address or boundary evidence to verify the location.'],
  cross_state: ['The tax body describes a different state or country from this comparison.', 'Confirm the intended state and assignment using the affected ship-tos.'],
  expected_code: ['This assignment is outside the state’s supported statewide tax-body code.', 'Check the expected tax body and excluded assignments below.'],
  policy_not_met: ['This assignment does not meet the approved deliberate no-tax policy.', 'Confirm the approved code, configured zero rate and active definition. This policy is not an official zero-percent rate.'],
  aggregate_unresolved: ['The batch reports unresolved assignments without a complete tax-body matching breakdown.', 'Review the state evidence and its aggregate reasons below. Individual official candidates were not retained for this group.'],
  diagnostic_unavailable: ['The returned batch identifies an unresolved assignment but does not include its specific matching rejection evidence.', 'Refresh the main queue for newer diagnostics. Review the state evidence if the explanation remains unavailable.'],
} as const;

export type SharedMatchDiagnostic = {
  version: 1; stateCode: string; reason: keyof typeof matchDiagnosticCopy;
  inputs: { taxBody?: string; description?: string; lookup?: string; countyHint?: string; jurisdictionType?: string };
  source: { sourceUrl?: string; machineReadableSourceUrl?: string; retrievedAt?: string; asOfDate?: string; effectivePeriod?: string; sourceHash?: string };
  reasonCounts?: { reason: string; count: number }[];
  candidates: { name?: string; jurisdictionCode?: string; locationCode?: string; jurisdictionType?: string; county?: string; parish?: string; totalGeneralRate?: number; componentRate?: number; beginDate?: string; endDate?: string; ambiguousArea?: boolean; multiCounty?: boolean; specialDistrict?: boolean }[];
};
export type MatchDiagnostic = AlabamaMatchDiagnostic | SharedMatchDiagnostic;
export function evidenceSourceLink(value?: string) {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
