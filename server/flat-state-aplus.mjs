import { describesOtherJurisdiction } from "../app/tax-body-policy.ts";

function sumShipTos(rows) {
  return rows.reduce((sum, row) => sum + Number(row.activeShipTos || 0), 0);
}

/**
 * Generic A+ reconciliation for a state whose entire real tax structure is one flat statewide tax
 * body with no local-option variation - confirmed live for MD, IN, KY, MI, ME, CT, MA, and MS (see
 * each state's docs/states/<code>.md). Structurally identical to server/nj-aplus.mjs's
 * reconcileNewJerseyAplus, generalized so eight states don't need eight near-duplicate files.
 * Different-state assignments remain visible as aggregate exclusions and never participate in the
 * rate comparison, the same pattern NJ's reconciler established first.
 */
export function reconcileFlatStateAplus({ stateCode, expectedTaxBody, stateDetail, officialRate }) {
  if (stateDetail?.stateCode !== stateCode) {
    throw new Error(`${stateCode} reconciliation requires an A+ state-detail snapshot for the same state.`);
  }
  if (!Number.isFinite(Number(officialRate))) {
    throw new Error(`${stateCode} reconciliation requires a numeric official statewide rate.`);
  }

  const rows = stateDetail.taxBodies ?? [];
  const crossStateAssignments = rows.filter((row) => describesOtherJurisdiction(row, stateCode));
  const comparableRows = rows.filter((row) => !describesOtherJurisdiction(row, stateCode) && row.taxBody === expectedTaxBody);
  const unclassifiedAssignments = rows.filter((row) => !describesOtherJurisdiction(row, stateCode) && row.taxBody !== expectedTaxBody);
  if (comparableRows.length > 1) throw new Error(`A+ returned duplicate ${expectedTaxBody} assignment groups.`);

  const expected = comparableRows[0] ?? null;
  const aplusRate = expected?.currentRate === null || expected?.currentRate === undefined ? null : Number(expected.currentRate);
  const rateDifference = Number.isFinite(aplusRate) ? Number((Number(officialRate) - aplusRate).toFixed(4)) : null;
  const totals = {
    activeShipTos: Number(stateDetail.activeShipTos || 0),
    comparedShipTos: sumShipTos(comparableRows),
    crossStateShipTos: sumShipTos(crossStateAssignments),
    unclassifiedShipTos: sumShipTos(unclassifiedAssignments),
  };
  if (totals.comparedShipTos + totals.crossStateShipTos + totals.unclassifiedShipTos !== totals.activeShipTos) {
    throw new Error(`${stateCode} assignment groups do not reconcile to the active ship-to total.`);
  }

  return {
    stateCode,
    expectedTaxBody,
    retrievedAt: new Date().toISOString(),
    officialRate: Number(officialRate),
    aplusRate,
    rateDifference,
    hasDifference: rateDifference !== null && Math.abs(rateDifference) >= 0.01,
    comparisonStatus: rateDifference === null ? "unavailable" : Math.abs(rateDifference) >= 0.01 ? "difference" : "matched",
    totals,
    crossStateAssignments,
    unclassifiedAssignments,
  };
}
