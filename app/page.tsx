"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countyCoverage,
  resolvedCases,
  snapshot,
  sources,
  specialTaxBodies,
  validatedOfficialNcFallback,
  validatedStateCoverageFallback,
  type CountyCoverage,
  type ResolvedCase,
} from "./tax-data";
import { validateXatxbdCsv, type APlusImportResult, type ImportedTaxBody } from "./aplus-import";
import { matchesJurisdictionFilters, type EffectiveFilter, type ReviewFilter, type SourceFilter } from "./jurisdiction-filters";
import { combineFindings, gaFindingsFromReconciliation, type JurisdictionFinding } from "./dashboard-findings";
import { describesOtherJurisdiction, isRetiredTaxBody, STATE_NAME_BY_CODE } from "./tax-body-policy";
import { ReviewAuditTrail, ReviewDecisionPanel, reviewStatusLabels, type ReviewCase, type ReviewStatus } from "./review-workflow";

type View = "dashboard" | "attention" | "upcoming" | "jurisdictions" | "history" | "sources" | "import";
type ConnectorStatus = "connecting" | "refreshing" | "live" | "fallback";
type LiveAPlusSnapshot = {
  source: string;
  retrievedAt: string;
  standardRows: ImportedTaxBody[];
  specialRows: ImportedTaxBody[];
  scheduledRows: ImportedTaxBody[];
  rateDistribution: { rate: number; count: number }[];
  warnings: string[];
};
type StateSummary = { stateCode: string; activeShipTos: number; activeCustomers: number; taxBodyCount: number };
type StateCoverageSnapshot = { retrievedAt: string; states: StateSummary[]; excludedShipTos: number };
type TaxTreatmentCode = "0" | "3" | "J" | "other";
type TaxTreatmentBucket = { treatmentCode: TaxTreatmentCode; activeShipTos: number; activeCustomers: number };
type TaxBodyTreatment = { taxBody: string | null; treatments: TaxTreatmentBucket[] };
type TaxTreatmentSnapshot = {
  retrievedAt: string;
  treatments: TaxTreatmentBucket[];
  taxBodies: TaxBodyTreatment[];
  temporaryTaxBody: {
    taxBody: "ZTEMP";
    definitionStatus: "configured" | "missing";
    configuredRate: number | null;
    activeShipTos: number;
    treatments: TaxTreatmentBucket[];
  };
};
type TaxTreatmentStatus = "idle" | "loading" | "ready" | "error";
type TreatmentAwareFinding = JurisdictionFinding & {
  totalAssignedShipTos: number;
  rateRiskShipTos: number | null;
  neverTaxedShipTos: number | null;
  lineLevelReviewShipTos: number | null;
  otherTreatmentShipTos: number | null;
};
type StateTaxBody = {
  taxBody: string | null;
  description: string | null;
  activeShipTos: number;
  activeCustomers: number;
  baseRate: number | null;
  localRates: number[];
  currentRate: number | null;
  nextRate: number | null;
  nextEffectiveDate: string | null;
  definitionStatus: "configured" | "missing";
  rateTotalValid: boolean | null;
};
type StateDetail = { stateCode: string; retrievedAt: string; activeShipTos: number; taxBodyCount: number; taxBodies: StateTaxBody[] };
type StateDetailStatus = "idle" | "loading" | "ready" | "error";
type OfficialSourceState = {
  stateCode: string;
  stateName: string;
  status: "connected" | "machine-readable-source" | "official-document-source" | "research-needed" | "no-general-sales-tax";
  adapter: string;
  coverage: string;
  sourceName: string;
  sourceUrl: string | null;
};
type OfficialStateRate = {
  jurisdictionType: "state" | "county" | "city" | "special";
  jurisdictionCode: string;
  name: string;
  componentRate: number;
  totalGeneralRate: number | null;
  generalInterstateRate: number;
  beginDate: string | null;
  endDate: string | null;
};
type OfficialStateSnapshot = {
  stateCode: string;
  source: string;
  sourceUrl: string;
  machineReadableSourceUrl: string | null;
  retrievedAt: string;
  asOfDate: string;
  stateRate: number;
  sourceHash: string;
  rates: OfficialStateRate[];
  counts: { counties: number; cities: number; specialJurisdictions: number };
  boundaryStatus: string;
};
type GaBoundaryJurisdiction = { fipsCounty: string | null; fipsPlace: string | null; specialCode: string | null };
type GaBoundaryTaxBodyFinding = {
  taxBody: string;
  description: string | null;
  activeShipTos: number;
  matchedShipTos: number;
  unmatchedShipTos: number;
  ambiguousShipTos: number;
  jurisdictionAssignmentConsistent: boolean;
  jurisdiction: GaBoundaryJurisdiction | null;
  officialRate: number | null;
  aplusRate: number | null;
  rateDifference: number | null;
  hasDifference: boolean;
};
type GaBoundaryReconciliation = {
  retrievedAt: string;
  boundaryFileUrl: string;
  boundaryRetrievedAt: string;
  boundarySourceHash: string;
  rateFileUrl: string | null;
  rateSourceHash: string;
  asOfDate: string;
  totals: { activeShipTos: number; matched: number; unmatched: number; ambiguous: number };
  matchTierCounts: { address: number; zip9: number; zip5: number; zip5FromZip9: number };
  taxBodyFindings: GaBoundaryTaxBodyFinding[];
  excludedForNoAplusRate: number;
  crossStateAssignments: { taxBodyCount: number; shipToCount: number; rateBearingTaxBodyCount: number; rateBearingShipToCount: number; taxBodies: GaBoundaryTaxBodyFinding[] };
  unmatchedReasons: { reason: string; count: number }[];
  ambiguousReasons: { reason: string; count: number }[];
};
// Shared shape for every "single flat statewide tax body" state's A+ reconciliation - NJ's own
// dedicated server/nj-aplus.mjs (which also carries the UEZ caveat) and the generic
// server/flat-state-aplus.mjs used for MD/IN/KY/MI/ME/CT/MA/MS both return this same structure.
type FlatStateAplusReconciliation = {
  stateCode: string;
  expectedTaxBody: string;
  retrievedAt: string;
  officialRate: number;
  aplusRate: number | null;
  rateDifference: number | null;
  hasDifference: boolean;
  comparisonStatus: "matched" | "difference" | "unavailable";
  totals: { activeShipTos: number; comparedShipTos: number; crossStateShipTos: number; unclassifiedShipTos: number };
  crossStateAssignments: StateTaxBody[];
  unclassifiedAssignments: StateTaxBody[];
  stateDetail: StateDetail;
};
// Shared shape for a "many codes, each mapped directly to one real jurisdiction" state's A+
// reconciliation (FL/PA/OH today - see server/direct-mapping-aplus.mjs). Unlike a flat state
// (one number, one comparison), this carries a whole table of per-tax-body findings.
type DirectMappingFinding = {
  taxBody: string;
  description: string | null;
  activeShipTos: number;
  jurisdictionLabel: string;
  officialRate: number | null;
  aplusRate: number | null;
  rateDifference: number | null;
  hasDifference: boolean;
  matched: boolean;
};
type DirectMappingAplusReconciliation = {
  stateCode: string;
  retrievedAt: string;
  totals: { activeShipTos: number; comparedShipTos: number; crossStateShipTos: number; misinputShipTos: number; unmatchedShipTos: number };
  findings: DirectMappingFinding[];
  crossStateAssignments: StateTaxBody[];
  misinputAssignments: StateTaxBody[];
  stateDetail: StateDetail;
};
type StateDrawerCacheEntry = {
  stateDetail: StateDetail | null;
  stateDetailStatus: StateDetailStatus;
  officialStateDetail: OfficialStateSnapshot | null;
  officialStateStatus: StateDetailStatus;
  gaBoundaryDetail: GaBoundaryReconciliation | null;
  gaBoundaryStatus: StateDetailStatus;
  flatStateAplusDetail: FlatStateAplusReconciliation | null;
  flatStateAplusStatus: StateDetailStatus;
  directMappingAplusDetail: DirectMappingAplusReconciliation | null;
  directMappingAplusStatus: StateDetailStatus;
  fetchedAt: number;
};
type ComparisonStatus = "matched" | "recent-match" | "mismatch" | "upcoming" | "not-checked";
type OfficialFutureChange = { county: string; effectiveDate: string; componentRate: number; component: string };
type OfficialNcSnapshot = {
  source: string;
  sourceUrl: string;
  effectiveDatesUrl: string;
  retrievedAt: string;
  asOfDate: string;
  effectivePeriod: string;
  sourceHash: string | null;
  rates: { county: string; taxBody: string; officialRate: number; previousOfficialRate: number | null; recentChange: boolean; recentEffectiveDate: string | null }[];
  futureChanges: OfficialFutureChange[];
};
type ComparedCounty = CountyCoverage & {
  comparisonStatus: ComparisonStatus;
  officialRate: number | null;
  officialEffectivePeriod: string | null;
  officialSourceUrl: string | null;
  officialRetrievedAt: string | null;
  rateDifference: number | null;
  previousOfficialRate: number | null;
  recentEffectiveDate: string | null;
  futureChanges: OfficialFutureChange[];
};
const LIVE_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const OFFLINE_MODE = process.env.NEXT_PUBLIC_TAXAP_OFFLINE_MODE === "true";

const SST_SOURCE_STATES = new Set(["GA", "IA", "KS", "MN", "NC", "ND", "NE", "NV", "OH", "OK", "SD", "TN", "UT", "VT", "WA", "WI", "WV"]);
const CONNECTED_GENERIC_SST_STATES = new Set(["AR", "WY", "RI", "NV", "NE"]);
const NO_GENERAL_SALES_TAX_STATES = new Set(["DE", "MT", "NH", "OR"]);
// States confirmed live (2026-08-26) to be a single flat statewide A+ tax body with no local-option
// variation, matching its official rate exactly - drives both the FALLBACK_OFFICIAL_SOURCES entries
// below and which states show the shared FlatStateAplusPanel in the state drawer. Deliberately does
// NOT include RI: RI's sole tax body is confirmed live at 0% against RI's real flat 7% rate, an open
// human decision, not wired A+ matching (see docs/pending-business-decisions.md).
const FLAT_STATE_APLUS_STATES = new Set(["NJ", "MD", "IN", "KY", "MI", "ME", "CT", "MA", "MS"]);
// States confirmed live (2026-08-27) to have many A+ codes each mapping directly to one real
// jurisdiction (no address matching needed) - see server/direct-mapping-aplus.mjs.
const DIRECT_MAPPING_APLUS_STATES = new Set(["FL", "PA", "OH", "VA", "NY", "AZ", "AL"]);
const FALLBACK_OFFICIAL_SOURCES: OfficialSourceState[] = Array.from(STATE_NAME_BY_CODE.entries()).map(([stateCode, stateName]) => {
  if (stateCode === "NC") return { stateCode, stateName, status: "connected", adapter: "state-dor-html", coverage: "county", sourceName: "North Carolina Department of Revenue", sourceUrl: sources[0].url };
  if (stateCode === "GA") return { stateCode, stateName, status: "connected", adapter: "sst-rate-file", coverage: "state, county, city, and special-jurisdiction components", sourceName: "Georgia DOR via Streamlined Sales Tax rate file", sourceUrl: "https://dor.georgia.gov/sales-tax-rates-general" };
  if (stateCode === "CA") return { stateCode, stateName, status: "connected", adapter: "state-dor-html", coverage: "current city and county total rates", sourceName: "California Department of Tax and Fee Administration", sourceUrl: "https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm" };
  if (stateCode === "TX") return { stateCode, stateName, status: "connected", adapter: "state-comptroller-text-html", coverage: "quarterly combined city and local-area rates", sourceName: "Texas Comptroller of Public Accounts", sourceUrl: "https://comptroller.texas.gov/taxes/file-pay/edi/sales-tax-rates.php" };
  if (stateCode === "FL") return { stateCode, stateName, status: "connected", adapter: "state-dor-xlsx", coverage: "all 67 county discretionary surtax totals, matched to A+ by real county name", sourceName: "Florida Department of Revenue", sourceUrl: "https://floridarevenue.com/taxes/taxesfees/Pages/discretionary.aspx" };
  if (stateCode === "SC") return { stateCode, stateName, status: "connected", adapter: "state-dor-pdf", coverage: "all 46 county (unincorporated) and municipality totals from ST-575; A+ tax-body matching not yet built", sourceName: "South Carolina Department of Revenue", sourceUrl: "https://dor.sc.gov/sites/dor/files/forms/ST575.pdf" };
  if (stateCode === "PA") return { stateCode, stateName, status: "connected", adapter: "state-dor-rules-census", coverage: "all 67 counties using the official state rate and Philadelphia/Allegheny add-ons; PA000/PA001 matched to A+", sourceName: "Pennsylvania Department of Revenue", sourceUrl: "https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax" };
  if (stateCode === "IL") return { stateCode, stateName, status: "connected", adapter: "state-dor-fixed-width", coverage: "current jurisdiction-wide standard-merchandise totals from IDOR's fixed-width file", sourceName: "Illinois Department of Revenue", sourceUrl: "https://tax.illinois.gov/research/taxrates/sales-tax-rate-machine-readable-files.html" };
  if (stateCode === "VA") return { stateCode, stateName, status: "connected", adapter: "state-dor-xlsx", coverage: "all 133 real counties and independent cities, matched to A+ by real locality name with the County/City suffix disambiguating Virginia's 4 name-duplicate pairs", sourceName: "Virginia Department of Taxation", sourceUrl: "https://www.tax.virginia.gov/sales-tax-rate-and-locality-code-lookup" };
  if (stateCode === "NY") return { stateCode, stateName, status: "connected", adapter: "state-dor-pdf", coverage: "Publication 718's full jurisdiction rate list, matched to A+ by real locality name", sourceName: "New York State Department of Taxation and Finance", sourceUrl: "https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf" };
  if (stateCode === "AZ") return { stateCode, stateName, status: "connected", adapter: "state-dor-csv", coverage: "business code 017 (Retail) county and city rates, city rows summed with their real county", sourceName: "Arizona Department of Revenue", sourceUrl: "https://azdor.gov/business/transaction-privilege-tax/tax-rate-table" };
  if (stateCode === "AL") return { stateCode, stateName, status: "connected", adapter: "state-dor-csv", coverage: "general sales rate only, matched to A+ by ADOR's own numeric locality code", sourceName: "Alabama Department of Revenue", sourceUrl: "https://www.revenue.alabama.gov/sales-use/local-cities-and-counties-tax-rates-text-file/" };
  if (stateCode === "DC") return { stateCode, stateName, status: "connected", adapter: "district-otr-html-flat-rate", coverage: "citywide general rate and enacted next rate; no local boundary matching required", sourceName: "District of Columbia Office of Tax and Revenue", sourceUrl: "https://otr.cfo.dc.gov/release/district-columbia-tax-changes-take-effect-october-1-2026" };
  if (stateCode === "ID") return { stateCode, stateName, status: "connected", adapter: "state-tax-commission-html-partial-local", coverage: "state rate and official resort-city inventory; unavailable central local totals are never guessed", sourceName: "Idaho State Tax Commission", sourceUrl: "https://tax.idaho.gov/taxes/sales-use/" };
  if (stateCode === "LA") return { stateCode, stateName, status: "connected", adapter: "remote-seller-current-parish-html", coverage: "current domicile-rate rows across all parish selectors", sourceName: "Louisiana Sales and Use Tax Commission for Remote Sellers", sourceUrl: "https://remotesellersfiling.la.gov/lookup/lookup.aspx" };
  if (stateCode === "MO") return { stateCode, stateName, status: "connected", adapter: "state-dor-quarterly-filing-code-xlsx", coverage: "current city, county, and special-district filing-code combinations", sourceName: "Missouri Department of Revenue", sourceUrl: "https://dor.mo.gov/taxation/business/tax-types/sales-use/rate-tables/" };
  if (stateCode === "NM") return { stateCode, stateName, status: "connected", adapter: "state-trd-rgis-grt-csv-archive", coverage: "current official district location codes and gross-receipts-tax totals", sourceName: "New Mexico Taxation and Revenue Department", sourceUrl: "https://www.tax.newmexico.gov/businesses/geographic-information-system-gis/data-download/" };
  if (stateCode === "MD") return { stateCode, stateName, status: "connected", adapter: "state-flat-rate", coverage: "flat 6% statewide rate (Tax-General Article Section 11-104); Maryland preempts local general sales tax, so no address matching is ever needed", sourceName: "Comptroller of Maryland", sourceUrl: "https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/Tax_rate_chart.pdf" };
  if (stateCode === "ME") return { stateCode, stateName, status: "connected", adapter: "state-flat-rate", coverage: "flat 5.5% statewide rate, live-parsed from Maine Revenue Services' own rate/due-date table; no local-option sales tax exists, so no address matching is ever needed", sourceName: "Maine Revenue Services", sourceUrl: "https://www.maine.gov/revenue/taxes/sales-use-service-provider-tax/rates-due-dates" };
  if (stateCode === "CT") return { stateCode, stateName, status: "connected", adapter: "state-flat-rate", coverage: "flat 6.35% statewide rate, live-parsed from Connecticut DRS's tax-information page; no local-option sales tax exists, so no address matching is ever needed", sourceName: "Connecticut Department of Revenue Services", sourceUrl: "https://portal.ct.gov/drs/sales-tax/tax-information" };
  if (stateCode === "MA") return { stateCode, stateName, status: "connected", adapter: "state-flat-rate", coverage: "flat 6.25% statewide rate, live-parsed from Massachusetts' own sales-and-use-tax guide; no general local-option sales tax exists, so no address matching is ever needed", sourceName: "Commonwealth of Massachusetts", sourceUrl: "https://www.mass.gov/guides/sales-and-use-tax" };
  if (stateCode === "MS") return { stateCode, stateName, status: "connected", adapter: "state-flat-rate", coverage: "flat 7% general retail rate, live-parsed from Mississippi DOR's rate page. Open caveat: Jackson (+1%) and Tupelo (+0.25%) each impose a narrow city-specific levy not modeled here", sourceName: "Mississippi Department of Revenue", sourceUrl: "https://www.dor.ms.gov/business/sales-use-tax/sales-tax-rates" };
  if (stateCode === "NJ") return { stateCode, stateName, status: "connected", adapter: "state-flat-rate", coverage: "flat statewide rate (6.625% since 2018), cross-validated live against two independent NJ Division of Taxation pages; no address matching is ever needed. Open caveat: NJ's Urban Enterprise Zone / Salem County reduced rate depends on Atlantic's own seller certification, not modeled", sourceName: "New Jersey Division of Taxation", sourceUrl: "https://www.nj.gov/treasury/taxation/su_10.shtml" };
  if (stateCode === "OH") return { stateCode, stateName, status: "connected", adapter: "sst-rate-file", coverage: "state, county, and special-jurisdiction rate components, matched to A+ by county name with the transit-authority surcharge crosswalk folded in", sourceName: `${stateName} via Streamlined Sales Tax`, sourceUrl: "https://www.streamlinedsalestax.org/ratesandboundry/Rates/" };
  if (stateCode === "TN") return { stateCode, stateName, status: "connected", adapter: "sst-rate-file", coverage: "state, county, city, and special-jurisdiction rate components", sourceName: `${stateName} via Streamlined Sales Tax`, sourceUrl: "https://www.streamlinedsalestax.org/ratesandboundry/Rates/" };
  if (stateCode === "IN" || stateCode === "KY" || stateCode === "MI") return { stateCode, stateName, status: "connected", adapter: "sst-rate-file", coverage: "flat statewide rate with zero local jurisdiction rows, validated 2026-08-26 - matches A+'s single statewide tax body exactly, no blocking finding", sourceName: `${stateName} via Streamlined Sales Tax`, sourceUrl: "https://www.streamlinedsalestax.org/ratesandboundry/Rates/" };
  if (CONNECTED_GENERIC_SST_STATES.has(stateCode)) return { stateCode, stateName, status: "connected", adapter: "sst-rate-file", coverage: "jurisdiction rate components, validated 2026-08-26", sourceName: `${stateName} via Streamlined Sales Tax`, sourceUrl: "https://www.streamlinedsalestax.org/ratesandboundry/Rates/" };
  if (NO_GENERAL_SALES_TAX_STATES.has(stateCode)) return { stateCode, stateName, status: "no-general-sales-tax", adapter: "none", coverage: "confirmed 2026-08-26: no general state or local sales/use tax exists in this state; excluded from rate comparison, not an unbuilt adapter", sourceName: "N/A", sourceUrl: null };
  if (stateCode === "HI") return { stateCode, stateName, status: "connected", adapter: "state-dotax-get-policy-html", coverage: "seller-side GET base, county surcharges, Kalawao exemption, and optional pass-on ceiling", sourceName: "Hawaii Department of Taxation", sourceUrl: "https://tax.hawaii.gov/geninfo/get/" };
  if (stateCode === "AK") return { stateCode, stateName, status: "connected", adapter: "local-only-arsstc-xlsx", coverage: "zero state sales tax plus current ARSSTC remote-seller destination rows", sourceName: "Alaska Remote Seller Sales Tax Commission", sourceUrl: "https://arsstc.org/downloads/" };
  if (SST_SOURCE_STATES.has(stateCode)) return { stateCode, stateName, status: "connected", adapter: "sst-rate-file", coverage: "validated state, county, city, and special-jurisdiction components as published for this state", sourceName: `${stateName} via Streamlined Sales Tax`, sourceUrl: "https://www.streamlinedsalestax.org/ratesandboundry/Rates/" };
  return { stateCode, stateName, status: "research-needed", adapter: "state-specific", coverage: "official DOR source mapping pending", sourceName: "State tax authority", sourceUrl: null };
});

