import { createHash } from "node:crypto";

export const MARYLAND_RATE_CHART_URL = "https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/Tax_rate_chart.pdf";
export const MARYLAND_STATE_RATE = 6;

/**
 * Maryland has no scrapable official rate source: its FAQ page is a JS-rendered SPA whose content
 * never appears in the raw HTML (confirmed 2026-08-26 - a plain fetch returns only the page shell).
 * The only real source is a static PDF rate chart, and there is nothing to parse either way -
 * Maryland preempts local general sales tax entirely (Tax-General Article Section 11-104), so the
 * rate is a single flat 6% statewide constant with no county, city, or special-district variation
 * and never needs address/boundary matching. This adapter is intentionally not a live fetch.
 */
export async function readOfficialMdRates({ now = new Date() } = {}) {
  const asOfDate = now.toISOString().slice(0, 10);
  const rate = {
    jurisdictionType: "state",
    jurisdictionCode: "MD",
    name: "Maryland",
    componentRate: MARYLAND_STATE_RATE,
    totalGeneralRate: MARYLAND_STATE_RATE,
    generalInterstateRate: MARYLAND_STATE_RATE,
    beginDate: null,
    endDate: null,
  };
  return {
    stateCode: "MD",
    source: "Comptroller of Maryland (Tax-General Article Section 11-104; 6% Rate Chart PDF)",
    sourceUrl: MARYLAND_RATE_CHART_URL,
    machineReadableSourceUrl: null,
    retrievedAt: now.toISOString(),
    asOfDate,
    stateRate: MARYLAND_STATE_RATE,
    sourceHash: createHash("sha256").update(`MD-flat-rate-${MARYLAND_STATE_RATE}`).digest("hex"),
    rates: [rate],
    counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
    boundaryStatus: "Maryland preempts local general sales tax - single flat statewide 6% rate, no address or boundary matching is ever needed.",
  };
}
