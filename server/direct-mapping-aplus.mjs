import { describesOtherJurisdiction } from "../app/tax-body-policy.ts";

/**
 * Generic A+ reconciliation for a state where many A+ tax-body codes each map directly to one
 * real jurisdiction (NC-style: no address/boundary matching needed, unlike GA's ga-boundary.mjs;
 * not a single flat statewide code, unlike server/flat-state-aplus.mjs). The caller supplies
 * `matchOfficialRow(taxBodyRow)` - a per-state function encoding whatever real convention that
 * state's Step 1 investigation confirmed (alphabetical index, jurisdiction-name parsing, a fixed
 * lookup table, etc. - see docs/state-rollout.md). This function only aggregates, excludes, and
 * reports; it never decides *how* to match, and never guesses when matchOfficialRow returns null.
 */
export function reconcileDirectMappingAplus({ stateCode, stateDetail, matchOfficialRow, isMisinput = () => false }) {
  if (stateDetail?.stateCode !== stateCode) {
    throw new Error(`${stateCode} reconciliation requires an A+ state-detail snapshot for the same state.`);
  }
  if (typeof matchOfficialRow !== "function") {
    throw new Error(`${stateCode} reconciliation requires a matchOfficialRow function.`);
  }

  const rows = stateDetail.taxBodies ?? [];
  const crossStateAssignments = rows.filter((row) => describesOtherJurisdiction(row, stateCode));
  const nonCrossState = rows.filter((row) => !describesOtherJurisdiction(row, stateCode));
  const misinputAssignments = nonCrossState.filter((row) => isMisinput(row));
  const comparableRows = nonCrossState.filter((row) => !isMisinput(row));

  const findings = comparableRows.map((row) => {
    const official = matchOfficialRow(row) ?? null;
    // A matched official row whose own total isn't resolvable (e.g. a city whose county couldn't
    // be determined) must be treated the same as "no match found" - never coerced to 0 via
    // Number(null), which would silently report a confident, wrong 0% official rate.
    const hasResolvedRate = official !== null && official.totalGeneralRate !== null && official.totalGeneralRate !== undefined;
    const aplusRate = row.currentRate === null || row.currentRate === undefined ? null : Number(row.currentRate);
    const officialRate = hasResolvedRate ? Number(official.totalGeneralRate) : null;
    const rateDifference = officialRate !== null && Number.isFinite(aplusRate) ? Number((officialRate - aplusRate).toFixed(4)) : null;
    return {
      taxBody: row.taxBody,
      description: row.description,
      activeShipTos: row.activeShipTos,
      jurisdictionLabel: official?.name ?? row.description ?? row.taxBody,
      officialRate,
      aplusRate,
      rateDifference,
      hasDifference: rateDifference !== null && Math.abs(rateDifference) >= 0.01,
      matched: hasResolvedRate,
    };
  });

  const sum = (list) => list.reduce((sum2, row) => sum2 + Number(row.activeShipTos || 0), 0);
  const unmatchedFindings = findings.filter((finding) => !finding.matched);

  return {
    stateCode,
    retrievedAt: new Date().toISOString(),
    totals: {
      activeShipTos: Number(stateDetail.activeShipTos || 0),
      comparedShipTos: sum(comparableRows),
      crossStateShipTos: sum(crossStateAssignments),
      misinputShipTos: sum(misinputAssignments),
      unmatchedShipTos: sum(unmatchedFindings.map((finding) => ({ activeShipTos: finding.activeShipTos }))),
    },
    findings,
    crossStateAssignments,
    misinputAssignments,
  };
}
