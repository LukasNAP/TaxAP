import { createHash } from "node:crypto";
import { readXlsxRows } from "./xlsx-utils.mjs";

export const VIRGINIA_RATES_URL = "https://www.tax.virginia.gov/sales-tax-rate-and-locality-code-lookup";
export const VIRGINIA_RATES_DOWNLOAD_URL = "https://www.tax.virginia.gov/sites/default/files/inline-files/sales-tax-rates.xlsx";

// Confirmed live 2026-08-27: the workbook's own document metadata (dcterms:modified) reads
// 2023-07-14 - genuinely the state's own currently-hosted file, not a stale mirror, matching the
// freshness flag already raised in docs/states/va.md. An earlier investigation independently
// cross-checked A+'s live rates against Virginia Tax's own published bulletins (TB 21-6, TB 22-7)
// for every real regional/local-option overlay and found no discrepancy - this file's age alone is
// not treated as disqualifying, but is exposed on the snapshot so it stays visible.
const KNOWN_STALE_SINCE = "2023-07-14";

const PLAUSIBLE_RATE_MIN = 4;
const PLAUSIBLE_RATE_MAX = 9;

function toPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number((number * 100).toFixed(4));
}

/**
 * Parses Virginia Tax's official sales-tax-rates.xlsx. Real, confirmed schema (2026-08-27): row 3
 * is the header, data starts row 4, columns are State FIPS / County-or-City FIPS / Locality Name /
 * Total General Sales Tax / ... Locality Name already distinguishes county vs. independent city
 * with a literal " County" or " City" suffix (e.g. "Accomack County", "Waynesboro City") - this is
 * the real disambiguation Virginia's county/city name-duplicate pairs (Fairfax, Franklin, Richmond,
 * Roanoke) need, not something this adapter has to infer.
 */
export function parseVirginiaRateWorkbook(buffer) {
  const rows = readXlsxRows(buffer);
  const header = rows[2] ?? {};
  if (header.A !== "State Code (FIPS)" || header.C !== "Locality Name" || header.D !== "Total General Sales Tax") {
    throw new Error("Virginia's rate workbook header no longer matches the expected column layout.");
  }
  const localities = [];
  for (const row of rows.slice(3)) {
    if (!row.A || !row.C) continue;
    if (row.A !== "51") throw new Error(`Virginia's rate workbook contained a non-Virginia state FIPS code (${row.A}).`);
    const name = String(row.C).trim();
    const isCity = /\sCity$/i.test(name);
    const isCounty = /\sCounty$/i.test(name);
    if (!isCity && !isCounty) throw new Error(`Virginia's rate workbook has a locality name with no recognizable County/City suffix: "${name}".`);
    const bareName = name.replace(/\s(?:County|City)$/i, "").trim();
    const totalGeneralRate = toPercent(row.D);
    if (totalGeneralRate === null || totalGeneralRate < PLAUSIBLE_RATE_MIN || totalGeneralRate > PLAUSIBLE_RATE_MAX) {
      throw new Error(`Virginia's rate workbook has an implausible total rate for ${name} (${row.D}).`);
    }
    localities.push({
      jurisdictionType: isCity ? "city" : "county",
      jurisdictionCode: `51${String(row.B).padStart(3, "0")}`,
      name,
      bareName,
      componentRate: null,
      totalGeneralRate,
      generalInterstateRate: totalGeneralRate,
      beginDate: null,
      endDate: null,
    });
  }
  if (localities.length !== 133) throw new Error(`Virginia's rate workbook returned ${localities.length} localities instead of the expected 133 (95 counties + 38 independent cities).`);
  const counties = localities.filter((row) => row.jurisdictionType === "county").length;
  const cities = localities.filter((row) => row.jurisdictionType === "city").length;
  if (counties !== 95 || cities !== 38) throw new Error(`Virginia's rate workbook returned ${counties} counties and ${cities} cities instead of the expected 95 and 38.`);
  return localities;
}

async function fetchWorkbook(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { headers: { "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Virginia Tax returned HTTP ${response.status}.`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 3_000 || buffer.readUInt32LE(0) !== 0x04034b50) throw new Error("Virginia Tax did not return the expected XLSX rate workbook.");
    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;

export async function readOfficialVaRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  const buffer = await fetchWorkbook(VIRGINIA_RATES_DOWNLOAD_URL, fetchImpl);
  const rates = parseVirginiaRateWorkbook(buffer);
  const snapshot = {
    stateCode: "VA",
    source: "Virginia Department of Taxation",
    sourceUrl: VIRGINIA_RATES_URL,
    machineReadableSourceUrl: VIRGINIA_RATES_DOWNLOAD_URL,
    retrievedAt: now.toISOString(),
    asOfDate: KNOWN_STALE_SINCE,
    stateRate: 4.3,
    sourceHash: createHash("sha256").update(buffer).digest("hex"),
    rates,
    counts: { counties: rates.filter((r) => r.jurisdictionType === "county").length, cities: rates.filter((r) => r.jurisdictionType === "city").length, specialJurisdictions: 0 },
    boundaryStatus: "All 133 real Virginia counties and independent cities are connected. Virginia's own county/city name-duplicate pairs (Fairfax, Franklin, Richmond, Roanoke) are disambiguated by the workbook's literal County/City suffix, not inferred.",
  };
  if (!bypassCache) {
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
  }
  return snapshot;
}
