import { createHash } from "node:crypto";

export const AZ_RATE_TABLE_PAGE_URL = "https://azdor.gov/business/transaction-privilege-tax/tax-rate-table";
export const AZ_RETAIL_BUSINESS_CODE = "017";

const PLAUSIBLE_RATE_MIN = 4;
const PLAUSIBLE_RATE_MAX = 13;

// Confirmed live 2026-08-27: AZDOR publishes a new dated CSV every month, including future-dated
// files ahead of their own effective date (e.g. a 09012026 file was already live before September).
// Never assume "the first/most-recent-dated link" is the CURRENTLY effective one - filter to dates
// on or before "now" and take the latest of those, the same discipline server/sst-rates.mjs already
// applies to its own quarterly files.
export function findCurrentAzRateCsv(pageHtml, now) {
  const matches = [...String(pageHtml).matchAll(/href="([^"]*TPT_RATETABLE_ALL_(\d{2})(\d{2})(\d{4})\.csv)"/gi)];
  if (matches.length === 0) throw new Error("No AZDOR TPT_RATETABLE_ALL_*.csv link was found on the rate table page.");
  const candidates = matches.map((match) => ({
    url: match[1],
    date: new Date(Date.UTC(Number(match[4]), Number(match[2]) - 1, Number(match[3]))),
  })).filter((candidate) => candidate.date.getTime() <= now.getTime());
  if (candidates.length === 0) throw new Error("AZDOR's rate table page lists only future-dated files - no currently-effective rate table found.");
  candidates.sort((a, b) => b.date.getTime() - a.date.getTime());
  return new URL(candidates[0].url, AZ_RATE_TABLE_PAGE_URL).href;
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else current += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") { fields.push(current); current = ""; }
    else current += char;
  }
  fields.push(current);
  return fields;
}

// Arizona's real 15 counties (fixed, well-known public geography) - used to classify each CSV row
// as a county-level total (which already includes the state rate) vs. everything else (a city,
// tribal region, or special district, which is a local-only add-on). An inclusion list of exactly
// 15 real names is far safer than trying to enumerate every one of AZDOR's ~100+ non-county region
// rows (most of which A+ never has an active code for anyway).
const AZ_COUNTIES = new Set([
  "APACHE", "COCHISE", "COCONINO", "GILA", "GRAHAM", "GREENLEE", "LA PAZ", "MARICOPA",
  "MOHAVE", "NAVAJO", "PIMA", "PINAL", "SANTA CRUZ", "YAVAPAI", "YUMA",
]);

// Arizona's own TPT structure (confirmed live 2026-08-27, docs/states/az.md): a COUNTY row's rate
// already includes the 5.6% state rate; an incorporated CITY's row is its own local-only add-on on
// top of the county it sits in - the two must be summed for a real ship-to inside city limits, they
// are not independent totals. AZDOR's CSV has no county column for city rows, so this adapter needs
// its own city -> county map. Verified 2026-08-27 against public county-government/Wikipedia
// sources (county boundaries are stable public geography, unlike tax rates, which this table reads
// live) - not guessed, and each entry can be independently re-verified against Arizona's own list
// of incorporated places if a future city is added to A+'s live codes and isn't in this map yet.
export const AZ_CITY_COUNTY = new Map([
  ["PHOENIX", "MARICOPA"], ["TUCSON", "PIMA"], ["CHANDLER", "MARICOPA"], ["TEMPE", "MARICOPA"],
  ["SCOTTSDALE", "MARICOPA"], ["GLENDALE", "MARICOPA"], ["MESA", "MARICOPA"], ["NOGALES", "SANTA CRUZ"],
  ["YUMA", "YUMA"], ["GILBERT", "MARICOPA"], ["GOODYEAR", "MARICOPA"], ["TOLLESON", "MARICOPA"],
  ["LAKE HAVASU CITY", "MOHAVE"], ["DOUGLAS", "COCHISE"], ["SAN LUIS", "YUMA"], ["LITCHFIELD PARK", "MARICOPA"],
  ["BULLHEAD CITY", "MOHAVE"], ["PRESCOTT VALLEY", "YAVAPAI"], ["PRESCOTT", "YAVAPAI"], ["QUEEN CREEK", "MARICOPA"],
  ["PEORIA", "MARICOPA"], ["SURPRISE", "MARICOPA"], ["CASA GRANDE", "PINAL"], ["COTTONWOOD", "YAVAPAI"],
  ["ELOY", "PINAL"], ["FLAGSTAFF", "COCONINO"], ["EL MIRAGE", "MARICOPA"], ["KINGMAN", "MOHAVE"],
  ["ORO VALLEY", "PIMA"], ["SAFFORD", "GRAHAM"], ["APACHE JUNCTION", "PINAL"], ["AVONDALE", "MARICOPA"],
  // Confirmed live 2026-08-27: AZDOR's CSV has 3 real cities that share their exact name with a
  // DIFFERENT county than the one they're actually in - not a data error, three genuine name
  // collisions the same shape as Virginia's Fairfax/Franklin/Richmond/Roanoke. Distinguished from
  // the real county row (region code "MAR"/"PMA"/"YMA", 3 letters) by AZDOR's own shorter region
  // code ("MP"/"PM"/"YM") for the city - see parseAzRateCsv. The City of Maricopa is in Pinal
  // County (confirmed directly by Lukas: 5.6% state + 1.1% Pinal + 2.5% city = 9.2% combined,
  // effective 2025-10-01); the Town of Pima is in Graham County; the City of Yuma is in Yuma
  // County (same name, same county - not actually a collision for matching purposes).
  ["MARICOPA", "PINAL"], ["PIMA", "GRAHAM"], ["YUMA", "YUMA"],
]);

