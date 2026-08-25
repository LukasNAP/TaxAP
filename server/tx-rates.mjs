import { createHash } from "node:crypto";

export const TEXAS_DOR_RATES_URL = "https://comptroller.texas.gov/taxes/file-pay/edi/sales-tax-rates.php";
export const TEXAS_RATE_FILE_URL = "https://comptroller.texas.gov/data/edi/sales-tax/taxrates.txt";
export const TEXAS_CITY_RATES_URL = "https://comptroller.texas.gov/taxes/sales/city.php";

function decimalRate(value, label) {
  const rate = Number(String(value).trim()) * 100;
  if (!Number.isFinite(rate) || rate < 0 || rate > 8.25) throw new Error(`Texas returned an invalid ${label} rate.`);
  return Number(rate.toFixed(4));
}

function quarterStart(period) {
  const match = String(period).match(/^(\d{4})([1-4])$/);
  if (!match) throw new Error("Texas rate file has an invalid quarter identifier.");
  const month = ["01", "04", "07", "10"][Number(match[2]) - 1];
  return `${match[1]}-${month}-01`;
}

export function parseTexasRateText(text, { enforceDeclaredLineCount = true } = {}) {
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.length > 0);
  const header = lines[0]?.split("\t");
  if (!header || header.length < 7 || header[0] !== "1") throw new Error("Texas rate file is missing its control record.");
  const declaredLineCount = Number(header[6]);
  if (!Number.isInteger(declaredLineCount) || declaredLineCount < 1) throw new Error("Texas rate file has an invalid declared row count.");
  if (enforceDeclaredLineCount && declaredLineCount !== lines.length) {
    throw new Error(`Texas rate file contains ${lines.length} lines instead of its declared ${declaredLineCount}.`);
  }
  const stateRate = decimalRate(header[4], "state");
  if (Math.abs(stateRate - 6.25) >= 0.001) throw new Error("Texas state rate is not the expected 6.25%.");
  const effectiveDate = quarterStart(header[1]);
  const detailLines = lines.slice(1).filter((line) => {
    const columns = line.split("\t");
    return columns.length >= 12 && !["q", "m"].includes(String(columns[1]).trim().toLowerCase());
  });
  const rates = detailLines.map((line, index) => {
    const columns = line.split("\t").map((value) => value.trim());
    const [placeName, placeCode, placeRateValue, countyName, countyCode, countyRateValue, specialName, specialCode, specialRateValue, transitName, transitCode, transitRateValue] = columns;
    if (!placeName || !countyName) throw new Error(`Texas jurisdiction row ${index + 1} is incomplete.`);
    const placeRate = decimalRate(placeRateValue, "city");
    const countyRate = decimalRate(countyRateValue, "county");
    const specialRate = decimalRate(specialRateValue, "special district");
    const transitRate = decimalRate(transitRateValue, "transit");
    const summedComponentRate = Number((stateRate + placeRate + countyRate + specialRate + transitRate).toFixed(4));
    const codes = [placeCode, countyCode, specialCode, transitCode].filter((value) => value && value.toLowerCase() !== "n/a");
    const jurisdictionCode = codes.length > 0 ? codes.join(":") : `${placeName}:${countyName}`.toUpperCase();
    return {
      jurisdictionType: placeCode.toLowerCase() === "n/a" ? "special" : "city",
      jurisdictionCode,
      name: countyName.toLowerCase() === "n/a" ? placeName : `${placeName} — ${countyName} County`,
      county: countyName.toLowerCase() === "n/a" ? null : countyName,
      componentRate: null,
      totalGeneralRate: null,
      generalInterstateRate: null,
      beginDate: effectiveDate,
      endDate: null,
      components: [
        { type: "city", name: placeName, code: placeCode, rate: placeRate },
        { type: "county", name: countyName, code: countyCode, rate: countyRate },
        { type: "special", name: specialName, code: specialCode, rate: specialRate },
        { type: "transit", name: transitName, code: transitCode, rate: transitRate },
      ].filter((component) => component.rate > 0),
      summedComponentRate,
    };
  });
  if (rates.length === 0) throw new Error("Texas rate file contains no jurisdiction rows.");
  return { stateRate, effectiveDate, declaredLineCount, rates };
}

