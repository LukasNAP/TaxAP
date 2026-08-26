import { createHash } from "node:crypto";

// Connecticut Department of Revenue Services. Confirmed live 2026-08-26 (see docs/states/ct.md):
// a plain HTML text page - no JS rendering issue, no bot block observed.
export const CT_RATES_URL = "https://portal.ct.gov/drs/sales-tax/tax-information";

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

// Matches DRS's own stated sentence: "The sales tax rate of 6.35% applies to the retail sale, lease,
// or rental of most goods ... and taxable services." Anchoring on this exact phrasing (rather than
// grabbing the first "X%" on the page) avoids Connecticut's separate category-specific rates (e.g.
// digital goods, short-term vehicle rental) mentioned elsewhere on the same page.
const RATE_PATTERN = /sales tax rate of (\d+(?:\.\d+)?)%\s+applies to the retail sale/i;

/**
 * Parses Connecticut DRS's sales-tax information page for the current general sales tax rate.
 * Connecticut abolished county government in 1960 and has never enacted a local-option sales tax
 * (confirmed live against A+'s XATXBD - a single CT000 tax body covers 100% of active CT ship-tos,
 * see docs/states/ct.md), so there is exactly one number to find, not a jurisdiction table.
 */
export function parseCtRatePage(html) {
  const text = plainText(html);
  const match = text.match(RATE_PATTERN);
  if (!match) {
    throw new Error('Connecticut DRS\'s tax-information page does not contain the expected "sales tax rate of X% applies to the retail sale" statement.');
  }
  const rate = Number(match[1]);
  if (!Number.isFinite(rate) || rate < PLAUSIBLE_RATE_MIN || rate > PLAUSIBLE_RATE_MAX) {
    throw new Error(`Connecticut DRS returned an implausible general sales tax rate (${rate}%); refusing to trust it.`);
  }
  return rate;
}

async function fetchOfficialPage(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Connecticut DRS returned HTTP ${response.status}.`);
    const html = await response.text();
    if (html.length < 500) throw new Error("Connecticut DRS returned an unexpectedly small response.");
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;

export async function readOfficialCtRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  const html = await fetchOfficialPage(CT_RATES_URL, fetchImpl);
  const rate = parseCtRatePage(html);
  const snapshot = {
    stateCode: "CT",
    source: "Connecticut Department of Revenue Services",
    sourceUrl: CT_RATES_URL,
    machineReadableSourceUrl: null,
    retrievedAt: now.toISOString(),
    asOfDate: now.toISOString().slice(0, 10),
    stateRate: rate,
    sourceHash: createHash("sha256").update(html).digest("hex"),
    rates: [{
      jurisdictionType: "state", jurisdictionCode: "CT", name: "Connecticut",
      componentRate: rate, totalGeneralRate: rate, generalInterstateRate: rate,
      beginDate: null, endDate: null,
    }],
    counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
    boundaryStatus: "Connecticut abolished county government in 1960 and has no local-option sales tax - a single flat statewide rate applies to every ship-to. No address or boundary matching is ever needed.",
  };
  if (!bypassCache) {
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
  }
  return snapshot;
}
