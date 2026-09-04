import { createHash } from "node:crypto";
import { SST_RATE_DIRECTORY_URL } from "./official-source-registry.mjs";
import { readSingleFileZip } from "./zip-utils.mjs";

export const GEORGIA_DOR_RATES_URL = "https://dor.georgia.gov/sales-tax-rates-general";
export const GEORGIA_COUNTY_NAMES_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_gaz_counties_13.txt";
export const GEORGIA_PLACE_NAMES_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_gaz_place_13.txt";
const GEORGIA_STATE_FIPS = "13";
const JURISDICTION_TYPES = { "45": "state", "00": "county", "01": "city", "49": "special", "63": "special", "79": "special" };
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
  IN: { stateName: "Indiana", stateFips: "18", expectedCountyCount: 0, flatStatewideRate: true, sourceUrl: "https://www.streamlinedsalestax.org/state-details/indiana" },
  KY: { stateName: "Kentucky", stateFips: "21", expectedCountyCount: 0, flatStatewideRate: true, sourceUrl: "https://www.streamlinedsalestax.org/state-details/kentucky" },
  MI: { stateName: "Michigan", stateFips: "26", expectedCountyCount: 0, flatStatewideRate: true, sourceUrl: "https://www.streamlinedsalestax.org/state-details/michigan" },
  RI: { stateName: "Rhode Island", stateFips: "44", expectedCountyCount: 0, flatStatewideRate: true, sourceUrl: "https://www.streamlinedsalestax.org/state-details/rhode-island" },
  // Iowa's live SST file contains 99 real county FIPS rows plus 199, which is not an Iowa
  // county. Keep 199 visible as a special jurisdiction instead of silently counting Iowa as
  // having 100 counties or treating it as an ordinary county rate.
  IA: { stateName: "Iowa", stateFips: "19", expectedCountyCount: 99, countyCodesToTreatAsSpecial: ["199"], sourceUrl: "https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/sales-use-tax-guide" },
  // Kansas's special-jurisdiction identifiers can be alphanumeric (for example, 11KAN).
  // Preserve them as special components; never force them into a county or city model.
  KS: { stateName: "Kansas", stateFips: "20", expectedCountyCount: 105, allowedJurisdictionTypes: ["00", "01", "45", "63", "79"], sourceUrl: "https://www.ksrevenue.gov/salesratechanges.html" },
  // Minnesota publishes rows only for counties/cities with an active local component, rather than
  // one row for every physical county. The reviewed 2026-09-02 file has 62 active county rows;
  // fail closed when that shape changes so a future tax start/end receives an explicit review.
  MN: { stateName: "Minnesota", stateFips: "27", expectedCountyCount: 62, allowedJurisdictionTypes: ["00", "01", "45", "63"], sourceUrl: "https://www.revenue.state.mn.us/local-sales-tax-information" },
  // North Dakota's current SST file contains all 53 county components plus home-rule city rows.
  // Local maximum-tax/refund caps are not encoded in this percentage file and remain out of scope.
  ND: { stateName: "North Dakota", stateFips: "38", expectedCountyCount: 53, allowedJurisdictionTypes: ["00", "01", "45"], sourceUrl: "https://www.tax.nd.gov/sales-and-use-tax/local-taxes-city-and-county-taxes" },
  // Nebraska local variation is overwhelmingly city-driven. The current file has one active county
  // component (Dakota County), 270 city rows, and five special rows; do not synthesize 93 county taxes.
  NE: { stateName: "Nebraska", stateFips: "31", expectedCountyCount: 1, cityRateIsFullLocal: true, allowedJurisdictionTypes: ["00", "01", "45", "63"], sourceUrl: "https://revenue.nebraska.gov/businesses/local-sales-and-use-tax-rates" },
  // Nevada's SST file is structurally different: its state row is zero and each county/special row
  // carries the complete combined rate. Preserve the published totals and derive only the local
  // component relative to Nevada's independently verified 6.85% minimum statewide rate.
  NV: { stateName: "Nevada", stateFips: "32", expectedCountyCount: 17, allowedJurisdictionTypes: ["00", "45", "63"], expectedSourceStateRate: 0, stateRateOverride: 6.85, jurisdictionRatesAreTotals: true, sourceUrl: "https://tax.nv.gov/tax-types/consumer-use-tax/" },
  // Oklahoma publishes every county plus municipality and special/combined local identifiers.
  // Preserve active zero-rate municipality rows because they are explicit source records.
  OK: { stateName: "Oklahoma", stateFips: "40", expectedCountyCount: 77, allowedJurisdictionTypes: ["00", "01", "45", "63"], sourceUrl: "https://oklahoma.gov/tax/businesses/sales-use-tax.html" },
  // South Dakota's type-49 rows represent tribal/special reporting jurisdictions, not an additive
  // local layer. Keep those rows visible and total-less until address/agreement reconciliation exists.
  SD: { stateName: "South Dakota", stateFips: "46", expectedCountyCount: 66, allowedJurisdictionTypes: ["00", "01", "45", "49"], sourceUrl: "https://dor.sd.gov/individuals/taxes/sales-use-tax/" },
  // Utah's ordinary SST component file contains all 29 counties plus active city add-ons.
  // Full destination totals still need ZIP+4/address boundary reconciliation.
  UT: { stateName: "Utah", stateFips: "49", expectedCountyCount: 29, allowedJurisdictionTypes: ["00", "01", "45"], sourceUrl: "https://tax.utah.gov/business/sales-tax/sales/rates/" },
  // Vermont has no county sales-tax layer, but it is not a flat state: municipalities may impose
  // a 1% destination-based local-option sales tax.
  VT: { stateName: "Vermont", stateFips: "50", expectedCountyCount: 0, allowedJurisdictionTypes: ["01", "45"], sourceUrl: "https://tax.vermont.gov/business/industry/contractors" },
  // Washington's source has 39 real county FIPS rows plus five non-Census identifiers encoded as
  // county type. Preserve 079-087 as special jurisdictions rather than inventing five counties.
  WA: { stateName: "Washington", stateFips: "53", expectedCountyCount: 39, countyCodesToTreatAsSpecial: ["079", "081", "083", "085", "087"], allowedJurisdictionTypes: ["00", "01", "45", "63"], sourceUrl: "https://dor.wa.gov/taxes-rates/sales-use-tax-rates" },
  // Wisconsin publishes all 72 county rows and every municipality, including explicit zero-rate
  // city rows. Premier resort area and local exposition taxes are outside this SST file.
  WI: { stateName: "Wisconsin", stateFips: "55", expectedCountyCount: 72, allowedJurisdictionTypes: ["00", "01", "45"], sourceUrl: "https://www.revenue.wi.gov/Pages/Apps/strb.aspx" },
  // West Virginia has no county sales-tax layer; participating municipalities add a uniform 1%
  // to the 6% state rate. Zero county rows therefore does not mean a flat statewide-only tax.
  WV: { stateName: "West Virginia", stateFips: "54", expectedCountyCount: 0, allowedJurisdictionTypes: ["01", "45"], sourceUrl: "https://tax.wv.gov/business/salesandusetax/municipalsalesandusetax/pages/municipalsalesandusetax.aspx" },
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
    if (!/^\d{2}$/.test(rowStateFips) || !/^\d{1,2}$/.test(jurisdictionType) || !/^[A-Z0-9]{2,10}$/.test(jurisdictionCode)) {
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
  const code = String(stateCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Choose a valid two-letter state code.");
  const files = [...String(directoryHtml).matchAll(/href=["']([^"']*\.(?:csv|zip))["']/gi)]
    .map((match) => match[1])
    .filter((href) => decodeURIComponent(new URL(href, SST_RATE_DIRECTORY_URL).pathname).split("/").at(-1)?.toUpperCase().startsWith(`${code}R`));
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
    if (config.expectedSourceStateRate !== undefined && parsed.stateRate !== config.expectedSourceStateRate) {
      throw new Error(`${config.stateName} SST state row changed from the expected ${config.expectedSourceStateRate}% source convention.`);
    }
    const stateRate = config.stateRateOverride ?? parsed.stateRate;
    if (config.allowedJurisdictionTypes) {
      const allowed = new Set(config.allowedJurisdictionTypes);
      const unexpected = [...new Set(parsed.activeRows.map((row) => row.jurisdictionType).filter((type) => !allowed.has(type)))];
      if (unexpected.length > 0) throw new Error(`${config.stateName} SST rate file contains unexpected jurisdiction types: ${unexpected.join(", ")}.`);
    }
    const specialCountyCodes = new Set(config.countyCodesToTreatAsSpecial ?? []);
    for (const code of specialCountyCodes) {
      if (!parsed.activeRows.some((row) => row.jurisdictionType === "00" && row.jurisdictionCode === code)) {
        throw new Error(`${config.stateName} SST rate file is missing its expected non-county jurisdiction ${code}.`);
      }
    }
    const rates = parsed.activeRows.map((row) => {
      const jurisdictionType = row.jurisdictionType === "00" && specialCountyCodes.has(row.jurisdictionCode)
        ? "special"
        : JURISDICTION_TYPES[row.jurisdictionType] ?? "special";
      const name = jurisdictionType === "state" ? config.stateName
        : jurisdictionType === "county" ? names.counties.get(row.jurisdictionCode) ?? `County FIPS ${row.jurisdictionCode}`
          : jurisdictionType === "city" ? names.places.get(row.jurisdictionCode) ?? `Place FIPS ${row.jurisdictionCode}`
            : `Special jurisdiction ${row.jurisdictionCode}`;
      if (config.jurisdictionRatesAreTotals && jurisdictionType !== "state" && row.generalIntrastateRate < stateRate) {
        throw new Error(`${config.stateName} SST jurisdiction ${row.jurisdictionCode} has a total below the ${stateRate}% statewide rate.`);
      }
      const componentRate = jurisdictionType === "state" ? stateRate
        : config.jurisdictionRatesAreTotals ? Number((row.generalIntrastateRate - stateRate).toFixed(4))
          : row.generalIntrastateRate;
      const totalGeneralRate = jurisdictionType === "state" ? stateRate
        : config.jurisdictionRatesAreTotals ? row.generalIntrastateRate
          : jurisdictionType === "county" || (jurisdictionType === "city" && config.cityRateIsFullLocal)
            ? Number((stateRate + row.generalIntrastateRate).toFixed(4)) : null;
      return {
        jurisdictionType,
        jurisdictionCode: row.jurisdictionCode,
        name,
        componentRate,
        totalGeneralRate,
        generalInterstateRate: jurisdictionType === "state" ? stateRate : row.generalInterstateRate,
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
      stateRate,
      sourceHash: createHash("sha256").update(rateCsv).digest("hex"),
      rates,
      counts,
      boundaryStatus: config.flatStatewideRate
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
