import type { JurisdictionFinding } from "./dashboard-findings.ts";

export type TreatmentAwareFinding = JurisdictionFinding & {
  totalAssignedShipTos: number;
  rateRiskShipTos: number | null;
  neverTaxedShipTos: number | null;
  lineLevelReviewShipTos: number | null;
  otherTreatmentShipTos: number | null;
};

export function applyFindingTreatments(
  findings: JurisdictionFinding[],
  snapshot: { taxBodies: { taxBody: string | null; treatments: { treatmentCode: string; activeShipTos: number }[] }[] } | null,
  status: "idle" | "loading" | "ready" | "error",
): TreatmentAwareFinding[] {
  // Only the current successful read can suppress a finding using zero counts.
  const byBody = new Map((status === "ready" ? snapshot?.taxBodies ?? [] : [])
    .filter(row => Boolean(row.taxBody))
    .map(row => [row.taxBody, new Map(row.treatments.map(t => [t.treatmentCode, t.activeShipTos]))]));
  return findings.map(finding => {
    const treatments = finding.evidenceStatus === "stale" ? undefined : byBody.get(finding.taxBody);
    if (!treatments) return { ...finding, totalAssignedShipTos: finding.activeShipTos, rateRiskShipTos: null, neverTaxedShipTos: null, lineLevelReviewShipTos: null, otherTreatmentShipTos: null };
    const rateRiskShipTos = treatments.get("0") ?? 0;
    const neverTaxedShipTos = treatments.get("3") ?? 0;
    const lineLevelReviewShipTos = treatments.get("J") ?? 0;
    const otherTreatmentShipTos = treatments.get("other") ?? 0;
    return { ...finding, totalAssignedShipTos: rateRiskShipTos + neverTaxedShipTos + lineLevelReviewShipTos + otherTreatmentShipTos,
      rateRiskShipTos, neverTaxedShipTos, lineLevelReviewShipTos, otherTreatmentShipTos, activeShipTos: rateRiskShipTos };
  });
}
