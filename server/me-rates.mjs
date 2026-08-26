import { createHash } from "node:crypto";

// Maine Revenue Services' own rate/due-date table. Confirmed live 2026-08-26 (see docs/states/me.md):
// a plain HTML table, "General Sales" row, one column per historical effective-date change - the
// most recent column is the current rate. No JS rendering issue like Maryland's FAQ page.
export const MAINE_RATES_URL = "https://www.maine.gov/revenue/taxes/sales-use-service-provider-tax/rates-due-dates";

const PLAUSIBLE_RATE_MIN = 3;
const PLAUSIBLE_RATE_MAX = 10;

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .trim();
}

function extractCellText(cellHtml) {
  return decodeHtml(cellHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

/** Splits one <table>...</table> block into an array of rows, each an array of cell text strings. */
function parseHtmlTableRows(tableHtml) {
  const rows = [];
  for (const rowMatch of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) => extractCellText(cellMatch[1]));
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

/**
 * Parses Maine Revenue Services' rate/due-date page for the current "General Sales" rate. The page's
 * first table lists one row per rate category (General Sales, Prepared Food, Use Tax, ...) with one
 * column per historical effective-date change - Maine's own confirmed structure (2026-08-26), not
 * assumed. The rightmost non-empty "General Sales" cell is the current rate. Cross-validated against
 * the "Use Tax" row, which Maine law sets identical to the general sales rate - if they ever disagree,
 * this is a real signal the page changed shape, not something to average away.
 */
export function parseMaineRateTable(html) {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) throw new Error("Maine Revenue Services' rate page does not contain a recognizable rate table.");
  const rows = parseHtmlTableRows(tableMatch[0]);
  const header = rows[0] ?? [];
  if (!header.some((cell) => /effective/i.test(cell))) {
    throw new Error('Maine Revenue Services\' rate table header no longer contains an "Effective ..." column - the page format may have changed.');
  }
  const findRow = (label) => rows.find((row) => row[0]?.trim().toLowerCase() === label);
  const generalSalesRow = findRow("general sales");
  const useTaxRow = findRow("use tax");
  if (!generalSalesRow) throw new Error('Maine Revenue Services\' rate table no longer has a "General Sales" row.');
  const lastNonEmpty = (row) => [...row].slice(1).reverse().find((cell) => cell && cell !== " ");
  const generalCell = lastNonEmpty(generalSalesRow);
  const rateMatch = generalCell?.match(/^(\d+(?:\.\d+)?)%$/);
  if (!rateMatch) throw new Error(`Maine Revenue Services' "General Sales" row's most recent value ("${generalCell ?? ""}") is not a plain percentage.`);
  const rate = Number(rateMatch[1]);
  if (!Number.isFinite(rate) || rate < PLAUSIBLE_RATE_MIN || rate > PLAUSIBLE_RATE_MAX) {
    throw new Error(`Maine Revenue Services returned an implausible general sales tax rate (${rate}%); refusing to trust it.`);
  }
  if (useTaxRow) {
    const useCell = lastNonEmpty(useTaxRow);
    if (useCell && useCell !== generalCell) {
      throw new Error(`Maine Revenue Services' General Sales (${generalCell}) and Use Tax (${useCell}) rows disagree - refusing to trust either.`);
    }
  }
  return rate;
}

async function fetchOfficialPage(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Maine Revenue Services returned HTTP ${response.status}.`);
    const html = await response.text();
    if (html.length < 500) throw new Error("Maine Revenue Services returned an unexpectedly small response.");
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;

/**
 * Maine has no local-option sales tax at all (confirmed live against A+'s XATXBD - a single ME000
 * tax body covers 100% of active ME ship-tos, see docs/states/me.md) - a single flat statewide rate,
 * no address or boundary matching ever needed.
 */
export async function readOfficialMeRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  const html = await fetchOfficialPage(MAINE_RATES_URL, fetchImpl);
  const rate = parseMaineRateTable(html);
  const snapshot = {
    stateCode: "ME",
    source: "Maine Revenue Services",
    sourceUrl: MAINE_RATES_URL,
    machineReadableSourceUrl: null,
    retrievedAt: now.toISOString(),
    asOfDate: now.toISOString().slice(0, 10),
    stateRate: rate,
    sourceHash: createHash("sha256").update(html).digest("hex"),
    rates: [{
      jurisdictionType: "state", jurisdictionCode: "ME", name: "Maine",
      componentRate: rate, totalGeneralRate: rate, generalInterstateRate: rate,
      beginDate: null, endDate: null,
    }],
    counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
    boundaryStatus: "Maine has no local-option sales tax - a single flat statewide rate applies to every ship-to. No address or boundary matching is ever needed.",
  };
  if (!bypassCache) {
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
  }
  return snapshot;
}
