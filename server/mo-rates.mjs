import { createHash } from "node:crypto";
import { readZipEntries } from "./zip-utils.mjs";

export const MISSOURI_RATE_TABLES_URL = "https://dor.mo.gov/taxation/business/tax-types/sales-use/rate-tables/";
export const MISSOURI_STATE_RATE = 4.225;

function decodeXmlText(value) {
  return String(value).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));
}

function normalizedText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sharedStrings(xml) {
  if (!xml) return [];
  return [...String(xml).matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi)].map((match) =>
    normalizedText([...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)].map((part) => decodeXmlText(part[1])).join("")),
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
      else if (/\bt=["']inlineStr["']/i.test(cell[1])) values[column] = normalizedText(body.replace(/<[^>]*>/g, ""));
      else values[column] = raw === "" ? null : raw;
    }
    return { rowNumber, values };
  });
}

function endOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function findCurrentMissouriWorkbook(html, { asOfDate = new Date().toISOString().slice(0, 10) } = {}) {
  const candidates = [...String(html).matchAll(/<a\b[^>]*href=["']([^"']+\.xlsx)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => {
    const label = normalizedText(match[2].replace(/<[^>]*>/g, ""));
    const period = label.match(/(\d{2})\/(20\d{2})(?:\s*-\s*(\d{2})\/(20\d{2}))?\s*-\s*XLS/i);
    if (!period) return null;
    const startMonth = Number(period[1]); const startYear = Number(period[2]);
    const endMonth = Number(period[3] ?? period[1]); const endYear = Number(period[4] ?? period[2]);
    if (![startMonth, endMonth].every((month) => month >= 1 && month <= 12)) return null;
    return {
      url: new URL(decodeXmlText(match[1]), MISSOURI_RATE_TABLES_URL).href,
      beginDate: `${startYear}-${String(startMonth).padStart(2, "0")}-01`,
      endDate: endOfMonth(endYear, endMonth),
    };
  }).filter(Boolean).sort((left, right) => right.beginDate.localeCompare(left.beginDate));
  const current = candidates.find((candidate) => candidate.beginDate <= asOfDate && candidate.endDate >= asOfDate);
  if (!current) throw new Error(`Missouri DOR did not link an XLSX rate table covering ${asOfDate}.`);
  return current;
}

function percentage(value, label) {
  const source = String(value ?? "").trim();
  let rate = Number(source.replace(/%$/, ""));
  if (!source.endsWith("%") && rate >= 0 && rate <= 1) rate *= 100;
  if (!Number.isFinite(rate) || rate < 0 || rate > 25) throw new Error(`Missouri workbook has an invalid ${label}.`);
  return Number(rate.toFixed(4));
}

export function parseMissouriRateWorkbook(buffer, { beginDate, endDate, minimumRows = 2_000 } = {}) {
  const entries = new Map(readZipEntries(Buffer.from(buffer)).map((entry) => [entry.name, entry.data]));
  const workbookXml = entries.get("xl/workbook.xml")?.toString("utf8");
  const relationshipsXml = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!workbookXml || !relationshipsXml) throw new Error("Missouri workbook is missing its workbook metadata.");
  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]+?)\/>/gi)].map((match) => ({
    name: decodeXmlText(match[1].match(/\bname=["']([^"']+)["']/i)?.[1] ?? ""),
    relationId: match[1].match(/\br:id=["']([^"']+)["']/i)?.[1],
  }));
  if (sheets.length !== 1 || sheets[0].name !== "Sales and Use Tax Rate Chart") {
    throw new Error("Missouri workbook sheet inventory changed; review the format before accepting it.");
  }
  const relationship = [...relationshipsXml.matchAll(/<Relationship\b([^>]+?)\/>/gi)].find((match) =>
    match[1].match(/\bId=["']([^"']+)["']/i)?.[1] === sheets[0].relationId,
  );
  const target = relationship?.[1].match(/\bTarget=["']([^"']+)["']/i)?.[1]?.replace(/^\/?xl\//, "");
  const sheetXml = target ? entries.get(`xl/${target.replace(/^\.\//, "")}`)?.toString("utf8") : null;
  if (!sheetXml) throw new Error("Missouri workbook is missing its rate worksheet.");
  const rows = worksheetRows(sheetXml, sharedStrings(entries.get("xl/sharedStrings.xml")?.toString("utf8")));
  const header = rows.find((row) => row.rowNumber === 12)?.values;
  const expectedHeaders = {
    B: "JurisdictionName", C: "JurisdictionCode", D: "SalesTaxRate(0000)", E: "UseTaxRate(0000)(0010)",
    F: "FoodSalesTax(1001)", G: "FoodUseTax(1001)(1011)", I: "DomesticUtilityRate(3200)", J: "AMJRate(7004)",
  };
  if (!header || Object.entries(expectedHeaders).some(([column, expected]) => normalizedText(header[column]).replace(/\s/g, "") !== expected)) {
    throw new Error("Missouri workbook rate columns changed; review the format before accepting it.");
  }
  const sourceRows = rows.filter((row) => /^\d{5}-\d{3}-\d{3}$/.test(String(row.values.C ?? "")));
  if (sourceRows.length < minimumRows) throw new Error(`Missouri workbook returned only ${sourceRows.length} jurisdiction rows.`);
  const codes = new Set();
  const rates = sourceRows.map(({ rowNumber, values }) => {
    const name = normalizedText(values.B); const filingCode = String(values.C);
    if (!name) throw new Error(`Missouri workbook row ${rowNumber} has no jurisdiction name.`);
    if (codes.has(filingCode)) throw new Error(`Missouri workbook repeats jurisdiction code ${filingCode}.`);
    codes.add(filingCode);
    const salesRate = percentage(values.D, `${name} sales rate`);
    if (salesRate < MISSOURI_STATE_RATE) throw new Error(`Missouri workbook row ${rowNumber} is below the ${MISSOURI_STATE_RATE}% state rate.`);
    const countyArea = filingCode.startsWith("00000-");
    const specialOverlay = !filingCode.endsWith("-000");
    return {
      jurisdictionType: specialOverlay ? "special" : countyArea ? "county" : "city",
      jurisdictionCode: `MO:${filingCode}`, filingCode, name,
      salesRate, useRate: percentage(values.E, `${name} use rate`),
      foodSalesRate: percentage(values.F, `${name} food sales rate`),
      foodUseRate: percentage(values.G, `${name} food use rate`),
      domesticUtilityRate: percentage(values.I, `${name} domestic utility rate`),
      amjRate: percentage(values.J, `${name} AMJ rate`),
      componentRate: Number((salesRate - MISSOURI_STATE_RATE).toFixed(4)), totalGeneralRate: salesRate,
      generalInterstateRate: percentage(values.E, `${name} use rate`), beginDate, endDate,
    };
  }).sort((left, right) => left.filingCode.localeCompare(right.filingCode));
  return {
    rates, sourceRows: sourceRows.length,
    counts: {
      counties: rates.filter((rate) => rate.jurisdictionType === "county").length,
      cities: rates.filter((rate) => rate.jurisdictionType === "city").length,
      specialJurisdictions: rates.filter((rate) => rate.jurisdictionType === "special").length,
    },
  };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialMoRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const yearUrl = new URL(`${now.getUTCFullYear()}/`, MISSOURI_RATE_TABLES_URL).href;
      const headers = { Accept: "text/html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 TaxAP/0.1" };
      const pageResponse = await fetchImpl(yearUrl, { headers, signal: controller.signal });
      if (!pageResponse.ok) throw new Error(`Missouri DOR returned HTTP ${pageResponse.status}.`);
      const pageHtml = await pageResponse.text();
      const current = findCurrentMissouriWorkbook(pageHtml, { asOfDate: now.toISOString().slice(0, 10) });
      const workbookResponse = await fetchImpl(current.url, { headers, signal: controller.signal });
      if (!workbookResponse.ok) throw new Error(`Missouri DOR workbook returned HTTP ${workbookResponse.status}.`);
      const workbook = Buffer.from(await workbookResponse.arrayBuffer());
      if (workbook.length < 100_000 || workbook.readUInt32LE(0) !== 0x04034b50) throw new Error("Missouri DOR did not return the expected XLSX workbook.");
      const parsed = parseMissouriRateWorkbook(workbook, current);
      const snapshot = {
        stateCode: "MO", source: "Missouri Department of Revenue", sourceUrl: yearUrl,
        machineReadableSourceUrl: current.url, retrievedAt: now.toISOString(), asOfDate: current.beginDate,
        stateRate: MISSOURI_STATE_RATE, sourceHash: createHash("sha256").update(pageHtml).update(workbook).digest("hex"),
        rates: parsed.rates, counts: parsed.counts, effectivePeriod: `${current.beginDate} through ${current.endDate}`,
        boundaryStatus: "Current filing jurisdiction codes and general sales/use totals are connected. Missouri codes represent city/county/special-district combinations; address-to-code and A+ reconciliation remain unresolved and are never guessed.",
      };
      cachedSnapshot = snapshot; cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000; return snapshot;
    } finally { clearTimeout(timeout); }
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