const visibleSpecialTaxBodies = specialTaxBodies.filter((taxBody) => !isRetiredTaxBody(taxBody));

function apiBaseUrl() {
  if (OFFLINE_MODE) return "";
  const configuredBase = process.env.NEXT_PUBLIC_TAXAP_API_BASE_URL?.replace(/\/$/, "");
  // Production deployments proxy the connector's /api routes through the same authenticated
  // origin as the web app.  This keeps port 3001 private inside the container network and avoids
  // putting a connector URL (or a second public surface) in browser configuration.
  return configuredBase || (window.location.hostname === "localhost" ? "http://127.0.0.1:3001" : window.location.origin);
}

const comparisonLabels: Record<ComparisonStatus, string> = {
  matched: "Matches NCDOR",
  "recent-match": "Recent change matched",
  mismatch: "Review difference",
  upcoming: "Upcoming change",
  "not-checked": "Official rate not checked",
};

const navItems: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "attention", label: "Needs attention" },
  { id: "upcoming", label: "Upcoming" },
  { id: "jurisdictions", label: "All jurisdictions" },
  { id: "history", label: "Review history" },
  { id: "sources", label: "Sources" },
  { id: "import", label: "Admin import" },
];

function formatRate(rate: number) {
  return `${rate.toFixed(2)}%`;
}

function reviewDateKey(county: ComparedCounty) {
  const source = county.futureChanges[0]?.effectiveDate ?? county.recentEffectiveDate ?? county.officialEffectivePeriod ?? "current";
  const isoDate = source.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;
  const usDate = source.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usDate) return `${usDate[3]}-${usDate[1].padStart(2, "0")}-${usDate[2].padStart(2, "0")}`;
  return source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "current";
}

function reviewFindingKey(county: ComparedCounty) {
  return `${county.taxBody}-${reviewDateKey(county)}`;
}

function initializeComparisons(coverage: CountyCoverage[]): ComparedCounty[] {
  return coverage.map((county) => ({
    ...county,
    comparisonStatus: "not-checked",
    officialRate: null,
    officialEffectivePeriod: null,
    officialSourceUrl: null,
    officialRetrievedAt: null,
    rateDifference: null,
    previousOfficialRate: null,
    recentEffectiveDate: null,
    futureChanges: [],
  }));
}

function mergeRateRows(current: ComparedCounty[], standardRows: ImportedTaxBody[]): ComparedCounty[] {
  const rowsByTaxBody = new Map(standardRows.map((row) => [row.taxBody, row]));
  return current.map((county) => {
    const imported = rowsByTaxBody.get(county.taxBody);
    if (!imported) return county;
    const localComponents = imported.localRates
      .map((rate, index) => ({
        label: imported.localDescriptions[index] || `Local component ${index + 1}`,
        rate,
      }))
      .filter((component) => component.rate !== 0);
    return {
      ...county,
      baseRate: imported.baseRate,
      localRate: imported.localRates[0] ?? 0,
      transitRate: imported.localRates.slice(1).reduce((sum, rate) => sum + rate, 0),
      rateComponents: [{ label: "State", rate: imported.baseRate }, ...localComponents],
      currentRate: imported.currentRate,
      scheduledRate: imported.nextRate > 0 ? imported.nextRate : null,
      scheduledEffectiveDate: imported.nextEffectiveDate,
    };
  });
}

function mergeOfficialRates(current: ComparedCounty[], official: OfficialNcSnapshot): ComparedCounty[] {
  const officialByTaxBody = new Map(official.rates.map((row) => [row.taxBody, row]));
  const changesByCounty = new Map<string, OfficialFutureChange[]>();
  for (const change of official.futureChanges) changesByCounty.set(change.county, [...(changesByCounty.get(change.county) ?? []), change]);
  return current.map((county) => {
    const officialRow = officialByTaxBody.get(county.taxBody);
    if (!officialRow) return county;
    const difference = Number((county.currentRate - officialRow.officialRate).toFixed(4));
    const futureChanges = changesByCounty.get(county.county) ?? [];
    return {
      ...county,
      comparisonStatus: Math.abs(difference) >= 0.001 ? "mismatch" : futureChanges.length > 0 ? "upcoming" : officialRow.recentChange ? "recent-match" : "matched",
      officialRate: officialRow.officialRate,
      officialEffectivePeriod: official.effectivePeriod,
      officialSourceUrl: official.sourceUrl,
      officialRetrievedAt: official.retrievedAt,
      rateDifference: difference,
      previousOfficialRate: officialRow.previousOfficialRate,
      recentEffectiveDate: officialRow.recentEffectiveDate,
      futureChanges,
    };
  });
}

