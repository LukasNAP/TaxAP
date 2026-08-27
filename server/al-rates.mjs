import { createHash } from "node:crypto";

export const AL_RATES_PAGE_URL = "https://www.revenue.alabama.gov/sales-use/local-cities-and-counties-tax-rates-text-file/";
export const AL_RATES_CSV_URL = "https://www.revenue.alabama.gov/wp-content/uploads/2024/03/taxrates_current.csv";
export const AL_STATE_RATE = 4;

const PLAUSIBLE_RATE_MIN = 4;
const PLAUSIBLE_RATE_MAX = 14;

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

// Confirmed live 2026-08-27 (see docs/states/al.md): A+'s ALnnnn tax-body codes use ADOR's own
// numeric "Locality Code" directly - NOT a synthesized or alphabetical scheme, unlike several other
// states this project has built. Matching by that exact number is far more reliable than any name
// parsing, and sidesteps A+'s inconsistent description casing/prefix ("Alabama X", "ALABAMA X",
// bare "X" with no prefix at all - all three appear live). Per Lukas's confirmed decision
// (2026-08-27): compare only the general sales rate (TaxType "ST", Rate Type "GENER") - equipment
// ("MACH") and police-jurisdiction rates are out of scope, not modeled here.
export function parseAlRateCsv(csvText) {
  const withoutBom = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const lines = withoutBom.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = parseCsvLine(lines[0]).map((field) => field.replace(/^"|"$/g, ""));
  if (header[0] !== "Locality Code" || header[3] !== "TaxType" || header[4] !== "Rate Type") {
    throw new Error("Alabama's rate file header no longer matches the expected column layout.");
  }
  const byCode = new Map();
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line).map((field) => field.replace(/^"|"$/g, ""));
    const [code, name, countyNumber, taxType, rateType, , , inactiveDate, rateText] = fields;
    if (taxType !== "ST" || rateType !== "GENER") continue;
    if (inactiveDate) continue; // a locality with an inactive date is retired - never a live rate
    const rate = Number(rateText);
    if (!Number.isFinite(rate)) throw new Error(`Alabama's rate file has a non-numeric general rate for locality ${code} (${name}).`);
    // A given locality code can appear more than once (e.g. a city that spans two counties, cross-
    // referenced once per county) - confirmed live these duplicates always carry the identical
    // rate, so the first one seen is kept rather than treated as a conflict.
    if (!byCode.has(code)) byCode.set(code, { code, name: name.trim(), countyNumber: Number(countyNumber), rate });
  }
  if (byCode.size < 300) throw new Error(`Alabama's rate file returned only ${byCode.size} general-rate localities, fewer than plausible.`);
  return byCode;
}

async function fetchText(url, fetchImpl, accept) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { headers: { Accept: accept, "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Alabama Department of Revenue returned HTTP ${response.status} for ${url}.`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;

export async function readOfficialAlRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  const csvText = await fetchText(AL_RATES_CSV_URL, fetchImpl, "text/csv");
  const byCode = parseAlRateCsv(csvText);

  // A locality whose own name ends in "COUNTY" already IS the county's own base rate (applies
  // county-wide, incorporated and unincorporated alike, per Alabama's real tax law - confirmed live
  // by cross-checking Mobile: state 4% + Mobile County's own 1.5% + Mobile city's own 5% = 10.5%,
  // matching A+'s live AL9149 exactly). Every other locality (a real city, or a county's own
  // "Uninc"/abatement variant) needs its parent county's rate added on top of its own.
  const countyRateByNumber = new Map();
  const countyRateByName = new Map();
  for (const locality of byCode.values()) {
    // "UNABATED <County> COUNTY" is a separate, lower abatement-zone rate for the same county
    // number - confirmed live to collide with the real base county rate if not excluded (Mobile:
    // real county rate 1.5%, UNABATED variant 0.5%, both keyed to county number 49).
    if (/\bCOUNTY$/i.test(locality.name) && !/^UNABATED\b/i.test(locality.name)) {
      countyRateByNumber.set(locality.countyNumber, locality.rate);
      countyRateByName.set(locality.name.replace(/\s+COUNTY$/i, "").trim().toUpperCase(), locality.rate);
    }
  }

  const rates = [];
  for (const locality of byCode.values()) {
    // Police-Jurisdiction-named localities are out of scope entirely per Lukas's confirmed
    // decision (general sales rate only) - their own rate is exposed for reference, but no total
    // is computed, since PJ zones don't follow the same state+county+city stacking rule (a PJ
    // rate is already its own reduced total in some cases, not a component to add onto).
    const isPoliceJurisdiction = /\bPJ\b/i.test(locality.name);
    const isCountyItself = !isPoliceJurisdiction && /\bCOUNTY$/i.test(locality.name);
    const countyRate = isCountyItself ? 0 : countyRateByNumber.get(locality.countyNumber);
    const total = !isPoliceJurisdiction && (isCountyItself || countyRate !== undefined)
      ? Number((AL_STATE_RATE + (countyRate ?? 0) + locality.rate).toFixed(4))
      : null;
    if (total !== null && (total < PLAUSIBLE_RATE_MIN || total > PLAUSIBLE_RATE_MAX)) {
      throw new Error(`Alabama's computed total for locality ${locality.code} (${locality.name}) is implausible (${total}%).`);
    }
    rates.push({
      jurisdictionType: isCountyItself ? "county" : "city",
      jurisdictionCode: locality.code,
      name: locality.name,
      componentRate: locality.rate,
      totalGeneralRate: total,
      generalInterstateRate: total,
      beginDate: null,
      endDate: null,
    });
  }

  const snapshot = {
    stateCode: "AL",
    source: "Alabama Department of Revenue (general sales rate only, per Lukas's confirmed decision)",
    sourceUrl: AL_RATES_PAGE_URL,
    machineReadableSourceUrl: AL_RATES_CSV_URL,
    retrievedAt: now.toISOString(),
    asOfDate: now.toISOString().slice(0, 10),
    stateRate: AL_STATE_RATE,
    sourceHash: createHash("sha256").update(csvText).digest("hex"),
    rates,
    countyRatesByName: Object.fromEntries(countyRateByName),
    counts: { counties: rates.filter((r) => r.jurisdictionType === "county").length, cities: rates.filter((r) => r.jurisdictionType === "city").length, specialJurisdictions: 0 },
    boundaryStatus: "Every ADOR locality code with an active general sales rate is connected, keyed by the same numeric locality code A+ uses directly. A county's own rate already applies county-wide (incorporated and unincorporated); a city's total is state + its county + its own local rate. Equipment and police-jurisdiction rates are out of scope per Lukas's confirmed decision. A handful of A+ codes for cities spanning more than one county reuse a different county's own locality number rather than the city's own (confirmed live for Birmingham/Shelby) - server/al-aplus.mjs cross-checks the locality name before trusting a numeric match, and falls back to unmatched rather than guessing when it doesn't line up.",
  };
  if (!bypassCache) {
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
  }
  return snapshot;
}
