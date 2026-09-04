import { createHash } from "node:crypto";

export const ARIZONA_DOR_RATE_TABLE_URL = "https://azdor.gov/business/transaction-privilege-tax/tax-rate-table";
export const ARIZONA_RETAIL_BUSINESS_CODE = "017";
export const ARIZONA_STATE_RETAIL_RATE = 5.6;

// Stable incorporated-place geography used only to combine AZDOR's city component with its
// county total. Tax rates themselves still come from the current official file.
export const AZ_CITY_COUNTY = new Map([
  ["PHOENIX", "MARICOPA"], ["TUCSON", "PIMA"], ["CHANDLER", "MARICOPA"], ["TEMPE", "MARICOPA"],
  ["SCOTTSDALE", "MARICOPA"], ["GLENDALE", "MARICOPA"], ["MESA", "MARICOPA"], ["NOGALES", "SANTA CRUZ"],
  ["YUMA", "YUMA"], ["GILBERT", "MARICOPA"], ["GOODYEAR", "MARICOPA"], ["TOLLESON", "MARICOPA"],
  ["LAKE HAVASU CITY", "MOHAVE"], ["DOUGLAS", "COCHISE"], ["SAN LUIS", "YUMA"], ["LITCHFIELD PARK", "MARICOPA"],
  ["BULLHEAD CITY", "MOHAVE"], ["PRESCOTT VALLEY", "YAVAPAI"], ["PRESCOTT", "YAVAPAI"], ["QUEEN CREEK", "MARICOPA"],
  ["PEORIA", "MARICOPA"], ["SURPRISE", "MARICOPA"], ["CASA GRANDE", "PINAL"], ["COTTONWOOD", "YAVAPAI"],
  ["ELOY", "PINAL"], ["FLAGSTAFF", "COCONINO"], ["EL MIRAGE", "MARICOPA"], ["KINGMAN", "MOHAVE"],
  ["ORO VALLEY", "PIMA"], ["SAFFORD", "GRAHAM"], ["APACHE JUNCTION", "PINAL"], ["AVONDALE", "MARICOPA"],
  ["MARICOPA", "PINAL"], ["PIMA", "GRAHAM"],
]);

const COUNTY_REGION_CODES = new Set(["APA", "COH", "COC", "GLA", "GRA", "GRN", "LAP", "MAR", "MOH", "NAV", "PMA", "PNL", "STC", "YAV", "YMA"]);

function decodeHtml(value) {
  return String(value).replace(/&amp;/gi, "&").replace(/&#0*39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
}

function csvFields(line) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { fields.push(value); value = ""; }
    else value += character;
  }
  if (quoted) throw new Error("Arizona TPT CSV contains an unterminated quoted field.");
  fields.push(value);
  return fields;
}

function isoDate(value) {
  const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) throw new Error(`Arizona TPT CSV contains an invalid date: ${value}.`);
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

export function findLatestArizonaCsv(html) {
  const links = [...String(html).matchAll(/href=["']([^"']*TPT_RATETABLE_ALL_(\d{8})\.csv)["']/gi)]
    .map((match) => ({ url: new URL(decodeHtml(match[1]), ARIZONA_DOR_RATE_TABLE_URL).href, date: `${match[2].slice(4)}-${match[2].slice(0, 2)}-${match[2].slice(2, 4)}` }))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (links.length === 0) throw new Error("Arizona DOR page did not list an all-business-classifications CSV.");
  return links[0];
}

