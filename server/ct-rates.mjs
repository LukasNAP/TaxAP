import { createHash } from "node:crypto";

export const CONNECTICUT_DRS_RATES_URL = "https://portal.ct.gov/drs/sales-tax/tax-information";
export const CONNECTICUT_GENERAL_RATE = 6.35;

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

export function parseConnecticutRateRules(html) {
  const text = textContent(html);
  const rateMatch = text.match(/sales tax rate of\s+(\d+(?:\.\d+)?)%\s+applies to the retail sale/i);
  if (!rateMatch) throw new Error("Connecticut DRS page did not contain the general retail sales-tax rate.");
  const generalRate = Number(rateMatch[1]);
  if (generalRate !== CONNECTICUT_GENERAL_RATE) {
    throw new Error(`Connecticut's general rate changed from the reviewed ${CONNECTICUT_GENERAL_RATE}%; review the official rules before accepting it.`);
  }
  if (!/There are no additional sales taxes imposed by local jurisdictions in Connecticut\./i.test(text)) {
    throw new Error("Connecticut DRS page no longer confirms that local jurisdictions impose no additional sales tax.");
  }
  return { generalRate, hasLocalSalesTax: false };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialCtRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetchImpl(CONNECTICUT_DRS_RATES_URL, {
        headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Connecticut DRS returned HTTP ${response.status}.`);
      const html = await response.text();
      if (html.length < 5_000) throw new Error("Connecticut DRS returned an unexpectedly short rate page.");
      const parsed = parseConnecticutRateRules(html);
      const asOfDate = now.toISOString().slice(0, 10);
      const snapshot = {
        stateCode: "CT",
        source: "Connecticut Department of Revenue Services",
        sourceUrl: CONNECTICUT_DRS_RATES_URL,
        machineReadableSourceUrl: null,
        retrievedAt: now.toISOString(),
        asOfDate,
        stateRate: parsed.generalRate,
        sourceHash: createHash("sha256").update(html).digest("hex"),
        rates: [{
          jurisdictionType: "state",
          jurisdictionCode: "CT",
          name: "Connecticut",
          componentRate: parsed.generalRate,
          totalGeneralRate: parsed.generalRate,
          generalInterstateRate: parsed.generalRate,
          beginDate: null,
          endDate: null,
        }],
        counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
        effectivePeriod: `Current official page retrieved ${asOfDate}`,
        boundaryStatus: "Connecticut DRS confirms the 6.35% general rate and no additional local-jurisdiction sales taxes; no address boundary matching is required for the general rate.",
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
  try {
    return await read;
  } finally {
    inFlightRead = null;
  }
}
