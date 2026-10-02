import type { JurisdictionFinding } from "./dashboard-findings.ts";
export type RetainedState = { stateCode: string; validatedAt: string; sourceRetrievedAt: string };

export function markRetainedEvidence(findings: JurisdictionFinding[], retainedStates: RetainedState[]): JurisdictionFinding[] {
  const retained = new Map(retainedStates.map(state => [state.stateCode, state]));
  return findings.map(finding => {
    const evidence = retained.get(finding.stateCode);
    if (evidence && finding.evidenceStatus === "stale" && finding.evidenceRetrievedAt === evidence.sourceRetrievedAt) return finding;
    return evidence ? { ...finding, evidenceStatus: "stale", evidenceRetrievedAt: evidence.sourceRetrievedAt, confidence: "unverified",
      confidenceNote: `Retained evidence from ${evidence.sourceRetrievedAt}. Current comparison unavailable; maintenance approval is blocked.${finding.confidenceNote ? ` ${finding.confidenceNote}` : ""}` } : finding;
  });
}
