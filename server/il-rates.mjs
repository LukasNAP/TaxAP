import { createHash } from "node:crypto";

export const ILLINOIS_IDOR_RATES_URL = "https://tax.illinois.gov/content/dam/soi/en/web/tax/research/taxrates/documents/salestaxrates/ordmache-current.txt";
export const ILLINOIS_IDOR_OVERVIEW_URL = "https://tax.illinois.gov/research/taxrates/sales-tax-rate-machine-readable-files.html";
export const ILLINOIS_STATE_RATE = 6.25;
export const ILLINOIS_COUNTY_COUNT = 102;

// IDOR's fixed-width county/municipality file, documented in IDR-1024.  These offsets cover
// only the current "Receipts General Merchandise" rate; drug, purchase, auto, and prior-rate
// fields deliberately remain out of TaxAP's general-sales-tax comparison.
const FIELDS = {
  locationId: [0, 10],
  locationName: [10, 35],
  countyName: [35, 60],
  addressOverride: [60, 61],
  effectiveDate: [61, 69],
  generalMerchandiseHighRate: [69, 74],
};

function field(line, [start, end]) {
  return line.slice(start, end).trim();
}

function toIsoDate(value) {
  if (!/^\d{8}$/.test(value)) throw new Error(`Illinois IDOR returned an invalid effective date: ${value || "blank"}.`);
  const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`) {
    throw new Error(`Illinois IDOR returned an invalid effective date: ${value}.`);
  }
  return date.toISOString().slice(0, 10);
}

function parseRate(value, label) {
  if (!/^\d{5}$/.test(value)) throw new Error(`Illinois IDOR returned an invalid ${label}: ${value || "blank"}.`);
  return Number((Number(value) / 1000).toFixed(4));
}

/**
 * Parses IDOR's currently-published county/municipality rate file.  Rows with an address
 * override are intentionally retained as metadata but omitted from comparable rates: IDOR says
 * their jurisdiction-wide amount does not apply to the entire location and the address-level
 * file must be consulted.  TaxAP therefore never substitutes a county or city total for them.
 */
export function parseIllinoisRates(text, { expectedCountyCount = ILLINOIS_COUNTY_COUNT, minRateRows = 1_000 } = {}) {
  const lines = String(text).split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < minRateRows) throw new Error(`Illinois IDOR returned only ${lines.length} rate rows; expected a complete jurisdiction file.`);

  const rows = lines.map((line, index) => {
    if (line.length < 132) throw new Error(`Illinois IDOR row ${index + 1} is too short for the documented fixed-width layout.`);
    const locationId = field(line, FIELDS.locationId);
    const locationName = field(line, FIELDS.locationName);
    const county = field(line, FIELDS.countyName);
    const addressOverride = field(line, FIELDS.addressOverride);
    if (!/^\d{3}-\d{4}-\d$/.test(locationId)) throw new Error(`Illinois IDOR row ${index + 1} has an invalid location ID: ${locationId || "blank"}.`);
    if (!locationName) throw new Error(`Illinois IDOR row ${index + 1} is missing its location name.`);
    if (addressOverride !== "Y" && addressOverride !== "N") throw new Error(`Illinois IDOR row ${index + 1} has an invalid address override flag.`);
    const effectiveDate = toIsoDate(field(line, FIELDS.effectiveDate));
    const totalGeneralRate = parseRate(field(line, FIELDS.generalMerchandiseHighRate), "general-merchandise high rate");
    // IDOR appends 52 non-Illinois/default rows (200-250 and 500, each suffixed -0099-x)
    // after the 1,544 Illinois county/municipality records. They have no county and are not
    // Illinois taxing jurisdictions, so accept that exact documented shape but never expose it.
    if (!county) {
      if (/^(?:2(?:[0-4]\d|50)|500)-0099-\d$/.test(locationId)) return null;
      throw new Error(`Illinois IDOR row ${index + 1} is missing its county name.`);
    }
    if (totalGeneralRate < 0 || totalGeneralRate > 20) throw new Error(`Illinois IDOR returned an implausible general-merchandise rate for ${locationName}.`);
    if (addressOverride === "Y" && totalGeneralRate !== 0) throw new Error(`Illinois IDOR marked ${locationId} as address-specific but did not zero its jurisdiction-wide rate.`);
    if (addressOverride === "N" && totalGeneralRate < ILLINOIS_STATE_RATE) throw new Error(`Illinois IDOR returned a below-state-rate general-merchandise total for ${locationName}.`);
    return { locationId, locationName, county, addressOverride: addressOverride === "Y", effectiveDate, totalGeneralRate };
  }).filter(Boolean);

  const byLocationId = new Map();
  for (const row of rows) {
    const existing = byLocationId.get(row.locationId);
    if (!existing) {
      byLocationId.set(row.locationId, row);
      continue;
    }
    // The current 08/01/2026 file repeats 100-0001-1 (Marion, Williamson) with the
    // same rate and two effective dates.  That is safe to collapse to the newer record;
    // any substantive disagreement remains a format/data change and fails closed.
    if (existing.locationName !== row.locationName || existing.county !== row.county
      || existing.addressOverride !== row.addressOverride || existing.totalGeneralRate !== row.totalGeneralRate) {
      throw new Error(`Illinois IDOR returned conflicting current records for location ID ${row.locationId}.`);
    }
    if (row.effectiveDate > existing.effectiveDate) byLocationId.set(row.locationId, row);
  }
  const uniqueRows = [...byLocationId.values()];
  const counties = new Set(uniqueRows.map((row) => row.county));
  if (counties.size !== expectedCountyCount) throw new Error(`Illinois IDOR current file covers ${counties.size} counties instead of ${expectedCountyCount}.`);

  const rates = uniqueRows.filter((row) => !row.addressOverride).map((row) => ({
    jurisdictionType: row.locationId.includes("-5000-") ? "county" : "city",
    jurisdictionCode: `IL:${row.locationId}`,
    name: row.locationName,
    county: row.county,
    componentRate: Number((row.totalGeneralRate - ILLINOIS_STATE_RATE).toFixed(4)),
    totalGeneralRate: row.totalGeneralRate,
    generalInterstateRate: row.totalGeneralRate,
    beginDate: row.effectiveDate,
    endDate: null,
    addressOverride: false,
  }));
  return { rows: uniqueRows, rates, counties: [...counties].sort() };
}

async function downloadIllinoisRates(fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(ILLINOIS_IDOR_RATES_URL, {
      headers: { Accept: "text/plain", "User-Agent": "TaxAP/0.1 official-rate monitor" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Illinois IDOR returned HTTP ${response.status}.`);
    const text = await response.text();
    if (text.length < 150_000) throw new Error("Illinois IDOR returned an unexpectedly small rate file.");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialIlRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const text = await downloadIllinoisRates(fetchImpl);
    const parsed = parseIllinoisRates(text);
    const addressOverrides = parsed.rows.filter((row) => row.addressOverride).length;
    const snapshot = {
      stateCode: "IL",
      source: "Illinois Department of Revenue",
      sourceUrl: ILLINOIS_IDOR_OVERVIEW_URL,
      machineReadableSourceUrl: ILLINOIS_IDOR_RATES_URL,
      retrievedAt: now.toISOString(),
      asOfDate: now.toISOString().slice(0, 10),
      stateRate: ILLINOIS_STATE_RATE,
      sourceHash: createHash("sha256").update(text).digest("hex"),
      rates: parsed.rates,
      counts: {
        counties: parsed.counties.length,
        cities: parsed.rates.filter((row) => row.jurisdictionType === "city").length,
        specialJurisdictions: addressOverrides,
      },
      boundaryStatus: `${parsed.rates.length} jurisdiction-wide general-merchandise rates across ${parsed.counties.length}/102 counties validated. ${addressOverrides} address-override location(s) are intentionally excluded until TaxAP has an approved, practical address-level matching design; A+ tax-body matching is not yet connected.`,
    };
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
    return snapshot;
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
