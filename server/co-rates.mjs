import { createHash } from "node:crypto";
import { readXlsxRows } from "./xlsx-utils.mjs";

export const COLORADO_RATES_URL = "https://tax.colorado.gov/how-to-look-up-sales-use-tax-rates";
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36 TaxAP/0.1";
const COMPONENT_COLUMNS = [
  ["I", "J"], ["L", "M"], ["O", "P"], ["R", "S"], ["U", "V"], ["X", "Y"],
  ["AA", "AB"], ["AD", "AE"], ["AG", "AH"], ["AJ", "AK"], ["AM", "AN"], ["AP", "AQ"],
];

function htmlText(value) {
  return String(value).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function periodForDate(now) {
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  return month <= 6
    ? { year, startMonth: 1, label: "January to June" }
    : { year, startMonth: 7, label: "July to December" };
}

/** Finds the current-period workbook from Colorado DOR's landing page; filenames are intentionally never hardcoded. */
export function findColoradoWorkbookUrl(html, { now = new Date(), baseUrl = COLORADO_RATES_URL } = {}) {
  const period = periodForDate(now);
  const anchors = [...String(html).matchAll(/<a\b[^>]*href=["']([^"']+\.xlsx(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const current = anchors.find((match) => {
    const label = htmlText(match[2]).toLowerCase();
    return label.includes(period.label.toLowerCase()) && label.includes(String(period.year));
  });
  if (!current) throw new Error(`Colorado DOR does not list a workbook for ${period.label} ${period.year}.`);
  return new URL(current[1].replace(/&amp;/g, "&"), baseUrl).href;
}

function decimal(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/**
 * Parses Colorado's official DR 1002/DR 0800 combined workbook. The workbook's visually merged
 * "Total Rate" header does not line up with a trustworthy data column, so the total is recomputed
 * from every official Tax Type/Rate component pair and validated to contain the 2.9% state layer.
 */
export function parseColoradoRateWorkbook(buffer, { minimumRows = 400 } = {}) {
  const rows = readXlsxRows(buffer);
  const header = rows[0] ?? {};
  if (header.A !== "Location Code" || !/Jurisdiction\s+Code/i.test(header.B || "") || header.C !== "County") {
    throw new Error("Colorado's rate workbook header no longer matches the expected By Name layout.");
  }
  if (header.I !== "Tax Type" || header.J !== "Rate") {
    throw new Error("Colorado's rate workbook is missing the expected Tax Type/Rate component columns.");
  }

  const rates = [];
  for (const row of rows.slice(1)) {
    const locationName = String(row.A || "").trim();
    const jurisdictionCode = String(row.B || "").trim();
    const county = String(row.C || "").trim();
    if (!locationName && !jurisdictionCode && !county) continue;
    if (!locationName || !/^\d{6}$/.test(jurisdictionCode) || !county) {
      throw new Error(`Colorado's rate workbook has an incomplete jurisdiction row (${locationName || jurisdictionCode || "unknown"}).`);
    }
    const components = COMPONENT_COLUMNS.flatMap(([typeColumn, rateColumn]) => {
      const taxType = String(row[typeColumn] || "").trim();
      const rate = decimal(row[rateColumn]);
      if (!taxType && rate === null) return [];
      if (!taxType || rate === null || rate < 0 || rate > 15) {
        throw new Error(`Colorado's rate workbook has an invalid ${taxType || "unnamed"} component for ${locationName}.`);
      }
      return [{ taxType, rate }];
    });
    const stateComponent = components.find((component) => /^state$/i.test(component.taxType));
    if (!stateComponent || Math.abs(stateComponent.rate - 2.9) > 0.0001) {
      throw new Error(`Colorado's rate workbook is missing its 2.9% state component for ${locationName}.`);
    }
    const totalGeneralRate = Number(components.reduce((sum, component) => sum + component.rate, 0).toFixed(4));
    if (totalGeneralRate < 2.9 || totalGeneralRate > 15) {
      throw new Error(`Colorado's rate workbook has an implausible total for ${locationName}.`);
    }
    rates.push({
      jurisdictionType: "location",
      jurisdictionCode,
      name: locationName,
      county,
      componentRate: Number((totalGeneralRate - 2.9).toFixed(4)),
      totalGeneralRate,
      generalInterstateRate: totalGeneralRate,
      beginDate: null,
      endDate: null,
      selfCollectedHomeRule: /^self-collected$/i.test(String(row.D || "").trim()),
      components,
    });
  }
  if (rates.length < minimumRows) throw new Error(`Colorado's rate workbook returned only ${rates.length} locations; expected at least ${minimumRows}.`);
  if (new Set(rates.map((rate) => rate.jurisdictionCode)).size !== rates.length) {
    throw new Error("Colorado's rate workbook contains duplicate jurisdiction codes.");
  }
  return rates;
}

async function fetchCurrentColoradoWorkbook(fetchImpl, now) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const landing = await fetchImpl(COLORADO_RATES_URL, {
      headers: { Accept: "text/html", "User-Agent": BROWSER_USER_AGENT }, signal: controller.signal,
    });
    if (!landing.ok) throw new Error(`Colorado DOR returned HTTP ${landing.status} for its rate landing page.`);
    const workbookUrl = findColoradoWorkbookUrl(await landing.text(), { now });
    const workbookResponse = await fetchImpl(workbookUrl, {
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "User-Agent": BROWSER_USER_AGENT }, signal: controller.signal,
    });
    if (!workbookResponse.ok) throw new Error(`Colorado DOR returned HTTP ${workbookResponse.status} for its rate workbook.`);
    const workbook = Buffer.from(await workbookResponse.arrayBuffer());
    if (workbook.length < 20_000 || workbook.readUInt32LE(0) !== 0x04034b50) {
      throw new Error("Colorado DOR did not return the expected XLSX rate workbook.");
    }
    return { workbookUrl, workbook };
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialCoRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const { workbookUrl, workbook } = await fetchCurrentColoradoWorkbook(fetchImpl, now);
    const rates = parseColoradoRateWorkbook(workbook);
    const period = periodForDate(now);
    const snapshot = {
      stateCode: "CO",
      source: "Colorado Department of Revenue",
      sourceUrl: COLORADO_RATES_URL,
      machineReadableSourceUrl: workbookUrl,
      retrievedAt: now.toISOString(),
      asOfDate: `${period.year}-${String(period.startMonth).padStart(2, "0")}-01`,
      stateRate: 2.9,
      sourceHash: createHash("sha256").update(workbook).digest("hex"),
      rates,
      counts: { counties: new Set(rates.map((rate) => rate.county)).size, cities: rates.length, specialJurisdictions: 0 },
      effectivePeriod: `${period.label} ${period.year}`,
      boundaryStatus: "Colorado's official location totals are connected. A+ matching uses an exact Colorado jurisdiction code when present; otherwise it compares only a unique official location name. Multi-rate cities and special-district variants remain unmatched rather than guessed.",
    };
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
    return snapshot;
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