export function parseArizonaRetailCsv(csv, { asOfDate }) {
  const lines = String(csv).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const headers = csvFields(lines.shift());
  const expected = ["RegionCode", "RegionName", "BusinessCode", "BusinessCodesName", "TaxRate", "TaxRateType", "RateStartDate", "RateEndDate"];
  if (headers.length !== expected.length || expected.some((header, index) => headers[index] !== header)) throw new Error("Arizona TPT CSV schema changed.");
  const rows = lines.map((line) => Object.fromEntries(headers.map((header, index) => [header, csvFields(line)[index]])))
    .filter((row) => row.BusinessCode === ARIZONA_RETAIL_BUSINESS_CODE && isoDate(row.RateStartDate) <= asOfDate && isoDate(row.RateEndDate) >= asOfDate);
  const seen = new Set();
  const rates = rows.map((row) => {
    if (!row.RegionCode || seen.has(row.RegionCode)) throw new Error(`Arizona TPT CSV has a missing or duplicate active retail region code: ${row.RegionCode}.`);
    seen.add(row.RegionCode);
    const componentRate = Number(row.TaxRate);
    if (!Number.isFinite(componentRate) || componentRate < 0 || componentRate > 15 || row.TaxRateType !== "Percent") throw new Error(`Arizona TPT CSV has an invalid retail rate for ${row.RegionCode}.`);
    const jurisdictionType = COUNTY_REGION_CODES.has(row.RegionCode) ? "county" : row.RegionCode.length === 2 ? "city" : "special";
    return {
      jurisdictionType,
      jurisdictionCode: row.RegionCode,
      name: row.RegionName,
      componentRate,
      totalGeneralRate: jurisdictionType === "city" ? null : componentRate,
      generalInterstateRate: jurisdictionType === "city" ? null : componentRate,
      beginDate: isoDate(row.RateStartDate),
      endDate: isoDate(row.RateEndDate) === "9999-12-31" ? null : isoDate(row.RateEndDate),
    };
  });
  const counts = {
    counties: rates.filter((row) => row.jurisdictionType === "county").length,
    cities: rates.filter((row) => row.jurisdictionType === "city").length,
    specialJurisdictions: rates.filter((row) => row.jurisdictionType === "special").length,
  };
  if (counts.counties !== 15 || counts.cities < 80 || counts.specialJurisdictions < 20) throw new Error(`Arizona TPT CSV coverage is incomplete (${counts.counties} counties, ${counts.cities} cities, ${counts.specialJurisdictions} special regions).`);
  return { rates, counts };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialAzRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const headers = { Accept: "text/html,text/csv", "User-Agent": "Mozilla/5.0 TaxAP/0.1 official-rate monitor" };
      const landingResponse = await fetchImpl(ARIZONA_DOR_RATE_TABLE_URL, { headers, signal: controller.signal });
      if (!landingResponse.ok) throw new Error(`Arizona DOR returned HTTP ${landingResponse.status}.`);
      const landingHtml = await landingResponse.text();
      const latest = findLatestArizonaCsv(landingHtml);
      const csvResponse = await fetchImpl(latest.url, { headers, signal: controller.signal });
      if (!csvResponse.ok) throw new Error(`Arizona DOR CSV returned HTTP ${csvResponse.status}.`);
      const csv = await csvResponse.text();
      if (csv.length < 50_000) throw new Error("Arizona DOR returned an unexpectedly short TPT CSV.");
      const parsed = parseArizonaRetailCsv(csv, { asOfDate: latest.date });
      const snapshot = {
        stateCode: "AZ", source: "Arizona Department of Revenue", sourceUrl: ARIZONA_DOR_RATE_TABLE_URL, machineReadableSourceUrl: latest.url,
        retrievedAt: now.toISOString(), asOfDate: latest.date, stateRate: ARIZONA_STATE_RETAIL_RATE,
        sourceHash: createHash("sha256").update(landingHtml).update(csv).digest("hex"),
        rates: [{ jurisdictionType: "state", jurisdictionCode: "AZ", name: "Arizona state retail TPT", componentRate: ARIZONA_STATE_RETAIL_RATE, totalGeneralRate: ARIZONA_STATE_RETAIL_RATE, generalInterstateRate: ARIZONA_STATE_RETAIL_RATE, beginDate: null, endDate: null }, ...parsed.rates],
        counts: parsed.counts,
        effectivePeriod: `Retail business code 017 effective ${latest.date}`,
        boundaryStatus: "Arizona's official monthly CSV is connected for retail business code 017. County and tribal rows are combined state-plus-county rates; city rows are city-only components and intentionally show 'requires boundary match' rather than guessed totals. Known A+ discrepancies and two custom codes remain unresolved and are not suppressed.",
      };
      cachedSnapshot = snapshot; cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000; return snapshot;
    } finally { clearTimeout(timeout); }
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
