import { createHash } from "node:crypto";

// NJ Division of Taxation. Per an explicit prior decision (see docs/states/nj.md), the stale
// 2018 Streamlined Sales Tax file is NOT used for NJ - SST appears to have stopped publishing a
// current NJ file entirely. These two nj.gov pages are the real, live, current source instead.
export const NJ_USE_TAX_FAQ_URL = "https://www.nj.gov/treasury/taxation/su_10.shtml";
export const NJ_RATE_CHANGE_URL = "https://www.nj.gov/treasury/taxation/ratechange/su-salestax.shtml";

// Plausibility bounds only - never used to fabricate a rate, only to reject an implausible parse
// (e.g. a decimal-point scraping error) rather than silently trusting it. NJ's rate has been in
// the 6-7% range for decades; a value outside a generous 4-10% band means something changed in
// the page's wording that this parser no longer understands, not a real new NJ rate.
const PLAUSIBLE_RATE_MIN = 4;
const PLAUSIBLE_RATE_MAX = 10;

// A real, confirmed New Jersey exception this adapter deliberately does NOT model: certified
// Urban Enterprise Zone / Salem County retailers may charge half the standard rate on qualifying
// in-person retail sales. This is a seller-certification property (does Atlantic hold a UZ-2
// certificate for a location?), not a ship-to/jurisdiction property, and A+'s XATXBD has no
// UEZ-specific tax-body code at all (confirmed live, see docs/states/nj.md). Per the project's
// "never guess" rule, this is surfaced as a caveat rather than silently assumed resolved either
// way (not applicable vs. applies-but-unmodeled) - a human needs to confirm Atlantic's own UEZ/
// Salem County seller-certification status before this can be ruled in or out.
export const NJ_UEZ_CAVEAT =
  "New Jersey has a real Urban Enterprise Zone / Salem County reduced-rate program (half the " +
  "standard rate) for qualifying in-person retail sales by a seller holding a UZ-2 certificate. " +
  "This depends on the seller's (Atlantic's) own certification status, not on the ship-to " +
  "address, and A+ has no UEZ-specific tax body to reflect it either way. Not resolved by this " +
  "adapter - confirm Atlantic's UEZ/Salem County seller-certification status before assuming the " +
  "flat statewide rate applies to every NJ ship-to without exception, or before assuming it never " +
  "does.";

