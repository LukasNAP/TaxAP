import { createHash } from "node:crypto";
import { SST_RATE_DIRECTORY_URL } from "./official-source-registry.mjs";
import { readSingleFileZip } from "./zip-utils.mjs";

export const GEORGIA_DOR_RATES_URL = "https://dor.georgia.gov/sales-tax-rates-general";
export const GEORGIA_COUNTY_NAMES_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_gaz_counties_13.txt";
export const GEORGIA_PLACE_NAMES_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_gaz_place_13.txt";
const GEORGIA_STATE_FIPS = "13";
const JURISDICTION_TYPES = { "45": "state", "00": "county", "01": "city", "63": "special" };
const JURISDICTION_SORT = { state: 0, county: 1, city: 2, special: 3 };
const GENERIC_SST_STATES = {
  OH: { stateName: "Ohio", stateFips: "39", expectedCountyCount: 88, sourceUrl: "https://tax.ohio.gov/business/ohio-business-taxes/sales-and-use/information-releases" },
  TN: { stateName: "Tennessee", stateFips: "47", expectedCountyCount: 95, sourceUrl: "https://www.tn.gov/revenue/taxes/sales-and-use-tax.html" },
  // Confirmed 2026-08-26: real, current bare-.csv SST files with a clean per-county shape matching
  // OH/TN exactly (no zip, no flat-rate/place-level wrinkle) - genuinely drop-in.
  AR: { stateName: "Arkansas", stateFips: "05", expectedCountyCount: 75, sourceUrl: "https://www.streamlinedsalestax.org/state-details/arkansas" },
  WY: { stateName: "Wyoming", stateFips: "56", expectedCountyCount: 23, sourceUrl: "https://www.streamlinedsalestax.org/state-details/wyoming" },
  // Confirmed 2026-08-26: these states have NO local-option sales tax at all - their current SST file
  // has zero county/city rows, just the single active statewide rate. expectedCountyCount: 0 makes the
  // existing validation assert exactly that shape rather than silently accepting a broken/empty file.
  IN: { stateName: "Indiana", stateFips: "18", expectedCountyCount: 0, sourceUrl: "https://www.streamlinedsalestax.org/state-details/indiana" },
  KY: { stateName: "Kentucky", stateFips: "21", expectedCountyCount: 0, sourceUrl: "https://www.streamlinedsalestax.org/state-details/kentucky" },
  MI: { stateName: "Michigan", stateFips: "26", expectedCountyCount: 0, sourceUrl: "https://www.streamlinedsalestax.org/state-details/michigan" },
  RI: { stateName: "Rhode Island", stateFips: "44", expectedCountyCount: 0, sourceUrl: "https://www.streamlinedsalestax.org/state-details/rhode-island" },
  // Confirmed 2026-08-26: Nevada's 17 real A+ codes (16 counties + Carson City) are all
  // jurisdictionType "county" in the SST file - no city-level sales tax exists in NV at all -
  // so the existing state+county totalGeneralRate logic already applies with zero changes.
  NV: { stateName: "Nevada", stateFips: "32", expectedCountyCount: 17, sourceUrl: "https://www.streamlinedsalestax.org/state-details/nevada" },
  // Confirmed 2026-08-26: Nebraska's real local-tax variation is entirely city-level (A+ has
  // zero county-FIPS codes; its NE##### codes are real Census place FIPS numbers). Each city row's
  // own rate already IS the full local total (no separate county component to stack on top) -
  // cityRateIsFullLocal opts this one state into computing totalGeneralRate for city rows the same
  // way as county rows. Do NOT copy this flag to a future state without confirming the same fact -
  // a state where city and county both layer independently (e.g. Wisconsin's resort-area surtax
  // cities) would get a silently wrong, too-low total this way.
  // expectedCountyCount is 1, not Nebraska's real 93 counties: unlike SD (which has a 0%-rate row
  // for every one of its 66 counties), Nebraska's SST file only includes an active county-type row
  // for counties that actually levy a county option tax - confirmed live, only Dakota (FIPS 31043)
  // does today. Verified directly against the live file 2026-08-26; do not assume 93 without
  // rechecking if this ever throws again.
  NE: { stateName: "Nebraska", stateFips: "31", expectedCountyCount: 1, cityRateIsFullLocal: true, sourceUrl: "https://www.streamlinedsalestax.org/state-details/nebraska" },
};

