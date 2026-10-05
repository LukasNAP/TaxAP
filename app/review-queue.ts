import type { JurisdictionFinding } from './dashboard-findings.ts';
export const gapLabels = {
  missing_definition: 'Tax-body definition missing',
  missing_rate: 'A+ rate unavailable',
  unresolved_jurisdiction: 'Jurisdiction not identified',
  ambiguous_jurisdiction: 'Multiple possible jurisdictions',
  excluded_tax_body: 'Tax body needs setup review',
  cross_state: 'State or country needs review',
  unknown: 'Comparison incomplete',
};
export type AssignmentGap = { stateCode: string; taxBody: string | null; taxBodyDescription?: string; shipTos: number; reason: keyof typeof gapLabels };
export const gapGuidance = {
  missing_definition: { why: 'The assigned tax body has no available A+ definition, so TaxAP cannot compare its rate.', next: 'Confirm the assigned tax body and its definition in A+ before reviewing the official rate.' },
  missing_rate: { why: 'TaxAP could not read a configured A+ rate for this assignment.', next: 'Check the tax-body definition and intended rate in A+. Then refresh the comparison.' },
  unresolved_jurisdiction: { why: 'TaxAP could not identify one supported official jurisdiction for this assignment.', next: 'Confirm the intended state, county and city using the affected ship-tos and the official state source.' },
  ambiguous_jurisdiction: { why: 'The returned comparison could not confirm one consistent official jurisdiction. TaxAP has not chosen a rate.', next: 'Confirm the intended county/city using the A+ tax-body description, affected ship-tos and the official state source. A matching place name alone is not enough.' },
  excluded_tax_body: { why: 'The tax body is outside this comparison’s supported assignments. This does not establish whether it is correct or taxable.', next: 'Review the tax-body setup and the state’s exclusions below to confirm the intended treatment.' },
  cross_state: { why: 'The assigned tax body identifies a different state or country from this state’s comparison scope.', next: 'Check the destination and intended tax-body assignment. Do not change it based on the code prefix alone.' },
  unknown: { why: 'The returned aggregate confirms a comparison gap but does not identify its cause.', next: 'Review the state evidence below. If the cause remains unclear, ask the tax team to investigate.' },
};
export function assignmentTitle(gap: AssignmentGap) {
  return gap.taxBodyDescription?.trim() || (gap.taxBody ? `Tax body ${gap.taxBody}` : 'State assignments without a tax-body breakdown');
}
export type QueueFilters = { state: string; minimum: number; evidence: 'all' | 'current' | 'stale'; kind: 'all' | 'rates' | 'assignments'; reason: string };
export const initialQueueFilters: QueueFilters = { state: 'all', minimum: 0, evidence: 'all', kind: 'all', reason: 'all' };
export function matchesQueueFinding(finding: JurisdictionFinding, filters: QueueFilters) {
  return filters.kind !== 'assignments' && filters.reason === 'all' && (filters.state === 'all' || finding.stateCode === filters.state) && finding.activeShipTos >= filters.minimum && (filters.evidence === 'all' || (filters.evidence === 'stale') === (finding.evidenceStatus === 'stale'));
}
export function matchesQueueGap(gap: AssignmentGap, filters: QueueFilters) {
  return filters.kind !== 'rates' && filters.evidence !== 'stale' && (filters.reason === 'all' || gap.reason === filters.reason) && (filters.state === 'all' || gap.stateCode === filters.state) && gap.shipTos >= filters.minimum;
}
