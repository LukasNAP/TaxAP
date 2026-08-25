// Generalizes the dashboard's rate-change inbox to accept any state's A+-vs-official comparison,
// instead of the North Carolina-only shape it started with. NC's own comparison logic in page.tsx
// is untouched; this module only defines the shared output shape and adapts other states into it.
// A state only belongs here once it has real A+ jurisdiction matching, not just an official-rate
// inventory — see docs/roadmap-50-states.md. Georgia is the only other state that qualifies today.

export type ComparisonStatus = "matched" | "recent-match" | "mismatch" | "upcoming" | "not-checked";
export type FindingConfidence = "confirmed" | "unverified";

export type JurisdictionFinding = {
  id: string;
  reviewFindingKey: string;
  stateCode: string;
  jurisdictionLabel: string;
  taxBody: string;
  officialRate: number | null;
  aplusRate: number | null;
  rateDifference: number | null;
  activeShipTos: number;
  comparisonStatus: ComparisonStatus;
  confidence: FindingConfidence;
  confidenceNote: string | null;
  effectiveDate: string | null;
  sourceUrl: string | null;
};

export type GaTaxBodyFindingInput = {
  taxBody: string;
  activeShipTos: number;
  officialRate: number | null;
  aplusRate: number | null;
  rateDifference: number | null;
  hasDifference: boolean;
  jurisdictionAssignmentConsistent: boolean;
};

const UNVERIFIED_JURISDICTION_NOTE =
  "Ship-tos under this tax body resolved to more than one official jurisdiction; this compares against the majority jurisdiction only.";

/**
 * Converts Georgia's boundary-reconciliation tax-body rows into the shared finding shape.
 * Every row with a rate difference is included, even when jurisdictionAssignmentConsistent is
 * false — per the project's fail-closed, no-silent-caps convention, a low-confidence finding is
 * flagged, not dropped. Only rows with at least one active ship-to are worth surfacing.
 */
export function gaFindingsFromReconciliation(
  taxBodyFindings: GaTaxBodyFindingInput[] | null | undefined,
): JurisdictionFinding[] {
  if (!taxBodyFindings) return [];
  return taxBodyFindings
    .filter((row) => row.hasDifference && row.activeShipTos > 0)
    .map((row) => ({
      id: `GA-${row.taxBody}`,
      reviewFindingKey: `GA-${row.taxBody}-current`,
      stateCode: "GA",
      jurisdictionLabel: row.taxBody,
      taxBody: row.taxBody,
      officialRate: row.officialRate,
      aplusRate: row.aplusRate,
      rateDifference: row.rateDifference,
      activeShipTos: row.activeShipTos,
      comparisonStatus: "mismatch",
      confidence: row.jurisdictionAssignmentConsistent ? "confirmed" : "unverified",
      confidenceNote: row.jurisdictionAssignmentConsistent ? null : UNVERIFIED_JURISDICTION_NOTE,
      effectiveDate: null,
      sourceUrl: null,
    }));
}

/** Merges findings from any number of states into one inbox, most-affected-ship-tos first. */
export function combineFindings(...lists: JurisdictionFinding[][]): JurisdictionFinding[] {
  return lists.flat().sort((a, b) => b.activeShipTos - a.activeShipTos);
}
