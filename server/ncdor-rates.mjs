import { createHash } from "node:crypto";

export const NCDOR_CURRENT_RATES_URL = "https://www.ncdor.gov/taxes-forms/sales-and-use-tax/sales-and-use-tax-rates/historical-total-general-state-local-and-transit-sales-and-use-tax-rates";
export const NCDOR_EFFECTIVE_DATES_URL = "https://www.ncdor.gov/taxes-forms/sales-and-use-tax/sales-and-use-tax-rates/effective-dates-local-and-transit-sales-and-use-tax-rates";

export const NC_COUNTIES = [
  "Alamance", "Alexander", "Alleghany", "Anson", "Ashe", "Avery", "Beaufort", "Bertie", "Bladen", "Brunswick",
  "Buncombe", "Burke", "Cabarrus", "Caldwell", "Camden", "Carteret", "Caswell", "Catawba", "Chatham", "Cherokee",
  "Chowan", "Clay", "Cleveland", "Columbus", "Craven", "Cumberland", "Currituck", "Dare", "Davidson", "Davie",
  "Duplin", "Durham", "Edgecombe", "Forsyth", "Franklin", "Gaston", "Gates", "Graham", "Granville", "Greene",
  "Guilford", "Halifax", "Harnett", "Haywood", "Henderson", "Hertford", "Hoke", "Hyde", "Iredell", "Jackson",
  "Johnston", "Jones", "Lee", "Lenoir", "Lincoln", "Macon", "Madison", "Martin", "McDowell", "Mecklenburg",
  "Mitchell", "Montgomery", "Moore", "Nash", "New Hanover", "Northampton", "Onslow", "Orange", "Pamlico", "Pasquotank",
  "Pender", "Perquimans", "Person", "Pitt", "Polk", "Randolph", "Richmond", "Robeson", "Rockingham", "Rowan",
  "Rutherford", "Sampson", "Scotland", "Stanly", "Stokes", "Surry", "Swain", "Transylvania", "Tyrrell", "Union",
  "Vance", "Wake", "Warren", "Washington", "Watauga", "Wayne", "Wilkes", "Wilson", "Yadkin", "Yancey",
];

function decodeHtml(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function tableRows(html, marker) {
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const table = tables.find((candidate) => candidate.includes(marker) && /County/i.test(candidate));
  if (!table) throw new Error(`NCDOR source is missing the expected ${marker} county table.`);
  return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
    [...match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => decodeHtml(cell[1])),
  ).filter((row) => row.length > 0);
}

function parseRate(value) {
  const match = String(value).match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function parseUsDate(value) {
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

export function parseNcdorCurrentRates(html) {
  const rows = tableRows(html, "Current");
  const headers = rows[0];
  const currentIndex = headers.findIndex((header) => /Current/i.test(header));
  if (currentIndex < 1) throw new Error("NCDOR source does not identify its current rate period.");
  const effectivePeriod = headers[currentIndex];
  const periodStartMatch = effectivePeriod.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const currentEffectiveDate = periodStartMatch ? `${periodStartMatch[3]}-${periodStartMatch[1].padStart(2, "0")}-${periodStartMatch[2].padStart(2, "0")}` : null;
  const dataRows = rows.slice(1);
  const byCounty = new Map(dataRows.map((row) => [row[0], row]));
  const rates = NC_COUNTIES.map((county, index) => {
    const row = byCounty.get(county);
    const rate = row ? parseRate(row[currentIndex]) : null;
    const previousRate = row ? parseRate(row[currentIndex + 1]) : null;
    if (rate === null || rate < 4 || rate > 12) throw new Error(`NCDOR source has no valid current rate for ${county} County.`);
    return {
      county,
      taxBody: `NC${String(index + 1).padStart(3, "0")}`,
      officialRate: rate,
      previousOfficialRate: previousRate,
      recentChange: previousRate !== null && Math.abs(rate - previousRate) >= 0.001,
      recentEffectiveDate: previousRate !== null && Math.abs(rate - previousRate) >= 0.001 ? currentEffectiveDate : null,
    };
  });
  if (byCounty.size !== 100 || rates.length !== 100) throw new Error("NCDOR source did not contain exactly 100 North Carolina counties.");
  return { effectivePeriod, rates };
}

export function parseNcdorFutureChanges(html, asOfDate = new Date().toISOString().slice(0, 10)) {
  const rows = tableRows(html, "1% Additional County Tax");
  const headers = rows[0];
  const components = headers.map((header) => {
    const match = header.match(/(2\.25|2|1|0\.50|0\.25)%/);
    return match ? Number(match[1]) : null;
  });
  const changes = [];
  for (const row of rows.slice(1)) {
    const county = row[0];
    if (!NC_COUNTIES.includes(county)) continue;
    for (let index = 2; index < row.length; index += 1) {
      const effectiveDate = parseUsDate(row[index]);
      if (effectiveDate && effectiveDate > asOfDate && components[index] !== null) {
        changes.push({ county, effectiveDate, componentRate: components[index], component: headers[index] });
      }
    }
  }
  return changes.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.county.localeCompare(b.county));
}

async function fetchOfficialPage(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`NCDOR returned HTTP ${response.status}.`);
    const html = await response.text();
    if (html.length < 10_000) throw new Error("NCDOR returned an unexpectedly small response.");
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialNcRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const [currentHtml, effectiveDatesHtml] = await Promise.all([
      fetchOfficialPage(NCDOR_CURRENT_RATES_URL, fetchImpl),
      fetchOfficialPage(NCDOR_EFFECTIVE_DATES_URL, fetchImpl),
    ]);
    const current = parseNcdorCurrentRates(currentHtml);
    const asOfDate = now.toISOString().slice(0, 10);
    const snapshot = {
      source: "North Carolina Department of Revenue",
      sourceUrl: NCDOR_CURRENT_RATES_URL,
      effectiveDatesUrl: NCDOR_EFFECTIVE_DATES_URL,
      retrievedAt: now.toISOString(),
      asOfDate,
      effectivePeriod: current.effectivePeriod,
      sourceHash: createHash("sha256").update(currentHtml).update(effectiveDatesHtml).digest("hex"),
      rates: current.rates,
      futureChanges: parseNcdorFutureChanges(effectiveDatesHtml, asOfDate),
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
