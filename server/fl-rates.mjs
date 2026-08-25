import { createHash } from "node:crypto";
import { readZipEntries } from "./zip-utils.mjs";

export const FLORIDA_DOR_RATES_URL = "https://floridarevenue.com/taxes/taxesfees/Pages/discretionary.aspx";
export const FLORIDA_RATE_DOWNLOAD_URL = "https://pointmatch.floridarevenue.com/General/DiscretionarySalesSurtaxRates.aspx/DiscretionarySalesSurtaxRates.aspx";
export const FLORIDA_STATE_RATE = 6;

export const FLORIDA_COUNTIES = [
  "ALACHUA", "BAKER", "BAY", "BRADFORD", "BREVARD", "BROWARD", "CALHOUN", "CHARLOTTE", "CITRUS", "CLAY",
  "COLLIER", "COLUMBIA", "DESOTO", "DIXIE", "DUVAL", "ESCAMBIA", "FLAGLER", "FRANKLIN", "GADSDEN", "GILCHRIST",
  "GLADES", "GULF", "HAMILTON", "HARDEE", "HENDRY", "HERNANDO", "HIGHLANDS", "HILLSBOROUGH", "HOLMES", "INDIAN RIVER",
  "JACKSON", "JEFFERSON", "LAFAYETTE", "LAKE", "LEE", "LEON", "LEVY", "LIBERTY", "MADISON", "MANATEE", "MARION",
  "MARTIN", "MIAMI-DADE", "MONROE", "NASSAU", "OKALOOSA", "OKEECHOBEE", "ORANGE", "OSCEOLA", "PALM BEACH", "PASCO",
  "PINELLAS", "POLK", "PUTNAM", "SANTA ROSA", "SARASOTA", "SEMINOLE", "ST JOHNS", "ST LUCIE", "SUMTER", "SUWANNEE",
  "TAYLOR", "UNION", "VOLUSIA", "WAKULLA", "WALTON", "WASHINGTON",
];

function decodeXml(value) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function sharedStrings(xml) {
  return [...String(xml).matchAll(/<si>([\s\S]*?)<\/si>/gi)].map((match) =>
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)].map((part) => decodeXml(part[1])).join(""),
  );
}

function workbookRows(sheetXml, strings) {
  return [...String(sheetXml).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)].map((row) => {
    const values = {};
    for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const reference = cell[1].match(/\br=["']([A-Z]+)\d+["']/i)?.[1]?.toUpperCase();
      if (!reference) continue;
      const raw = cell[2].match(/<v>([\s\S]*?)<\/v>/i)?.[1] ?? "";
      values[reference] = /\bt=["']s["']/i.test(cell[1]) ? strings[Number(raw)] ?? "" : decodeXml(raw);
    }
    return values;
  });
}

export function parseFloridaSurtaxWorkbook(buffer, { expectedCounties = FLORIDA_COUNTIES } = {}) {
  const entries = new Map(readZipEntries(Buffer.from(buffer)).map((entry) => [entry.name, entry.data]));
  const sheet = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8");
  const stringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  if (!sheet || !stringsXml) throw new Error("Florida rate workbook is missing its first worksheet or shared strings.");
  const strings = sharedStrings(stringsXml);
  const rows = workbookRows(sheet, strings);
  const asOfText = strings.find((value) => /Rates shown above are current as of/i.test(value));
  const asOfMatch = asOfText?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!asOfMatch) throw new Error("Florida rate workbook does not identify when its rates were current.");
  const asOfDate = `${asOfMatch[3]}-${asOfMatch[1].padStart(2, "0")}-${asOfMatch[2].padStart(2, "0")}`;
  const expected = new Set(expectedCounties.map((county) => county.toUpperCase()));
  const byCounty = new Map();
  for (const row of rows) {
    const county = String(row.A || "").trim().toUpperCase();
    if (!expected.has(county)) continue;
    const rateMatch = String(row.B || "").match(/^(\d+(?:\.\d+)?)%$/);
    if (!rateMatch) throw new Error(`Florida rate workbook has no valid surtax rate for ${county}.`);
    const surtaxRate = Number(rateMatch[1]);
    if (surtaxRate < 0 || surtaxRate > 3) throw new Error(`Florida returned an invalid surtax rate for ${county}.`);
    if (byCounty.has(county) && byCounty.get(county) !== surtaxRate) throw new Error(`Florida returned conflicting duplicate rates for ${county}.`);
    byCounty.set(county, surtaxRate);
  }
  const missing = [...expected].filter((county) => !byCounty.has(county));
  if (missing.length > 0 || byCounty.size !== expected.size) {
    throw new Error(`Florida rate workbook is incomplete; missing ${missing.join(", ") || "unknown counties"}.`);
  }
  const rates = [...byCounty].map(([county, surtaxRate]) => ({
    jurisdictionType: "county",
    jurisdictionCode: `FL:${county}`,
    name: `${county.replace(/\b\w/g, (letter) => letter.toUpperCase()).replace("Miami-Dade", "Miami-Dade")} County`,
    county,
    componentRate: surtaxRate,
    totalGeneralRate: Number((FLORIDA_STATE_RATE + surtaxRate).toFixed(4)),
    generalInterstateRate: Number((FLORIDA_STATE_RATE + surtaxRate).toFixed(4)),
    beginDate: null,
    endDate: null,
  })).sort((left, right) => left.name.localeCompare(right.name));
  return { asOfDate, rates };
}

