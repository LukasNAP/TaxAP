export type IdentityStatus = "confirmed" | "ambiguous" | "unresolved" | "not_checked";
export type LocationStatus = "verified" | "partial" | "not_checked";
export type JurisdictionVerification = { identityStatus?: IdentityStatus; locationStatus?: LocationStatus };

export const identityLabels: Record<IdentityStatus, string> = {
  confirmed: "Confirmed", ambiguous: "Ambiguous — needs review", unresolved: "Unresolved — needs review", not_checked: "Not checked",
};
export const locationLabels: Record<LocationStatus, string> = {
  verified: "Verified against official address boundaries", partial: "Partial or ZIP-based evidence", not_checked: "Not checked",
};

// Retained or older evidence must never imply a current address verification.
export function findingVerification(finding: JurisdictionVerification & { confidence?: string; evidenceStatus?: string }) {
  return {
    identityStatus: finding.evidenceStatus === "stale" ? "not_checked" as const : finding.identityStatus ?? (finding.confidence === "confirmed" ? "confirmed" as const : "not_checked" as const),
    locationStatus: finding.evidenceStatus === "stale" ? "not_checked" as const : finding.locationStatus ?? "not_checked" as const,
  };
}