function decodeHtml(value) {
  return String(value).replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

export function parseTexasCityRatesHtml(html, { minimumRows = 1_000 } = {}) {
  const tableRows = [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const parsedRates = tableRows.flatMap((match) => {
    const heading = match[1].match(/<th\b([^>]*)>([\s\S]*?)<\/th>/i);
    if (!heading || /\bindent\b/i.test(heading[1])) return [];
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decodeHtml(cell[1]));
    if (cells.length !== 3) return [];
    const totalMatch = cells[2].match(/^\.(\d{6})$/);
    if (!totalMatch) return [];
    const totalGeneralRate = Number((Number(`0.${totalMatch[1]}`) * 100).toFixed(4));
    if (totalGeneralRate < 6.25 || totalGeneralRate > 8.25) throw new Error("Texas city table returned a total outside the 6.25%–8.25% range.");
    const name = decodeHtml(heading[2]);
    return [{
      jurisdictionType: "city",
      jurisdictionCode: `${cells[0] || "TX"}:${name}:${totalGeneralRate.toFixed(4)}`.toUpperCase(),
      name,
      county: name.match(/\(([^)]+) Co\)/i)?.[1] ?? null,
      componentRate: Number((totalGeneralRate - 6.25).toFixed(4)),
      totalGeneralRate,
      generalInterstateRate: totalGeneralRate,
      beginDate: null,
      endDate: null,
    }];
  });
  const rates = [...new Map(parsedRates.map((row) => [`${row.name}:${row.jurisdictionCode}`, row])).values()];
  if (rates.length < minimumRows) throw new Error(`Texas city rate table returned only ${rates.length} combined jurisdictions.`);
  return rates;
}

async function fetchOfficialText(fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(TEXAS_RATE_FILE_URL, {
      headers: { Accept: "text/plain", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Texas Comptroller returned HTTP ${response.status}.`);
    const text = await response.text();
    if (text.length < 100_000) throw new Error("Texas Comptroller returned an unexpectedly small rate file.");
    return text;
  } finally { clearTimeout(timeout); }
}

async function fetchCityRatesHtml(fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(TEXAS_CITY_RATES_URL, {
      headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Texas Comptroller city rates returned HTTP ${response.status}.`);
    const html = await response.text();
    if (html.length < 100_000) throw new Error("Texas Comptroller returned an unexpectedly small city-rate page.");
    return html;
  } finally { clearTimeout(timeout); }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialTxRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const [text, cityHtml] = await Promise.all([fetchOfficialText(fetchImpl), fetchCityRatesHtml(fetchImpl)]);
    const parsed = parseTexasRateText(text);
    const rates = parseTexasCityRatesHtml(cityHtml).map((row) => ({ ...row, beginDate: parsed.effectiveDate }));
    const snapshot = {
      stateCode: "TX",
      source: "Texas Comptroller of Public Accounts",
      sourceUrl: TEXAS_DOR_RATES_URL,
      machineReadableSourceUrl: TEXAS_RATE_FILE_URL,
      retrievedAt: now.toISOString(),
      asOfDate: now.toISOString().slice(0, 10),
      stateRate: parsed.stateRate,
      sourceHash: createHash("sha256").update(text).update(cityHtml).digest("hex"),
      rates,
      counts: {
        counties: new Set(rates.map((row) => row.county).filter(Boolean)).size,
        cities: rates.length,
        specialJurisdictions: 0,
      },
      effectivePeriod: `Quarter beginning ${parsed.effectiveDate}`,
      boundaryStatus: "Quarterly city and combined-area totals are connected. The component file is retained as evidence, but overlapping components are not summed; address-level tax responsibility remains a separate reconciliation step.",
    };
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
    return snapshot;
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