function hiddenFields(html) {
  const fields = {};
  for (const input of String(html).matchAll(/<input\b[^>]*type=["']hidden["'][^>]*>/gi)) {
    const name = input[0].match(/\bname=["']([^"']+)["']/i)?.[1];
    const value = input[0].match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? "";
    if (name) fields[name] = value.replaceAll("&amp;", "&");
  }
  return fields;
}

async function downloadCurrentWorkbook(fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const page = await fetchImpl(FLORIDA_RATE_DOWNLOAD_URL, {
      headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal,
    });
    if (!page.ok) throw new Error(`Florida DOR returned HTTP ${page.status}.`);
    const html = await page.text();
    const fields = hiddenFields(html);
    if (!fields.__VIEWSTATE || !fields.__EVENTVALIDATION) throw new Error("Florida DOR download page is missing its validation fields.");
    const response = await fetchImpl(FLORIDA_RATE_DOWNLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "TaxAP/0.1 official-rate monitor" },
      body: new URLSearchParams({ ...fields, "ctl00$BodyContent$gridView_DownloadLink": "Download All" }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Florida DOR rate download returned HTTP ${response.status}.`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 3_000 || buffer.readUInt32LE(0) !== 0x04034b50) throw new Error("Florida DOR did not return the expected XLSX rate workbook.");
    return buffer;
  } finally { clearTimeout(timeout); }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialFlRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const workbook = await downloadCurrentWorkbook(fetchImpl);
    const parsed = parseFloridaSurtaxWorkbook(workbook);
    const snapshot = {
      stateCode: "FL",
      source: "Florida Department of Revenue",
      sourceUrl: FLORIDA_DOR_RATES_URL,
      machineReadableSourceUrl: FLORIDA_RATE_DOWNLOAD_URL,
      retrievedAt: now.toISOString(),
      asOfDate: parsed.asOfDate,
      stateRate: FLORIDA_STATE_RATE,
      sourceHash: createHash("sha256").update(workbook).digest("hex"),
      rates: parsed.rates,
      counts: { counties: parsed.rates.length, cities: 0, specialJurisdictions: 0 },
      effectivePeriod: `Current as of ${parsed.asOfDate}`,
      boundaryStatus: "All 67 county surtax totals are connected. Effective and expiration detail remains in Form DR-15DSS; address-to-county matching is separate.",
    };
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
    return snapshot;
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
