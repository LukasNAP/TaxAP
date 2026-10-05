import type { JurisdictionFinding } from "./dashboard-findings.ts";

export function ncReviewKey(input: { taxBody: string; currentRate: number | null; officialRate: number | null; futureDate?: string | null; recentDate?: string | null; effectivePeriod?: string | null }): string {
  const source = input.futureDate ?? input.recentDate ?? input.effectivePeriod ?? "current";
  const iso = source.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const us = source.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const date = iso ?? (us ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}` : source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "current");
  return `${input.taxBody}-${date}:a${input.currentRate ?? "unknown"}:o${input.officialRate ?? "unknown"}`;
}

// A changed rate pair must receive a fresh review, even if an older finding was resolved.
export function findingDecisionKey(finding: Pick<JurisdictionFinding, "stateCode" | "reviewFindingKey" | "aplusRate" | "officialRate">): string {
  if (finding.stateCode === "NC") return finding.reviewFindingKey;
  return `${finding.reviewFindingKey}:a${finding.aplusRate ?? "unknown"}:o${finding.officialRate ?? "unknown"}`;
}

export function findingReviewEvidence(finding: JurisdictionFinding) {
  return {
    findingKey: findingDecisionKey(finding), stateCode: finding.stateCode,
    jurisdiction: finding.jurisdictionLabel, taxBody: finding.taxBody,
    findingType: finding.comparisonStatus === "upcoming" ? "upcoming" : finding.comparisonStatus === "recent-match" ? "recent-match" : "mismatch",
    aplusRate: finding.aplusRate, officialRate: finding.officialRate,
    effectiveDate: finding.effectiveDate, sourceUrl: finding.sourceUrl,
  };
}
