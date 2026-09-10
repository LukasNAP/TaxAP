import type { JurisdictionFinding } from "./dashboard-findings.ts";

// A changed rate pair must receive a fresh review, even if an older finding was resolved.
export function findingDecisionKey(finding: JurisdictionFinding): string {
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
