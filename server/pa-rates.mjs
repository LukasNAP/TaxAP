import { createHash } from "node:crypto";

export const PENNSYLVANIA_DOR_RATES_URL = "https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax";
export const PENNSYLVANIA_LOCAL_CHANGE_URL = "https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/local-sales-tax";
export const PENNSYLVANIA_COUNTY_NAMES_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_gaz_counties_42.txt";

function plainText(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePennsylvaniaRateRules(html) {
  const text = plainText(html);
  const stateRate = /(?:statewide\s+)?sales(?:\s+and\s+use)?\s+tax\s+rate\s+is\s+6\s*(?:percent|%)/i.test(text)
    || /6\s*(?:percent|%)\s+(?:statewide\s+)?sales(?:\s+and\s+use)?\s+tax/i.test(text) ? 6 : null;
  const alleghenyLocalRate = /Allegheny[\s\S]{0,180}?1\s*(?:percent|%)/i.test(text)
    || /1\s*(?:percent|%)[\s\S]{0,180}?Allegheny/i.test(text) ? 1 : null;
  const philadelphiaLocalRate = /Philadelphia[\s\S]{0,180}?2\s*(?:percent|%)/i.test(text)
    || /2\s*(?:percent|%)[\s\S]{0,180}?Philadelphia/i.test(text) ? 2 : null;
  if (stateRate === null || alleghenyLocalRate === null || philadelphiaLocalRate === null) {
    throw new Error("Pennsylvania's official page did not contain the expected 6%, Allegheny 1%, and Philadelphia 2% rules.");
  }
  return { stateRate, alleghenyLocalRate, philadelphiaLocalRate };
}

export function parsePennsylvaniaCountyNames(text) {
  const rows = String(text).split(/\r?\n/).filter(Boolean).map((line) => line.split("|"));
  const headers = rows[0] ?? [];
  const geoidIndex = headers.indexOf("GEOID");
  const nameIndex = headers.indexOf("NAME");
  if (geoidIndex < 0 || nameIndex < 0) throw new Error("Census Gazetteer is missing Pennsylvania county identifiers.");
  const counties = rows.slice(1).filter((row) => row[geoidIndex]?.startsWith("42")).map((row) => ({
    jurisdictionCode: row[geoidIndex].slice(2),
    name: row[nameIndex].replace(/ County$/i, ""),
  }));
  if (counties.length !== 67) throw new Error(`Pennsylvania county source returned ${counties.length} counties instead of 67.`);
  if (new Set(counties.map((county) => county.jurisdictionCode)).size !== 67) throw new Error("Pennsylvania county source contains duplicate FIPS codes.");
  return counties;
}

async function fetchText(url, fetchImpl, accept) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { headers: { Accept: accept, "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Official rate source returned HTTP ${response.status}.`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialPaRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const [officialHtml, countyText] = await Promise.all([
      fetchText(PENNSYLVANIA_DOR_RATES_URL, fetchImpl, "text/html"),
      fetchText(PENNSYLVANIA_COUNTY_NAMES_URL, fetchImpl, "text/plain"),
    ]);
    const rules = parsePennsylvaniaRateRules(officialHtml);
    const counties = parsePennsylvaniaCountyNames(countyText);
    const rates = counties.map((county) => {
      const localRate = county.name === "Allegheny" ? rules.alleghenyLocalRate : county.name === "Philadelphia" ? rules.philadelphiaLocalRate : 0;
      return {
        jurisdictionType: "county",
        jurisdictionCode: county.jurisdictionCode,
        name: county.name,
        componentRate: localRate,
        totalGeneralRate: rules.stateRate + localRate,
        generalInterstateRate: rules.stateRate + localRate,
        beginDate: null,
        endDate: null,
      };
    }).sort((left, right) => left.name.localeCompare(right.name));
    const snapshot = {
      stateCode: "PA",
      source: "Pennsylvania Department of Revenue",
      sourceUrl: PENNSYLVANIA_DOR_RATES_URL,
      machineReadableSourceUrl: PENNSYLVANIA_COUNTY_NAMES_URL,
      retrievedAt: now.toISOString(),
      asOfDate: now.toISOString().slice(0, 10),
      stateRate: rules.stateRate,
      sourceHash: createHash("sha256").update(officialHtml).update(countyText).digest("hex"),
      rates,
      counts: { counties: rates.length, cities: 0, specialJurisdictions: 0 },
      boundaryStatus: "Official statewide and local add-on rules are connected. The separate Pennsylvania destination-sourcing publication remains a workflow notice, not a rate change.",
      notices: [{
        title: "Local sales tax sourcing change",
        sourceUrl: PENNSYLVANIA_LOCAL_CHANGE_URL,
        summary: "Pennsylvania published a destination-sourcing change affecting Philadelphia and Allegheny County collection responsibilities. Review the official notice before changing A+.",
      }],
    };
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
    return snapshot;
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
