import type { JurisdictionFinding } from './dashboard-findings.ts';
export const gapLabels = {
  missing_definition: 'Missing A+ tax-body definition',
  missing_rate: 'Configured rate unavailable',
  unresolved_jurisdiction: 'No unique supported official jurisdiction match',
  ambiguous_jurisdiction: 'Multiple or inconsistent official jurisdiction candidates',
  excluded_tax_body: 'Excluded or unsupported tax body',
  cross_state: 'Tax body identifies a different state or country',
  unknown: 'Reason unavailable from the returned comparison',
};
export type AssignmentGap = { stateCode: string; taxBody: string | null; shipTos: number; reason: keyof typeof gapLabels };
export type QueueFilters = { state: string; minimum: number; evidence: 'all' | 'current' | 'stale'; kind: 'all' | 'rates' | 'assignments'; reason: string };
export const initialQueueFilters: QueueFilters = { state: 'all', minimum: 0, evidence: 'all', kind: 'all', reason: 'all' };
export function matchesQueueFinding(finding: JurisdictionFinding, filters: QueueFilters) {
  return filters.kind !== 'assignments' && filters.reason === 'all' && (filters.state === 'all' || finding.stateCode === filters.state) && finding.activeShipTos >= filters.minimum && (filters.evidence === 'all' || (filters.evidence === 'stale') === (finding.evidenceStatus === 'stale'));
}
export function matchesQueueGap(gap: AssignmentGap, filters: QueueFilters) {
  return filters.kind !== 'rates' && filters.evidence !== 'stale' && (filters.reason === 'all' || gap.reason === filters.reason) && (filters.state === 'all' || gap.stateCode === filters.state) && gap.shipTos >= filters.minimum;
}
