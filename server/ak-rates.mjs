import { createHash } from "node:crypto";
import { readZipEntries } from "./zip-utils.mjs";

export const ALASKA_SALES_TAX_POLICY_URL = "https://www.commerce.alaska.gov/web/dcra/OfficeoftheStateAssessor/AlaskaSalesTaxInformation";
export const ALASKA_REMOTE_SELLER_RATES_URL = "https://arsstc.org/business-sellers/tax-rates/";
export const ALASKA_STATE_RATE = 0;
export const ALASKA_EXPECTED_MEMBER_ROWS = 56;

const EXPECTED_HEADERS = [
  "Borough / Census Tract Name", "Borough Tax Rate", "Tax Filing Code", "Date adopted Remote Sellers Code",
  "Remote Sellers Tax Collection Start Date", "Tax Rate Effective Date", "City/Taxing Area",
  "City / Taxing Area Sales Tax Rate", "Tax Filing Code", "Date adopted Remote Sellers Code",
  "Remote Sellers Tax Collection Start Date", "Tax Rate Effective Date", "Sales Tax Rate Total",
];

function decodeXml(value) {
  return String(value).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
}

function sharedStrings(xml) {
  return [...String(xml).matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi)].map((match) =>
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)].map((part) => decodeXml(part[1])).join(""),
  );
}