function compactDate(value) {
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) throw new Error(`Invalid SST effective date: ${value}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function percent(value) {
  const rate = Number(value) * 100;
  if (!Number.isFinite(rate) || rate < 0 || rate > 20) throw new Error(`Invalid SST rate: ${value}`);
  return Number(rate.toFixed(4));
}

export function parseSstRateCsv(csv, { stateFips, asOfDate }) {
  const compactAsOfDate = asOfDate.replaceAll("-", "");
  if (!/^\d{8}$/.test(compactAsOfDate)) throw new Error("Choose a valid SST comparison date.");
  const rows = String(csv).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    const columns = line.split(",").map((value) => value.trim());
    if (columns.length !== 9) throw new Error(`SST rate row ${index + 1} does not have 9 columns.`);
    const [rowStateFips, jurisdictionType, jurisdictionCode, generalIntrastate, generalInterstate, foodDrugIntrastate, foodDrugInterstate, beginDate, endDate] = columns;
    // jurisdictionCode is numeric (FIPS-style) for state/county/city rows, but confirmed live
    // 2026-08-26 that special-district (type 63/79) rows can be alphanumeric - Nebraska's transit
    // district codes (GL801-GL805), Kansas's type-79 codes (11KAN, AEATC, ALIOL), and Washington's
    // location codes (L1702 etc.) all use a 5-character letter+digit shape. Accept alphanumeric
    // codes generally rather than special-casing each state's exact pattern - the state FIPS and
    // jurisdictionType columns are still strictly numeric and carry the real validation weight.
    if (!/^\d{2}$/.test(rowStateFips) || !/^\d{1,2}$/.test(jurisdictionType) || !/^[A-Za-z0-9]{2,6}$/.test(jurisdictionCode)) {
      throw new Error(`SST rate row ${index + 1} has an invalid jurisdiction identifier.`);
    }
    compactDate(beginDate);
    compactDate(endDate);
    return {
      stateFips: rowStateFips,
      jurisdictionType: jurisdictionType.padStart(2, "0"),
      jurisdictionCode,
      generalIntrastateRate: percent(generalIntrastate),
      generalInterstateRate: percent(generalInterstate),
      foodDrugIntrastateRate: percent(foodDrugIntrastate),
      foodDrugInterstateRate: percent(foodDrugInterstate),
      beginDate: compactDate(beginDate),
      endDate: compactDate(endDate),
      active: beginDate <= compactAsOfDate && endDate >= compactAsOfDate,
    };
  });
  if (rows.some((row) => row.stateFips !== stateFips)) throw new Error("SST rate file contains an unexpected state FIPS code.");
  const activeRows = rows.filter((row) => row.active);
  const stateRows = activeRows.filter((row) => row.jurisdictionType === "45");
  if (stateRows.length !== 1) throw new Error("SST rate file must contain exactly one active state rate.");
  const keys = new Set();
  for (const row of activeRows) {
    const key = `${row.jurisdictionType}:${row.jurisdictionCode}`;
    if (keys.has(key)) throw new Error(`SST rate file has duplicate active jurisdiction ${key}.`);
    keys.add(key);
  }
  return { rows, activeRows, stateRate: stateRows[0].generalIntrastateRate };
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

/**
 * Fetches an SST rate file's raw CSV text. Confirmed 2026-08-26: most states publish their current
 * rate file as a `.zip` (a single CSV inside), not the bare `.csv` OH/TN happen to have - unzip it
 * transparently here rather than making every caller special-case the extension.
 */
async function fetchSstRateFileText(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "text/csv,application/zip,application/x-zip-compressed,application/octet-stream", "User-Agent": "TaxAP/0.1 official-rate monitor" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Official rate source returned HTTP ${response.status}.`);
    if (/\.zip$/i.test(url)) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const entry = readSingleFileZip(buffer);
      return entry.data.toString("utf8");
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function findLatestSstCsv(directoryHtml, stateCode) {
  const expression = new RegExp(`href=["']([^"']*${stateCode}R[^"']*\\.(?:csv|zip))["']`, "gi");
  const files = [...String(directoryHtml).matchAll(expression)].map((match) => match[1]);
  if (files.length === 0) throw new Error(`No current ${stateCode} SST rate file was listed.`);
  return new URL(files.sort().at(-1), SST_RATE_DIRECTORY_URL).href;
}

