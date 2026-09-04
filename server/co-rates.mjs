import { createHash } from "node:crypto";
import { readZipEntries } from "./zip-utils.mjs";

export const COLORADO_RATE_LOOKUP_URL = "https://tax.colorado.gov/how-to-look-up-sales-use-tax-rates";
export const COLORADO_STATE_RATE = 2.9;
export const COLORADO_EXPECTED_SHEETS = ["By Name", "By Juris Codes", "Exemption Codes", "Tax Codes", "Alternate City Rates", "State Service Fee Rates"];

function decodeXml(value) {
  return String(value).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
}

function sharedStrings(xml) {
  if (!xml) return [];
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

function columnName(index) {
  let value = index;
  let result = "";
  while (value > 0) { value -= 1; result = String.fromCharCode(65 + (value % 26)) + result; value = Math.floor(value / 26); }
  return result;
}

function normalizedHeader(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function percentage(value, label) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 20) throw new Error(`Colorado workbook has an invalid ${label}.`);
  return Number(rate.toFixed(4));
}

export function findCurrentColoradoWorkbook(html, { asOfDate = new Date().toISOString().slice(0, 10) } = {}) {
  const candidates = [...String(html).matchAll(/href=["']([^"']*Colorado_Jurisdiction_Codes_Rates_([^"']+)\.xlsx)["']/gi)].map((match) => {
    const name = match[2].replaceAll("_", "-");
    const year = Number(name.match(/(20\d{2})/i)?.[1]);
    if (!year) return null;
    const firstHalf = /Jan(?:uary)?-?Jun(?:e)?/i.test(name);
    const secondHalf = /July?-?Dec/i.test(name);
    if (!firstHalf && !secondHalf) return null;
    return {
      url: new URL(match[1].replaceAll("&amp;", "&"), COLORADO_RATE_LOOKUP_URL).href,
      beginDate: `${year}-${firstHalf ? "01" : "07"}-01`, endDate: `${year}-${firstHalf ? "06-30" : "12-31"}`,
    };
  }).filter(Boolean).sort((left, right) => right.beginDate.localeCompare(left.beginDate));
  const current = candidates.find((candidate) => candidate.beginDate <= asOfDate && candidate.endDate >= asOfDate);
  if (!current) throw new Error(`Colorado DOR did not link a jurisdiction workbook covering ${asOfDate}.`);
  return current;
}