function decodeHtml(value) {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function assertPlausibleRate(rate, label) {
  if (!Number.isFinite(rate) || rate < PLAUSIBLE_RATE_MIN || rate > PLAUSIBLE_RATE_MAX) {
    throw new Error(`NJ Division of Taxation returned an implausible ${label} (${rate}%); refusing to trust it.`);
  }
}

function parseUsLongDate(value) {
  const match = String(value).trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) throw new Error(`NJ Division of Taxation used an unrecognized date format: "${value}".`);
  const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]} 00:00:00 UTC`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`NJ Division of Taxation used an invalid date: "${value}".`);
  return parsed.toISOString().slice(0, 10);
}

// Matches sentences of the shape "6.625% on purchases made in 2018 and after" - the actual
// wording confirmed live on su_10.shtml (both the Sales Tax and Use Tax statements use this
// phrasing, since NJ's Use Tax rate is explicitly defined as identical to the Sales Tax rate).
const RATE_STATEMENT_PATTERN = /(\d+(?:\.\d+)?)%\s+on purchases made in\s+(\d{4})\s+and after/gi;

/**
 * Parses the plain-text rendering of NJ's Sales/Use Tax FAQ page for the currently-stated flat
 * rate. New Jersey has no county or municipal local-option sales tax at all (confirmed live
 * against A+'s XATXBD - a single NJ000 tax body covers the whole state, see docs/states/nj.md),
 * so there is no table to parse and no jurisdiction breakdown to validate - just one number that
 * has to be found and trusted only if it's stated unambiguously.
 */
export function parseNjRateStatementHtml(html) {
  const text = decodeHtml(html);
  const matches = [...text.matchAll(RATE_STATEMENT_PATTERN)];
  if (matches.length === 0) {
    throw new Error('NJ Division of Taxation FAQ page does not contain the expected "X% on purchases made in YYYY and after" rate statement.');
  }
  const distinct = new Map(matches.map((match) => [`${match[1]}|${match[2]}`, { rate: Number(match[1]), sinceYear: Number(match[2]) }]));
  if (distinct.size > 1) {
    const found = [...distinct.values()].map((entry) => `${entry.rate}% since ${entry.sinceYear}`).join(" vs. ");
    throw new Error(`NJ Division of Taxation FAQ page states disagreeing rates in different places: ${found}.`);
  }
  const statement = [...distinct.values()][0];
  assertPlausibleRate(statement.rate, "current rate");
  return statement;
}

// Supports the earlier prose sentence and NJ's current two-heading layout. The heading-only form
// is accepted only when its associated transition-period heading also supplies the effective date.
const RATE_CHANGE_PATTERN = /rate\s+(?:decreased|increased|changed|dropped|rose)\s+from\s+(\d+(?:\.\d+)?)%\s+to\s+(\d+(?:\.\d+)?)%[^.]*?effective\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})/i;
const RATE_TRANSITION_TITLE_PATTERN = /Sales\s+Tax\s+Transition\s+from\s+(\d+(?:\.\d+)?)%\s+to\s+(\d+(?:\.\d+)?)%/i;
const RATE_TRANSITION_DATE_PATTERN = /but\s+Not\s+Completed\s+Until\s+On\s+or\s+After\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})/i;

/**
 * Parses NJ's rate-change history page for the most recent statewide rate transition. Cross-
 * checked against parseNjRateStatementHtml's output in readOfficialNjRates rather than trusted
 * alone - two independently-worded nj.gov pages agreeing is the closest thing to confirmation
 * available without a machine-readable source.
 */
export function parseNjRateChangeHtml(html) {
  const text = decodeHtml(html);
  const sentenceMatch = text.match(RATE_CHANGE_PATTERN);
  const titleMatch = text.match(RATE_TRANSITION_TITLE_PATTERN);
  const titleDateMatch = text.match(RATE_TRANSITION_DATE_PATTERN);
  if (!sentenceMatch && (!titleMatch || !titleDateMatch)) {
    throw new Error("NJ Division of Taxation rate-change page does not describe a recognizable statewide rate transition (\"from X% to Y% effective <date>\").");
  }
  const fromRate = Number(sentenceMatch?.[1] ?? titleMatch?.[1]);
  const toRate = Number(sentenceMatch?.[2] ?? titleMatch?.[2]);
  const effectiveDateText = sentenceMatch?.[3] ?? titleDateMatch?.[1];
  assertPlausibleRate(fromRate, "prior rate");
  assertPlausibleRate(toRate, "new rate");
  if (fromRate === toRate) throw new Error("NJ Division of Taxation rate-change page describes a transition with no actual rate change.");
  return { fromRate, toRate, effectiveDate: parseUsLongDate(effectiveDateText) };
}

async function fetchOfficialPage(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`NJ Division of Taxation returned HTTP ${response.status} for ${url}.`);
    const html = await response.text();
    if (html.length < 500) throw new Error(`NJ Division of Taxation returned an unexpectedly small response for ${url}.`);
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

/**
 * Reads and cross-validates New Jersey's current flat statewide sales/use tax rate directly from
 * the NJ Division of Taxation (not the stale 2018 Streamlined Sales Tax file - see
 * docs/states/nj.md for why). New Jersey has no local-option sales tax at all, so unlike every
 * county/city-based adapter in this codebase, there is exactly one jurisdiction and one number:
 * no boundary or address matching is ever needed for the general rate.
 *
 * This produces only the official-source half of NJ support - it does not touch A+'s XATXBD.
 * A separate, documented caveat (NJ_UEZ_CAVEAT) covers the one real exception this adapter
 * deliberately does not resolve: NJ's Urban Enterprise Zone / Salem County reduced rate, which
 * depends on the seller's own certification, not on any ship-to's jurisdiction.
 */
export async function readOfficialNjRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const [faqHtml, changeHtml] = await Promise.all([
      fetchOfficialPage(NJ_USE_TAX_FAQ_URL, fetchImpl),
      fetchOfficialPage(NJ_RATE_CHANGE_URL, fetchImpl),
    ]);
    const statement = parseNjRateStatementHtml(faqHtml);
    const change = parseNjRateChangeHtml(changeHtml);
    if (statement.rate !== change.toRate) {
      throw new Error(`NJ Division of Taxation pages disagree on the current rate: FAQ page says ${statement.rate}%, rate-change page's most recent transition lands on ${change.toRate}%.`);
    }
    if (statement.sinceYear !== Number(change.effectiveDate.slice(0, 4))) {
      throw new Error(`NJ Division of Taxation pages disagree on when the current rate took effect: FAQ page says ${statement.sinceYear}, rate-change page says ${change.effectiveDate}.`);
    }
    const rate = statement.rate;
    const snapshot = {
      stateCode: "NJ",
      source: "New Jersey Division of Taxation",
      sourceUrl: NJ_USE_TAX_FAQ_URL,
      machineReadableSourceUrl: null,
      retrievedAt: now.toISOString(),
      asOfDate: now.toISOString().slice(0, 10),
      stateRate: rate,
      sourceHash: createHash("sha256").update(faqHtml).update(changeHtml).digest("hex"),
      rates: [{
        jurisdictionType: "state",
        jurisdictionCode: "NJ",
        name: "New Jersey",
        componentRate: rate,
        totalGeneralRate: rate,
        generalInterstateRate: rate,
        beginDate: change.effectiveDate,
        endDate: null,
      }],
      counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
      boundaryStatus: "New Jersey has no county or municipal local-option sales tax - a single flat statewide rate applies to every ship-to. A+ confirms this: exactly one XATXBD tax body (NJ000) exists for the whole state, and 599 of 600 active NJ ship-tos are already assigned to it (the one exception is a border ship-to correctly taxed in a neighboring state's jurisdiction, not a bug). No address or boundary matching is ever needed for the general rate.",
      caveats: [NJ_UEZ_CAVEAT],
    };
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
    return snapshot;
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try {
    return await read;
  } finally {
    inFlightRead = null;
  }
}
