import { createHash } from "node:crypto";

// Mississippi Department of Revenue. Confirmed live 2026-08-26 (see docs/states/ms.md): a plain
// HTML page organized by sale category, each with its own "subject to sales tax equal to X% ..."
// statement - the general "Retail Sales" section's "Sale of tangible personal property" line is the
// one this project tracks (the general rate), not the many other category-specific lines on the
// same page (utilities, admissions, etc., some of which share the same 7% by coincidence).
export const MS_RATES_URL = "https://www.dor.ms.gov/business/sales-use-tax/sales-tax-rates";

// dor.ms.gov's certificate (a legitimate GlobalSign-issued cert for the real Mississippi Department
// of Information Technology Services domain, confirmed via `openssl s_client` 2026-08-26) fails
// Node's default bundled CA verification with UNABLE_TO_VERIFY_LEAF_SIGNATURE - Node's own root
// store doesn't happen to include the intermediate this chain needs, even though the OS trust store
// does. This is why `npm run dev:connector` runs with `--use-system-ca` (see package.json) - not a
// sign this source is untrustworthy.

const PLAUSIBLE_RATE_MIN = 3;
const PLAUSIBLE_RATE_MAX = 10;

// A real, confirmed Mississippi exception this adapter deliberately does NOT model: Jackson (+1%)
// and Tupelo (+0.25%) each impose their own narrow, city-specific levy on top of the general 7%
// rate, published by MS DOR on separate standalone pages, not the main rate table this adapter
// parses. A+ has no MS-prefixed tax body besides the single flat MS000 (confirmed live, see
// docs/states/ms.md), so there is no way to tell from A+ data alone whether any ship-to is
// physically inside either city. Per the project's "never guess" rule, surfaced as a caveat rather
// than silently assumed resolved either way.
export const MS_CITY_LEVY_CAVEAT =
  "Mississippi has two real, narrow city-specific levies not modeled by this adapter: Jackson " +
  "(+1%) and Tupelo (+0.25%), each published by MS DOR on its own standalone page rather than the " +
  "main rate table. A+ has no MS-prefixed tax body besides the single flat MS000, so whether any " +
  "ship-to is physically inside Jackson or Tupelo city limits cannot be determined from A+ data " +
  "alone. Not resolved by this adapter - confirm whether any active MS ship-tos are in either city " +
  "before treating the flat 7% comparison as complete for 100% of Mississippi's book of business.";

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

// Anchored on the specific statutory line item ("Sale of tangible personal property ...... X%")
// rather than the first "X%" found after the "Retail Sales" heading, since that heading is
// immediately followed by several other category-specific lines (groceries, farm equipment, etc.)
// at different rates.
const RETAIL_SALES_SECTION_PATTERN = /Retail Sales[\s\S]{0,600}?Sale of tangible personal property\s*\.{2,}\s*(\d+(?:\.\d+)?)%/i;

/**
 * Parses the Mississippi DOR sales-tax-rates page for the current general retail rate. Mississippi
 * has no general local-option sales tax (confirmed live against A+'s XATXBD - a single MS000 tax
 * body covers 267 of 270 active MS ship-tos, see docs/states/ms.md), so a single statewide rate is
 * the correct shape - but see MS_CITY_LEVY_CAVEAT for the two narrow exceptions this doesn't cover.
 */
export function parseMsRatePage(html) {
  const text = plainText(html);
  const match = text.match(RETAIL_SALES_SECTION_PATTERN);
  if (!match) {
    throw new Error('Mississippi DOR\'s rate page does not contain the expected "Retail Sales ... Sale of tangible personal property ...... X%" line under its Retail Sales section.');
  }
  const rate = Number(match[1]);
  if (!Number.isFinite(rate) || rate < PLAUSIBLE_RATE_MIN || rate > PLAUSIBLE_RATE_MAX) {
    throw new Error(`Mississippi DOR returned an implausible general sales tax rate (${rate}%); refusing to trust it.`);
  }
  return rate;
}

async function fetchOfficialPage(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Mississippi DOR returned HTTP ${response.status}.`);
    const html = await response.text();
    if (html.length < 500) throw new Error("Mississippi DOR returned an unexpectedly small response.");
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;

export async function readOfficialMsRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  const html = await fetchOfficialPage(MS_RATES_URL, fetchImpl);
  const rate = parseMsRatePage(html);
  const snapshot = {
    stateCode: "MS",
    source: "Mississippi Department of Revenue",
    sourceUrl: MS_RATES_URL,
    machineReadableSourceUrl: null,
    retrievedAt: now.toISOString(),
    asOfDate: now.toISOString().slice(0, 10),
    stateRate: rate,
    sourceHash: createHash("sha256").update(html).digest("hex"),
    rates: [{
      jurisdictionType: "state", jurisdictionCode: "MS", name: "Mississippi",
      componentRate: rate, totalGeneralRate: rate, generalInterstateRate: rate,
      beginDate: null, endDate: null,
    }],
    counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
    boundaryStatus: "Mississippi has no general local-option sales tax - a single flat statewide rate applies to the vast majority of ship-tos. No address or boundary matching is needed for the general case, but see the Jackson/Tupelo caveat.",
    caveats: [MS_CITY_LEVY_CAVEAT],
  };
  if (!bypassCache) {
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
  }
  return snapshot;
}