export function parseColoradoRateWorkbook(buffer, { beginDate, endDate, minimumRows = 400 } = {}) {
  const entries = new Map(readZipEntries(Buffer.from(buffer)).map((entry) => [entry.name, entry.data]));
  const workbookXml = entries.get("xl/workbook.xml")?.toString("utf8");
  const relationshipsXml = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!workbookXml || !relationshipsXml) throw new Error("Colorado workbook is missing its workbook metadata.");
  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]+?)\/>/gi)].map((match) => ({
    name: match[1].match(/\bname=["']([^"']+)["']/i)?.[1], relationId: match[1].match(/\br:id=["']([^"']+)["']/i)?.[1],
  }));
  if (sheets.length !== COLORADO_EXPECTED_SHEETS.length || COLORADO_EXPECTED_SHEETS.some((name) => !sheets.some((sheet) => sheet.name === name))) {
    throw new Error("Colorado workbook sheet inventory changed; review the format before accepting it.");
  }
  const byName = sheets.find((sheet) => sheet.name === "By Name");
  const relationship = [...relationshipsXml.matchAll(/<Relationship\b([^>]+?)\/>/gi)].find((match) => match[1].match(/\bId=["']([^"']+)["']/i)?.[1] === byName.relationId);
  const target = relationship?.[1].match(/\bTarget=["']([^"']+)["']/i)?.[1]?.replace(/^\/?xl\//, "");
  const sheetXml = target ? entries.get(`xl/${target.replace(/^\.\//, "")}`)?.toString("utf8") : null;
  if (!sheetXml) throw new Error("Colorado workbook is missing the By Name worksheet.");
  const rows = worksheetRows(sheetXml, sharedStrings(entries.get("xl/sharedStrings.xml")?.toString("utf8")));
  const header = rows.find((row) => row.rowNumber === 1)?.values;
  const expectedFirst = ["Location Code", "Jurisdiction Code", "County", "Self Collected Home Rule", "City Exemptions (state-collected cities)", "County Exemptions", "Special Dist Exemptions", "Total Rate"];
  if (!header || expectedFirst.some((expected, index) => normalizedHeader(header[columnName(index + 1)]) !== expected)) {
    throw new Error("Colorado workbook's By Name identity columns changed.");
  }
  for (let index = 9; index <= 44; index += 3) {
    if (normalizedHeader(header[columnName(index)]) !== "Tax Type" || normalizedHeader(header[columnName(index + 1)]) !== "Rate" || normalizedHeader(header[columnName(index + 2)]) !== "Service Fee Rate") {
      throw new Error("Colorado workbook's repeating tax-layer columns changed.");
    }
  }
  const sourceRows = rows.filter((row) => row.rowNumber > 1 && row.values.A != null);
  if (sourceRows.length < minimumRows) throw new Error(`Colorado workbook returned only ${sourceRows.length} jurisdiction rows.`);
  const codes = new Set();
  const rates = sourceRows.map(({ rowNumber, values }) => {
    const name = String(values.A || "").trim();
    const jurisdictionCode = String(values.B || "").padStart(6, "0");
    const county = String(values.C || "").trim();
    if (!name || !/^\d{6}$/.test(jurisdictionCode) || !county) throw new Error(`Colorado workbook row ${rowNumber} lacks a valid name, code, or county.`);
    if (codes.has(jurisdictionCode)) throw new Error(`Colorado workbook repeats jurisdiction code ${jurisdictionCode}.`);
    codes.add(jurisdictionCode);
    const layers = [];
    for (let index = 9; index <= 44; index += 3) {
      const taxType = String(values[columnName(index)] || "").trim();
      const rawRate = values[columnName(index + 1)];
      if (!taxType && rawRate == null) continue;
      if (!taxType || rawRate == null) throw new Error(`Colorado workbook row ${rowNumber} has an incomplete tax layer.`);
      layers.push({ taxType, rate: percentage(rawRate, `${name} ${taxType} rate`) });
    }
    const stateLayers = layers.filter((layer) => layer.taxType.toLowerCase() === "state");
    if (stateLayers.length !== 1 || stateLayers[0].rate !== COLORADO_STATE_RATE) throw new Error(`Colorado workbook row ${rowNumber} does not contain the expected 2.9% state layer.`);
    const totalGeneralRate = percentage(values.H, `${name} total rate`);
    const calculated = Number(layers.reduce((sum, layer) => sum + layer.rate, 0).toFixed(4));
    if (calculated !== totalGeneralRate) throw new Error(`Colorado workbook row ${rowNumber} layers total ${calculated}% instead of ${totalGeneralRate}%.`);
    const hasCity = layers.some((layer) => layer.taxType.toLowerCase() === "city");
    const hasCounty = layers.some((layer) => ["county", "cnty"].includes(layer.taxType.toLowerCase()));
    const onlyStateCounty = layers.every((layer) => ["state", "county", "cnty"].includes(layer.taxType.toLowerCase()));
    const jurisdictionType = hasCity ? "city" : hasCounty && onlyStateCounty ? "county" : "special";
    return {
      jurisdictionType, jurisdictionCode: `CO:${jurisdictionCode}`, filingCode: jurisdictionCode, name, county,
      selfCollectedHomeRule: /self[- ]collected/i.test(String(values.D || "")), layers,
      componentRate: Number((totalGeneralRate - COLORADO_STATE_RATE).toFixed(4)), totalGeneralRate,
      generalInterstateRate: totalGeneralRate, beginDate, endDate,
    };
  }).sort((left, right) => left.jurisdictionCode.localeCompare(right.jurisdictionCode));
  const counts = {
    counties: rates.filter((rate) => rate.jurisdictionType === "county").length,
    cities: rates.filter((rate) => rate.jurisdictionType === "city").length,
    specialJurisdictions: rates.filter((rate) => rate.jurisdictionType === "special").length,
  };
  return { rates, counts, sourceRows: sourceRows.length, homeRuleRows: rates.filter((rate) => rate.selfCollectedHomeRule).length };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialCoRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const headers = { Accept: "text/html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 TaxAP/0.1" };
      const pageResponse = await fetchImpl(COLORADO_RATE_LOOKUP_URL, { headers, signal: controller.signal });
      if (!pageResponse.ok) throw new Error(`Colorado DOR returned HTTP ${pageResponse.status}.`);
      const pageHtml = await pageResponse.text();
      const current = findCurrentColoradoWorkbook(pageHtml, { asOfDate: now.toISOString().slice(0, 10) });
      const workbookResponse = await fetchImpl(current.url, { headers, signal: controller.signal });
      if (!workbookResponse.ok) throw new Error(`Colorado DOR workbook returned HTTP ${workbookResponse.status}.`);
      const workbook = Buffer.from(await workbookResponse.arrayBuffer());
      if (workbook.length < 50_000 || workbook.readUInt32LE(0) !== 0x04034b50) throw new Error("Colorado DOR did not return the expected XLSX workbook.");
      const parsed = parseColoradoRateWorkbook(workbook, current);
      const snapshot = {
        stateCode: "CO", source: "Colorado Department of Revenue", sourceUrl: COLORADO_RATE_LOOKUP_URL,
        machineReadableSourceUrl: current.url, retrievedAt: now.toISOString(), asOfDate: current.beginDate,
        stateRate: COLORADO_STATE_RATE, sourceHash: createHash("sha256").update(pageHtml).update(workbook).digest("hex"),
        rates: parsed.rates, counts: parsed.counts, effectivePeriod: `${current.beginDate} through ${current.endDate}`,
        boundaryStatus: "Current jurisdiction codes, layered totals, counties, and self-collected-home-rule flags are connected. A city can have several valid county/special-district variants, so city-name matching is prohibited. Colorado's public address lookup is interactive; address-to-district and A+ reconciliation remain unresolved and are never guessed.",
      };
      cachedSnapshot = snapshot; cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000; return snapshot;
    } finally { clearTimeout(timeout); }
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
