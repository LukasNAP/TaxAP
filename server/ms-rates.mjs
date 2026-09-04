import { createHash } from "node:crypto";

export const MISSISSIPPI_DOR_RATES_URL = "https://www.dor.ms.gov/business/sales-use-tax/sales-tax-rates";
export const MISSISSIPPI_JACKSON_TAX_URL = "https://www.dor.ms.gov/node/238";
export const MISSISSIPPI_TUPELO_TAX_URL = "https://www.dor.ms.gov/node/289";
export const MISSISSIPPI_GENERAL_RATE = 7;

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

export function parseMississippiGeneralRate(html) {
  const text = textContent(html);
  const rate = text.match(/Sale of tangible personal property\s*\.{2,}\s*(\d+(?:\.\d+)?)%/i);
  if (!rate) throw new Error("Mississippi DOR rate page did not contain the tangible-personal-property retail rate.");
  const generalRate = Number(rate[1]);
  if (generalRate !== MISSISSIPPI_GENERAL_RATE) throw new Error(`Mississippi's general retail rate changed from the reviewed ${MISSISSIPPI_GENERAL_RATE}%; review the official rules before accepting it.`);
  return { generalRate };
}

export function parseMississippiJacksonTax(html) {
  const text = textContent(html);
  const rate = text.match(/A\s+(\d+(?:\.\d+)?)%\s+tax is imposed on every person making sales of tangible personal property or services within the municipality/i);
  const effective = text.match(/Effective\s+March\s+1,\s+2014/i);
  const repeal = text.match(/Repeal date\s+July\s+1,\s+2035/i);
  if (!rate || !effective || !repeal) throw new Error("Mississippi DOR Jackson page did not contain the reviewed local rate and effective period.");
  const componentRate = Number(rate[1]);
  if (componentRate !== 1) throw new Error("Jackson's general local levy changed from the reviewed 1%; review the official rules before accepting it.");
  return { componentRate, beginDate: "2014-03-01", endDate: "2035-06-30" };
}

export function parseMississippiTupeloTax(html) {
  const text = textContent(html);
  const rate = text.match(/A\s+\.(\d+)%\s+tax is imposed on all retail sales and services in Tupelo/i);
  if (!rate || !/Beginning\s+May\s+1,\s+2026[\s\S]{0,250}?general seven percent\s*\(7%\)\s*rate/i.test(text)) {
    throw new Error("Mississippi DOR Tupelo page did not contain the reviewed local rate and current general-sales scope.");
  }
  const componentRate = Number(`0.${rate[1]}`);
  if (componentRate !== 0.25) throw new Error("Tupelo's general local levy changed from the reviewed 0.25%; review the official rules before accepting it.");
  return { componentRate, beginDate: "1989-02-01", endDate: null, scopeConfirmedDate: "2026-05-01" };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialMsRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const urls = [MISSISSIPPI_DOR_RATES_URL, MISSISSIPPI_JACKSON_TAX_URL, MISSISSIPPI_TUPELO_TAX_URL];
      const responses = await Promise.all(urls.map((url) => fetchImpl(url, { headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal })));
      for (let index = 0; index < responses.length; index++) {
        if (!responses[index].ok) throw new Error(`Mississippi DOR returned HTTP ${responses[index].status} for ${urls[index]}.`);
      }
      const pages = await Promise.all(responses.map((response) => response.text()));
      if (pages.some((html) => html.length < 20_000)) throw new Error("Mississippi DOR returned an unexpectedly short rate page.");
      const general = parseMississippiGeneralRate(pages[0]);
      const jackson = parseMississippiJacksonTax(pages[1]);
      const tupelo = parseMississippiTupeloTax(pages[2]);
      const asOfDate = now.toISOString().slice(0, 10);
      const snapshot = {
        stateCode: "MS",
        source: "Mississippi Department of Revenue",
        sourceUrl: MISSISSIPPI_DOR_RATES_URL,
        machineReadableSourceUrl: null,
        retrievedAt: now.toISOString(),
        asOfDate,
        stateRate: general.generalRate,
        sourceHash: createHash("sha256").update(pages.join("\n")).digest("hex"),
        rates: [
          { jurisdictionType: "state", jurisdictionCode: "MS", name: "Mississippi", componentRate: general.generalRate, totalGeneralRate: general.generalRate, generalInterstateRate: general.generalRate, beginDate: null, endDate: null },
          { jurisdictionType: "city", jurisdictionCode: "JACKSON", name: "Jackson", componentRate: jackson.componentRate, totalGeneralRate: general.generalRate + jackson.componentRate, generalInterstateRate: general.generalRate, beginDate: jackson.beginDate, endDate: jackson.endDate },
          { jurisdictionType: "city", jurisdictionCode: "TUPELO", name: "Tupelo", componentRate: tupelo.componentRate, totalGeneralRate: general.generalRate + tupelo.componentRate, generalInterstateRate: general.generalRate, beginDate: tupelo.beginDate, endDate: tupelo.endDate },
        ],
        counts: { counties: 0, cities: 2, specialJurisdictions: 0 },
        effectivePeriod: `Current official pages retrieved ${asOfDate}`,
        boundaryStatus: "Mississippi DOR publishes a 7% general tangible-property rate, plus general-retail local levies in Jackson (1%) and Tupelo (0.25%). Other tourism/economic-development levies are category-specific and remain outside this general-merchandise comparison. Jackson/Tupelo city-boundary matching is still required for address-level totals.",
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
