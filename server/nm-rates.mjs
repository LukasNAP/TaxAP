import { createHash } from "node:crypto";
import { readZipEntries } from "./zip-utils.mjs";

export const NEW_MEXICO_GIS_DATA_URL = "https://www.tax.newmexico.gov/businesses/geographic-information-system-gis/data-download/";
export const NEW_MEXICO_STATE_GRT_RATE = 5.125;
export const NEW_MEXICO_EXPECTED_COUNTY_REMAINDERS = 32;

const EXPECTED_HEADERS = [
  "OBJECTID_1", "name", "county", "locat_cdr", "locat_cd1", "locat_cd2", "grt_rate", "note_key",
  "bndry_ref", "SHAPE_Leng", "grt_rate2", "Shape_Area",
];

function decodeHtml(value) {
  return String(value).replaceAll("&amp;", "&").replaceAll("&#038;", "&").replaceAll("&quot;", '"').replaceAll("&#039;", "'");
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function findCurrentNewMexicoDataset(html, { asOfDate = new Date().toISOString().slice(0, 10) } = {}) {
  const datasets = [...String(html).matchAll(/<a\b[^>]*href=["']([^"']*dataset\.html\?uuid=([a-f0-9-]{36})[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const label = decodeHtml(match[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      const period = label.match(/Gross Receipts Tax Rates and Boundaries:\s*(January|July)\s+(?:1,?\s*)?(\d{4})\s+to\s+(June|December)\s+(?:30|31),?\s*(\d{4})/i);
      if (!period) return null;
      const startMonth = period[1].toLowerCase() === "january" ? 1 : 7;
      const endMonth = period[3].toLowerCase() === "june" ? 6 : 12;
      return {
        uuid: match[2].toLowerCase(),
        datasetUrl: new URL(decodeHtml(match[1]), NEW_MEXICO_GIS_DATA_URL).href,
        beginDate: isoDate(Number(period[2]), startMonth, 1),
        endDate: isoDate(Number(period[4]), endMonth, endMonth === 6 ? 30 : 31),
      };
    }).filter(Boolean).sort((left, right) => right.beginDate.localeCompare(left.beginDate));
  const current = datasets.find((dataset) => dataset.beginDate <= asOfDate && dataset.endDate >= asOfDate);
  if (!current) throw new Error(`New Mexico TRD did not link a GRT boundary dataset covering ${asOfDate}.`);
  return current;
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
  if (quoted) throw new Error("New Mexico GRT CSV has an unterminated quoted field.");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((values) => values.some((value) => value !== ""));
}

function percent(value, label) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 15) throw new Error(`New Mexico GRT data has an invalid ${label}.`);
  return Number(rate.toFixed(4));
}

function primaryType(name) {
  if (/^Remainder of County\s*-/i.test(name)) return "county";
  if (/\b(?:Airport|TID|TIDD|TIF|Industrial Park|Fairgrounds|Water|Sanitation|Alamogordo Land|Bonito Lake|Sugarite Canyon)\b/i.test(name)) return "special";
  return "city";
}

function pushUnique(ratesByCode, rate) {
  const previous = ratesByCode.get(rate.jurisdictionCode);
  if (!previous) { ratesByCode.set(rate.jurisdictionCode, rate); return; }
  if (previous.totalGeneralRate !== rate.totalGeneralRate) {
    throw new Error(`New Mexico GRT data assigns conflicting values to location code ${rate.jurisdictionCode}.`);
  }
  if (previous.name !== rate.name) previous.name = [...new Set(`${previous.name} / ${rate.name}`.split(" / "))].join(" / ");
}

