import { createHash } from "node:crypto";

export const MAINE_REVENUE_RATES_URL = "https://www1.maine.gov/revenue/taxes/sales-use-service-provider-tax/rates-due-dates";
export const MAINE_GENERAL_RATE = 5.5;

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

export function parseMaineRateTable(html) {
  const text = textContent(html);
  if (!/Effective\s+01\/01\/2026/i.test(text)) throw new Error("Maine Revenue Services page is missing its current 2026 rate column.");
  const general = text.match(/General Sales\s+(?:\d+(?:\.\d+)?%\s+){3}(\d+(?:\.\d+)?)%/i);
  const use = text.match(/Use Tax\s+(?:\d+(?:\.\d+)?%\s+){3}(\d+(?:\.\d+)?)%/i);
  if (!general || !use) throw new Error("Maine Revenue Services page did not contain the current general and use-tax rates.");
  const generalRate = Number(general[1]);
  const useTaxRate = Number(use[1]);
  if (generalRate !== MAINE_GENERAL_RATE || useTaxRate !== MAINE_GENERAL_RATE) {
    throw new Error(`Maine's general or use-tax rate changed from the reviewed ${MAINE_GENERAL_RATE}%; review the official rules before accepting it.`);
  }
  return { generalRate, useTaxRate, effectiveDate: "2026-01-01" };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialMeRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetchImpl(MAINE_REVENUE_RATES_URL, {
        headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Maine Revenue Services returned HTTP ${response.status}.`);
      const html = await response.text();
      if (html.length < 5_000) throw new Error("Maine Revenue Services returned an unexpectedly short rate page.");
      const parsed = parseMaineRateTable(html);
      const snapshot = {
        stateCode: "ME",
        source: "Maine Revenue Services",
        sourceUrl: MAINE_REVENUE_RATES_URL,
        machineReadableSourceUrl: null,
        retrievedAt: now.toISOString(),
        asOfDate: now.toISOString().slice(0, 10),
        stateRate: parsed.generalRate,
        sourceHash: createHash("sha256").update(html).digest("hex"),
        rates: [{ jurisdictionType: "state", jurisdictionCode: "ME", name: "Maine", componentRate: parsed.generalRate, totalGeneralRate: parsed.generalRate, generalInterstateRate: parsed.useTaxRate, beginDate: parsed.effectiveDate, endDate: null }],
        counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
        effectivePeriod: `Effective ${parsed.effectiveDate}`,
        boundaryStatus: "Maine Revenue Services publishes one statewide general sales/use-tax rate and no locality rate rows; no general-rate boundary layer is required.",
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
