import { createHash } from "node:crypto";

export const IDAHO_TAX_COMMISSION_RATES_URL = "https://tax.idaho.gov/taxes/sales-use/online-guide/";
export const IDAHO_TAX_COMMISSION_CITY_TAX_URL = "https://tax.idaho.gov/taxes/sales-use/sales-tax/local-sales-tax/city-sales-tax/";
export const IDAHO_GENERAL_RATE = 6;
export const IDAHO_LOCAL_TAX_CITIES = [
  "Bellevue", "Bonners Ferry", "Cascade", "Crouch", "Donnelly", "Driggs", "Hailey", "Harrison", "Irwin", "Kellogg", "Ketchum", "Lava Hot Springs", "Mackay", "McCall", "Ponderay", "Riggins", "Salmon", "Sandpoint", "Stanley", "Sun Valley", "Swan Valley", "Tetonia", "Victor",
];

function textContent(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&rsquo;|&#8217;/gi, "’")
    .replace(/&#8211;|&ndash;/gi, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseIdahoRateRules(rateHtml, cityHtml) {
  const rateText = textContent(rateHtml);
  const cityText = textContent(cityHtml);
  const salesRate = rateText.match(/Idaho(?:’|')s sales tax rate is\s*(\d+(?:\.\d+)?)%/i);
  const useRate = rateText.match(/Idaho(?:’|')s use tax rate is also\s*(\d+(?:\.\d+)?)%/i);
  if (!salesRate || !useRate) throw new Error("Idaho Tax Commission guide did not contain both statewide sales and use-tax rates.");
  const generalRate = Number(salesRate[1]);
  const useTaxRate = Number(useRate[1]);
  if (generalRate !== IDAHO_GENERAL_RATE || useTaxRate !== IDAHO_GENERAL_RATE) throw new Error(`Idaho's general sales or use-tax rate changed from the reviewed ${IDAHO_GENERAL_RATE}%; review the official rules before accepting it.`);
  if (!/Some Idaho resort cities have a local sales tax in addition to the state sales tax/i.test(cityText) || !/Contact the following cities directly for questions about their local sales tax/i.test(cityText)) {
    throw new Error("Idaho Tax Commission page no longer describes its decentralized resort-city local taxes.");
  }
  const missingCities = IDAHO_LOCAL_TAX_CITIES.filter((city) => !new RegExp(`\\b${city.replaceAll(" ", "\\s+")}\\b`, "i").test(cityText));
  if (missingCities.length > 0) throw new Error(`Idaho Tax Commission local-tax city list is missing: ${missingCities.join(", ")}.`);
  return { generalRate, useTaxRate, localTaxCities: [...IDAHO_LOCAL_TAX_CITIES] };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialIdRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const responses = await Promise.all([IDAHO_TAX_COMMISSION_RATES_URL, IDAHO_TAX_COMMISSION_CITY_TAX_URL].map((url) => fetchImpl(url, { headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal })));
      if (!responses[0].ok || !responses[1].ok) throw new Error(`Idaho Tax Commission returned HTTP ${responses[0].ok ? responses[1].status : responses[0].status}.`);
      const pages = await Promise.all(responses.map((response) => response.text()));
      if (pages.some((html) => html.length < 20_000)) throw new Error("Idaho Tax Commission returned an unexpectedly short guidance page.");
      const parsed = parseIdahoRateRules(pages[0], pages[1]);
      const asOfDate = now.toISOString().slice(0, 10);
      const snapshot = {
        stateCode: "ID",
        source: "Idaho State Tax Commission",
        sourceUrl: IDAHO_TAX_COMMISSION_RATES_URL,
        machineReadableSourceUrl: null,
        retrievedAt: now.toISOString(),
        asOfDate,
        stateRate: parsed.generalRate,
        sourceHash: createHash("sha256").update(pages.join("\n")).digest("hex"),
        rates: [{ jurisdictionType: "state", jurisdictionCode: "ID", name: "Idaho", componentRate: parsed.generalRate, totalGeneralRate: parsed.generalRate, generalInterstateRate: parsed.useTaxRate, beginDate: null, endDate: null }],
        counts: { counties: 0, cities: 0, specialJurisdictions: 0 },
        effectivePeriod: `Current official pages retrieved ${asOfDate}`,
        unavailableLocalJurisdictions: parsed.localTaxCities,
        boundaryStatus: `Idaho Tax Commission confirms matching 6% state sales/use rates and identifies ${parsed.localTaxCities.length} resort cities with separately administered local-option taxes. The Commission directs taxpayers to each city and does not publish their rates centrally, so TaxAP exposes the validated statewide rate but does not guess local totals.`,
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
