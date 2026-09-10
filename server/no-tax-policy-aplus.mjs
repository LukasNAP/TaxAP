import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

// User confirmed these existing assignments are deliberate no-tax treatment on
// September 10, 2026. This is a business policy, not an official jurisdiction rate.
export const CONFIRMED_NO_TAX_BODIES = Object.freeze({
  AK: ["AK000"], HI: ["HI000"], ND: ["ND000"], WY: ["WY000", "ZTEMP"],
});

export function reconcileConfirmedNoTax(stateCode, stateDetail) {
  const codes = CONFIRMED_NO_TAX_BODIES[stateCode];
  if (!codes) throw new Error("No deliberate no-tax policy is configured for this state.");
  const result = reconcileDirectMappingAplus({ stateCode, stateDetail, matchOfficialRow: () => null });
  const approved = new Set((stateDetail.taxBodies ?? []).filter((row) =>
    codes.includes(row.taxBody) && row.definitionStatus === "configured" &&
    row.currentRate !== null && row.currentRate !== undefined && String(row.currentRate).trim() !== "" &&
    Number(row.currentRate) === 0 && !isRetiredTaxBody(row),
  ).map((row) => row.taxBody));
  // Only non-cross-state rows in the reconciler's findings can qualify.
  const policyFindings = result.findings.filter((r) => approved.has(r.taxBody));
  result.findings = result.findings.filter((r) => !approved.has(r.taxBody));
  result.totals.comparedShipTos = 0;
  result.totals.unmatchedShipTos = result.findings.reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  result.totals.intentionalNoTaxShipTos = policyFindings.reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, noTaxPolicy: {
    confirmedOn: "2026-09-10", approvedTaxBodies: [...codes],
    description: "Existing zero-rate assignments are deliberate no-tax treatment confirmed by the user. They are excluded from rate comparisons; this does not assert an official 0% jurisdiction rate. New codes, nonzero rates, missing definitions and retired assignments remain unresolved.",
  } };
}
