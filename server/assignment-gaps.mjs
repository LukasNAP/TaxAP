// Presentation of returned aggregates only: no rate calculation or jurisdiction inference.
import { aggregateMatchDiagnostic, defaultMatchDiagnostic } from './match-diagnostic.mjs';
function diagnosticReasonFor(result, row, reason) {
  if (reason === 'cross_state') return 'cross_state';
  if (reason === 'missing_definition') return 'missing_definition';
  if (reason === 'missing_rate') return Number.isFinite(row.aplusRate) ? 'official_rate_unavailable' : 'missing_aplus_rate';
  if (!row.taxBody) return 'aggregate_unresolved';
  if (reason === 'excluded_tax_body') return result.expectedTaxBody ? 'expected_code' : 'unsupported_assignment';
  return 'diagnostic_unavailable';
}
export function assignmentGaps(result, health) {
  if (!Number.isFinite(health.uncheckedShipTos) || health.uncheckedShipTos <= 0) return [];
  const gaps = [];
  function add(row, reason) {
    const count = row.activeShipTos;
    if (!Number.isInteger(count) || count <= 0) return;
    const description = row.description ?? result.stateDetail?.taxBodies?.find(body => body.taxBody === row.taxBody)?.description;
    const diagnosticReason = diagnosticReasonFor(result, row, reason);
    const suppliedDiagnostic = aggregateMatchDiagnostic(row.matchDiagnostic);
    const baseDiagnostic = (reason !== 'cross_state' && suppliedDiagnostic?.stateCode === result.stateCode ? suppliedDiagnostic : null) ?? defaultMatchDiagnostic(result.stateCode, { ...row, description }, diagnosticReason, result.officialSnapshot);
    const matchDiagnostic = result.stateCode === 'GA' && !row.taxBody ? aggregateMatchDiagnostic({ ...baseDiagnostic, reasonCounts: reason === 'ambiguous_jurisdiction' ? result.ambiguousReasons : result.unmatchedReasons }) : baseDiagnostic;
    gaps.push({ stateCode: result.stateCode, taxBody: row.taxBody ?? null, shipTos: count, reason,
      ...(typeof description === 'string' && description.trim() ? { taxBodyDescription: description.trim() } : {}),
      ...(matchDiagnostic ? { matchDiagnostic } : {}) });
  }
  const excluded = new Set();
  for (const row of result.crossStateAssignments ?? []) { add(row, 'cross_state'); excluded.add(row.taxBody); }
  for (const row of [...(result.misinputAssignments ?? []), ...(result.unclassifiedAssignments ?? [])]) {
    if (excluded.has(row.taxBody)) continue;
    add(row, row.definitionStatus === 'missing' ? 'missing_definition' : 'excluded_tax_body'); excluded.add(row.taxBody);
  }
  for (const row of result.findings ?? []) {
    if (excluded.has(row.taxBody) || (row.matched && Number.isFinite(row.aplusRate) && Number.isFinite(row.officialRate))) continue;
    add(row, row.definitionStatus === 'missing' ? 'missing_definition' : row.identityStatus === 'ambiguous' || row.jurisdictionAssignmentConsistent === false ? 'ambiguous_jurisdiction' : !row.matched ? 'unresolved_jurisdiction' : 'missing_rate');
  }
  const unresolved = result.totals?.unmatched;
  const ambiguous = result.totals?.ambiguous;
  if (Number.isInteger(unresolved) && unresolved > 0) add({ activeShipTos: unresolved }, 'unresolved_jurisdiction');
  if (Number.isInteger(ambiguous) && ambiguous > 0) add({ activeShipTos: ambiguous }, 'ambiguous_jurisdiction');
  const described = gaps.reduce((sum, gap) => sum + gap.shipTos, 0);
  // Conflicting/overlapping aggregates must not inflate or silently invent a reason.
  if (described > health.uncheckedShipTos) return [{ stateCode: result.stateCode, taxBody: null, shipTos: health.uncheckedShipTos, reason: 'unknown', matchDiagnostic: defaultMatchDiagnostic(result.stateCode, {}, 'aggregate_unresolved', result.officialSnapshot) }];
  if (described < health.uncheckedShipTos) gaps.push({ stateCode: result.stateCode, taxBody: result.expectedTaxBody ?? null, shipTos: health.uncheckedShipTos - described, matchDiagnostic: defaultMatchDiagnostic(result.stateCode, { taxBody: result.expectedTaxBody }, result.expectedTaxBody && !Number.isFinite(result.aplusRate) ? 'missing_aplus_rate' : 'aggregate_unresolved', result.officialSnapshot), reason: Number.isFinite(result.officialRate) && !Number.isFinite(result.aplusRate) && result.expectedTaxBody ? 'missing_rate' : 'unknown' });
  return gaps;
}
