import { createHash } from "node:crypto";

export const DISTRICT_OF_COLUMBIA_OTR_RATES_URL = "https://otr.cfo.dc.gov/am/node/1800521";
export const DISTRICT_OF_COLUMBIA_CURRENT_RATE = 6;
export const DISTRICT_OF_COLUMBIA_FUTURE_RATE = 7;
export const DISTRICT_OF_COLUMBIA_FUTURE_EFFECTIVE_DATE = "2026-10-01";

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

export function parseDistrictOfColumbiaRateSchedule(html) {
  const text = textContent(html);
  const schedule = text.match(/general sales tax rate[\s\S]{0,300}?remain\s+(\d+(?:\.\d+)?)%\s+through\s+Sept\.\s+30,\s+2026[\s\S]{0,180}?increase to\s+(\d+(?:\.\d+)?)%\s+for periods beginning on and after\s+Oct\.\s+1,\s+2026/i);
  if (!schedule) throw new Error("District of Columbia OTR notice did not contain the current and scheduled general sales-tax rates.");
  const currentRate = Number(schedule[1]);
  const futureRate = Number(schedule[2]);
  if (currentRate !== DISTRICT_OF_COLUMBIA_CURRENT_RATE || futureRate !== DISTRICT_OF_COLUMBIA_FUTURE_RATE) {
    throw new Error("District of Columbia's general sales-tax schedule changed from the reviewed 6% to 7% transition; review the official notice before accepting it.");
  }
  return {
    currentRate,
    currentEndDate: "2026-09-30",
    futureRate,
    futureEffectiveDate: DISTRICT_OF_COLUMBIA_FUTURE_EFFECTIVE_DATE,
  };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialDcRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetchImpl(DISTRICT_OF_COLUMBIA_OTR_RATES_URL, {
        headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal,
      });
      if (!response.ok) throw new Error(`District of Columbia OTR returned HTTP ${response.status}.`);
      const html = await response.text();
      if (html.length < 20_000) throw new Error("District of Columbia OTR returned an unexpectedly short notice page.");
      const parsed = parseDistrictOfColumbiaRateSchedule(html);
      const asOfDate = now.toISOString().slice(0, 10);
      const futureIsCurrent = asOfDate >= parsed.futureEffectiveDate;
      const stateRate = futureIsCurrent ? parsed.futureRate : parsed.currentRate;
      const snapshot = {
        stateCode: "DC",
        source: "District of Columbia Office of Tax and Revenue",
        sourceUrl: DISTRICT_OF_COLUMBIA_OTR_RATES_URL,
        machineReadableSourceUrl: null,
        retrievedAt: now.toISOString(),
        asOfDate,
        stateRate,
        sourceHash: createHash("sha256").update(html).digest("hex"),
        rates: [{
          jurisdictionType: "state",
          jurisdictionCode: "DC",
          name: "District of Columbia",
          componentRate: stateRate,
          totalGeneralRate: stateRate,
          generalInterstateRate: stateRate,
          beginDate: futureIsCurrent ? parsed.futureEffectiveDate : null,
          endDate: futureIsCurrent ? null : parsed.currentEndDate,
        }],
        counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
        effectivePeriod: futureIsCurrent ? `Effective ${parsed.futureEffectiveDate}` : `Through ${parsed.currentEndDate}`,
        futureChanges: futureIsCurrent ? [] : [{
          jurisdiction: "District of Columbia",
          effectiveDate: parsed.futureEffectiveDate,
          currentRate: parsed.currentRate,
          futureRate: parsed.futureRate,
        }],
        boundaryStatus: futureIsCurrent
          ? "D.C. OTR's scheduled 7% general rate is now effective citywide; no local boundary matching is required."
          : "D.C. OTR confirms a 6% general rate through September 30, 2026, followed by 7% beginning October 1, 2026. The rate is citywide, so no local boundary matching is required.",
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
