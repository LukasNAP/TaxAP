import { createHash } from "node:crypto";

export const ALABAMA_LOCAL_RATES_URL = "https://www.revenue.alabama.gov/sales-use/local-cities-and-counties-tax-rates-text-file/";
export const ALABAMA_STATE_RATES_URL = "https://www.revenue.alabama.gov/sales-use/state-sales-use-tax-rates/";
export const ALABAMA_STATE_GENERAL_RATE = 4;
export const AL_STATE_RATE = ALABAMA_STATE_GENERAL_RATE;

const EXPECTED_HEADERS = [
  "Locality Code", "Locality Name", "County Number", "TaxType", "Rate Type", "Administered", "Active Date",
  "Inactive Date", "Rate", "Indicator", "PJ", "County Code", "PJ_Rate",
];

function plainText(html) {
  return String(html).replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;|&#038;/gi, "&").replace(/\s+/g, " ").trim();
}

export function findCurrentAlabamaCsv(html) {
  const link = [...String(html).matchAll(/href=["']([^"']*taxrates_current\.csv)["']/gi)][0]?.[1];
  if (!link) throw new Error("Alabama DOR did not link taxrates_current.csv.");
  const linkIndex = String(html).search(/taxrates_current\.csv/i);
  const updated = plainText(String(html).slice(linkIndex, linkIndex + 1_000)).match(/Updated for\s+([A-Z][a-z]+)\s+([12]\d{2})\s*(\d)/i);
  if (!updated) throw new Error("Alabama DOR did not identify the update month for taxrates_current.csv.");
  const parsedDate = new Date(`${updated[1]} 1, ${updated[2]}${updated[3]} 00:00:00 UTC`);
  if (Number.isNaN(parsedDate.getTime())) throw new Error("Alabama DOR listed an invalid CSV update month.");
  return { url: new URL(link.replaceAll("&amp;", "&"), ALABAMA_LOCAL_RATES_URL).href, asOfDate: parsedDate.toISOString().slice(0, 10) };
}

export function parseAlabamaStateGeneralRate(html) {
  const text = plainText(html);
  const rate = text.match(/Sales and Use Tax Rates[\s\S]{0,500}?General:\s*(\d+(?:\.\d+)?)%/i)?.[1];
  if (Number(rate) !== ALABAMA_STATE_GENERAL_RATE) throw new Error("Alabama state-rate page no longer confirms a 4% general sales-tax rate.");
  return ALABAMA_STATE_GENERAL_RATE;
}

