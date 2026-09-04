import { createHash } from "node:crypto";
import { readZipEntries } from "./zip-utils.mjs";

export const VIRGINIA_DOR_RATES_URL = "https://www.tax.virginia.gov/sales-tax-rate-and-locality-code-lookup";
export const VIRGINIA_RATE_DOWNLOAD_URL = "https://www.tax.virginia.gov/sites/default/files/inline-files/sales-tax-rates.xlsx";
export const VIRGINIA_STATE_RATE = 4.3;

const EXPECTED_HEADERS = [
  "State Code (FIPS)",
  "County or City Code (FIPS)",
  "Locality Name",
  "Total General Sales Tax",
  "Total Food & Personal Hygiene Sales Tax",
  "State General Sales Tax",
  "State Regional Sales Tax (NVA)",
  "State Regional Sales Tax (HR)",
  "State Regional Sales Tax (CVA)",
  "State Regional Sales Tax (HT)",
  "Local Sales Tax",
  "Additional Local Option Sales Tax",
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

function readSharedStrings(xml) {
  return [...String(xml).matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi)].map((match) =>
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)].map((part) => decodeXml(part[1])).join(""),
  );
}

function readWorksheetRows(sheetXml, strings) {
  return [...String(sheetXml).matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)].map((row) => {
    const rowNumber = Number(row[1].match(/\br=["'](\d+)["']/i)?.[1]);
    const values = {};
    for (const cell of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi)) {
      const column = cell[1].match(/\br=["']([A-Z]+)\d+["']/i)?.[1]?.toUpperCase();
      if (!column) continue;
      const body = cell[2] ?? "";
      const raw = body.match(/<v>([\s\S]*?)<\/v>/i)?.[1] ?? "";
      if (/\bt=["']s["']/i.test(cell[1])) {
        const index = Number(raw);
        if (!Number.isInteger(index) || strings[index] === undefined) throw new Error(`Virginia workbook row ${rowNumber} references a missing shared string.`);
        values[column] = strings[index];
      } else if (/\bt=["']inlineStr["']/i.test(cell[1])) {
        values[column] = decodeXml(body);
      } else {
        values[column] = raw === "" ? null : raw;
      }
    }
    return { rowNumber, values };
  });
}

function decimalPercent(value, label, locality, { allowBlank = false } = {}) {
  if ((value == null || value === "") && allowBlank) return 0;
  const decimal = Number(value);
  if (!Number.isFinite(decimal) || decimal < 0 || decimal > 0.2) {
    throw new Error(`Virginia workbook has an invalid ${label} for ${locality}.`);
  }
  return Number((decimal * 100).toFixed(4));
}

export function parseVirginiaRateWorkbook(buffer, { expectedLocalities = 133, expectedCounties = 95, expectedCities = 38 } = {}) {
  const entries = new Map(readZipEntries(Buffer.from(buffer)).map((entry) => [entry.name, entry.data]));
  const sheetXml = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8");
  const stringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  if (!sheetXml || !stringsXml) throw new Error("Virginia rate workbook is missing its first worksheet or shared strings.");

  const rows = readWorksheetRows(sheetXml, readSharedStrings(stringsXml));
  const header = rows.find((row) => row.rowNumber === 3)?.values;
  const columns = "ABCDEFGHIJKL";
  if (!header || [...columns].some((column, index) => header[column] !== EXPECTED_HEADERS[index])) {
    throw new Error("Virginia rate workbook headers changed; review the official format before accepting it.");
  }

  const localityRows = rows.filter((row) => row.rowNumber > 3 && (row.values.A != null || row.values.B != null || row.values.C != null));
  if (localityRows.some((row) => row.values.A !== "51")) {
    throw new Error("Virginia rate workbook contains a locality row outside Virginia FIPS 51.");
  }
  if (localityRows.length !== expectedLocalities) {
    throw new Error(`Virginia rate workbook returned ${localityRows.length} localities instead of ${expectedLocalities}.`);
  }

  const keys = new Set();
  const rates = localityRows.map(({ rowNumber, values }) => {
    const localityCode = String(values.B || "").trim();
    const name = String(values.C || "").trim();
    if (!/^\d{3}$/.test(localityCode) || !/\S+ (?:County|City)$/.test(name)) {
      throw new Error(`Virginia workbook row ${rowNumber} has an invalid FIPS code or locality name.`);
    }
    const jurisdictionCode = `51${localityCode}`;
    if (keys.has(jurisdictionCode)) throw new Error(`Virginia workbook has duplicate locality FIPS ${jurisdictionCode}.`);
    keys.add(jurisdictionCode);

    const totalGeneralRate = decimalPercent(values.D, "total general rate", name);
    const foodRate = decimalPercent(values.E, "food and personal hygiene rate", name);
    const stateRate = decimalPercent(values.F, "state rate", name);
    const regionalRates = ["G", "H", "I", "J"].map((column) => decimalPercent(values[column], "regional rate", name, { allowBlank: true }));
    const localRate = decimalPercent(values.K, "local rate", name);
    const additionalLocalRate = decimalPercent(values.L, "additional local-option rate", name, { allowBlank: true });
    const calculatedTotal = Number((stateRate + regionalRates.reduce((sum, rate) => sum + rate, 0) + localRate + additionalLocalRate).toFixed(4));
    if (stateRate !== VIRGINIA_STATE_RATE || foodRate !== 1 || localRate !== 1) {
      throw new Error(`Virginia workbook changed a statewide component for ${name}; review the official rules before accepting it.`);
    }
    if (regionalRates.slice(0, 3).some((rate) => rate !== 0 && rate !== 0.7)
      || ![0, 1].includes(regionalRates[3])
      || (additionalLocalRate !== 0 && additionalLocalRate !== 1)) {
      throw new Error(`Virginia workbook has an unexpected regional or local-option component for ${name}.`);
    }
    if (calculatedTotal !== totalGeneralRate || ![5.3, 6, 6.3, 7].includes(totalGeneralRate)) {
      throw new Error(`Virginia workbook components do not reconcile to the published total for ${name}.`);
    }

    const jurisdictionType = name.endsWith(" County") ? "county" : "city";
    return {
      jurisdictionType,
      jurisdictionCode,
      name,
      componentRate: Number((totalGeneralRate - VIRGINIA_STATE_RATE).toFixed(4)),
      totalGeneralRate,
      generalInterstateRate: totalGeneralRate,
      foodAndPersonalHygieneRate: foodRate,
      beginDate: null,
      endDate: null,
    };
  }).sort((left, right) => left.name.localeCompare(right.name));

  const counts = {
    counties: rates.filter((rate) => rate.jurisdictionType === "county").length,
    cities: rates.filter((rate) => rate.jurisdictionType === "city").length,
    specialJurisdictions: 0,
  };
  if (counts.counties !== expectedCounties || counts.cities !== expectedCities) {
    throw new Error(`Virginia rate workbook returned ${counts.counties} counties and ${counts.cities} cities instead of ${expectedCounties} and ${expectedCities}.`);
  }
  return { rates, counts };
}

async function downloadCurrentWorkbook(fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(VIRGINIA_RATE_DOWNLOAD_URL, {
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "User-Agent": "TaxAP/0.1 official-rate monitor" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Virginia Tax returned HTTP ${response.status}.`);
    const workbook = Buffer.from(await response.arrayBuffer());
    if (workbook.length < 10_000 || workbook.readUInt32LE(0) !== 0x04034b50) {
      throw new Error("Virginia Tax did not return the expected XLSX rate workbook.");
    }
    const modifiedHeader = response.headers.get("last-modified");
    const lastModified = modifiedHeader ? new Date(modifiedHeader) : null;
    if (!lastModified || Number.isNaN(lastModified.getTime())) {
      throw new Error("Virginia Tax rate workbook did not provide a valid Last-Modified date.");
    }
    return { workbook, lastModified };
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialVaRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const { workbook, lastModified } = await downloadCurrentWorkbook(fetchImpl);
    const parsed = parseVirginiaRateWorkbook(workbook);
    const asOfDate = lastModified.toISOString().slice(0, 10);
    const snapshot = {
      stateCode: "VA",
      source: "Virginia Department of Taxation",
      sourceUrl: VIRGINIA_DOR_RATES_URL,
      machineReadableSourceUrl: VIRGINIA_RATE_DOWNLOAD_URL,
      retrievedAt: now.toISOString(),
      asOfDate,
      stateRate: VIRGINIA_STATE_RATE,
      sourceHash: createHash("sha256").update(workbook).digest("hex"),
      rates: parsed.rates,
      counts: parsed.counts,
      effectivePeriod: `Current Virginia Tax workbook (server updated ${asOfDate})`,
      boundaryStatus: "All 95 counties and 38 independent cities are connected by official FIPS code. Address-to-locality and A+ tax-body matching remain separate validation steps.",
    };
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
