import { createHash } from "node:crypto";

export const CALIFORNIA_DOR_RATES_URL = "https://cdtfa.ca.gov/taxes-and-fees/rates.aspx";
export const CALIFORNIA_DOR_OVERVIEW_URL = "https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm";
export const CALIFORNIA_STATE_RATE = 7.25;

function decodeHtml(value) {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateLabel(value) {
  const parsed = new Date(`${value} 00:00:00 UTC`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`CDTFA returned an invalid effective date: ${value}`);
  return parsed.toISOString().slice(0, 10);
}

export function parseCaliforniaRatesHtml(html, { expectedCountyCount = 58 } = {}) {
  const source = String(html);
  const effectiveMatch = source.match(/Sales\s*&amp;\s*Use Tax Rates\s*\(effective\s+([^)]+)\)/i)
    ?? source.match(/Sales\s*(?:&amp;|&)\s*Use Tax Rates\s*\(effective\s+([^)]+)\)/i);
  if (!effectiveMatch) throw new Error("CDTFA did not identify the effective date for its current rate table.");
  const effectiveDate = parseDateLabel(decodeHtml(effectiveMatch[1]));
  const updatedMatch = source.match(/Data Last Updated:\s*([^<]+)/i);
  const lastUpdated = updatedMatch ? parseDateLabel(decodeHtml(updatedMatch[1])) : null;
  const table = source.match(/<table\b[^>]*id=["']ratesTable["'][^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!table) throw new Error("CDTFA is missing the expected current city and county rate table.");

  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[1]));
    if (cells.length !== 5 || !/^(City|County)$/i.test(cells[3])) return [];
    const rateMatch = cells[1].match(/^(\d+(?:\.\d+)?)%$/);
    if (!rateMatch) return [];
    const totalGeneralRate = Number(rateMatch[1]);
    if (totalGeneralRate < CALIFORNIA_STATE_RATE || totalGeneralRate > 15) {
      throw new Error(`CDTFA returned an invalid total rate for ${cells[0]}.`);
    }
    const jurisdictionType = cells[3].toLowerCase();
    return [{
      jurisdictionType,
      jurisdictionCode: `${jurisdictionType}:${cells[2]}:${cells[0]}`.toUpperCase(),
      name: cells[0],
      county: cells[2],
      componentRate: Number((totalGeneralRate - CALIFORNIA_STATE_RATE).toFixed(4)),
      totalGeneralRate,
      generalInterstateRate: totalGeneralRate,
      beginDate: effectiveDate,
      endDate: null,
      notes: cells[4] || null,
    }];
  });
  const uniqueKeys = new Set(rows.map((row) => `${row.jurisdictionType}:${row.county}:${row.name}`));
  if (uniqueKeys.size !== rows.length) throw new Error("CDTFA returned duplicate current jurisdiction rows.");
  const counties = new Set(rows.map((row) => row.county));
  if (counties.size !== expectedCountyCount) {
    throw new Error(`CDTFA current rate table covers ${counties.size} counties instead of ${expectedCountyCount}.`);
  }
  if (rows.length < expectedCountyCount) throw new Error("CDTFA returned an incomplete current rate table.");
  return { effectiveDate, lastUpdated, rates: rows };
}

async function fetchOfficialHtml(fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(CALIFORNIA_DOR_RATES_URL, {
      headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`CDTFA returned HTTP ${response.status}.`);
    const html = await response.text();
    if (html.length < 50_000) throw new Error("CDTFA returned an unexpectedly small rate page.");
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialCaRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const html = await fetchOfficialHtml(fetchImpl);
    const parsed = parseCaliforniaRatesHtml(html);
    const snapshot = {
      stateCode: "CA",
      source: "California Department of Tax and Fee Administration",
      sourceUrl: CALIFORNIA_DOR_OVERVIEW_URL,
      machineReadableSourceUrl: CALIFORNIA_DOR_RATES_URL,
      retrievedAt: now.toISOString(),
      asOfDate: now.toISOString().slice(0, 10),
      stateRate: CALIFORNIA_STATE_RATE,
      sourceHash: createHash("sha256").update(html).digest("hex"),
      rates: parsed.rates,
      counts: {
        counties: parsed.rates.filter((row) => row.jurisdictionType === "county").length,
        cities: parsed.rates.filter((row) => row.jurisdictionType === "city").length,
        specialJurisdictions: 0,
      },
      effectivePeriod: `Effective ${parsed.effectiveDate}`,
      boundaryStatus: "Current city and county totals are connected. Exact ship-to jurisdiction matching remains a separate aggregate reconciliation step.",
    };
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
    return snapshot;
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