function parseCsvRows(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < String(csv).length; index += 1) {
    const character = String(csv)[index];
    if (quoted) {
      if (character === '"' && String(csv)[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (quoted) throw new Error("Alabama rate CSV has an unterminated quoted field.");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((values) => values.some((value) => value !== ""));
}

function ratePercent(value, label) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1_000) throw new Error(`Alabama rate CSV has an invalid ${label}.`);
  return Number(rate.toFixed(4));
}

function dateValue(value, label) {
  if (!/^\d{8}$/.test(value)) throw new Error(`Alabama rate CSV has an invalid ${label}.`);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function localityKey(row) {
  return `${row.localityCode}:${row.countyCode || "BASE"}`;
}

export function parseAlabamaCurrentCsv(csv, { asOfDate, minimumSalesRows = 800, expectedCountyNumbers = 67 } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate || "")) throw new Error("Alabama rate CSV requires its validated update date.");
  const rows = parseCsvRows(csv);
  const headers = rows.shift()?.map((value) => value.replace(/^\uFEFF/, ""));
  if (!headers || headers.length !== EXPECTED_HEADERS.length || headers.some((header, index) => header !== EXPECTED_HEADERS[index])) {
    throw new Error("Alabama rate CSV headers changed; review the DOR format before accepting it.");
  }
  const parsedRows = rows.map((values) => {
    if (values.length !== headers.length) throw new Error("Alabama rate CSV contains a malformed row.");
    const source = Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
    if (!/^\d{4}$/.test(source["Locality Code"]) || !/^[79]/.test(source["Locality Code"])) throw new Error("Alabama rate CSV has an invalid locality code.");
    if (!source["Locality Name"]) throw new Error("Alabama rate CSV has a blank locality name.");
    if (!/^\d{1,2}$/.test(source["County Number"]) || Number(source["County Number"]) < 1 || Number(source["County Number"]) > 99) throw new Error("Alabama rate CSV has an invalid county-number field.");
    if (source["County Code"] && !/^7\d{3}$/.test(source["County Code"])) throw new Error("Alabama rate CSV has an invalid municipality county cross-reference.");
    if (source.PJ && !/^[YN]$/.test(source.PJ)) throw new Error("Alabama rate CSV has an invalid police-jurisdiction flag.");
    if (source["Inactive Date"]) throw new Error("Alabama current-rate CSV unexpectedly contains an inactive row.");
    return {
      localityCode: source["Locality Code"], localityName: source["Locality Name"], countyNumber: Number(source["County Number"]),
      taxType: source.TaxType, rateType: source["Rate Type"], administeredBy: source.Administered,
      activeDate: dateValue(source["Active Date"], `${source["Locality Code"]} active date`),
      localRate: ratePercent(source.Rate, `${source["Locality Code"]} rate`), pj: source.PJ || null,
      countyCode: source["County Code"] || null, pjRate: source.PJ_Rate === "" ? null : ratePercent(source.PJ_Rate, `${source["Locality Code"]} police-jurisdiction rate`),
    };
  });
  const salesRows = parsedRows.filter((row) => row.taxType === "ST" && row.rateType === "GENER");
  if (salesRows.length < minimumSalesRows) throw new Error(`Alabama rate CSV returned only ${salesRows.length} general sales-tax locality rows.`);
  const countyNumbers = new Set(salesRows.filter((row) => row.localityCode.startsWith("7")).map((row) => row.countyNumber));
  if (countyNumbers.size !== expectedCountyNumbers) throw new Error(`Alabama rate CSV represented ${countyNumbers.size} county numbers instead of ${expectedCountyNumbers}.`);
  const sellersUse = new Map(parsedRows.filter((row) => row.taxType === "SU" && row.rateType === "GENER").map((row) => [localityKey(row), row]));
  for (const row of [...salesRows, ...sellersUse.values()]) {
    if (row.localRate > 10 || (row.pjRate != null && row.pjRate > 10)) throw new Error(`Alabama general sales/use row ${localityKey(row)} has an implausible percentage rate.`);
  }
  const seen = new Set();
  const rates = [];
  for (const row of salesRows) {
    const key = localityKey(row);
    if (seen.has(key)) throw new Error(`Alabama rate CSV repeats general sales-tax locality ${key}.`);
    seen.add(key);
    const use = sellersUse.get(key);
    const jurisdictionType = row.localityCode.startsWith("7") ? "county" : "city";
    rates.push({
      jurisdictionType, jurisdictionCode: `AL:${key}:CL`, localityCode: row.localityCode, countyCode: row.countyCode,
      countyNumber: row.countyNumber, name: row.localityName, zone: jurisdictionType === "city" ? "corporate-limits" : "county",
      componentRate: row.localRate, totalGeneralRate: Number((ALABAMA_STATE_GENERAL_RATE + row.localRate).toFixed(4)),
      generalInterstateRate: use ? Number((ALABAMA_STATE_GENERAL_RATE + use.localRate).toFixed(4)) : null,
      beginDate: row.activeDate, endDate: null, administeredBy: row.administeredBy,
    });
    if (jurisdictionType === "city" && row.pj === "Y") {
      if (row.pjRate == null) throw new Error(`Alabama municipality ${key} levies a police-jurisdiction tax but has no PJ rate.`);
      rates.push({
        jurisdictionType: "special", jurisdictionCode: `AL:${key}:PJ`, localityCode: row.localityCode, countyCode: row.countyCode,
        countyNumber: row.countyNumber, name: `${row.localityName} Police Jurisdiction`, zone: "police-jurisdiction",
        componentRate: row.pjRate, totalGeneralRate: Number((ALABAMA_STATE_GENERAL_RATE + row.pjRate).toFixed(4)),
        generalInterstateRate: use?.pjRate == null ? null : Number((ALABAMA_STATE_GENERAL_RATE + use.pjRate).toFixed(4)),
        beginDate: row.activeDate, endDate: null, administeredBy: row.administeredBy,
      });
    }
  }
  const counts = {
    counties: rates.filter((rate) => rate.jurisdictionType === "county").length,
    cities: rates.filter((rate) => rate.jurisdictionType === "city").length,
    specialJurisdictions: rates.filter((rate) => rate.jurisdictionType === "special").length,
  };
  return { rates: rates.sort((left, right) => left.jurisdictionCode.localeCompare(right.jurisdictionCode)), counts, sourceRows: rows.length, salesRows: salesRows.length };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialAlRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const headers = { Accept: "text/html,text/csv", "User-Agent": "TaxAP/0.1 official-rate monitor" };
      const [listingResponse, stateResponse] = await Promise.all([
        fetchImpl(ALABAMA_LOCAL_RATES_URL, { headers, signal: controller.signal }),
        fetchImpl(ALABAMA_STATE_RATES_URL, { headers, signal: controller.signal }),
      ]);
      if (!listingResponse.ok) throw new Error(`Alabama DOR rate listing returned HTTP ${listingResponse.status}.`);
      if (!stateResponse.ok) throw new Error(`Alabama DOR state rates returned HTTP ${stateResponse.status}.`);
      const listingHtml = await listingResponse.text();
      const stateHtml = await stateResponse.text();
      parseAlabamaStateGeneralRate(stateHtml);
      const current = findCurrentAlabamaCsv(listingHtml);
      if (current.asOfDate > now.toISOString().slice(0, 10)) throw new Error(`Alabama DOR current file is dated ${current.asOfDate}, after the requested snapshot date.`);
      const csvResponse = await fetchImpl(current.url, { headers, signal: controller.signal });
      if (!csvResponse.ok) throw new Error(`Alabama DOR current rate CSV returned HTTP ${csvResponse.status}.`);
      const csv = await csvResponse.text();
      if (csv.length < 500_000) throw new Error("Alabama DOR current rate CSV was unexpectedly small.");
      const parsed = parseAlabamaCurrentCsv(csv, { asOfDate: current.asOfDate });
      const snapshot = {
        stateCode: "AL", source: "Alabama Department of Revenue", sourceUrl: ALABAMA_LOCAL_RATES_URL,
        machineReadableSourceUrl: current.url, retrievedAt: now.toISOString(), asOfDate: current.asOfDate,
        stateRate: ALABAMA_STATE_GENERAL_RATE, sourceHash: createHash("sha256").update(listingHtml).update(stateHtml).update(csv).digest("hex"),
        rates: parsed.rates, counts: parsed.counts, effectivePeriod: `Current active file updated ${current.asOfDate}`,
        boundaryStatus: "Current general sales-tax corporate-limit, county, and police-jurisdiction rates are connected. Alabama's official address lookup is interactive rather than a bulk boundary feed, so address-to-zone matching is not built. A+ comparison remains withheld because AL000 is a heavily used retired 0% placeholder and A+'s locality catalog is much coarser than DOR's inventory.",
      };
      cachedSnapshot = snapshot; cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000; return snapshot;
    } finally { clearTimeout(timeout); }
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
