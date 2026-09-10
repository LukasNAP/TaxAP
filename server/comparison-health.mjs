/** Summarize returned aggregates only; never infer a successful match from a reader count. */
export function comparisonHealth(result) {
  const totals = result.totals ?? {};
  const active = Number.isFinite(totals.activeShipTos) ? totals.activeShipTos : null;
  const compared = Array.isArray(result.findings)
    ? result.findings.filter((row) => row.matched && Number.isFinite(row.aplusRate) && Number.isFinite(row.officialRate))
      .reduce((sum, row) => sum + row.activeShipTos, 0)
    : Number.isFinite(result.aplusRate) && Number.isFinite(result.officialRate) ? totals.comparedShipTos : 0;
  const intentionalNoTax = totals.intentionalNoTaxShipTos ?? 0;
  return {
    stateCode: result.stateCode, activeShipTos: active, comparedShipTos: compared,
    intentionalNoTaxShipTos: intentionalNoTax,
    uncheckedShipTos: active === null || !Number.isFinite(compared) ? null : Math.max(0, active - compared - intentionalNoTax),
  };
}
