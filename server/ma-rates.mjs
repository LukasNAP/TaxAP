import { createHash } from "node:crypto";

export const MASSACHUSETTS_DOR_RATES_URL = "https://www.mass.gov/guides/sales-and-use-tax";
export const MASSACHUSETTS_GENERAL_RATE = 6.25;

function textContent(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(value) {
  const parsed = new Date(`${value} 00:00:00 UTC`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Massachusetts DOR page has an invalid update date.");
  return parsed.toISOString().slice(0, 10);
}

export function parseMassachusettsRateRules(html) {
  const text = textContent(html);
  const sales = text.match(/The Massachusetts sales tax is\s+(\d+(?:\.\d+)?)%\s+of the sales price/i);
  const use = text.match(/The Massachusetts use tax is\s+(\d+(?:\.\d+)?)%\s+of the sales price/i);
  const updated = text.match(/Updated:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  if (!sales || !use || !updated) throw new Error("Massachusetts DOR page did not contain its sales rate, use rate, and update date.");
  const salesRate = Number(sales[1]);
  const useTaxRate = Number(use[1]);
  if (salesRate !== MASSACHUSETTS_GENERAL_RATE || useTaxRate !== MASSACHUSETTS_GENERAL_RATE) {
    throw new Error(`Massachusetts's general sales or use-tax rate changed from the reviewed ${MASSACHUSETTS_GENERAL_RATE}%; review the official rules before accepting it.`);
  }
  return { salesRate, useTaxRate, updatedDate: isoDate(updated[1]) };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialMaRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetchImpl(MASSACHUSETTS_DOR_RATES_URL, {
        headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Massachusetts DOR returned HTTP ${response.status}.`);
      const html = await response.text();
      if (html.length < 20_000) throw new Error("Massachusetts DOR returned an unexpectedly short rate page.");
      const parsed = parseMassachusettsRateRules(html);
      const snapshot = {
        stateCode: "MA",
        source: "Massachusetts Department of Revenue",
        sourceUrl: MASSACHUSETTS_DOR_RATES_URL,
        machineReadableSourceUrl: null,
        retrievedAt: now.toISOString(),
        asOfDate: parsed.updatedDate,
        stateRate: parsed.salesRate,
        sourceHash: createHash("sha256").update(html).digest("hex"),
        rates: [{ jurisdictionType: "state", jurisdictionCode: "MA", name: "Massachusetts", componentRate: parsed.salesRate, totalGeneralRate: parsed.salesRate, generalInterstateRate: parsed.useTaxRate, beginDate: null, endDate: null }],
        counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
        effectivePeriod: `Official guide updated ${parsed.updatedDate}`,
        boundaryStatus: "Massachusetts DOR publishes a 6.25% statewide sales/use-tax rate for tangible personal property. Local-option meal, marijuana, lodging, and other category-specific taxes are outside this general-merchandise comparison.",
      };
      cachedSnapshot = snapshot;
      cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
      return snapshot;
    } finally {
      clearTimeout(timeout);
    }
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