function rateRow({ jurisdictionType, jurisdictionCode, name, county, totalGeneralRate, beginDate, endDate, noteKey = null }) {
  if (!/^\d{2}-\d{3}$/.test(jurisdictionCode)) throw new Error(`New Mexico GRT data has an invalid location code ${jurisdictionCode || "(blank)"}.`);
  const componentRate = jurisdictionType === "special" && totalGeneralRate < NEW_MEXICO_STATE_GRT_RATE
    ? totalGeneralRate
    : Number((totalGeneralRate - NEW_MEXICO_STATE_GRT_RATE).toFixed(4));
  return {
    jurisdictionType, jurisdictionCode: `NM:${jurisdictionCode}`, locationCode: jurisdictionCode, name, county,
    componentRate, totalGeneralRate, generalInterstateRate: totalGeneralRate, beginDate, endDate, noteKey,
  };
}

export function parseNewMexicoRateArchive(buffer, { beginDate, endDate, expectedCounties = NEW_MEXICO_EXPECTED_COUNTY_REMAINDERS } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(beginDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || "")) {
    throw new Error("New Mexico GRT dataset requires a validated effective period.");
  }
  const entries = readZipEntries(Buffer.from(buffer));
  const csvEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".csv"));
  const metadataEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".xml"));
  if (csvEntries.length !== 1 || metadataEntries.length !== 1) throw new Error("New Mexico GRT archive must contain exactly one CSV and one XML metadata file.");
  const metadata = metadataEntries[0].data.toString("utf8");
  if (!/boundaries for New Mexico(?:'|&apos;)s gross receipts tax districts/i.test(metadata)
      || !/Tribal Location Code \(1\)/i.test(metadata)
      || !/Gross receipts tax rate for Isleta Pueblo class 2/i.test(metadata)) {
    throw new Error("New Mexico GRT archive metadata no longer describes the reviewed district-rate fields.");
  }
  const rows = parseCsvRows(csvEntries[0].data.toString("utf8"));
  const headers = rows.shift()?.map((value) => value.replace(/^\uFEFF/, ""));
  if (!headers || headers.length !== EXPECTED_HEADERS.length || headers.some((header, index) => header !== EXPECTED_HEADERS[index])) {
    throw new Error("New Mexico GRT CSV headers changed; review the RGIS format before accepting it.");
  }
  if (rows.length < 200) throw new Error(`New Mexico GRT CSV returned only ${rows.length} boundary rows.`);
  const ratesByCode = new Map();
  const sources = rows.map((values) => {
    if (values.length !== headers.length) throw new Error("New Mexico GRT CSV contains a malformed row.");
    const source = Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
    if (!source.name || !source.county) throw new Error("New Mexico GRT CSV contains a district without a name or county.");
    return source;
  }).sort((left, right) => Number(Boolean(right.locat_cdr)) - Number(Boolean(left.locat_cdr)));
  for (const source of sources) {
    const { name, county } = source;
    if (source.locat_cdr) {
      pushUnique(ratesByCode, rateRow({
        jurisdictionType: primaryType(name), jurisdictionCode: source.locat_cdr, name, county,
        totalGeneralRate: percent(source.grt_rate, `${name} rate`), beginDate, endDate, noteKey: source.note_key || null,
      }));
    } else {
      if (!source.locat_cd1 || !source.locat_cd2) throw new Error(`New Mexico tribal district ${name} lacks both reviewed location codes.`);
      const classOneRate = percent(source.grt_rate, `${name} class-1 rate`);
      const classTwoRate = percent(Number(source.grt_rate2) > 0 ? source.grt_rate2 : source.grt_rate, `${name} class-2 rate`);
      pushUnique(ratesByCode, rateRow({ jurisdictionType: "special", jurisdictionCode: source.locat_cd1, name: `${name} (tribal class 1)`, county, totalGeneralRate: classOneRate, beginDate, endDate, noteKey: source.note_key || null }));
      pushUnique(ratesByCode, rateRow({ jurisdictionType: "special", jurisdictionCode: source.locat_cd2, name: `${name} (tribal class 2)`, county, totalGeneralRate: classTwoRate, beginDate, endDate, noteKey: source.note_key || null }));
    }
  }
  const rates = [...ratesByCode.values()].sort((left, right) => left.jurisdictionCode.localeCompare(right.jurisdictionCode));
  const counts = {
    counties: rates.filter((rate) => rate.jurisdictionType === "county").length,
    cities: rates.filter((rate) => rate.jurisdictionType === "city").length,
    specialJurisdictions: rates.filter((rate) => rate.jurisdictionType === "special").length,
  };
  if (counts.counties !== expectedCounties) throw new Error(`New Mexico GRT data returned ${counts.counties} county remainders instead of ${expectedCounties}.`);
  if (rates.length < 250) throw new Error(`New Mexico GRT data returned only ${rates.length} unique location codes.`);
  return { rates, counts, sourceRows: rows.length };
}

