export type EffectiveFilter = "all" | "current" | "upcoming" | "undated";
export type SourceFilter = "all" | "validated" | "unavailable";
export type ReviewFilter = "all" | "unreviewed" | "new" | "in_review" | "approved" | "resolved" | "not_applicable";

export type JurisdictionFilterRow = {
  stateCode: string;
  jurisdictionType: string;
  jurisdictionName: string;
  taxBody: string;
  comparisonStatus: string;
  effectiveState: Exclude<EffectiveFilter, "all">;
  sourceStatus: Exclude<SourceFilter, "all">;
  reviewStatus: Exclude<ReviewFilter, "all"> | null;
};

export type JurisdictionFilters = {
  query: string;
  state: string;
  jurisdictionType: string;
  comparison: string;
  effective: EffectiveFilter;
  source: SourceFilter;
  review: ReviewFilter;
};

export function matchesJurisdictionFilters(row: JurisdictionFilterRow, filters: JurisdictionFilters) {
  const query = filters.query.trim().toLowerCase();
  const matchesQuery = !query
    || row.jurisdictionName.toLowerCase().includes(query)
    || row.taxBody.toLowerCase().includes(query);

  return matchesQuery
    && (filters.state === "all" || row.stateCode === filters.state)
    && (filters.jurisdictionType === "all" || row.jurisdictionType === filters.jurisdictionType)
    && (filters.comparison === "all" || row.comparisonStatus === filters.comparison)
    && (filters.effective === "all" || row.effectiveState === filters.effective)
    && (filters.source === "all" || row.sourceStatus === filters.source)
    && (filters.review === "all"
      || (filters.review === "unreviewed" ? row.reviewStatus === null : row.reviewStatus === filters.review));
}
