import { fetchOfficial } from "./official-fetch.mjs";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evidenceDirectory } from "./data-paths.mjs";
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

// Colorado names each half-year workbook by period, e.g. "July-Dec2026" or "Jan-June2026_Apr26" for a reissue.
function coloradoPeriodFromName(periodName) {
  const name = String(periodName).replaceAll("_", "-");
  const year = Number(name.match(/(20\d{2})/i)?.[1]);
  if (!year) return null;
  const firstHalf = /Jan(?:uary)?-?Jun(?:e)?/i.test(name);
  const secondHalf = /July?-?Dec/i.test(name);
  if (firstHalf === secondHalf) return null;
  return { beginDate: `${year}-${firstHalf ? "01" : "07"}-01`, endDate: `${year}-${firstHalf ? "06-30" : "12-31"}` };
}

export function findCurrentColoradoWorkbook(html, { asOfDate = new Date().toISOString().slice(0, 10) } = {}) {
  const candidates = [...String(html).matchAll(/href=["']([^"']*Colorado_Jurisdiction_Codes_Rates_([^"']+)\.xlsx)["']/gi)].map((match) => {
    const period = coloradoPeriodFromName(match[2]);
    return period && { url: new URL(match[1].replaceAll("&amp;", "&"), COLORADO_RATE_LOOKUP_URL).href, ...period };
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

const COLORADO_BOUNDARY_STATUS = "Current jurisdiction codes, layered totals, counties, and self-collected-home-rule flags are connected. A city can have several valid county/special-district variants, so city-name matching is prohibited. Colorado's public address lookup is interactive; address-to-district and A+ reconciliation remain unresolved and are never guessed.";
// Below the router's 2 MB request limit; the official workbook is about 120 KB.
export const COLORADO_UPLOAD_MAX_BYTES = 2_000_000;
const COLORADO_WORKBOOK_FILE = /^Colorado_Jurisdiction_Codes_Rates_([A-Za-z0-9_-]+)\.xlsx$/i;
const UPLOAD_LEAD_DAYS = 62;

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

function assertWorkbookBytes(workbook, message) {
  if (workbook.length < 50_000 || workbook.readUInt32LE(0) !== 0x04034b50) throw new Error(message);
}

function writeAtomically(filename, data) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  writeFileSync(temporary, data, { mode: 0o600 });
  renameSync(temporary, filename);
}

export function coloradoUploadDirectory(directory = evidenceDirectory()) {
  return resolve(directory, "co-uploads");
}

/**
 * Stores a browser-downloaded copy of Colorado's official workbook for use only when automatic
 * retrieval fails. It must pass the same validation as a download and is keyed by its half-year period.
 */
export function saveColoradoUploadedWorkbook({ fileName, workbook, uploadedBy, now = new Date(), directory = evidenceDirectory(), minimumRows } = {}) {
  const name = String(fileName || "").trim();
  const periodName = name.match(COLORADO_WORKBOOK_FILE)?.[1];
  const period = periodName && coloradoPeriodFromName(periodName);
  if (!period) throw new Error("Upload the official Colorado_Jurisdiction_Codes_Rates_<period>.xlsx workbook without renaming it.");
  const today = now.toISOString().slice(0, 10);
  const latestBegin = new Date(now.getTime() + UPLOAD_LEAD_DAYS * 86_400_000).toISOString().slice(0, 10);
  if (period.endDate < today) throw new Error(`This workbook covers ${period.beginDate} through ${period.endDate}, which has ended.`);
  if (period.beginDate > latestBegin) throw new Error(`This workbook starts ${period.beginDate}; upload it within ${UPLOAD_LEAD_DAYS} days of that date.`);
  const uploader = String(uploadedBy || "").replace(/\s+/g, " ").trim();
  if (uploader.length < 2 || uploader.length > 80 || !/^[\p{L}\p{M} .,'-]+$/u.test(uploader)) throw new Error("Enter the uploader's name using letters, spaces, periods, commas, apostrophes or hyphens.");
  if (!Buffer.isBuffer(workbook) || workbook.length > COLORADO_UPLOAD_MAX_BYTES) throw new Error("The uploaded file is missing or too large.");
  assertWorkbookBytes(workbook, "The uploaded file is not the expected XLSX workbook.");
  const parsed = parseColoradoRateWorkbook(workbook, { ...period, ...(minimumRows ? { minimumRows } : {}) });
  const metadata = {
    version: 1, fileName: name, ...period, uploadedAt: now.toISOString(), uploadedBy: uploader,
    sha256: createHash("sha256").update(workbook).digest("hex"), rows: parsed.rates.length, counts: parsed.counts,
  };
  const folder = coloradoUploadDirectory(directory);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  // Workbook first: metadata only ever points at a complete file, and its hash detects a mismatch.
  writeAtomically(resolve(folder, `${period.beginDate}.xlsx`), workbook);
  writeAtomically(resolve(folder, `${period.beginDate}.json`), JSON.stringify(metadata));
  cachedSnapshot = null; cacheExpiresAt = 0;
  return metadata;
}

/** Returns the stored upload covering today, revalidated, or null. Expired periods are never used. */
export function readColoradoUploadedWorkbook({ now = new Date(), directory = evidenceDirectory(), minimumRows } = {}) {
  const folder = coloradoUploadDirectory(directory);
  if (!existsSync(folder)) return null;
  const today = now.toISOString().slice(0, 10);
  const metadata = readdirSync(folder).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .map((file) => { try { return JSON.parse(readFileSync(resolve(folder, file), "utf8")); } catch { return null; } })
    .filter((record) => record?.version === 1 && record.beginDate <= today && record.endDate >= today)
    .sort((left, right) => right.beginDate.localeCompare(left.beginDate))[0];
  if (!metadata) return null;
  const workbook = readFileSync(resolve(folder, `${metadata.beginDate}.xlsx`));
  if (createHash("sha256").update(workbook).digest("hex") !== metadata.sha256) throw new Error("The uploaded Colorado workbook failed integrity validation.");
  assertWorkbookBytes(workbook, "The uploaded Colorado workbook failed integrity validation.");
  const parsed = parseColoradoRateWorkbook(workbook, { beginDate: metadata.beginDate, endDate: metadata.endDate, ...(minimumRows ? { minimumRows } : {}) });
  return { metadata, parsed };
}

export async function readOfficialCoRates({ fetchImpl = fetchOfficial, now = new Date(), bypassCache = false, uploadDirectory = evidenceDirectory(), minimumRows } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    let snapshot;
    try {
      const headers = { Accept: "text/html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 TaxAP/0.1" };
      const pageResponse = await fetchImpl(COLORADO_RATE_LOOKUP_URL, { headers, signal: controller.signal });
      if (!pageResponse.ok) throw new Error(`Colorado DOR returned HTTP ${pageResponse.status}.`);
      const pageHtml = await pageResponse.text();
      const current = findCurrentColoradoWorkbook(pageHtml, { asOfDate: now.toISOString().slice(0, 10) });
      const workbookResponse = await fetchImpl(current.url, { headers, signal: controller.signal });
      if (!workbookResponse.ok) throw new Error(`Colorado DOR workbook returned HTTP ${workbookResponse.status}.`);
      const workbook = Buffer.from(await workbookResponse.arrayBuffer());
      assertWorkbookBytes(workbook, "Colorado DOR did not return the expected XLSX workbook.");
      const parsed = parseColoradoRateWorkbook(workbook, { ...current, ...(minimumRows ? { minimumRows } : {}) });
      snapshot = {
        stateCode: "CO", source: "Colorado Department of Revenue", sourceUrl: COLORADO_RATE_LOOKUP_URL,
        machineReadableSourceUrl: current.url, retrievedAt: now.toISOString(), asOfDate: current.beginDate,
        stateRate: COLORADO_STATE_RATE, sourceHash: createHash("sha256").update(pageHtml).update(workbook).digest("hex"),
        rates: parsed.rates, counts: parsed.counts, effectivePeriod: `${current.beginDate} through ${current.endDate}`,
        boundaryStatus: COLORADO_BOUNDARY_STATUS, retrievalMethod: "automatic",
      };
    } catch (error) {
      // Automatic retrieval failed; only a validated upload covering today may stand in.
      const upload = readColoradoUploadedWorkbook({ now, directory: uploadDirectory, minimumRows });
      if (!upload) throw error;
      const { metadata, parsed } = upload;
      snapshot = {
        stateCode: "CO", source: "Colorado Department of Revenue (official workbook, manual upload)", sourceUrl: COLORADO_RATE_LOOKUP_URL,
        machineReadableSourceUrl: null, retrievedAt: metadata.uploadedAt, asOfDate: metadata.beginDate,
        stateRate: COLORADO_STATE_RATE, sourceHash: metadata.sha256,
        rates: parsed.rates, counts: parsed.counts, effectivePeriod: `${metadata.beginDate} through ${metadata.endDate}`,
        boundaryStatus: COLORADO_BOUNDARY_STATUS, retrievalMethod: "manual-upload",
        manualUpload: { fileName: metadata.fileName, uploadedAt: metadata.uploadedAt, uploadedBy: metadata.uploadedBy, sha256: metadata.sha256 },
      };
    } finally { clearTimeout(timeout); }
    cachedSnapshot = snapshot; cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000; return snapshot;
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
