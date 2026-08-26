import { createHash } from "node:crypto";

// Massachusetts' own sales-and-use-tax guide. Confirmed live 2026-08-26 (see docs/states/ma.md):
// mass.gov bot-blocks a browser-style User-Agent (and this project's WebFetch tool) with an HTTP 403
// even though the page is genuinely live - a plain, non-browser User-Agent gets through with a clean
// 200. This is the same universal caveat already documented in docs/roadmap-50-states.md for several
// other state tax-agency domains (azdor.gov, tax.colorado.gov, revenue.nh.gov, otr.cfo.dc.gov): a 403
// from an automated browser-style fetch is not sufficient evidence the source is dead.
export const MA_RATES_URL = "https://www.mass.gov/guides/sales-and-use-tax";
const MA_USER_AGENT = "curl/8.0";

const PLAUSIBLE_RATE_MIN = 3;
const PLAUSIBLE_RATE_MAX = 10;

function plainText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Matches the guide's own stated sentences: "The Massachusetts sales tax is 6.25% of the sales
// price..." and "The Massachusetts use tax is 6.25% of the sales price...". Cross-validating both
// (Massachusetts law sets them identical) is the closest thing to confirmation available from a
// single-page HTML source, the same discipline NJ's two-page cross-check applies with two pages.
const SALES_RATE_PATTERN = /Massachusetts sales tax is\s+(\d+(?:\.\d+)?)%/i;
const USE_RATE_PATTERN = /Massachusetts use tax is\s+(\d+(?:\.\d+)?)%/i;

/**
 * Parses the Massachusetts sales-and-use-tax guide for the current flat rate. Massachusetts' general
 * sales/use tax has no county- or city-level local-option variation at all (confirmed live against
 * A+'s XATXBD - a single MA000 tax body covers 342 of 343 active MA ship-tos, see docs/states/ma.md;
 * the separate local-option meals and room-occupancy taxes are different tax categories, not tracked
 * here), so there is exactly one number to find.
 */
export function parseMaRatePage(html) {
  const text = plainText(html);
  const salesMatch = text.match(SALES_RATE_PATTERN);
  const useMatch = text.match(USE_RATE_PATTERN);
  if (!salesMatch) throw new Error('Massachusetts\' sales-and-use-tax guide does not contain the expected "Massachusetts sales tax is X%" statement.');
  const rate = Number(salesMatch[1]);
  if (!Number.isFinite(rate) || rate < PLAUSIBLE_RATE_MIN || rate > PLAUSIBLE_RATE_MAX) {
    throw new Error(`Massachusetts returned an implausible sales tax rate (${rate}%); refusing to trust it.`);
  }
  if (useMatch && Number(useMatch[1]) !== rate) {
    throw new Error(`Massachusetts' guide states disagreeing sales (${rate}%) and use (${useMatch[1]}%) tax rates - refusing to trust either.`);
  }
  return rate;
}

async function fetchOfficialPage(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { headers: { Accept: "text/html", "User-Agent": MA_USER_AGENT }, signal: controller.signal });
    if (!response.ok) throw new Error(`Massachusetts' sales-and-use-tax guide returned HTTP ${response.status}.`);
    const html = await response.text();
    if (html.length < 500) throw new Error("Massachusetts' sales-and-use-tax guide returned an unexpectedly small response.");
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;

export async function readOfficialMaRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  const html = await fetchOfficialPage(MA_RATES_URL, fetchImpl);
  const rate = parseMaRatePage(html);
  const snapshot = {
    stateCode: "MA",
    source: "Commonwealth of Massachusetts",
    sourceUrl: MA_RATES_URL,
    machineReadableSourceUrl: null,
    retrievedAt: now.toISOString(),
    asOfDate: now.toISOString().slice(0, 10),
    stateRate: rate,
    sourceHash: createHash("sha256").update(html).digest("hex"),
    rates: [{
      jurisdictionType: "state", jurisdictionCode: "MA", name: "Massachusetts",
      componentRate: rate, totalGeneralRate: rate, generalInterstateRate: rate,
      beginDate: null, endDate: null,
    }],
    counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
    boundaryStatus: "Massachusetts' general sales/use tax has no local-option variation - a single flat statewide rate applies to every ship-to. No address or boundary matching is ever needed. (Separate local-option meals and room-occupancy taxes exist but are a different tax category, not tracked here.)",
  };
  if (!bypassCache) {
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
  }
  return snapshot;
}