function downloadCoverageCsv(coverage: ComparedCounty[], snapshotDate: string) {
  const rows = [
    ["County", "A+ Tax Body", "A+ Configured Rate", "Official NCDOR Rate", "Difference", "Active Ship-tos", "Active Customers", "Comparison Status"],
    ...coverage.map((county) => [
      county.county,
      county.taxBody,
      formatRate(county.currentRate),
      county.officialRate === null ? "Not checked" : formatRate(county.officialRate),
      county.rateDifference === null ? "" : `${county.rateDifference.toFixed(2)}%`,
      String(county.activeShipTos),
      String(county.activeCustomers),
      comparisonLabels[county.comparisonStatus],
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `taxap-nc-county-coverage-${snapshotDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [activeCountyCoverage, setActiveCountyCoverage] = useState<ComparedCounty[]>(() => mergeOfficialRates(initializeComparisons(countyCoverage), validatedOfficialNcFallback));
  const [importResult, setImportResult] = useState<APlusImportResult | null>(null);
  const [appliedImport, setAppliedImport] = useState<{ fileName: string; importedOn: string } | null>(null);
  const [connectorStatus, setConnectorStatus] = useState<ConnectorStatus>(() => OFFLINE_MODE ? "fallback" : "connecting");
  const [connectorMessage, setConnectorMessage] = useState(() => OFFLINE_MODE
    ? "Offline design mode is active. Production connections and refreshes are disabled."
    : "Connecting to the read-only A+ source…");
  const [liveSnapshot, setLiveSnapshot] = useState<LiveAPlusSnapshot | null>(null);
  const [officialSnapshot, setOfficialSnapshot] = useState<OfficialNcSnapshot | null>(validatedOfficialNcFallback);
  const [stateCoverage, setStateCoverage] = useState<StateCoverageSnapshot | null>({ retrievedAt: validatedOfficialNcFallback.retrievedAt, states: validatedStateCoverageFallback, excludedShipTos: 0 });
  const [taxTreatmentSnapshot, setTaxTreatmentSnapshot] = useState<TaxTreatmentSnapshot | null>(null);
  const [taxTreatmentStatus, setTaxTreatmentStatus] = useState<TaxTreatmentStatus>("idle");
  const [selectedState, setSelectedState] = useState<StateSummary | null>(null);
  const [stateDetail, setStateDetail] = useState<StateDetail | null>(null);
  const [stateDetailStatus, setStateDetailStatus] = useState<StateDetailStatus>("idle");
  const [officialSources, setOfficialSources] = useState<OfficialSourceState[]>(FALLBACK_OFFICIAL_SOURCES);
  const [officialStateDetail, setOfficialStateDetail] = useState<OfficialStateSnapshot | null>(null);
  const [officialStateStatus, setOfficialStateStatus] = useState<StateDetailStatus>("idle");
  const [gaBoundaryDetail, setGaBoundaryDetail] = useState<GaBoundaryReconciliation | null>(null);
  const [gaBoundaryStatus, setGaBoundaryStatus] = useState<StateDetailStatus>("idle");
  const [flatStateAplusDetail, setFlatStateAplusDetail] = useState<FlatStateAplusReconciliation | null>(null);
  const [flatStateAplusStatus, setFlatStateAplusStatus] = useState<StateDetailStatus>("idle");
  const [directMappingAplusDetail, setDirectMappingAplusDetail] = useState<DirectMappingAplusReconciliation | null>(null);
  const [directMappingAplusStatus, setDirectMappingAplusStatus] = useState<StateDetailStatus>("idle");
  // Deliberately separate from gaBoundaryDetail/gaBoundaryStatus above, which belong to the state
  // drawer and get cleared whenever it closes. The home dashboard's findings must survive that —
  // see the "how come it reconnects every click" / caching work this pairs with.
  const [dashboardGaBoundary, setDashboardGaBoundary] = useState<GaBoundaryReconciliation | null>(null);
  // Every other wired state's (NJ + the 9 flat-rate states + FL/PA/OH direct-mapping states)
  // findings, fetched in one batch on dashboard load - same "survives drawer close" shape as
  // dashboardGaBoundary above, so a real finding stays visible in "Needs attention" without the
  // user having to open that specific state's drawer first.
  const [dashboardOtherFindings, setDashboardOtherFindings] = useState<JurisdictionFinding[]>([]);
  // Both start false and flip true (success or failure - either way, the fetch was attempted) the
  // first time their own refresh finishes. Needed because gaBoundaryDetail/dashboardOtherFindings
  // both start empty and take several seconds to populate live - without this, "Needs attention"
  // reads as 0 (or NC-only) for those first few seconds on every page load, then visibly jumps once
  // the real data lands. Gating the displayed count on both being loaded at least once means the
  // number is either "still loading" or the real settled value - never a misleadingly low one.
  const [gaBoundaryLoaded, setGaBoundaryLoaded] = useState(false);
  const [otherFindingsLoaded, setOtherFindingsLoaded] = useState(false);
  // Session-lifetime cache of state-drawer reads, keyed by state code. A ref (not state) so
  // populating it never triggers a re-render on its own — openState reads/writes it directly.
  const stateDrawerCacheRef = useRef<Map<string, StateDrawerCacheEntry>>(new Map());
  const [stateDrawerCheckedAt, setStateDrawerCheckedAt] = useState<number | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<ComparedCounty | null>(null);
  const [selectedCase, setSelectedCase] = useState<ResolvedCase | null>(null);
  const [reviewCases, setReviewCases] = useState<ReviewCase[]>([]);
  const [selectedReviewCase, setSelectedReviewCase] = useState<ReviewCase | null>(null);
  const [reviewStoreStatus, setReviewStoreStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ComparisonStatus | "all">("all");
  const [stateFilter, setStateFilter] = useState<"all" | "NC">("all");
  const [jurisdictionTypeFilter, setJurisdictionTypeFilter] = useState<"all" | "county">("all");
  const [effectiveFilter, setEffectiveFilter] = useState<EffectiveFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortBy, setSortBy] = useState<"county" | "ship-tos" | "effective">("ship-tos");

  useEffect(() => {
    const closeDrawer = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCounty(null);
        setSelectedCase(null);
        setSelectedReviewCase(null);
        setSelectedState(null);
        setOfficialStateDetail(null);
      }
    };
    window.addEventListener("keydown", closeDrawer);
    return () => window.removeEventListener("keydown", closeDrawer);
  }, []);

  const refreshReviewCases = useCallback(async () => {
    const apiBase = apiBaseUrl();
    if (!apiBase) {
      setReviewStoreStatus("error");
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/reviews`, { headers: { "Content-Type": "application/json" } });
      if (!response.ok) throw new Error("Review history unavailable");
      const payload = await response.json() as { cases: ReviewCase[] };
      setReviewCases(payload.cases);
      setReviewStoreStatus("ready");
    } catch {
      setReviewStoreStatus("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshReviewCases(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshReviewCases]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const apiBase = apiBaseUrl();
      if (!apiBase) return;
      try {
        const response = await fetch(`${apiBase}/api/official/sources`, { headers: { "Content-Type": "application/json" } });
        if (response.ok) setOfficialSources(((await response.json()) as { sources: OfficialSourceState[] }).sources);
      } catch {
        // Source rollout status is supplementary; live A+ coverage remains available.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // The state-drawer cache added to openState() below (unrelated to this callback) throws off
  // the React Compiler's cross-function static analysis here; this function's own body and []
  // deps are unchanged and correct — verified by bisecting the diff against the last commit,
  // where this callback alone lints clean. useCallback([]) still guarantees a stable reference
  // at runtime either way.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const refreshLiveSnapshot = useCallback(async () => {
    setConnectorStatus((current) => current === "live" ? "refreshing" : "connecting");
    setConnectorMessage("Reading and validating A+ tax bodies…");
    const apiBase = apiBaseUrl();
    if (!apiBase) {
      setConnectorStatus("fallback");
      setConnectorMessage("A backend connector has not been configured for this environment.");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 65_000);
    setTaxTreatmentStatus("loading");
    try {
      const requestOptions = { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal };
      const [ratesResponse, statesResponse, officialResponse, treatmentResponse] = await Promise.all([
        fetch(`${apiBase}/api/aplus/tax-bodies`, requestOptions),
        fetch(`${apiBase}/api/aplus/states`, requestOptions),
        fetch(`${apiBase}/api/official/nc-rates`, requestOptions).catch(() => null),
        fetch(`${apiBase}/api/aplus/tax-treatment`, requestOptions).catch(() => null),
      ]);
      if (!ratesResponse.ok || !statesResponse.ok) throw new Error("A+ connector returned an unavailable response.");
      const [nextSnapshot, nextStateCoverage] = await Promise.all([
        ratesResponse.json() as Promise<LiveAPlusSnapshot>,
        statesResponse.json() as Promise<StateCoverageSnapshot>,
      ]);
      if (nextSnapshot.standardRows.length !== 100) throw new Error("A+ connector returned an incomplete county snapshot.");
      const liveCoverage = mergeRateRows(initializeComparisons(countyCoverage), nextSnapshot.standardRows);
      let officialComparison: OfficialNcSnapshot | null = null;
      if (officialResponse?.ok) officialComparison = await officialResponse.json() as OfficialNcSnapshot;
      if (treatmentResponse?.ok) {
        setTaxTreatmentSnapshot(await treatmentResponse.json() as TaxTreatmentSnapshot);
        setTaxTreatmentStatus("ready");
      } else {
        setTaxTreatmentStatus("error");
      }
      setActiveCountyCoverage(officialComparison ? mergeOfficialRates(liveCoverage, officialComparison) : liveCoverage);
      setLiveSnapshot(nextSnapshot);
      setOfficialSnapshot(officialComparison);
      setStateCoverage(nextStateCoverage);
      setAppliedImport(null);
      setSelectedCounty(null);
      setConnectorStatus("live");
      setConnectorMessage(officialComparison
        ? `Compared ${nextSnapshot.standardRows.length} A+ county rates with ${officialComparison.source}; ${nextStateCoverage.states.length} states have active A+ ship-tos.`
        : `Validated ${nextSnapshot.standardRows.length} NC county rates; the official NCDOR comparison is temporarily unavailable.`);
    } catch {
      setConnectorStatus("fallback");
      setConnectorMessage("Live A+ data is unavailable; the last validated built-in snapshot remains visible.");
      setTaxTreatmentStatus("error");
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  // Kept independent from refreshLiveSnapshot above (its own callback, its own try/catch) so a
  // Georgia failure can never affect NC's refresh, and so NC's memoized callback body is untouched.
  const refreshGaBoundary = useCallback(async () => {
    const apiBase = apiBaseUrl();
    if (!apiBase) {
      setGaBoundaryLoaded(true); // offline mode: no live source to wait on, so there's nothing to load
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/official/states/GA/boundary`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!response.ok) throw new Error("Georgia boundary reconciliation unavailable");
      setDashboardGaBoundary(await response.json() as GaBoundaryReconciliation);
    } catch {
      // The dashboard's Georgia findings simply hold their last known value on failure — same
      // fail-quiet-but-don't-guess behavior as the NC official-rate fetch a few lines up.
    } finally {
      setGaBoundaryLoaded(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshLiveSnapshot(), 0);
    const interval = window.setInterval(() => void refreshLiveSnapshot(), LIVE_REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [refreshLiveSnapshot]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshGaBoundary(), 0);
    const interval = window.setInterval(() => void refreshGaBoundary(), LIVE_REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [refreshGaBoundary]);

  // Kept independent from NC's and GA's refresh above for the same reason refreshGaBoundary is its
  // own callback: one wired state (or the whole batch) failing must never affect the others.
  const refreshOtherFindings = useCallback(async () => {
    const apiBase = apiBaseUrl();
    if (!apiBase) {
      setOtherFindingsLoaded(true); // offline mode: no live source to wait on, so there's nothing to load
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/official/findings`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!response.ok) throw new Error("Wired-state findings batch unavailable");
      const result = await response.json() as { findings: JurisdictionFinding[] };
      setDashboardOtherFindings(result.findings);
    } catch {
      // Holds its last known value on failure - same fail-quiet-but-don't-guess behavior as NC/GA.
    } finally {
      setOtherFindingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshOtherFindings(), 0);
    const interval = window.setInterval(() => void refreshOtherFindings(), LIVE_REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [refreshOtherFindings]);

  const reviewCasesByKey = useMemo(() => new Map(reviewCases.map((reviewCase) => [reviewCase.findingKey, reviewCase])), [reviewCases]);

  const filteredCounties = useMemo(() => {
    return activeCountyCoverage
      .filter((county) => {
        const reviewCase = reviewCasesByKey.get(reviewFindingKey(county));
        const effectiveState = county.comparisonStatus === "upcoming" ? "upcoming" : county.officialRate === null ? "undated" : "current";
        return matchesJurisdictionFilters({
          stateCode: "NC",
          jurisdictionType: "county",
          jurisdictionName: `${county.county} County`,
          taxBody: county.taxBody,
          comparisonStatus: county.comparisonStatus,
          effectiveState,
          sourceStatus: county.officialRate === null ? "unavailable" : "validated",
          reviewStatus: reviewCase?.status ?? null,
        }, {
          query,
          state: stateFilter,
          jurisdictionType: jurisdictionTypeFilter,
          comparison: statusFilter,
          effective: effectiveFilter,
          source: sourceFilter,
          review: reviewFilter,
        });
      })
      .sort((a, b) => sortBy === "county"
        ? a.county.localeCompare(b.county)
        : sortBy === "effective"
          ? (a.futureChanges[0]?.effectiveDate ?? a.recentEffectiveDate ?? "9999").localeCompare(b.futureChanges[0]?.effectiveDate ?? b.recentEffectiveDate ?? "9999")
          : b.activeShipTos - a.activeShipTos || a.county.localeCompare(b.county));
  }, [activeCountyCoverage, effectiveFilter, jurisdictionTypeFilter, query, reviewCasesByKey, reviewFilter, sortBy, sourceFilter, stateFilter, statusFilter]);

  const openFindings = useMemo(
    () => activeCountyCoverage.filter((county) => county.comparisonStatus === "mismatch" && county.activeShipTos > 0),
    [activeCountyCoverage],
  );
  const upcomingFindings = useMemo(
    () => activeCountyCoverage.filter((county) => county.comparisonStatus === "upcoming"),
    [activeCountyCoverage],
  );
  const resolvedReviewCases = useMemo(() => reviewCases.filter((reviewCase) => reviewCase.status === "resolved" || reviewCase.status === "not_applicable"), [reviewCases]);

  // NC's own comparisonStatus/ComparedCounty pipeline above is untouched. This just adapts its
  // output — and Georgia's separately-fetched boundary reconciliation — into the shared shape the
  // generalized rate-change inbox renders, so a state doesn't need a bespoke inbox to appear in it.
  const toNcFinding = useCallback((county: ComparedCounty): JurisdictionFinding => ({
    id: `NC-${county.taxBody}`,
    reviewFindingKey: reviewFindingKey(county),
    stateCode: "NC",
    jurisdictionLabel: `${county.county} County`,
    taxBody: county.taxBody,
    officialRate: county.officialRate,
    aplusRate: county.currentRate,
    rateDifference: county.rateDifference,
    activeShipTos: county.activeShipTos,
    comparisonStatus: county.comparisonStatus,
    confidence: "confirmed",
    confidenceNote: null,
    effectiveDate: county.futureChanges[0]?.effectiveDate ?? county.recentEffectiveDate ?? null,
    sourceUrl: county.officialSourceUrl,
  }), []);
  const gaFindings = useMemo(
    () => gaFindingsFromReconciliation(dashboardGaBoundary?.taxBodyFindings),
    [dashboardGaBoundary],
  );
  const inboxFindings = useMemo(
    () => combineFindings([...openFindings, ...upcomingFindings].map(toNcFinding), gaFindings, dashboardOtherFindings),
    [dashboardOtherFindings, gaFindings, openFindings, toNcFinding, upcomingFindings],
  );
  const treatmentByTaxBody = useMemo(() => new Map((taxTreatmentSnapshot?.taxBodies ?? [])
    .filter((row): row is TaxBodyTreatment & { taxBody: string } => Boolean(row.taxBody))
    .map((row) => [row.taxBody, new Map(row.treatments.map((treatment) => [treatment.treatmentCode, treatment.activeShipTos]))])), [taxTreatmentSnapshot]);
  const treatmentAwareInboxFindings = useMemo<TreatmentAwareFinding[]>(() => inboxFindings.map((finding) => {
    const treatments = treatmentByTaxBody.get(finding.taxBody);
    if (!treatments) return { ...finding, totalAssignedShipTos: finding.activeShipTos, rateRiskShipTos: null, neverTaxedShipTos: null, lineLevelReviewShipTos: null, otherTreatmentShipTos: null };
    const rateRiskShipTos = treatments.get("0") ?? 0;
    const neverTaxedShipTos = treatments.get("3") ?? 0;
    const lineLevelReviewShipTos = treatments.get("J") ?? 0;
    const otherTreatmentShipTos = treatments.get("other") ?? 0;
    return {
      ...finding,
      totalAssignedShipTos: rateRiskShipTos + neverTaxedShipTos + lineLevelReviewShipTos + otherTreatmentShipTos,
      rateRiskShipTos,
      neverTaxedShipTos,
      lineLevelReviewShipTos,
      otherTreatmentShipTos,
      activeShipTos: rateRiskShipTos,
    };
  }), [inboxFindings, treatmentByTaxBody]);
  const rateRiskFindings = useMemo(() => treatmentAwareInboxFindings
    .filter((finding) => finding.rateRiskShipTos === null || finding.rateRiskShipTos > 0)
    .sort((left, right) => right.activeShipTos - left.activeShipTos || left.jurisdictionLabel.localeCompare(right.jurisdictionLabel)), [treatmentAwareInboxFindings]);
  const lineLevelOnlyFindings = useMemo(() => treatmentAwareInboxFindings.filter((finding) => finding.rateRiskShipTos === 0 && (finding.lineLevelReviewShipTos ?? 0) > 0), [treatmentAwareInboxFindings]);
  const neverTaxedOnlyFindings = useMemo(() => treatmentAwareInboxFindings.filter((finding) => finding.rateRiskShipTos === 0 && (finding.lineLevelReviewShipTos ?? 0) === 0 && (finding.neverTaxedShipTos ?? 0) > 0), [treatmentAwareInboxFindings]);
  const needsAttentionCount = rateRiskFindings.length;
  // GA and the other-states batch both take several seconds to load and start empty - without this,
  // needsAttentionCount reads as NC-only (or 0) for the first few seconds of every page load, then
  // visibly jumps once they land. Gating the displayed count on this means it's either a clear
  // "loading" state or the real settled number - never a misleadingly low one.
  const dashboardCountsReady = gaBoundaryLoaded && otherFindingsLoaded && taxTreatmentStatus !== "idle" && taxTreatmentStatus !== "loading";
  const openFinding = (finding: JurisdictionFinding) => {
    if (finding.stateCode === "NC") {
      const county = activeCountyCoverage.find((candidate) => candidate.taxBody === finding.taxBody);
      if (county) setSelectedCounty(county);
      return;
    }
    void openState(finding.stateCode);
  };

  const saveCountyReview = async (county: ComparedCounty, status: ReviewStatus, actor: "Ana" | "Liv", note: string) => {
    const apiBase = apiBaseUrl();
    if (!apiBase) throw new Error("TaxAP review storage is not configured.");
    const findingType = county.comparisonStatus === "upcoming" ? "upcoming" : county.comparisonStatus === "recent-match" ? "recent-match" : "mismatch";
    const response = await fetch(`${apiBase}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        findingKey: reviewFindingKey(county),
        stateCode: "NC",
        jurisdiction: `${county.county} County`,
        taxBody: county.taxBody,
        findingType,
        aplusRate: county.currentRate,
        officialRate: county.officialRate,
        effectiveDate: reviewDateKey(county),
        sourceUrl: county.officialSourceUrl,
        status,
        actor,
        note,
      }),
    });
    const payload = await response.json() as { case?: ReviewCase; error?: string };
    if (!response.ok || !payload.case) throw new Error(payload.error || "The review decision could not be saved.");
    setReviewCases((current) => [payload.case!, ...current.filter((item) => item.findingKey !== payload.case!.findingKey)]);
    setSelectedReviewCase((current) => current?.findingKey === payload.case!.findingKey ? payload.case! : current);
    setReviewStoreStatus("ready");
    return payload.case;
  };

  const stateSummariesByCode = useMemo(
    () => new Map((stateCoverage?.states ?? []).map((state) => [state.stateCode, state])),
    [stateCoverage],
  );
  const officialSourcesByCode = useMemo(() => new Map(officialSources.map((source) => [source.stateCode, source])), [officialSources]);
  const officialRolloutRows = useMemo(() => officialSources.map((source) => ({
    ...source,
    activeShipTos: stateSummariesByCode.get(source.stateCode)?.activeShipTos ?? 0,
  })).sort((a, b) => b.activeShipTos - a.activeShipTos || a.stateCode.localeCompare(b.stateCode)), [officialSources, stateSummariesByCode]);

  const openState = async (stateCode: string, options: { forceRefresh?: boolean } = {}) => {
    const summary = stateSummariesByCode.get(stateCode);
    if (!summary) return;
    setSelectedState(summary);

    const cacheKey = stateCode.toUpperCase();
    const cached = stateDrawerCacheRef.current.get(cacheKey);
    const cacheIsFresh = Boolean(cached) && new Date().getTime() - cached!.fetchedAt < LIVE_REFRESH_INTERVAL_MS;
    if (cached && cacheIsFresh && !options.forceRefresh) {
      setStateDetail(cached.stateDetail);
      setStateDetailStatus(cached.stateDetailStatus);
      setOfficialStateDetail(cached.officialStateDetail);
      setOfficialStateStatus(cached.officialStateStatus);
      setGaBoundaryDetail(cached.gaBoundaryDetail);
      setGaBoundaryStatus(cached.gaBoundaryStatus);
      setFlatStateAplusDetail(cached.flatStateAplusDetail);
      setFlatStateAplusStatus(cached.flatStateAplusStatus);
      setDirectMappingAplusDetail(cached.directMappingAplusDetail);
      setDirectMappingAplusStatus(cached.directMappingAplusStatus);
      setStateDrawerCheckedAt(cached.fetchedAt);
      return;
    }

    const isFlatStateAplus = FLAT_STATE_APLUS_STATES.has(cacheKey);
    const isDirectMappingAplus = DIRECT_MAPPING_APLUS_STATES.has(cacheKey);
    const hasAplusEndpoint = isFlatStateAplus || isDirectMappingAplus;
    setStateDetail(null);
    setStateDetailStatus("loading");
    setOfficialStateDetail(null);
    setOfficialStateStatus("loading");
    setGaBoundaryDetail(null);
    setGaBoundaryStatus(cacheKey === "GA" ? "loading" : "idle");
    setFlatStateAplusDetail(null);
    setFlatStateAplusStatus(isFlatStateAplus ? "loading" : "idle");
    setDirectMappingAplusDetail(null);
    setDirectMappingAplusStatus(isDirectMappingAplus ? "loading" : "idle");
    const apiBase = apiBaseUrl();
    if (!apiBase) {
      setStateDetailStatus("error");
      setOfficialStateStatus("error");
      if (cacheKey === "GA") setGaBoundaryStatus("error");
      if (isFlatStateAplus) setFlatStateAplusStatus("error");
      if (isDirectMappingAplus) setDirectMappingAplusStatus("error");
      return;
    }
    const officialRequest = fetch(`${apiBase}/api/official/states/${encodeURIComponent(stateCode)}`, { method: "POST", headers: { "Content-Type": "application/json" } }).catch(() => null);
    const boundaryRequest = cacheKey === "GA"
      ? fetch(`${apiBase}/api/official/states/GA/boundary`, { method: "POST", headers: { "Content-Type": "application/json" } }).catch(() => null)
      : null;
    const aplusEndpointRequest = hasAplusEndpoint
      ? fetch(`${apiBase}/api/official/states/${encodeURIComponent(stateCode)}/aplus`, { method: "POST", headers: { "Content-Type": "application/json" } }).catch(() => null)
      : null;

    let nextStateDetail: StateDetail | null = null;
    let nextStateDetailStatus: StateDetailStatus = "error";
    let pendingFlatStateAplusDetail: FlatStateAplusReconciliation | null = null;
    let pendingDirectMappingAplusDetail: DirectMappingAplusReconciliation | null = null;
    try {
      const response = hasAplusEndpoint && aplusEndpointRequest
        ? await aplusEndpointRequest
        : await fetch(`${apiBase}/api/aplus/states/${encodeURIComponent(stateCode)}`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!response?.ok) throw new Error("State detail unavailable");
      if (isFlatStateAplus) {
        pendingFlatStateAplusDetail = await response.json() as FlatStateAplusReconciliation;
        nextStateDetail = pendingFlatStateAplusDetail.stateDetail;
      } else if (isDirectMappingAplus) {
        pendingDirectMappingAplusDetail = await response.json() as DirectMappingAplusReconciliation;
        nextStateDetail = pendingDirectMappingAplusDetail.stateDetail;
      } else {
        nextStateDetail = await response.json() as StateDetail;
      }
      nextStateDetailStatus = "ready";
    } catch {
      nextStateDetailStatus = "error";
    }
    setStateDetail(nextStateDetail);
    setStateDetailStatus(nextStateDetailStatus);

    let nextOfficialDetail: OfficialStateSnapshot | null = null;
    let nextOfficialStatus: StateDetailStatus = "error";
    const officialResponse = await officialRequest;
    if (officialResponse?.ok) {
      nextOfficialDetail = await officialResponse.json() as OfficialStateSnapshot;
      nextOfficialStatus = "ready";
    }
    setOfficialStateDetail(nextOfficialDetail);
    setOfficialStateStatus(nextOfficialStatus);

    let nextGaDetail: GaBoundaryReconciliation | null = null;
    let nextGaStatus: StateDetailStatus = cacheKey === "GA" ? "error" : "idle";
    if (boundaryRequest) {
      const boundaryResponse = await boundaryRequest;
      if (boundaryResponse?.ok) {
        nextGaDetail = await boundaryResponse.json() as GaBoundaryReconciliation;
        nextGaStatus = "ready";
      }
      setGaBoundaryDetail(nextGaDetail);
      setGaBoundaryStatus(nextGaStatus);
    }

    let nextFlatStateAplusDetail: FlatStateAplusReconciliation | null = null;
    let nextFlatStateAplusStatus: StateDetailStatus = isFlatStateAplus ? "error" : "idle";
    if (isFlatStateAplus) {
      if (pendingFlatStateAplusDetail) {
        nextFlatStateAplusDetail = pendingFlatStateAplusDetail;
        nextFlatStateAplusStatus = "ready";
      }
      setFlatStateAplusDetail(nextFlatStateAplusDetail);
      setFlatStateAplusStatus(nextFlatStateAplusStatus);
    }

    let nextDirectMappingAplusDetail: DirectMappingAplusReconciliation | null = null;
    let nextDirectMappingAplusStatus: StateDetailStatus = isDirectMappingAplus ? "error" : "idle";
    if (isDirectMappingAplus) {
      if (pendingDirectMappingAplusDetail) {
        nextDirectMappingAplusDetail = pendingDirectMappingAplusDetail;
        nextDirectMappingAplusStatus = "ready";
      }
      setDirectMappingAplusDetail(nextDirectMappingAplusDetail);
      setDirectMappingAplusStatus(nextDirectMappingAplusStatus);
    }

    // Cached for the rest of the session (or until LIVE_REFRESH_INTERVAL_MS elapses, or the
    // drawer's own Refresh control is used) so reopening the same state doesn't re-read A+.
    const fetchedAt = new Date().getTime();
    stateDrawerCacheRef.current.set(cacheKey, {
      stateDetail: nextStateDetail,
      stateDetailStatus: nextStateDetailStatus,
      officialStateDetail: nextOfficialDetail,
      officialStateStatus: nextOfficialStatus,
      gaBoundaryDetail: nextGaDetail,
      gaBoundaryStatus: nextGaStatus,
      flatStateAplusDetail: nextFlatStateAplusDetail,
      flatStateAplusStatus: nextFlatStateAplusStatus,
      directMappingAplusDetail: nextDirectMappingAplusDetail,
      directMappingAplusStatus: nextDirectMappingAplusStatus,
      fetchedAt,
    });
    setStateDrawerCheckedAt(fetchedAt);
  };

  const navigate = (view: View) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const applyImportedSnapshot = (result: APlusImportResult) => {
    if (result.errors.length > 0 || result.standardRows.length !== 100) return;
    const importedCoverage = mergeRateRows(initializeComparisons(countyCoverage), result.standardRows);
    setActiveCountyCoverage(officialSnapshot ? mergeOfficialRates(importedCoverage, officialSnapshot) : importedCoverage);
    setAppliedImport({
      fileName: result.fileName,
      importedOn: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    });
  };

  const resetImportedSnapshot = () => {
    const restoredCoverage = liveSnapshot ? mergeRateRows(initializeComparisons(countyCoverage), liveSnapshot.standardRows) : initializeComparisons(countyCoverage);
    setActiveCountyCoverage(officialSnapshot ? mergeOfficialRates(restoredCoverage, officialSnapshot) : restoredCoverage);
    setAppliedImport(null);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate("dashboard")} aria-label="TaxAP dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element -- the approved SVG must retain its native aspect ratio */}
          <img className="atlantic-logo" src="/atlantic-packaging-horizontal.svg" alt="Atlantic Packaging" />
          <span className="product-lockup">
            <strong>TaxAP</strong>
            <small>Sales &amp; use tax monitoring</small>
          </span>
        </button>
        <nav className="nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? "active" : ""}
              type="button"
              key={item.id}
              onClick={() => navigate(item.id)}
              aria-current={activeView === item.id ? "page" : undefined}
            >
              {item.label}
              {item.id === "attention" && dashboardCountsReady && needsAttentionCount > 0 && <span className="nav-count">{needsAttentionCount}</span>}
              {item.id === "upcoming" && upcomingFindings.length > 0 && <span className="nav-count">{upcomingFindings.length}</span>}
            </button>
          ))}
        </nav>
        <div className={`sync-status sync-${appliedImport ? "import" : connectorStatus}`} title={appliedImport ? `Session import: ${appliedImport.fileName}` : connectorMessage}>
          <span className="sync-dot" />
          {appliedImport
            ? "Admin import active"
            : connectorStatus === "live"
              ? "Live A+ connected"
              : connectorStatus === "refreshing"
                ? "Refreshing A+…"
                : connectorStatus === "connecting"
                  ? OFFLINE_MODE ? "Offline design mode" : "Connecting to A+…"
                  : "Validated fallback"}
        </div>
      </header>

      {activeView === "dashboard" && (
        <section className="page-content" aria-labelledby="overview-title">
          <div className="intro">
            <h1 id="overview-title" className="sr-only">TaxAP dashboard</h1>
            <button className="primary-button" type="button" onClick={() => navigate("attention")}>
              Open review queue <span aria-hidden="true">→</span>
            </button>
          </div>

          <SummaryStats
            openCount={dashboardCountsReady ? needsAttentionCount : null}
            upcomingCount={dashboardCountsReady ? upcomingFindings.length : null}
            affectedShipTos={dashboardCountsReady ? rateRiskFindings.reduce((total, finding) => total + finding.activeShipTos, 0) : null}
            connectedSources={officialSources.filter((source) => source.status === "connected").length}
            lastRefresh={officialSnapshot?.retrievedAt ?? null}
          />

          <div className={`connector-banner connector-${connectorStatus}`} role="status">
            <div>
              <span className="section-label">A+ data connection</span>
              <strong>{connectorStatus === "live" || connectorStatus === "refreshing" ? "Read-only A+ connector active" : OFFLINE_MODE ? "Production connection intentionally disabled" : connectorStatus === "connecting" ? "Connecting to A+" : "Using the validated fallback snapshot"}</strong>
              <p>{connectorMessage}{liveSnapshot ? ` Last successful read: ${new Date(liveSnapshot.retrievedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.` : ""}</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => { void refreshLiveSnapshot(); void refreshGaBoundary(); }} disabled={OFFLINE_MODE || connectorStatus === "connecting" || connectorStatus === "refreshing"}>{OFFLINE_MODE ? "Supervised refresh only" : connectorStatus === "refreshing" ? "Refreshing…" : "Refresh now"}</button>
          </div>

          <TaxTreatmentPanel snapshot={taxTreatmentSnapshot} status={taxTreatmentStatus} connectorStatus={connectorStatus} />

          <section className="dashboard-grid">
            <article className="priority-card" aria-labelledby="priority-title">
              <div className="card-heading">
                <div>
                  <span className="section-label">Rate-change inbox</span>
                  <h2 id="priority-title">Published changes and A+ impact</h2>
                </div>
                <button className="text-button" type="button" onClick={() => navigate("jurisdictions")}>View all jurisdictions →</button>
              </div>
              <div className="inbox-columns" aria-label="How TaxAP classifies a published change">
                <div><span>01</span><strong>Published</strong><small>Official source reports a rate or effective date.</small></div>
                <div><span>02</span><strong>Relevant</strong><small>Active Atlantic ship-tos use the jurisdiction.</small></div>
                <div><span>03</span><strong>Compared</strong><small>Validated official and A+ rates are evaluated.</small></div>
                <div><span>04</span><strong>Reviewed</strong><small>Ana or Liv records the outcome in TaxAP.</small></div>
              </div>
              <div className="priority-table-wrap">
                <table className="priority-table">
                  <thead><tr><th>Effective</th><th>State</th><th>Jurisdiction</th><th>Published rate</th><th>A+ rate</th><th>Rate-risk ship-tos</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
                  <tbody>
                    {rateRiskFindings.length > 0 ? rateRiskFindings.slice(0, 6).map((finding) => (
                      <tr key={finding.id}>
                        <td>{finding.effectiveDate ?? "Current"}</td>
                        <td>{finding.stateCode}</td>
                        <td><button className="table-link" type="button" onClick={() => openFinding(finding)}><strong>{finding.jurisdictionLabel}</strong><small>{finding.taxBody}</small></button></td>
                        <td>{finding.officialRate === null ? "Unavailable" : formatRate(finding.officialRate)}</td>
                        <td>{finding.aplusRate === null ? "Unavailable" : formatRate(finding.aplusRate)}</td>
                        <td>{finding.activeShipTos.toLocaleString()}{(finding.lineLevelReviewShipTos ?? 0) > 0 && <small className="treatment-impact-note">+ {finding.lineLevelReviewShipTos?.toLocaleString()} line-level</small>}</td>
                        <td><ComparisonPill status={finding.comparisonStatus} />{finding.confidence === "unverified" && <span className="rate-warning" title={finding.confidenceNote ?? undefined}> !</span>}</td>
                        <td><button className="icon-button" type="button" onClick={() => openFinding(finding)} aria-label={`Open ${finding.jurisdictionLabel}`}>›</button></td>
                      </tr>
                    )) : !dashboardCountsReady ? (
                      <tr><td colSpan={8}><div className="inbox-empty"><span aria-hidden="true">…</span><div><strong>Loading every connected state&apos;s findings…</strong><p>Georgia&apos;s boundary match and the other wired states are still being compared against A+ — this can take a few seconds.</p></div></div></td></tr>
                    ) : (
                      <tr><td colSpan={8}><div className="inbox-empty"><span aria-hidden="true">✓</span><div><strong>No confirmed differences or upcoming changes</strong><p>{officialSnapshot ? "Every validated current NC rate matches A+, and Georgia's boundary reconciliation has no unresolved rate difference." : "The last validated snapshot has no open findings. Connect official sources during supervised validation to check for newer publications."}</p></div></div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {dashboardCountsReady && (lineLevelOnlyFindings.length > 0 || neverTaxedOnlyFindings.length > 0) && (
                <div className="treatment-queue-note" role="status"><strong>Treatment-scoped findings:</strong>{lineLevelOnlyFindings.length > 0 && <> {lineLevelOnlyFindings.length} {lineLevelOnlyFindings.length === 1 ? "finding requires" : "findings require"} line-level review, so no header-level rate conclusion is shown.</>}{neverTaxedOnlyFindings.length > 0 && <> {lineLevelOnlyFindings.length > 0 ? " " : " "}{neverTaxedOnlyFindings.length} {neverTaxedOnlyFindings.length === 1 ? "finding is" : "findings are"} assigned only to never-taxed ship-tos and excluded from rate-risk impact.</>}</div>
              )}
              <div className="recent-publication">
                <span className="status-mark">✓</span>
                <div><span className="section-label">Recently handled publication</span><strong>Mecklenburg County · 8.25% effective July 1, 2026</strong><p>A+ now matches and the prior-rate invoices were handled by the tax team.</p></div>
                <button className="secondary-button" type="button" onClick={() => setSelectedCase(resolvedCases[0])}>View evidence</button>
              </div>
            </article>

            <aside className="alerts-card">
              <div className="card-heading alert-heading">
                <div>
                  <span className="section-label">Review activity</span>
                  <h2>{!dashboardCountsReady ? "Loading…" : needsAttentionCount > 0 ? `${needsAttentionCount} rate ${needsAttentionCount === 1 ? "difference" : "differences"}` : upcomingFindings.length > 0 ? `${upcomingFindings.length} upcoming ${upcomingFindings.length === 1 ? "change" : "changes"}` : "No open findings"}</h2>
                </div>
                <span className={`count-pill ${needsAttentionCount === 0 ? "quiet" : ""}`}>{dashboardCountsReady ? needsAttentionCount : "…"}</span>
              </div>
              {!dashboardCountsReady ? (
                <div className="empty-queue compact"><span aria-hidden="true">…</span><div><strong>Loading review activity…</strong><p>Georgia&apos;s boundary match and the other wired states are still being compared against A+.</p></div></div>
              ) : rateRiskFindings.length === 0 ? (
                <div className="empty-queue compact"><span aria-hidden="true">✓</span><div><strong>The approval queue is clear</strong><p>{officialSnapshot ? "Every current NC county rate in A+ matches the validated NCDOR table, and Georgia's boundary reconciliation has no unresolved difference." : "The official NCDOR comparison is not currently available."}</p></div></div>
              ) : rateRiskFindings.slice(0, 4).map((finding) => (
                <button className="alert-row" type="button" key={finding.id} onClick={() => openFinding(finding)}>
                  <span className={`alert-icon comparison-${finding.comparisonStatus}`} aria-hidden="true">{finding.comparisonStatus === "mismatch" ? "!" : "↗"}</span>
                  <span className="alert-copy"><strong>{finding.jurisdictionLabel}</strong><span>{finding.stateCode} · A+ {finding.aplusRate === null ? "pending" : formatRate(finding.aplusRate)} · Official {finding.officialRate === null ? "pending" : formatRate(finding.officialRate)}</span><small>{comparisonLabels[finding.comparisonStatus]}{(finding.lineLevelReviewShipTos ?? 0) > 0 ? ` · ${finding.lineLevelReviewShipTos?.toLocaleString()} line-level review` : ""}{finding.confidence === "unverified" ? " · unverified jurisdiction match" : ""}</small></span>
                  <span className="shipto-count"><strong>{finding.activeShipTos.toLocaleString()}</strong><small>ship-tos</small></span><span className="row-arrow" aria-hidden="true">›</span>
                </button>
              ))}
               <div className="recent-heading"><span>Most recent resolution</span><button type="button" onClick={() => navigate("history")}>View history</button></div>
              {resolvedCases.map((resolvedCase) => (
                <button className="alert-row" type="button" key={resolvedCase.id} onClick={() => setSelectedCase(resolvedCase)}>
                  <span className="alert-icon resolved" aria-hidden="true">✓</span>
                  <span className="alert-copy">
                    <strong>{resolvedCase.place}</strong>
                    <span>{resolvedCase.previousRate} → {resolvedCase.currentRate}</span>
                    <small>{resolvedCase.resolution}</small>
                  </span>
                  <span className="shipto-count"><strong>{resolvedCase.invoices}</strong><small>invoices</small></span>
                  <span className="row-arrow" aria-hidden="true">›</span>
                </button>
              ))}
              <div className="source-note">
                <span className="source-icon">i</span>
                <div><strong>{connectorStatus === "live" && officialSnapshot ? "Live A+ and official NCDOR comparison" : "Last validated rate snapshot"}</strong><p>{officialSnapshot ? `${officialSnapshot.rates.length} official county rates preserved for ${officialSnapshot.effectivePeriod}. Refresh date: ${new Date(officialSnapshot.retrievedAt).toLocaleDateString("en-US")}.` : "Official comparison unavailable; TaxAP did not infer a result."}</p></div>
              </div>
            </aside>
          </section>

          <AppFooter />
        </section>
      )}

      {activeView === "jurisdictions" && (
        <section className="page-content view-page" aria-labelledby="jurisdictions-title">
          <PageHeading
            titleId="jurisdictions-title"
            eyebrow="Searchable rate inventory"
            title="All jurisdictions"
            description="Search the current jurisdiction inventory and open connected state sources for validated state, county, city, and special-jurisdiction detail. A+ comparisons remain separate until jurisdiction matching is validated."
            action={<button className="secondary-button export-button" type="button" onClick={() => downloadCoverageCsv(activeCountyCoverage, new Date().toISOString().slice(0, 10))}>Export aggregate CSV</button>}
          />
          <div className="coverage-summary">
            <div><strong>100</strong><span>validated NC counties</span></div>
            <div><strong>93</strong><span>with active ship-tos</span></div>
            <div><strong>{officialSources.filter((source) => source.status === "connected").length}</strong><span>official state adapters</span></div>
            <p>The table shows the last locally validated NC comparison evidence. Connected state inventories are available through the state drill-down; Georgia jurisdiction components require a supervised A+ reconciliation before comparison.</p>
          </div>
          <div className="table-card">
            <div className="table-toolbar jurisdiction-toolbar">
              <label className="search-field">
                <span>Search</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jurisdiction or tax body…" />
              </label>
              <label>
                <span>State</span>
                <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as "all" | "NC")}><option value="all">All available</option><option value="NC">North Carolina</option></select>
              </label>
              <label>
                <span>Jurisdiction</span>
                <select value={jurisdictionTypeFilter} onChange={(event) => setJurisdictionTypeFilter(event.target.value as "all" | "county")}><option value="all">All types</option><option value="county">County</option></select>
              </label>
              <label>
                <span>Comparison</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ComparisonStatus | "all")}>
                  <option value="all">All comparisons</option>
                  <option value="matched">A+ matches</option>
                  <option value="recent-match">Recent change matched</option>
                  <option value="mismatch">A+ differs</option>
                  <option value="upcoming">Upcoming change</option>
                  <option value="not-checked">Not checked</option>
                </select>
              </label>
              <label><span>Effective date</span><select value={effectiveFilter} onChange={(event) => setEffectiveFilter(event.target.value as "all" | "current" | "upcoming" | "undated")}><option value="all">Any date</option><option value="current">Current</option><option value="upcoming">Upcoming</option><option value="undated">Unavailable</option></select></label>
              <label><span>Review</span><select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}><option value="all">Any review status</option><option value="unreviewed">Unreviewed</option><option value="new">New</option><option value="in_review">In review</option><option value="approved">Approved</option><option value="resolved">Resolved</option><option value="not_applicable">Not applicable</option></select></label>
              <label><span>Official source</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as "all" | "validated" | "unavailable")}><option value="all">Any source status</option><option value="validated">Validated</option><option value="unavailable">Unavailable</option></select></label>
              <label>
                <span>Sort</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "county" | "ship-tos" | "effective")}>
                  <option value="ship-tos">Most ship-tos</option>
                  <option value="county">Jurisdiction A–Z</option>
                  <option value="effective">Effective date</option>
                </select>
              </label>
            </div>
            <div className="result-count">Showing {filteredCounties.length} of 100 available jurisdictions</div>
            <div className="table-scroll">
              <table className="coverage-table jurisdiction-table">
                <thead><tr><th>Effective</th><th>State</th><th>Jurisdiction</th><th>Type</th><th>A+ tax body</th><th>Official rate</th><th>A+ rate</th><th>Difference</th><th>Ship-tos</th><th>Source</th><th>Review</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
                <tbody>
                  {filteredCounties.map((county) => (
                    <tr key={county.taxBody}>
                      <td>{county.futureChanges[0]?.effectiveDate ?? county.recentEffectiveDate ?? (county.officialRate === null ? "—" : "Current")}</td>
                      <td>NC</td>
                      <td><button type="button" className="table-link" onClick={() => setSelectedCounty(county)}>{county.county} County</button></td>
                      <td>County</td>
                      <td><code>{county.taxBody}</code></td>
                      <td>{county.officialRate === null ? "Unavailable" : formatRate(county.officialRate)}</td>
                      <td>{formatRate(county.currentRate)}</td>
                      <td>{county.rateDifference === null ? "—" : `${county.rateDifference > 0 ? "+" : ""}${county.rateDifference.toFixed(2)} pp`}</td>
                      <td>{county.activeShipTos.toLocaleString()}</td>
                      <td><span className={`source-rollout-status ${county.officialRate === null ? "source-rollout-research-needed" : "source-rollout-connected"}`}>{county.officialRate === null ? "Unavailable" : "Validated"}</span></td>
                      <td>{reviewCasesByKey.get(reviewFindingKey(county)) ? reviewStatusLabels[reviewCasesByKey.get(reviewFindingKey(county))!.status] : county.comparisonStatus === "recent-match" ? "Already handled" : "Unreviewed"}</td>
                      <td><ComparisonPill status={county.comparisonStatus} /></td>
                      <td><button className="icon-button" type="button" onClick={() => setSelectedCounty(county)} aria-label={`Open ${county.county} County`}>›</button></td>
                    </tr>
                  ))}
                  {filteredCounties.length === 0 && <tr><td colSpan={13}><div className="empty-table"><strong>No jurisdictions match these filters.</strong><span>Clear one or more filters to widen the results.</span></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <AppFooter />
        </section>
      )}

      {activeView === "attention" && (
        <section className="page-content view-page" aria-labelledby="attention-title">
          <PageHeading
            titleId="attention-title"
            eyebrow="Published changes and A+ impact"
            title="Needs attention"
            description="This is the same all-state rate-risk inbox shown on the dashboard. It includes only findings with one or more always-taxable ship-tos."
          />
          <section className="queue-panel attention-panel" aria-labelledby="attention-title">
            <div className="panel-heading"><div><span className="section-label">Action needed</span><h2>Rate-risk findings</h2></div><span className={`count-pill ${dashboardCountsReady && needsAttentionCount === 0 ? "quiet" : ""}`}>{dashboardCountsReady ? needsAttentionCount : "…"}</span></div>
            {!dashboardCountsReady ? (
              <div className="empty-queue large"><span aria-hidden="true">…</span><div><strong>Loading every connected state&apos;s findings…</strong><p>TaxAP is waiting for the Georgia boundary match and the other wired state comparisons before showing the review queue.</p></div></div>
            ) : rateRiskFindings.length === 0 ? (
              <div className="empty-queue large"><span aria-hidden="true">✓</span><div><strong>No rate-risk findings</strong><p>No confirmed rate difference currently affects an always-taxable ship-to in the completed all-state comparison.</p></div></div>
            ) : rateRiskFindings.map((finding) => {
                 const reviewCase = reviewCasesByKey.get(finding.reviewFindingKey);
                 return (
                   <button className="history-card finding-card" type="button" key={finding.id} onClick={() => openFinding(finding)}>
                    <span className={`status-mark comparison-${finding.comparisonStatus}`}>{finding.comparisonStatus === "upcoming" ? "↗" : "!"}</span>
                     <span><strong>{finding.jurisdictionLabel}</strong><small>{finding.stateCode} · {finding.taxBody} · {finding.activeShipTos.toLocaleString()} rate-risk ship-tos{reviewCase ? ` · ${reviewStatusLabels[reviewCase.status]}` : " · New"}{finding.confidence === "unverified" ? " · Needs jurisdiction review" : ""}</small></span>
                     <span className="history-rate">A+ {finding.aplusRate === null ? "Pending" : formatRate(finding.aplusRate)} → <strong>{finding.officialRate === null ? "Pending" : formatRate(finding.officialRate)}</strong></span>
                     <span className="row-arrow" aria-hidden="true">›</span>
                   </button>
                 );
            })}
          </section>
          <div className="safety-banner"><strong>Read-only boundary</strong><span>Review decisions are TaxAP records. Changes to tax-body rates still happen through the supported A+ GUI.</span></div>
          <AppFooter />
        </section>
      )}

      {activeView === "upcoming" && (
        <section className="page-content view-page" aria-labelledby="upcoming-title">
          <PageHeading
            titleId="upcoming-title"
            eyebrow="Published future effective dates"
            title="Upcoming changes"
            description="Government announcements stay separate from A+ discrepancies until their jurisdiction and configured rate are validated."
          />
          <section className="queue-panel" aria-labelledby="upcoming-title">
            <div className="panel-heading"><div><span className="section-label">Forward calendar</span><h2>Published changes</h2></div><span className={`count-pill ${upcomingFindings.length === 0 ? "quiet" : ""}`}>{upcomingFindings.length}</span></div>
            {upcomingFindings.length === 0 ? (
              <div className="empty-queue large"><span aria-hidden="true">—</span><div><strong>No future changes in the last validated snapshot</strong><p>This does not claim that no agency has published a newer change. Official-source refresh is intentionally deferred to supervised live validation.</p></div></div>
            ) : upcomingFindings.map((county) => (
              <button className="history-card finding-card" type="button" key={county.taxBody} onClick={() => setSelectedCounty(county)}>
                <span className="status-mark comparison-upcoming">↗</span>
                <span><strong>{county.county} County</strong><small>NC · {county.taxBody} · {county.activeShipTos.toLocaleString()} active ship-tos</small></span>
                <span className="history-rate">Effective <strong>{county.futureChanges[0]?.effectiveDate ?? county.scheduledEffectiveDate ?? "Pending"}</strong></span>
                <span className="row-arrow" aria-hidden="true">›</span>
              </button>
            ))}
          </section>
          <AppFooter />
        </section>
      )}

      {activeView === "history" && (
        <section className="page-content view-page" aria-labelledby="history-title">
          <PageHeading
            titleId="history-title"
            eyebrow="TaxAP audit trail"
            title="Review history"
            description="See who reviewed a publication, the evidence used, the decision, and when it was recorded."
          />
          <section className="queue-panel history-panel" aria-labelledby="history-title">
            <div className="panel-heading"><div><span className="section-label">Completed work</span><h2>Resolved findings</h2></div><span className="count-pill">{reviewStoreStatus === "ready" ? resolvedReviewCases.length : resolvedCases.length}</span></div>
            {reviewStoreStatus === "ready" && resolvedReviewCases.length > 0 ? resolvedReviewCases.map((reviewCase) => (
              <button className="history-card" type="button" key={reviewCase.findingKey} onClick={() => setSelectedReviewCase(reviewCase)}>
                <span className="status-mark">✓</span>
                <span><strong>{reviewCase.jurisdiction}</strong><small>{reviewCase.taxBody} · {reviewCase.assignedTo ? `resolved by ${reviewCase.assignedTo}` : "resolved"}</small></span>
                <span className="history-rate">A+ {reviewCase.aplusRate === null ? "—" : formatRate(reviewCase.aplusRate)} → <strong>{reviewCase.officialRate === null ? "—" : formatRate(reviewCase.officialRate)}</strong></span>
                <span className="row-arrow" aria-hidden="true">›</span>
              </button>
            )) : resolvedCases.map((resolvedCase) => (
              <button className="history-card" type="button" key={resolvedCase.id} onClick={() => setSelectedCase(resolvedCase)}>
                <span className="status-mark">✓</span><span><strong>{resolvedCase.place}</strong><small>{resolvedCase.taxBody} · verified fallback record</small></span><span className="history-rate">{resolvedCase.previousRate} → <strong>{resolvedCase.currentRate}</strong></span><span className="row-arrow" aria-hidden="true">›</span>
              </button>
            ))}
            {reviewStoreStatus === "error" && <p className="queue-storage-warning" role="status">Local review storage is unavailable because the connector is intentionally stopped; verified fallback history remains visible.</p>}
          </section>
          <AppFooter />
        </section>
      )}

      {activeView === "sources" && (
        <section className="page-content view-page" aria-labelledby="sources-title">
          <PageHeading
            titleId="sources-title"
            eyebrow="Evidence and freshness"
            title="Data sources"
            description="Every finding must identify the official rate source and the A+ snapshot used for comparison."
          />
          <div className="source-grid">
            {sources.map((source, index) => (
              <article className="source-card" key={source.name}>
                <div className="source-card-top"><span className="source-number">0{index + 1}</span><span className="source-status">✓ {index === 0 && officialSnapshot ? "100 counties validated" : source.status}</span></div>
                <h2>{source.name}</h2>
                <p>{source.purpose}</p>
                <dl><div><dt>Last checked</dt><dd>{index === 0 && officialSnapshot ? new Date(officialSnapshot.retrievedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : source.checkedOn}</dd></div><div><dt>Connection</dt><dd>{source.url ? "Official website" : "Verified read-only SQL"}</dd></div>{index === 0 && officialSnapshot && <><div><dt>Effective period</dt><dd>{officialSnapshot.effectivePeriod}</dd></div><div><dt>Evidence</dt><dd>{officialSnapshot.sourceHash ? <code>{officialSnapshot.sourceHash.slice(0, 12)}…</code> : "Validated offline snapshot"}</dd></div></>}</dl>
                {source.url ? <a href={source.url} target="_blank" rel="noreferrer">Open official source ↗</a> : <span className="source-private">Internal source · no browser link</span>}
              </article>
            ))}
          </div>
          <section className="table-card" aria-labelledby="official-rollout-title">
            <div className="panel-heading"><div><span className="section-label">Nationwide adapter registry</span><h2 id="official-rollout-title">Official rate-source rollout</h2></div><span className="count-pill">{officialRolloutRows.filter((row) => row.status === "connected").length} connected</span></div>
            <p className="table-card-lede">States are ordered by the dated aggregate A+ ship-to snapshot. “Machine source identified” means structured files exist but still need adapter validation; “Official document identified” means the authority publishes rates in a document that still needs a reliable parser.</p>
            <div className="table-scroll source-rollout-scroll">
              <table className="coverage-table source-rollout-table">
                <thead><tr><th>State</th><th>Active A+ ship-tos</th><th>Source status</th><th>Coverage</th><th>Official source</th></tr></thead>
                <tbody>{officialRolloutRows.map((source) => (
                  <tr key={source.stateCode}>
                    <td>{stateSummariesByCode.has(source.stateCode)
                      ? <button className="table-link" type="button" onClick={() => void openState(source.stateCode)}><strong>{source.stateCode}</strong> · {source.stateName}</button>
                      : <><strong>{source.stateCode}</strong> · {source.stateName}</>}</td>
                    <td>{source.activeShipTos.toLocaleString()}</td>
                      <td><span className={`source-rollout-status source-rollout-${source.status}`}>{source.status === "connected" ? "Connected" : source.status === "machine-readable-source" ? "Machine source identified" : source.status === "official-document-source" ? "Official document identified" : source.status === "no-general-sales-tax" ? "No general sales tax" : "Research needed"}</span></td>
                    <td>{source.coverage}</td>
                    <td>{source.sourceUrl ? <a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceName} ↗</a> : source.sourceName}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          <section className="table-card" aria-labelledby="special-tax-bodies-title">
            <div className="panel-heading"><div><span className="section-label">Outside the standard county inventory</span><h2 id="special-tax-bodies-title">Active special A+ tax bodies</h2></div><span className="count-pill quiet">{visibleSpecialTaxBodies.length}</span></div>
            <div className="table-scroll">
              <table className="coverage-table">
                <thead><tr><th>A+ tax body</th><th>A+ description</th><th>Configured rate</th><th>County handling</th></tr></thead>
                <tbody>{visibleSpecialTaxBodies.map((taxBody) => (
                  <tr key={taxBody.taxBody}><td><code>{taxBody.taxBody}</code></td><td>{taxBody.description}</td><td>{formatRate(taxBody.currentRate)}</td><td>Excluded</td></tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          <section className="source-next">
            <span className="section-label">Next application milestone</span>
            <h2>The nationwide source framework is underway.</h2>
            <p>Official-rate adapters are now connected for North Carolina, Georgia, California, Texas, Florida, Pennsylvania, Ohio, and Tennessee. Illinois and Virginia have machine-readable sources identified; South Carolina and Maryland have official publications identified. They remain intentionally unconnected until their formats and jurisdiction rules pass fixture validation. Jurisdiction-to-A+ matching outside NC and GA is still a separate step.</p>
            <ol><li><span>1</span>Read active A+ coverage</li><li><span>2</span>Validate official rates</li><li><span>3</span>Match jurisdictions</li><li><span>4</span>Review differences</li></ol>
          </section>
          <AppFooter />
        </section>
      )}

      {activeView === "import" && (
        <ImportSnapshotView
          result={importResult}
          appliedImport={appliedImport}
          onResult={setImportResult}
          onApply={applyImportedSnapshot}
          onReset={resetImportedSnapshot}
        />
      )}

      {selectedState && (
        <Drawer titleId="state-title" className="state-drawer" onClose={() => { setSelectedState(null); setStateDetail(null); setStateDetailStatus("idle"); setOfficialStateDetail(null); setOfficialStateStatus("idle"); setGaBoundaryDetail(null); setGaBoundaryStatus("idle"); setFlatStateAplusDetail(null); setFlatStateAplusStatus("idle"); setDirectMappingAplusDetail(null); setDirectMappingAplusStatus("idle"); setStateDrawerCheckedAt(null); }}>
          <div className="drawer-kicker"><span className="section-label">{connectorStatus === "live" ? "Live A+ state coverage" : "Validated A+ state snapshot"}</span><span className="status-badge">Read only</span></div>
          <h2 id="state-title">{STATE_NAME_BY_CODE.get(selectedState.stateCode) ?? selectedState.stateCode}</h2>
          <p className="drawer-lede">Active ship-to assignments and configured tax-body rates queried from A+. This is not yet a comparison with the state&apos;s official Department of Revenue rates.</p>
          <div className="drawer-refresh-row">
            {stateDrawerCheckedAt && <small>Checked {new Date(stateDrawerCheckedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · reused on reopen until refreshed</small>}
            <button className="secondary-button" type="button" disabled={stateDetailStatus === "loading"} onClick={() => void openState(selectedState.stateCode, { forceRefresh: true })}>{stateDetailStatus === "loading" ? "Refreshing…" : "Refresh this state"}</button>
          </div>
          <div className="state-metrics">
            <div><span>Active ship-tos</span><strong>{selectedState.activeShipTos.toLocaleString()}</strong></div>
            <div><span>Active customers</span><strong>{selectedState.activeCustomers.toLocaleString()}</strong></div>
            <div><span>Assigned tax bodies</span><strong>{selectedState.taxBodyCount.toLocaleString()}</strong></div>
          </div>
          <OfficialStateSourcePanel source={officialSourcesByCode.get(selectedState.stateCode) ?? null} status={officialStateStatus} snapshot={officialStateDetail} />
          {selectedState.stateCode === "GA" && <GeorgiaBoundaryPanel status={gaBoundaryStatus} reconciliation={gaBoundaryDetail} />}
          {FLAT_STATE_APLUS_STATES.has(selectedState.stateCode) && <FlatStateAplusPanel status={flatStateAplusStatus} reconciliation={flatStateAplusDetail} />}
          {DIRECT_MAPPING_APLUS_STATES.has(selectedState.stateCode) && <DirectMappingAplusPanel status={directMappingAplusStatus} reconciliation={directMappingAplusDetail} />}
          {stateDetailStatus === "loading" && <div className="state-detail-message" role="status">Querying A+ tax-body assignments and configured rates…</div>}
          {stateDetailStatus === "error" && <div className="state-detail-message state-detail-error" role="alert">The state detail query is unavailable. The state-level totals above remain from the last successful A+ coverage read.</div>}
          {stateDetailStatus === "ready" && stateDetail && (() => {
            const anomalousTaxBodies = stateDetail.taxBodies.filter((row) => describesOtherJurisdiction(row, selectedState.stateCode));
            const inStateTaxBodies = stateDetail.taxBodies.filter((row) => !describesOtherJurisdiction(row, selectedState.stateCode));
            return (
              <>
                <div className="state-tax-body-list">
                  <div className="state-table-heading"><strong>Tax bodies assigned in {selectedState.stateCode}</strong><span>{inStateTaxBodies.length} assignment groups</span></div>
                  <div className="table-scroll"><table className="coverage-table state-coverage-table"><thead><tr><th>Tax body</th><th>Description</th><th>A+ rate</th><th>Ship-tos</th><th>Customers</th><th>Next rate</th></tr></thead><tbody>
                    {inStateTaxBodies.map((row, index) => (
                      <tr key={`${row.taxBody ?? "unassigned"}-${index}`} className={row.definitionStatus === "missing" ? "definition-missing" : undefined}>
                        <td><code>{row.taxBody ?? "Unassigned"}</code></td>
                        <td>{row.description || (row.taxBody ? "Definition not found in XATXBD" : "No tax body on ship-to")}</td>
                        <td>{row.currentRate === null ? "—" : formatRate(row.currentRate)}{row.rateTotalValid === false && <span className="rate-warning" title="The configured components do not equal the configured total"> !</span>}</td>
                        <td>{row.activeShipTos.toLocaleString()}</td>
                        <td>{row.activeCustomers.toLocaleString()}</td>
                        <td>{row.nextRate && row.nextRate > 0 ? `${formatRate(row.nextRate)}${row.nextEffectiveDate ? ` · ${row.nextEffectiveDate}` : ""}` : "None"}</td>
                      </tr>
                    ))}
                  </tbody></table></div>
                </div>
                {anomalousTaxBodies.length > 0 && (
                  <div className="state-tax-body-list state-tax-body-anomalies">
                    <div className="state-table-heading">
                      <strong>Needs review — assigned tax body names a different jurisdiction</strong>
                      <span>{anomalousTaxBodies.length} assignment groups</span>
                    </div>
                    <p className="drawer-lede">
                      These ship-tos are physically in {STATE_NAME_BY_CODE.get(selectedState.stateCode) ?? selectedState.stateCode}, but the A+ tax body
                      assigned to them (XATXBD) is described as another state or country. This is a live A+ data issue, not a TaxAP filtering artifact.
                    </p>
                    <div className="table-scroll"><table className="coverage-table state-coverage-table"><thead><tr><th>Tax body</th><th>Description</th><th>A+ rate</th><th>Ship-tos</th><th>Customers</th><th>Next rate</th></tr></thead><tbody>
                      {anomalousTaxBodies.map((row, index) => (
                        <tr key={`anomaly-${row.taxBody ?? "unassigned"}-${index}`} className="definition-missing">
                          <td><code>{row.taxBody ?? "Unassigned"}</code></td>
                          <td>{row.description}</td>
                          <td>{row.currentRate === null ? "—" : formatRate(row.currentRate)}{row.rateTotalValid === false && <span className="rate-warning" title="The configured components do not equal the configured total"> !</span>}</td>
                          <td>{row.activeShipTos.toLocaleString()}</td>
                          <td>{row.activeCustomers.toLocaleString()}</td>
                          <td>{row.nextRate && row.nextRate > 0 ? `${formatRate(row.nextRate)}${row.nextEffectiveDate ? ` · ${row.nextEffectiveDate}` : ""}` : "None"}</td>
                        </tr>
                      ))}
                    </tbody></table></div>
                  </div>
                )}
              </>
            );
          })()}
          <div className="no-write-note"><strong>Nothing here changes A+.</strong>TaxAP displays aggregate assignments and configured rates only; customer names and ship-to addresses are not returned to the browser.</div>
          <div className="drawer-actions">
            {selectedState.stateCode === "NC" && <button className="primary-button" type="button" onClick={() => { navigate("jurisdictions"); setSelectedState(null); setStateDetail(null); setOfficialStateDetail(null); }}>Open NC jurisdictions</button>}
            <button className="secondary-button" type="button" onClick={() => { setSelectedState(null); setStateDetail(null); setStateDetailStatus("idle"); setOfficialStateDetail(null); setOfficialStateStatus("idle"); setGaBoundaryDetail(null); setGaBoundaryStatus("idle"); }}>Close</button>
          </div>
        </Drawer>
      )}

      {selectedCounty && (
        <Drawer titleId="county-title" onClose={() => setSelectedCounty(null)}>
          <div className="drawer-kicker"><span className="section-label">County rate comparison</span><ComparisonPill status={selectedCounty.comparisonStatus} /></div>
          <h2 id="county-title">{selectedCounty.county} County</h2>
          <p className="drawer-lede">Validated A+ configuration compared with the official NCDOR general sales and use tax county table. TaxAP requires all 100 counties before displaying a result.</p>
          <div className="county-metrics"><div><span>Active ship-tos</span><strong>{selectedCounty.activeShipTos.toLocaleString()}</strong></div><div><span>Active customers</span><strong>{selectedCounty.activeCustomers.toLocaleString()}</strong></div></div>
          <dl className="review-facts">
            <div><dt>A+ tax body</dt><dd>{selectedCounty.taxBody}</dd></div>
            <div><dt>A+ configured rate</dt><dd>{formatRate(selectedCounty.currentRate)}</dd></div>
            <div><dt>Official NCDOR rate</dt><dd>{selectedCounty.officialRate === null ? "Comparison unavailable" : formatRate(selectedCounty.officialRate)}</dd></div>
            <div><dt>Difference</dt><dd>{selectedCounty.rateDifference === null ? "—" : `${selectedCounty.rateDifference > 0 ? "+" : ""}${selectedCounty.rateDifference.toFixed(2)} percentage points`}</dd></div>
            <div><dt>Rate components</dt><dd>{selectedCounty.rateComponents.map((component) => `${formatRate(component.rate)} ${component.label}`).join(" + ")}</dd></div>
            <div><dt>Scheduled next rate</dt><dd>{selectedCounty.scheduledRate === null ? "None in A+" : `${formatRate(selectedCounty.scheduledRate)} · ${selectedCounty.scheduledEffectiveDate}`}</dd></div>
            <div><dt>State</dt><dd>North Carolina</dd></div>
            <div><dt>A+ rate snapshot</dt><dd>{appliedImport?.importedOn ?? snapshot.verifiedOn}</dd></div>
            <div><dt>NCDOR effective period</dt><dd>{selectedCounty.officialEffectivePeriod ?? "Not available"}</dd></div>
            <div><dt>Official source checked</dt><dd>{selectedCounty.officialRetrievedAt ? new Date(selectedCounty.officialRetrievedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "Not available"}</dd></div>
          </dl>
          {selectedCounty.comparisonStatus === "mismatch" ? (
            <div className="comparison-note comparison-note-mismatch"><span aria-hidden="true">!</span><div><strong>A+ differs from the current official rate</strong><p>Review the source and effective date before changing the A+ tax body. {selectedCounty.activeShipTos.toLocaleString()} active ship-tos are assigned to this county tax body.</p></div></div>
          ) : selectedCounty.comparisonStatus === "upcoming" ? (
            <div className="comparison-note comparison-note-upcoming"><span aria-hidden="true">↗</span><div><strong>NCDOR has an announced future component change</strong><p>{selectedCounty.futureChanges.map((change) => `${change.component} effective ${change.effectiveDate}`).join("; ")}.</p></div></div>
          ) : selectedCounty.comparisonStatus === "recent-match" ? (
            <div className="resolution-note"><span aria-hidden="true">✓</span><div><strong>Recent NCDOR change is already matched in A+</strong><p>The official rate moved from {selectedCounty.previousOfficialRate === null ? "the prior rate" : formatRate(selectedCounty.previousOfficialRate)} to {selectedCounty.officialRate === null ? "the current rate" : formatRate(selectedCounty.officialRate)} effective {selectedCounty.recentEffectiveDate ?? "in the current NCDOR period"}.</p></div></div>
          ) : (
            <div className="comparison-note comparison-note-match"><span aria-hidden="true">✓</span><div><strong>{selectedCounty.comparisonStatus === "matched" ? "A+ matches the current NCDOR rate" : "Official comparison unavailable"}</strong><p>{selectedCounty.activeShipTos > 0 ? `${selectedCounty.activeShipTos.toLocaleString()} active ship-tos use this tax body.` : "No active A+ ship-to address is assigned to this standard county tax body."}</p></div></div>
          )}
          {(selectedCounty.comparisonStatus === "mismatch" || selectedCounty.comparisonStatus === "upcoming") && (
            <ReviewDecisionPanel
              reviewCase={reviewCasesByKey.get(reviewFindingKey(selectedCounty)) ?? null}
              onSave={(status, actor, note) => saveCountyReview(selectedCounty, status, actor, note)}
            />
          )}
          <div className="drawer-actions">
            {selectedCounty.officialSourceUrl && <a className="secondary-button drawer-link" href={selectedCounty.officialSourceUrl} target="_blank" rel="noreferrer">Open official NCDOR evidence ↗</a>}
            {reviewCasesByKey.has(reviewFindingKey(selectedCounty)) && <button className="secondary-button" type="button" onClick={() => { setSelectedReviewCase(reviewCasesByKey.get(reviewFindingKey(selectedCounty)) ?? null); setSelectedCounty(null); }}>View audit history</button>}
            {selectedCounty.taxBody === "NC060" && !reviewCasesByKey.has(reviewFindingKey(selectedCounty)) && <button className="primary-button" type="button" onClick={() => { setSelectedCounty(null); setSelectedCase(resolvedCases[0]); }}>Open resolved case</button>}
            <button className="secondary-button" type="button" onClick={() => setSelectedCounty(null)}>Close</button>
          </div>
        </Drawer>
      )}

      {selectedReviewCase && (
        <Drawer titleId="stored-review-title" onClose={() => setSelectedReviewCase(null)}>
          <div className="drawer-kicker"><span className="section-label">TaxAP review record</span><span className={`review-status review-status-${selectedReviewCase.status}`}>{reviewStatusLabels[selectedReviewCase.status]}</span></div>
          <h2 id="stored-review-title">{selectedReviewCase.jurisdiction}</h2>
          <p className="drawer-lede">A durable record of the evidence and human decisions. This history is stored separately from A+.</p>
          <div className="rate-comparison"><div><span>A+ rate</span><strong>{selectedReviewCase.aplusRate === null ? "—" : formatRate(selectedReviewCase.aplusRate)}</strong></div><span className="compare-arrow">→</span><div className="official-rate"><span>Official rate</span><strong>{selectedReviewCase.officialRate === null ? "—" : formatRate(selectedReviewCase.officialRate)}</strong></div></div>
          <dl className="review-facts">
            <div><dt>A+ tax body</dt><dd>{selectedReviewCase.taxBody}</dd></div>
            <div><dt>Finding type</dt><dd>{selectedReviewCase.findingType}</dd></div>
            <div><dt>Effective date</dt><dd>{selectedReviewCase.effectiveDate ?? "Not recorded"}</dd></div>
            <div><dt>Current owner</dt><dd>{selectedReviewCase.assignedTo ?? "Unassigned"}</dd></div>
            <div><dt>Last updated</dt><dd>{new Date(selectedReviewCase.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
            <div><dt>Latest note</dt><dd>{selectedReviewCase.latestNote ?? "No note recorded"}</dd></div>
          </dl>
          <ReviewAuditTrail reviewCase={selectedReviewCase} />
          <div className="no-write-note"><strong>No A+ records were changed by TaxAP.</strong>Any approved rate maintenance still happens through the supported A+ GUI.</div>
          <div className="drawer-actions"><button className="primary-button" type="button" onClick={() => setSelectedReviewCase(null)}>Close audit record</button></div>
        </Drawer>
      )}

      {selectedCase && (
        <Drawer titleId="review-title" onClose={() => setSelectedCase(null)}>
          <div className="drawer-kicker"><span className="section-label">Resolved rate change</span><span className="status-badge">✓ Resolved</span></div>
          <h2 id="review-title">{selectedCase.place}</h2>
          <p className="drawer-lede">The first verified TaxAP audit case, preserved as aggregate evidence.</p>
          <div className="rate-comparison"><div><span>Previous A+ rate</span><strong>{selectedCase.previousRate}</strong></div><span className="compare-arrow">→</span><div className="official-rate"><span>Official rate</span><strong>{selectedCase.currentRate}</strong></div></div>
          <dl className="review-facts">
            <div><dt>A+ tax body</dt><dd>{selectedCase.taxBody}</dd></div>
            <div><dt>Effective date</dt><dd>{selectedCase.effectiveDate}</dd></div>
            <div><dt>Active ship-tos assigned</dt><dd>{selectedCase.activeShipTos.toLocaleString()}</dd></div>
            <div><dt>Prior-rate invoices reviewed</dt><dd>{selectedCase.invoices}</dd></div>
            <div><dt>Customers represented in review</dt><dd>{selectedCase.customersReviewed}</dd></div>
            <div><dt>Positive taxable sales reviewed</dt><dd>{selectedCase.taxableSales}</dd></div>
            <div><dt>Initial one-point estimate</dt><dd>{selectedCase.reviewEstimate}</dd></div>
            <div><dt>Official source</dt><dd><a href={sources[0].url ?? "#"} target="_blank" rel="noreferrer">North Carolina DOR ↗</a></dd></div>
          </dl>
          <div className="resolution-note"><span aria-hidden="true">✓</span><div><strong>Resolved by {selectedCase.resolvedBy}</strong><p>The A+ rate was changed and invoices that used the prior 7.25% rate were handled. The estimate above is not an outstanding balance.</p><small>Recorded {selectedCase.resolvedOn}</small></div></div>
          <div className="no-write-note"><strong>No A+ records were changed by TaxAP.</strong>This application preserves the aggregate evidence and the tax team&apos;s resolution.</div>
          <div className="drawer-actions"><button className="primary-button" type="button" onClick={() => setSelectedCase(null)}>Close case</button></div>
        </Drawer>
      )}
    </main>
  );
}

function TaxTreatmentPanel({ snapshot, status, connectorStatus }: { snapshot: TaxTreatmentSnapshot | null; status: TaxTreatmentStatus; connectorStatus: ConnectorStatus }) {
  if (status === "loading") {
    return <section className="tax-treatment-panel" aria-labelledby="tax-treatment-title"><span className="section-label">A+ tax treatment context</span><strong id="tax-treatment-title">Reading aggregate treatment counts…</strong></section>;
  }
  if (status === "error" || !snapshot) {
    return <section className="tax-treatment-panel tax-treatment-unavailable" aria-labelledby="tax-treatment-title"><span className="section-label">A+ tax treatment context</span><strong id="tax-treatment-title">Treatment summary unavailable</strong><p>{connectorStatus === "fallback" ? "Live A+ data is unavailable, so TaxAP is not showing a tax-treatment conclusion." : "TaxAP could not load the aggregate treatment summary. No treatment conclusion is shown."}</p></section>;
  }

  const bucket = (treatmentCode: TaxTreatmentCode) => snapshot.treatments.find((item) => item.treatmentCode === treatmentCode) ?? { treatmentCode, activeShipTos: 0, activeCustomers: 0 };
  const alwaysTaxable = bucket("0");
  const neverTaxed = bucket("3");
  const lineLevelReview = bucket("J");
  const other = bucket("other");
  const temporaryAlwaysTaxable = snapshot.temporaryTaxBody.treatments.find((item) => item.treatmentCode === "0")?.activeShipTos ?? 0;

  return (
    <section className="tax-treatment-panel" aria-labelledby="tax-treatment-title">
      <div className="tax-treatment-heading"><div><span className="section-label">A+ tax treatment context</span><h2 id="tax-treatment-title">Rate monitoring is scoped by tax treatment</h2></div><small>Aggregate only · refreshed {new Date(snapshot.retrievedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</small></div>
      <p className="tax-treatment-intro">This A+ setting guides TaxAP&apos;s monitoring scope; it does not determine a customer&apos;s legal taxability.</p>
      <div className="tax-treatment-grid">
        <div><span>0 · Always taxable</span><strong>{alwaysTaxable.activeShipTos.toLocaleString()}</strong><small>Included in rate-comparison impact.</small></div>
        <div><span>3 · Never taxed</span><strong>{neverTaxed.activeShipTos.toLocaleString()}</strong><small>Intentional exempt activity; excluded from rate-risk impact.</small></div>
        <div><span>J · Mixed</span><strong>{lineLevelReview.activeShipTos.toLocaleString()}</strong><small>Requires line-level review; no header-level rate conclusion.</small></div>
        <div><span>Other or blank</span><strong>{other.activeShipTos.toLocaleString()}</strong><small>Unclassified treatment; no rate conclusion.</small></div>
      </div>
      {snapshot.temporaryTaxBody.activeShipTos > 0 && (
        <div className="temporary-tax-alert" role="status">
          <span aria-hidden="true">!</span>
          <div><strong>Temporary tax-body configuration needs confirmation</strong><p><code>ZTEMP</code> is assigned to {snapshot.temporaryTaxBody.activeShipTos.toLocaleString()} active ship-tos. {temporaryAlwaysTaxable.toLocaleString()} are marked always taxable.{snapshot.temporaryTaxBody.configuredRate === null ? " Its current A+ rate could not be confirmed." : ` Its configured A+ rate is ${formatRate(snapshot.temporaryTaxBody.configuredRate)}.`} This is displayed as a configuration exception, not an automatic rate mismatch.</p></div>
        </div>
      )}
    </section>
  );
}

function OfficialStateSourcePanel({ source, status, snapshot }: { source: OfficialSourceState | null; status: StateDetailStatus; snapshot: OfficialStateSnapshot | null }) {
  const statusLabel = source?.status === "connected" ? "Connected"
    : source?.status === "machine-readable-source" ? "Machine source identified"
      : source?.status === "official-document-source" ? "Official document identified"
        : source?.status === "no-general-sales-tax" ? "No general sales tax"
          : "Research needed";
  return (
    <section className="official-state-panel" aria-labelledby="official-state-title">
      <div className="state-table-heading"><div><span className="section-label">Official sales and use tax source</span><strong id="official-state-title">{source?.sourceName ?? "Loading source registry"}</strong></div>{source && <span className={`source-rollout-status source-rollout-${source.status}`}>{statusLabel}</span>}</div>
      {status === "loading" && <div className="state-detail-message" role="status">Checking the official state rate source…</div>}
      {status === "error" && source?.status === "connected" && <div className="state-detail-message state-detail-error" role="alert">The connected official source is temporarily unavailable or failed validation. TaxAP did not infer any rates.</div>}
      {status === "error" && source?.status !== "connected" && <div className="official-adapter-pending"><strong>{statusLabel}</strong><p>{source?.coverage ?? "The official source still needs to be mapped and validated."}</p></div>}
      {status === "ready" && snapshot && (
        <>
          <div className="official-source-summary">
            <div><span>State rate</span><strong>{formatRate(snapshot.stateRate)}</strong></div>
            <div><span>County rows</span><strong>{snapshot.counts.counties}</strong></div>
            <div><span>City components</span><strong>{snapshot.counts.cities}</strong></div>
            <div><span>Checked</span><strong>{new Date(snapshot.retrievedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong></div>
          </div>
          <p className="official-boundary-note">{snapshot.boundaryStatus}</p>
          <details className="official-rate-details">
            <summary>View {snapshot.rates.length} official jurisdiction rate records</summary>
            <div className="table-scroll"><table className="coverage-table official-rate-table"><thead><tr><th>Type</th><th>Jurisdiction</th><th>Code</th><th>Component</th><th>Total general rate</th><th>Effective</th></tr></thead><tbody>
              {snapshot.rates.map((rate) => (
                <tr key={`${rate.jurisdictionType}-${rate.jurisdictionCode}`}><td>{rate.jurisdictionType}</td><td>{rate.name}</td><td><code>{rate.jurisdictionCode}</code></td><td>{formatRate(rate.componentRate)}</td><td>{rate.totalGeneralRate === null ? "Requires boundary match" : formatRate(rate.totalGeneralRate)}</td><td>{rate.beginDate ?? "Current file"}</td></tr>
              ))}
            </tbody></table></div>
          </details>
          <div className="official-source-links"><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Open state DOR source ↗</a>{snapshot.machineReadableSourceUrl && <a href={snapshot.machineReadableSourceUrl} target="_blank" rel="noreferrer">Open machine-readable evidence ↗</a>}<span>Fingerprint {snapshot.sourceHash.slice(0, 12)}…</span></div>
        </>
      )}
    </section>
  );
}

function GeorgiaBoundaryPanel({ status, reconciliation }: { status: StateDetailStatus; reconciliation: GaBoundaryReconciliation | null }) {
  if (status === "loading") {
    return <div className="state-detail-message" role="status">Matching active Georgia ship-tos against the official Streamlined boundary file…</div>;
  }
  if (status === "error" || !reconciliation) {
    return <div className="state-detail-message state-detail-error" role="alert">The Georgia boundary-match reconciliation is unavailable or failed validation. No jurisdiction was guessed.</div>;
  }
  const { totals, matchTierCounts, taxBodyFindings, excludedForNoAplusRate, crossStateAssignments } = reconciliation;
  const differences = taxBodyFindings.filter((row) => row.hasDifference);
  return (
    <section className="official-state-panel" aria-labelledby="ga-boundary-title">
      <div className="state-table-heading"><div><span className="section-label">Georgia address-boundary reconciliation</span><strong id="ga-boundary-title">Streamlined boundary match</strong></div></div>
      <div className="official-source-summary">
        <div><span>Active ship-tos</span><strong>{totals.activeShipTos.toLocaleString()}</strong></div>
        <div><span>Matched</span><strong>{totals.matched.toLocaleString()}</strong></div>
        <div><span>Unmatched</span><strong>{totals.unmatched.toLocaleString()}</strong></div>
        <div><span>Ambiguous</span><strong>{totals.ambiguous.toLocaleString()}</strong></div>
      </div>
      <p className="official-boundary-note">
        Matched by address: {matchTierCounts.address.toLocaleString()} · ZIP+4: {matchTierCounts.zip9.toLocaleString()} · ZIP-5: {matchTierCounts.zip5.toLocaleString()} · ZIP+4 sub-ranges in agreement (no ZIP-5 row published): {matchTierCounts.zip5FromZip9.toLocaleString()}.
        Unmatched and ambiguous ship-tos are reported, not guessed.
        {excludedForNoAplusRate > 0 && ` ${excludedForNoAplusRate} tax ${excludedForNoAplusRate === 1 ? "body" : "bodies"} excluded from the rows below for having no A+ rate configured (retired, DO NOT USE, or a blank 0% definition).`}
        {crossStateAssignments.taxBodyCount > 0 && ` ${crossStateAssignments.rateBearingTaxBodyCount} rate-bearing different-jurisdiction tax ${crossStateAssignments.rateBearingTaxBodyCount === 1 ? "body" : "bodies"}, covering ${crossStateAssignments.rateBearingShipToCount.toLocaleString()} ship-tos, are excluded from Georgia rate comparison. ${crossStateAssignments.taxBodyCount - crossStateAssignments.rateBearingTaxBodyCount} additional zero-rate outside-jurisdiction assignment groups remain visible below.`}
      </p>
      {crossStateAssignments.taxBodyCount > 0 && (
        <details className="official-rate-details">
          <summary>View {crossStateAssignments.taxBodyCount} different-state or country assignment groups ({crossStateAssignments.shipToCount.toLocaleString()} ship-tos)</summary>
          <div className="table-scroll"><table className="coverage-table official-rate-table"><thead><tr><th>Tax body</th><th>Description</th><th>Ship-tos</th><th>A+ rate</th><th>Handling</th></tr></thead><tbody>
            {crossStateAssignments.taxBodies.map((row) => (
              <tr key={row.taxBody}><td><code>{row.taxBody}</code></td><td>{row.description ?? "Different-state tax body"}</td><td>{row.activeShipTos.toLocaleString()}</td><td>{row.aplusRate === null ? "—" : formatRate(row.aplusRate)}</td><td>Excluded from GA comparison</td></tr>
            ))}
          </tbody></table></div>
        </details>
      )}
      {(reconciliation.unmatchedReasons.length > 0 || reconciliation.ambiguousReasons.length > 0) && (
        <details className="official-rate-details">
          <summary>Why {totals.unmatched.toLocaleString()} unmatched{totals.ambiguous > 0 ? ` and ${totals.ambiguous.toLocaleString()} ambiguous` : ""} ship-tos didn&apos;t resolve</summary>
          <ul className="unmatched-reason-list">
            {reconciliation.unmatchedReasons.map((row) => (
              <li key={row.reason}><strong>{row.count.toLocaleString()}</strong> unmatched — {row.reason}</li>
            ))}
            {reconciliation.ambiguousReasons.map((row) => (
              <li key={row.reason}><strong>{row.count.toLocaleString()}</strong> ambiguous — {row.reason}</li>
            ))}
          </ul>
        </details>
      )}
      <details className="official-rate-details">
        <summary>View {taxBodyFindings.length} tax-body reconciliation rows{differences.length > 0 ? ` (${differences.length} with a rate difference)` : ""}</summary>
        <div className="table-scroll"><table className="coverage-table official-rate-table"><thead><tr><th>Tax body</th><th>Ship-tos</th><th>Matched</th><th>Unmatched</th><th>Ambiguous</th><th>Official rate</th><th>A+ rate</th></tr></thead><tbody>
          {taxBodyFindings.map((row) => (
            <tr key={row.taxBody} className={row.hasDifference ? "definition-missing" : undefined}>
              <td><code>{row.taxBody}</code></td>
              <td>{row.activeShipTos.toLocaleString()}</td>
              <td>{row.matchedShipTos.toLocaleString()}</td>
              <td>{row.unmatchedShipTos.toLocaleString()}</td>
              <td>{row.ambiguousShipTos.toLocaleString()}</td>
              <td>{row.officialRate === null ? "—" : formatRate(row.officialRate)}</td>
              <td>{row.aplusRate === null ? "—" : formatRate(row.aplusRate)}{!row.jurisdictionAssignmentConsistent && <span className="rate-warning" title="Matched ship-tos under this tax body resolved to more than one jurisdiction"> !</span>}</td>
            </tr>
          ))}
        </tbody></table></div>
      </details>
      <div className="official-source-links"><a href={reconciliation.boundaryFileUrl} target="_blank" rel="noreferrer">Open boundary-file evidence ↗</a><span>Boundary fingerprint {reconciliation.boundarySourceHash.slice(0, 12)}…</span></div>
    </section>
  );
}

function FlatStateAplusPanel({ status, reconciliation }: { status: StateDetailStatus; reconciliation: FlatStateAplusReconciliation | null }) {
  const stateName = reconciliation ? (STATE_NAME_BY_CODE.get(reconciliation.stateCode) ?? reconciliation.stateCode) : "this state";
  if (status === "loading") return <div className="state-detail-message" role="status">Comparing A+&apos;s single statewide tax body with the current official rate…</div>;
  if (status === "error" || !reconciliation) return <div className="state-detail-message state-detail-error" role="alert">The A+ comparison is unavailable or failed validation. No rate was guessed.</div>;
  const { totals } = reconciliation;
  return (
    <section className="official-state-panel" aria-labelledby="flat-state-aplus-title">
      <div className="state-table-heading"><div><span className="section-label">{stateName} A+ reconciliation</span><strong id="flat-state-aplus-title">Flat statewide rate comparison</strong></div></div>
      <div className="official-source-summary">
        <div><span>{reconciliation.expectedTaxBody} ship-tos</span><strong>{totals.comparedShipTos.toLocaleString()}</strong></div>
        <div><span>Official rate</span><strong>{formatRate(reconciliation.officialRate)}</strong></div>
        <div><span>A+ rate</span><strong>{reconciliation.aplusRate === null ? "—" : formatRate(reconciliation.aplusRate)}</strong></div>
        <div><span>Result</span><strong>{reconciliation.comparisonStatus === "matched" ? "Matches" : reconciliation.comparisonStatus === "difference" ? "Review difference" : "Unavailable"}</strong></div>
      </div>
      <p className="official-boundary-note">
        {totals.crossStateShipTos.toLocaleString()} ship-to{totals.crossStateShipTos === 1 ? "" : "s"} assigned to another state and {totals.unclassifiedShipTos.toLocaleString()} unclassified ship-to{totals.unclassifiedShipTos === 1 ? "" : "s"} are reported separately and excluded from the {reconciliation.expectedTaxBody} comparison. All {totals.activeShipTos.toLocaleString()} active {stateName} ship-tos reconcile to these categories.
      </p>
    </section>
  );
}

function DirectMappingAplusPanel({ status, reconciliation }: { status: StateDetailStatus; reconciliation: DirectMappingAplusReconciliation | null }) {
  const stateName = reconciliation ? (STATE_NAME_BY_CODE.get(reconciliation.stateCode) ?? reconciliation.stateCode) : "this state";
  if (status === "loading") return <div className="state-detail-message" role="status">Comparing each A+ tax body with its matching official jurisdiction…</div>;
  if (status === "error" || !reconciliation) return <div className="state-detail-message state-detail-error" role="alert">The A+ comparison is unavailable or failed validation. No rate was guessed.</div>;
  const { totals } = reconciliation;
  const mismatches = reconciliation.findings.filter((finding) => finding.hasDifference).sort((a, b) => b.activeShipTos - a.activeShipTos);
  const unmatched = reconciliation.findings.filter((finding) => !finding.matched);
  return (
    <section className="official-state-panel" aria-labelledby="direct-mapping-aplus-title">
      <div className="state-table-heading"><div><span className="section-label">{stateName} A+ reconciliation</span><strong id="direct-mapping-aplus-title">Per tax-body rate comparison</strong></div></div>
      <div className="official-source-summary">
        <div><span>Compared ship-tos</span><strong>{totals.comparedShipTos.toLocaleString()}</strong></div>
        <div><span>Rate differences</span><strong>{mismatches.length}</strong></div>
        <div><span>Misinputs excluded</span><strong>{totals.misinputShipTos.toLocaleString()}</strong></div>
        <div><span>Cross-state excluded</span><strong>{totals.crossStateShipTos.toLocaleString()}</strong></div>
      </div>
      {mismatches.length > 0 ? (
        <div className="official-source-table-wrap"><table><thead><tr><th>Tax body</th><th>Jurisdiction</th><th>Official</th><th>A+</th><th>Ship-tos</th></tr></thead><tbody>
          {mismatches.map((finding) => (
            <tr key={finding.taxBody}><td>{finding.taxBody}</td><td>{finding.jurisdictionLabel}</td><td>{finding.officialRate === null ? "—" : formatRate(finding.officialRate)}</td><td>{finding.aplusRate === null ? "—" : formatRate(finding.aplusRate)}</td><td>{finding.activeShipTos.toLocaleString()}</td></tr>
          ))}
        </tbody></table></div>
      ) : (
        <p className="official-boundary-note">No rate differences found among {totals.comparedShipTos.toLocaleString()} compared ship-tos.</p>
      )}
      {(totals.unmatchedShipTos > 0 || unmatched.length > 0) && (
        <p className="official-boundary-note">{unmatched.length} tax body{unmatched.length === 1 ? "" : "ies"} ({totals.unmatchedShipTos.toLocaleString()} ship-tos) had no matching official jurisdiction found and {unmatched.length === 1 ? "is" : "are"} not compared, rather than guessed.</p>
      )}
    </section>
  );
}

function ImportSnapshotView({
  result,
  appliedImport,
  onResult,
  onApply,
  onReset,
}: {
  result: APlusImportResult | null;
  appliedImport: { fileName: string; importedOn: string } | null;
  onResult: (result: APlusImportResult | null) => void;
  onApply: (result: APlusImportResult) => void;
  onReset: () => void;
}) {
  const readFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      onResult({
        fileName: file.name,
        hasHeader: false,
        rowCount: 0,
        standardRows: [],
        specialRows: [],
        scheduledRows: [],
        errors: ["Choose a CSV export from the A+ XATXBD query."],
        warnings: [],
        rateDistribution: [],
      });
      return;
    }
    if (file.size > 2_000_000) {
      onResult({
        fileName: file.name,
        hasHeader: false,
        rowCount: 0,
        standardRows: [],
        specialRows: [],
        scheduledRows: [],
        errors: ["The file is larger than 2 MB, which is unexpected for an XATXBD export."],
        warnings: [],
        rateDistribution: [],
      });
      return;
    }
    onResult(validateXatxbdCsv(await file.text(), file.name));
  };

  const canApply = Boolean(result && result.errors.length === 0 && result.standardRows.length === 100);

  return (
    <section className="page-content view-page" aria-labelledby="import-title">
      <PageHeading
        titleId="import-title"
        eyebrow="Administrator fallback"
        title="Import A+ tax-body snapshot"
        description="Use this only when the live read-only connector is unavailable or when testing an export. Normal users receive A+ rates automatically."
      />

      {appliedImport && (
        <div className="import-active-banner">
          <div><span className="section-label">Session snapshot active</span><strong>{appliedImport.fileName}</strong><small>Applied {appliedImport.importedOn}. Refreshing the page clears it.</small></div>
          <button className="secondary-button" type="button" onClick={onReset}>Restore built-in snapshot</button>
        </div>
      )}

      <section className="import-card" aria-labelledby="choose-export-title">
        <div className="import-step"><span>01</span><div><h2 id="choose-export-title">Choose the A+ export</h2><p>Expected: the 19 XATXBD columns, with or without a header row. Customer and ship-to exports are rejected by this validator.</p></div></div>
        <label className="file-drop">
          <input type="file" accept=".csv,text/csv" onChange={readFile} />
          <span className="file-icon" aria-hidden="true">CSV</span>
          <strong>{result ? "Choose a different CSV" : "Choose XATXBD CSV"}</strong>
          <small>Local validation only · maximum 2 MB</small>
        </label>
      </section>

      {result && (
        <section className="import-results" aria-live="polite" aria-labelledby="validation-title">
          <div className="import-step"><span>02</span><div><h2 id="validation-title">Validation results</h2><p>{result.fileName} · {result.rowCount} data rows · {result.hasHeader ? "header detected" : "headerless export"}</p></div></div>
          <div className={`validation-banner ${canApply ? "validation-pass" : "validation-fail"}`}>
            <span aria-hidden="true">{canApply ? "✓" : "!"}</span>
            <div><strong>{canApply ? "Ready to apply" : "Import blocked"}</strong><p>{canApply ? "All 100 standard county tax bodies passed structural and rate-total checks." : "Correct the errors below and export the file again."}</p></div>
          </div>

          <div className="import-stats">
            <article><span>Standard counties</span><strong>{result.standardRows.length} / 100</strong><small>NC001 through NC100</small></article>
            <article><span>Special tax bodies</span><strong>{result.specialRows.length}</strong><small>Kept outside standard county inventory</small></article>
            <article><span>Scheduled changes</span><strong>{result.scheduledRows.length}</strong><small>Next rate or date populated</small></article>
            <article><span>Blocking errors</span><strong>{result.errors.length}</strong><small>Must be zero to apply</small></article>
          </div>

          {result.rateDistribution.length > 0 && (
            <div className="rate-distribution"><span>Configured rate distribution</span><div>{result.rateDistribution.map((item) => <strong key={item.rate}>{formatRate(item.rate)} <small>{item.count} counties</small></strong>)}</div></div>
          )}

          {(result.errors.length > 0 || result.warnings.length > 0) && (
            <div className="validation-lists">
              {result.errors.length > 0 && <div><h3>Errors</h3><ul>{result.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
              {result.warnings.length > 0 && <div><h3>Notes</h3><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
            </div>
          )}

          {result.standardRows.length > 0 && (
            <div className="table-card import-preview">
              <div className="panel-heading"><div><span className="section-label">Representative rows</span><h2>Rate preview</h2></div><span className="count-pill quiet">4</span></div>
              <div className="table-scroll"><table className="coverage-table"><thead><tr><th>Tax body</th><th>Description</th><th>Base</th><th>Local components</th><th>Total</th><th>Next rate</th></tr></thead><tbody>
                {result.standardRows.filter((row) => ["NC032", "NC060", "NC068", "NC092"].includes(row.taxBody)).map((row) => (
                  <tr key={row.taxBody}><td><code>{row.taxBody}</code></td><td>{row.description}</td><td>{formatRate(row.baseRate)}</td><td>{row.localRates.filter((rate) => rate !== 0).map(formatRate).join(" + ") || "—"}</td><td><strong>{formatRate(row.currentRate)}</strong></td><td>{row.nextRate > 0 ? `${formatRate(row.nextRate)} · ${row.nextEffectiveDate}` : "None"}</td></tr>
                ))}
              </tbody></table></div>
            </div>
          )}

          <div className="import-actions">
            <div><strong>Session-only application</strong><p>This replaces only TaxAP&apos;s displayed county rates until the browser is refreshed.</p></div>
            <button className="primary-button" type="button" disabled={!canApply} onClick={() => result && onApply(result)}>Apply validated snapshot</button>
          </div>
        </section>
      )}
      <AppFooter />
    </section>
  );
}

function SummaryStats({ openCount, upcomingCount, affectedShipTos, connectedSources, lastRefresh }: { openCount: number | null; upcomingCount: number | null; affectedShipTos: number | null; connectedSources: number; lastRefresh: string | null }) {
  return (
    <section className="stats" aria-label="Tax rate monitoring summary">
      <article><span>Needs attention</span><strong>{openCount === null ? "…" : openCount}</strong><small>{openCount === null ? "Still loading every connected state" : "Confirmed official-to-A+ differences"}</small></article>
      <article><span>Upcoming changes</span><strong>{upcomingCount === null ? "…" : upcomingCount}</strong><small>Published future effective dates</small></article>
      <article><span>Affected ship-tos</span><strong>{affectedShipTos === null ? "…" : affectedShipTos.toLocaleString()}</strong><small>Aggregate impact across open findings</small></article>
      <article><span>Connected sources</span><strong>{connectedSources}</strong><small>Validated official-rate adapters</small></article>
      <article><span>Last validated refresh</span><strong className="stat-date">{lastRefresh ? new Date(lastRefresh).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unavailable"}</strong><small>Live refresh requires supervision</small></article>
    </section>
  );
}

function PageHeading({ titleId, eyebrow, title, description, action }: { titleId: string; eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="view-heading"><div><span className="eyebrow">{eyebrow}</span><h1 id={titleId}>{title}</h1><p>{description}</p></div>{action}</div>;
}

function ComparisonPill({ status }: { status: ComparisonStatus }) {
  return <span className={`status-pill comparison-${status}`}>{comparisonLabels[status]}</span>;
}

function Drawer({ titleId, onClose, children, className = "" }: { titleId: string; onClose: () => void; children: React.ReactNode; className?: string }) {
  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`review-drawer ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button className="drawer-close" type="button" onClick={onClose} aria-label="Close details">×</button>
        {children}
      </section>
    </div>
  );
}

function AppFooter() {
  return <footer><span>TaxAP · Sales and use tax monitoring</span><span>Read-only evidence and review workspace</span></footer>;
}
