// Presentation of returned aggregates only: no rate calculation or jurisdiction inference.
export function assignmentGaps(result, health) {
  if (!Number.isFinite(health.uncheckedShipTos) || health.uncheckedShipTos <= 0) return [];
  const gaps = [];
  function add(row, reason) {
    const count = row.activeShipTos;
    if (!Number.isInteger(count) || count <= 0) return;
    gaps.push({ stateCode: result.stateCode, taxBody: row.taxBody ?? null, shipTos: count, reason });
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
  if (described > health.uncheckedShipTos) return [{ stateCode: result.stateCode, taxBody: null, shipTos: health.uncheckedShipTos, reason: 'unknown' }];
  if (described < health.uncheckedShipTos) gaps.push({ stateCode: result.stateCode, taxBody: result.expectedTaxBody ?? null, shipTos: health.uncheckedShipTos - described, reason: Number.isFinite(result.officialRate) && !Number.isFinite(result.aplusRate) && result.expectedTaxBody ? 'missing_rate' : 'unknown' });
  return gaps;
}