async function readCensusNames(stateFips, fetchImpl) {
  const countyNamesUrl = `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_gaz_counties_${stateFips}.txt`;
  const placeNamesUrl = `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_gaz_place_${stateFips}.txt`;
  const [counties, places] = await Promise.all([
    fetchText(stateFips === GEORGIA_STATE_FIPS ? GEORGIA_COUNTY_NAMES_URL : countyNamesUrl, fetchImpl, "text/plain"),
    fetchText(stateFips === GEORGIA_STATE_FIPS ? GEORGIA_PLACE_NAMES_URL : placeNamesUrl, fetchImpl, "text/plain"),
  ]);
  const parse = (text, label) => {
    const rows = String(text).split(/\r?\n/).filter(Boolean).map((line) => line.split("|"));
    const headers = rows[0];
    const nameIndex = headers.indexOf("NAME");
    const geoidIndex = headers.indexOf("GEOID");
    if (nameIndex < 0 || geoidIndex < 0) throw new Error(`Census Gazetteer is missing ${label} names.`);
    const entries = rows.slice(1).filter((row) => row[geoidIndex]?.startsWith(stateFips)).map((row) => [row[geoidIndex].slice(2), row[nameIndex]]);
    return new Map(entries);
  };
  return { counties: parse(counties, "county"), places: parse(places, "place") };
}

const genericCache = new Map();
const genericInFlight = new Map();