function worksheetRows(xml, strings) {
  return [...String(xml).matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)].map((row) => {
    const rowNumber = Number(row[1].match(/\br=["'](\d+)["']/i)?.[1]);
    const values = {};
    for (const cell of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi)) {
      const column = cell[1].match(/\br=["']([A-Z]+)\d+["']/i)?.[1]?.toUpperCase();
      if (!column) continue;
      const body = cell[2] ?? "";
      const raw = body.match(/<v>([\s\S]*?)<\/v>/i)?.[1] ?? "";
      if (/\bt=["']s["']/i.test(cell[1])) values[column] = strings[Number(raw)] ?? "";
      else if (/\bt=["']inlineStr["']/i.test(cell[1])) values[column] = decodeXml(body);
      else values[column] = raw === "" ? null : raw;
    }
    return { rowNumber, values };
  });
}

function decimalRate(value, label, { allowBlank = false } = {}) {
  if ((value == null || value === "") && allowBlank) return 0;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.15) throw new Error(`Alaska rate workbook has an invalid ${label}.`);
  return rate;
}

function excelDate(value, label) {
  if (value == null || value === "") return null;
  if (/^\d+(?:\.\d+)?$/.test(String(value))) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86_400_000);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  const parsed = new Date(`${value} 00:00:00 UTC`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Alaska rate workbook has an invalid ${label}.`);
  return parsed.toISOString().slice(0, 10);
}

export function findLatestAlaskaWorkbook(html) {
  const links = [...String(html).matchAll(/href=["']([^"']*ARSSTC-Sales-Tax-Rate-Sheet-(\d{1,2})-(\d{1,2})-(\d{2,4})\.xlsx)["']/gi)]
    .map((match) => {
      const year = match[4].length === 2 ? `20${match[4]}` : match[4];
      return { url: new URL(match[1].replaceAll("&amp;", "&"), ALASKA_REMOTE_SELLER_RATES_URL).href, date: `${year}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` };
    }).sort((left, right) => right.date.localeCompare(left.date));
  if (links.length === 0) throw new Error("ARSSTC rate page did not link a non-ZIP sales-tax workbook.");
  return links[0];
}

export function parseAlaskaPolicy(html) {
  const text = String(html).replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ");
  if (!/State of Alaska does\s+NOT\s+levy a sales tax/i.test(text) || !/local municipalities within the state do levy a sales tax/i.test(text)) {
    throw new Error("Alaska DCRA page no longer confirms the zero state rate and local municipal sales taxes.");
  }
  return { stateRate: ALASKA_STATE_RATE, hasLocalSalesTax: true };
}

export function parseAlaskaRateWorkbook(buffer, { expectedRows = ALASKA_EXPECTED_MEMBER_ROWS, expectedBoroughRows = 10, expectedCityRows = 46 } = {}) {
  const entries = new Map(readZipEntries(Buffer.from(buffer)).map((entry) => [entry.name, entry.data]));
  const sheetXml = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8");
  const stringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  if (!sheetXml || !stringsXml) throw new Error("Alaska rate workbook is missing its general-rate worksheet or shared strings.");
  const rows = worksheetRows(sheetXml, sharedStrings(stringsXml));
  const policyNote = String(rows.find((row) => row.rowNumber === 3)?.values.A || "");
  if (!/State of Alaska does not have a state level remote sellers sales tax/i.test(policyNote)) {
    throw new Error("ARSSTC workbook no longer confirms that Alaska has no state-level remote-seller sales tax.");
  }
  const header = rows.find((row) => row.rowNumber === 4)?.values;
  const columns = "ABCDEFGHIJKLM";
  if (!header || [...columns].some((column, index) => header[column] !== EXPECTED_HEADERS[index])) {
    throw new Error("Alaska rate workbook headers changed; review the ARSSTC format before accepting it.");
  }
  const asOf = String(rows.find((row) => row.rowNumber === 1)?.values.M || "").match(/As of\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!asOf) throw new Error("Alaska rate workbook does not identify its as-of date.");
  const asOfDate = `${asOf[3]}-${asOf[1].padStart(2, "0")}-${asOf[2].padStart(2, "0")}`;

  const sourceRows = rows.filter((row) => row.rowNumber > 4 && row.rowNumber < 61 && row.values.M != null);
  if (sourceRows.length !== expectedRows) throw new Error(`Alaska rate workbook returned ${sourceRows.length} member destination rows instead of ${expectedRows}.`);
  const codes = new Set();
  const rates = sourceRows.map(({ rowNumber, values }) => {
    const boroughName = String(values.A || "").trim();
    const cityName = String(values.G || "").trim();
    const isCity = Boolean(cityName);
    const filingCode = String(isCity ? values.I || "" : values.C || "").trim();
    if (!boroughName || !/^\d{4,6}$/.test(filingCode)) throw new Error(`Alaska rate workbook row ${rowNumber} lacks a borough name or valid filing code.`);
    if (codes.has(filingCode)) throw new Error(`Alaska rate workbook repeats filing code ${filingCode}.`);
    codes.add(filingCode);
    const boroughRate = decimalRate(values.B, `borough rate on row ${rowNumber}`, { allowBlank: true });
    const cityRate = decimalRate(values.H, `city rate on row ${rowNumber}`, { allowBlank: true });
    const totalRate = decimalRate(values.M, `total rate on row ${rowNumber}`);
    if (Number((boroughRate + cityRate).toFixed(6)) !== Number(totalRate.toFixed(6))) {
      throw new Error(`Alaska rate workbook row ${rowNumber} does not reconcile its borough and city components to the published total.`);
    }
    const beginDates = [excelDate(values.F, `borough effective date on row ${rowNumber}`), excelDate(values.L, `city effective date on row ${rowNumber}`)].filter(Boolean).sort();
    return {
      jurisdictionType: isCity ? "city" : "county",
      jurisdictionCode: `AK:${filingCode}`,
      filingCode,
      name: isCity ? cityName : boroughName,
      county: boroughName,
      componentRate: Number((totalRate * 100).toFixed(4)),
      totalGeneralRate: Number((totalRate * 100).toFixed(4)),
      generalInterstateRate: Number((totalRate * 100).toFixed(4)),
      beginDate: beginDates.at(-1) ?? null,
      endDate: null,
    };
  }).sort((left, right) => left.name.localeCompare(right.name));
  const counts = {
    counties: rates.filter((rate) => rate.jurisdictionType === "county").length,
    cities: rates.filter((rate) => rate.jurisdictionType === "city").length,
    specialJurisdictions: 0,
  };
  if (counts.counties !== expectedBoroughRows || counts.cities !== expectedCityRows) {
    throw new Error(`Alaska rate workbook returned ${counts.counties} borough-area and ${counts.cities} city rows instead of ${expectedBoroughRows} and ${expectedCityRows}.`);
  }
  return { asOfDate, rates, counts };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialAkRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const headers = { Accept: "text/html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "User-Agent": "TaxAP/0.1 official-rate monitor" };
      const ratesPageResponse = await fetchImpl(ALASKA_REMOTE_SELLER_RATES_URL, { headers, signal: controller.signal });
      if (!ratesPageResponse.ok) throw new Error(`ARSSTC returned HTTP ${ratesPageResponse.status}.`);
      const ratesHtml = await ratesPageResponse.text();
      const latest = findLatestAlaskaWorkbook(ratesHtml);
      const workbookResponse = await fetchImpl(latest.url, { headers, signal: controller.signal });
      if (!workbookResponse.ok) throw new Error(`ARSSTC rate workbook returned HTTP ${workbookResponse.status}.`);
      const workbook = Buffer.from(await workbookResponse.arrayBuffer());
      if (workbook.length < 10_000 || workbook.readUInt32LE(0) !== 0x04034b50) throw new Error("ARSSTC did not return the expected XLSX rate workbook.");
      const parsed = parseAlaskaRateWorkbook(workbook);
      if (parsed.asOfDate !== latest.date) throw new Error(`ARSSTC workbook says ${parsed.asOfDate}, but its current link is dated ${latest.date}.`);
      const snapshot = {
        stateCode: "AK", source: "Alaska Remote Seller Sales Tax Commission",
        sourceUrl: ALASKA_REMOTE_SELLER_RATES_URL, machineReadableSourceUrl: latest.url,
        retrievedAt: now.toISOString(), asOfDate: parsed.asOfDate, stateRate: ALASKA_STATE_RATE,
        sourceHash: createHash("sha256").update(ratesHtml).update(workbook).digest("hex"),
        rates: [{ jurisdictionType: "state", jurisdictionCode: "AK:STATE", name: "Alaska state sales tax", componentRate: 0, totalGeneralRate: 0, generalInterstateRate: 0, beginDate: null, endDate: null }, ...parsed.rates],
        counts: parsed.counts, effectivePeriod: `ARSSTC member rates as of ${parsed.asOfDate}`,
        boundaryStatus: "Alaska has no state sales tax. The current ARSSTC workbook supplies validated destination totals for participating remote-seller jurisdictions, including layered borough/city totals and seasonal rates. It does not cover every Alaska municipality; address-boundary and nonmember-jurisdiction coverage remain unresolved and are never guessed.",
      };
      cachedSnapshot = snapshot; cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000; return snapshot;
    } finally { clearTimeout(timeout); }
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