/**
 * Parses AZDOR's TPT rate table CSV for a single business classification, splitting rows into
 * county-level totals (already include the state rate) and city-level local add-ons that need to
 * be summed with their county for a real address inside city limits.
 */
export function parseAzRateCsv(csvText, { businessCode = AZ_RETAIL_BUSINESS_CODE } = {}) {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = parseCsvLine(lines[0]).map((field) => field.trim());
  if (header[0] !== "RegionCode" || header[2] !== "BusinessCode" || header[4] !== "TaxRate") {
    throw new Error("AZDOR's rate table CSV header no longer matches the expected column layout.");
  }
  const byCounty = new Map();
  const byCity = new Map();
  let stateRate = null;
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const [regionCode, regionName, code, , rateText, rateType] = fields;
    if (code !== businessCode || rateType !== "Percent") continue;
    const rate = Number(rateText);
    if (!Number.isFinite(rate)) throw new Error(`AZDOR's rate table has a non-numeric rate for region "${regionName}".`);
    const name = String(regionName || "").trim().toUpperCase();
    if (name === "STATE OF ARIZONA" || regionCode === "AZ" || regionCode === "ST") { stateRate = rate; continue; }
    const countyName = name.replace(/\s+CO\.?$/i, "").trim();
    // A region name that exactly matches one of Arizona's 15 real counties is normally that
    // county's own row - EXCEPT for 3 confirmed live cases (Maricopa, Pima, Yuma) where AZDOR's
    // own shorter 2-letter region code marks it as a same-named CITY instead (see AZ_CITY_COUNTY's
    // comment). Every real county row uses a 3-letter code.
    if (AZ_COUNTIES.has(countyName) && String(regionCode).trim().length === 3) {
      byCounty.set(countyName, rate);
    } else {
      byCity.set(name, rate);
    }
  }
  if (stateRate === null) {
    // AZDOR's own county rows already fold the state rate in (confirmed live) - if the file never
    // states a bare state row, that's expected, not an error; state rate is exposed for reference
    // only, using the well-known statutory 5.6% Arizona TPT retail rate as of 2026.
    stateRate = 5.6;
  }
  if (byCounty.size !== 15) throw new Error(`AZDOR's rate table returned ${byCounty.size} counties instead of Arizona's real 15.`);
  return { stateRate, byCounty, byCity };
}

async function fetchText(url, fetchImpl, accept) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { headers: { Accept: accept, "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal });
    if (!response.ok) throw new Error(`AZDOR returned HTTP ${response.status} for ${url}.`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;

export async function readOfficialAzRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  const pageHtml = await fetchText(AZ_RATE_TABLE_PAGE_URL, fetchImpl, "text/html");
  const csvUrl = findCurrentAzRateCsv(pageHtml, now);
  const csvText = await fetchText(csvUrl, fetchImpl, "text/csv");
  const parsed = parseAzRateCsv(csvText);

  const rates = [];
  for (const [name, rate] of parsed.byCounty) {
    const plausible = rate >= PLAUSIBLE_RATE_MIN && rate <= PLAUSIBLE_RATE_MAX;
    if (!plausible) throw new Error(`AZDOR's rate table has an implausible county total for ${name} (${rate}%).`);
    rates.push({ jurisdictionType: "county", jurisdictionCode: name, name, componentRate: rate, totalGeneralRate: rate, generalInterstateRate: rate, beginDate: null, endDate: null });
  }
  for (const [name, cityRate] of parsed.byCity) {
    const county = AZ_CITY_COUNTY.get(name);
    const countyRate = county ? parsed.byCounty.get(county) : null;
    const total = countyRate !== null && countyRate !== undefined ? Number((countyRate + cityRate).toFixed(4)) : null;
    rates.push({ jurisdictionType: "city", jurisdictionCode: name, name, county: county ?? null, componentRate: cityRate, totalGeneralRate: total, generalInterstateRate: total, beginDate: null, endDate: null });
  }

  const snapshot = {
    stateCode: "AZ",
    source: "Arizona Department of Revenue (business code 017, Retail)",
    sourceUrl: AZ_RATE_TABLE_PAGE_URL,
    machineReadableSourceUrl: csvUrl,
    retrievedAt: now.toISOString(),
    asOfDate: now.toISOString().slice(0, 10),
    stateRate: parsed.stateRate,
    sourceHash: createHash("sha256").update(csvText).digest("hex"),
    rates,
    counts: { counties: parsed.byCounty.size, cities: parsed.byCity.size, specialJurisdictions: 0 },
    boundaryStatus: "County rows already include Arizona's 5.6% state TPT rate. City rows are their own local-only add-on; a real address inside city limits needs county + city summed, computed here for every city with a known county (see AZ_CITY_COUNTY).",
  };
  if (!bypassCache) {
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
  }
  return snapshot;
}