function validateServices(services, dataset) {
  const description = String(services?.description || "");
  if (!/New Mexico Gross Receipts Tax/i.test(description) || !description.includes(dataset.beginDate.slice(0, 4))) {
    throw new Error("New Mexico RGIS service metadata does not describe the selected GRT period.");
  }
  const csvUrl = services?.downloads?.find((download) => download?.csv)?.csv;
  if (!csvUrl || !/^https:\/\/gstore\.unm\.edu\/apps\/rgis\/datasets\//i.test(csvUrl)) {
    throw new Error("New Mexico RGIS service metadata did not provide the reviewed CSV archive.");
  }
  return csvUrl;
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialNmRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const headers = { Accept: "text/html,application/json,application/zip", "User-Agent": "TaxAP/0.1 official-rate monitor" };
      const pageResponse = await fetchImpl(NEW_MEXICO_GIS_DATA_URL, { headers, signal: controller.signal });
      if (!pageResponse.ok) throw new Error(`New Mexico TRD returned HTTP ${pageResponse.status}.`);
      const pageHtml = await pageResponse.text();
      const dataset = findCurrentNewMexicoDataset(pageHtml, { asOfDate: now.toISOString().slice(0, 10) });
      const servicesUrl = `https://gstore.unm.edu/apps/rgis/datasets/${dataset.uuid}/services.json`;
      const servicesResponse = await fetchImpl(servicesUrl, { headers, signal: controller.signal });
      if (!servicesResponse.ok) throw new Error(`New Mexico RGIS metadata returned HTTP ${servicesResponse.status}.`);
      const servicesText = await servicesResponse.text();
      let services;
      try { services = JSON.parse(servicesText); } catch { throw new Error("New Mexico RGIS metadata was not valid JSON."); }
      const archiveUrl = validateServices(services, dataset);
      const archiveResponse = await fetchImpl(archiveUrl, { headers, signal: controller.signal });
      if (!archiveResponse.ok) throw new Error(`New Mexico RGIS rate archive returned HTTP ${archiveResponse.status}.`);
      const archive = Buffer.from(await archiveResponse.arrayBuffer());
      if (archive.length < 10_000 || archive.readUInt32LE(0) !== 0x04034b50) throw new Error("New Mexico RGIS did not return the expected ZIP archive.");
      const parsed = parseNewMexicoRateArchive(archive, dataset);
      const snapshot = {
        stateCode: "NM", source: "New Mexico Taxation and Revenue Department / RGIS",
        sourceUrl: NEW_MEXICO_GIS_DATA_URL, machineReadableSourceUrl: archiveUrl,
        retrievedAt: now.toISOString(), asOfDate: dataset.beginDate, stateRate: NEW_MEXICO_STATE_GRT_RATE,
        sourceHash: createHash("sha256").update(pageHtml).update(servicesText).update(archive).digest("hex"),
        rates: parsed.rates, counts: parsed.counts, effectivePeriod: `${dataset.beginDate} through ${dataset.endDate}`,
        boundaryStatus: "Official district location codes and current total Gross Receipts Tax rates are connected. New Mexico GRT is a seller-side tax that TaxAP treats as functionally equivalent for monitoring by prior product decision. The source warns that boundaries may contain inaccuracies or omissions; TRD also identifies Lovington Industrial Park as missing from the current GIS layer. Address-to-polygon matching and A+ reconciliation remain unresolved and are never guessed.",
      };
      cachedSnapshot = snapshot; cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000; return snapshot;
    } finally { clearTimeout(timeout); }
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