export async function readOfficialSstStateRates(stateCode, { fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  const code = String(stateCode || "").trim().toUpperCase();
  const config = GENERIC_SST_STATES[code];
  if (!config) throw new Error(`${code || "Requested state"} does not have a validated generic SST adapter.`);
  const cached = genericCache.get(code);
  if (!bypassCache && cached && Date.now() < cached.expiresAt) return cached.snapshot;
  if (!bypassCache && genericInFlight.has(code)) return genericInFlight.get(code);
  const read = (async () => {
    const asOfDate = now.toISOString().slice(0, 10);
    const directoryHtml = await fetchText(SST_RATE_DIRECTORY_URL, fetchImpl, "text/html");
    const rateFileUrl = findLatestSstCsv(directoryHtml, code);
    const [rateCsv, names] = await Promise.all([
      fetchSstRateFileText(rateFileUrl, fetchImpl),
      readCensusNames(config.stateFips, fetchImpl),
    ]);
    const parsed = parseSstRateCsv(rateCsv, { stateFips: config.stateFips, asOfDate });
    const rates = parsed.activeRows.map((row) => {
      const jurisdictionType = JURISDICTION_TYPES[row.jurisdictionType] ?? "special";
      const name = jurisdictionType === "state" ? config.stateName
        : jurisdictionType === "county" ? names.counties.get(row.jurisdictionCode) ?? `County FIPS ${row.jurisdictionCode}`
          : jurisdictionType === "city" ? names.places.get(row.jurisdictionCode) ?? `Place FIPS ${row.jurisdictionCode}`
            : `Special jurisdiction ${row.jurisdictionCode}`;
      return {
        jurisdictionType,
        jurisdictionCode: row.jurisdictionCode,
        name,
        componentRate: row.generalIntrastateRate,
        totalGeneralRate: jurisdictionType === "state" ? parsed.stateRate
          : jurisdictionType === "county" ? Number((parsed.stateRate + row.generalIntrastateRate).toFixed(4))
            : jurisdictionType === "city" && config.cityRateIsFullLocal ? Number((parsed.stateRate + row.generalIntrastateRate).toFixed(4))
              : null,
        generalInterstateRate: row.generalInterstateRate,
        beginDate: row.beginDate,
        endDate: row.endDate,
      };
    }).sort((left, right) => JURISDICTION_SORT[left.jurisdictionType] - JURISDICTION_SORT[right.jurisdictionType] || left.name.localeCompare(right.name));
    const counts = {
      counties: rates.filter((row) => row.jurisdictionType === "county").length,
      cities: rates.filter((row) => row.jurisdictionType === "city").length,
      specialJurisdictions: rates.filter((row) => row.jurisdictionType === "special").length,
    };
    if (counts.counties !== config.expectedCountyCount) {
      throw new Error(`${config.stateName} SST rate file returned ${counts.counties} counties instead of ${config.expectedCountyCount}.`);
    }
    const snapshot = {
      stateCode: code,
      source: `${config.stateName} via Streamlined Sales Tax`,
      sourceUrl: config.sourceUrl,
      machineReadableSourceUrl: rateFileUrl,
      retrievedAt: now.toISOString(),
      asOfDate,
      stateRate: parsed.stateRate,
      sourceHash: createHash("sha256").update(rateCsv).digest("hex"),
      rates,
      counts,
      boundaryStatus: config.expectedCountyCount === 0
        ? "No local-option sales tax exists in this state - a single flat statewide rate applies to every ship-to. No address or boundary matching is needed."
        : "Official jurisdiction components are connected. City and special totals require boundary reconciliation before comparison with A+.",
    };
    genericCache.set(code, { snapshot, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
    return snapshot;
  })();
  if (bypassCache) return read;
  genericInFlight.set(code, read);
  try { return await read; } finally { genericInFlight.delete(code); }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialGaRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const asOfDate = now.toISOString().slice(0, 10);
    const directoryHtml = await fetchText(SST_RATE_DIRECTORY_URL, fetchImpl, "text/html");
    const rateFileUrl = findLatestSstCsv(directoryHtml, "GA");
    const [rateCsv, names] = await Promise.all([
      fetchSstRateFileText(rateFileUrl, fetchImpl),
      readCensusNames(GEORGIA_STATE_FIPS, fetchImpl),
    ]);
    const parsed = parseSstRateCsv(rateCsv, { stateFips: GEORGIA_STATE_FIPS, asOfDate });
    const rates = parsed.activeRows.map((row) => {
      const jurisdictionType = JURISDICTION_TYPES[row.jurisdictionType] ?? "special";
      const name = jurisdictionType === "state" ? "Georgia"
        : jurisdictionType === "county" ? names.counties.get(row.jurisdictionCode) ?? `County FIPS ${row.jurisdictionCode}`
          : jurisdictionType === "city" ? names.places.get(row.jurisdictionCode) ?? `Place FIPS ${row.jurisdictionCode}`
            : `Special jurisdiction ${row.jurisdictionCode}`;
      return {
        jurisdictionType,
        jurisdictionCode: row.jurisdictionCode,
        name,
        componentRate: row.generalIntrastateRate,
        totalGeneralRate: jurisdictionType === "state" ? parsed.stateRate : jurisdictionType === "county" ? Number((parsed.stateRate + row.generalIntrastateRate).toFixed(4)) : null,
        generalInterstateRate: row.generalInterstateRate,
        beginDate: row.beginDate,
        endDate: row.endDate,
      };
    }).sort((a, b) => JURISDICTION_SORT[a.jurisdictionType] - JURISDICTION_SORT[b.jurisdictionType] || a.name.localeCompare(b.name));
    const snapshot = {
      stateCode: "GA",
      source: "Georgia DOR via Streamlined Sales Tax",
      sourceUrl: GEORGIA_DOR_RATES_URL,
      machineReadableSourceUrl: rateFileUrl,
      retrievedAt: now.toISOString(),
      asOfDate,
      stateRate: parsed.stateRate,
      sourceHash: createHash("sha256").update(rateCsv).digest("hex"),
      rates,
      counts: {
        counties: rates.filter((row) => row.jurisdictionType === "county").length,
        cities: rates.filter((row) => row.jurisdictionType === "city").length,
        specialJurisdictions: rates.filter((row) => row.jurisdictionType === "special").length,
      },
      boundaryStatus: "Rate components connected; active Georgia ship-tos are matched against the official Streamlined boundary file (see the boundary reconciliation below).",
    };
    if (snapshot.counts.counties !== 159) throw new Error(`Georgia SST rate file returned ${snapshot.counts.counties} counties instead of 159.`);
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
