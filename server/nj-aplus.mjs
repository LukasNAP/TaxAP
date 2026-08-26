import { describesOtherJurisdiction } from "../app/tax-body-policy.ts";

const EXPECTED_TAX_BODY = "NJ000";

function sumShipTos(rows) {
  return rows.reduce((sum, row) => sum + Number(row.activeShipTos || 0), 0);
}

/**
 * Compares New Jersey's single A+ tax body with the flat official statewide rate. Different-state
 * assignments remain visible as aggregate exclusions and never participate in the rate comparison.
 */
export function reconcileNewJerseyAplus({ stateDetail, officialSnapshot }) {
  if (stateDetail?.stateCode !== "NJ" || officialSnapshot?.stateCode !== "NJ") {
    throw new Error("New Jersey reconciliation requires NJ A+ and official-source snapshots.");
  }

  const officialRows = officialSnapshot.rates?.filter((row) => row.jurisdictionCode === "NJ") ?? [];
  if (officialRows.length !== 1 || !Number.isFinite(Number(officialRows[0].totalGeneralRate))) {
    throw new Error("New Jersey official snapshot must contain exactly one statewide total rate.");
  }

  const rows = stateDetail.taxBodies ?? [];
  const crossStateAssignments = rows.filter((row) => describesOtherJurisdiction(row, "NJ"));
  const comparableRows = rows.filter((row) => !describesOtherJurisdiction(row, "NJ") && row.taxBody === EXPECTED_TAX_BODY);
  const unclassifiedAssignments = rows.filter((row) => !describesOtherJurisdiction(row, "NJ") && row.taxBody !== EXPECTED_TAX_BODY);
  if (comparableRows.length > 1) throw new Error("A+ returned duplicate NJ000 assignment groups.");

  const expected = comparableRows[0] ?? null;
  const officialRate = Number(officialRows[0].totalGeneralRate);
  const aplusRate = expected?.currentRate === null || expected?.currentRate === undefined ? null : Number(expected.currentRate);
  const rateDifference = Number.isFinite(aplusRate) ? Number((officialRate - aplusRate).toFixed(4)) : null;
  const totals = {
    activeShipTos: Number(stateDetail.activeShipTos || 0),
    comparedShipTos: sumShipTos(comparableRows),
    crossStateShipTos: sumShipTos(crossStateAssignments),
    unclassifiedShipTos: sumShipTos(unclassifiedAssignments),
  };
  if (totals.comparedShipTos + totals.crossStateShipTos + totals.unclassifiedShipTos !== totals.activeShipTos) {
    throw new Error("New Jersey assignment groups do not reconcile to the active ship-to total.");
  }

  return {
    stateCode: "NJ",
    expectedTaxBody: EXPECTED_TAX_BODY,
    retrievedAt: new Date().toISOString(),
    officialRate,
    aplusRate,
    rateDifference,
    hasDifference: rateDifference !== null && Math.abs(rateDifference) >= 0.01,
    comparisonStatus: rateDifference === null ? "unavailable" : Math.abs(rateDifference) >= 0.01 ? "difference" : "matched",
    totals,
    crossStateAssignments,
    unclassifiedAssignments,
  };
}
