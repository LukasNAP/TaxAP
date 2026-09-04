import { createHash } from "node:crypto";

export const HAWAII_GET_URL = "https://tax.hawaii.gov/get/";
export const HAWAII_COUNTY_SURCHARGE_URL = "https://tax.hawaii.gov/geninfo/countysurcharge/";
export const HAWAII_SURCHARGE_EXEMPTIONS_URL = "https://tax.hawaii.gov/get/exemptions-county-surcharge/";
export const HAWAII_GET_BASE_RATE = 4;
export const HAWAII_GET_WITH_SURCHARGE_RATE = 4.5;
export const HAWAII_MAXIMUM_PASS_ON_RATE = 4.712;

function textContent(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&rsquo;|&#8217;/gi, "’")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHawaiiGetRules(getHtml, surchargeHtml, exemptionsHtml) {
  const getText = textContent(getHtml);
  const surchargeText = textContent(surchargeHtml);
  const exemptionsText = textContent(exemptionsHtml);
  if (!/GET is NOT a sales tax/i.test(getText) || !/GET is a tax on the business itself/i.test(getText)) throw new Error("Hawaii DOTAX page no longer confirms that GET is a seller-side tax rather than a sales tax.");
  const retailRate = getText.match(/Selling retail goods and services[\s\S]{0,250}?(\d+(?:\.\d+)?)%\*/i);
  if (!retailRate || Number(retailRate[1]) !== HAWAII_GET_WITH_SURCHARGE_RATE) throw new Error("Hawaii's reviewed retail GET rate with county surcharge changed; review the official rules before accepting it.");
  if (!/Businesses may choose to pass on the GET and any applicable county surcharge to its customers but are not required to do so/i.test(surchargeText)) throw new Error("Hawaii DOTAX page no longer confirms that visible GET pass-on is optional.");
  const counties = [
    { name: "Honolulu", beginDate: "2007-01-01" },
    { name: "Hawaii", beginDate: "2020-01-01" },
    { name: "Kauai", beginDate: "2019-01-01" },
    { name: "Maui", beginDate: "2024-01-01" },
  ];
  for (const county of counties) {
    const pattern = new RegExp(`(?:City and County of )?${county.name}[\\s\\S]{0,180}?${HAWAII_MAXIMUM_PASS_ON_RATE.toFixed(4)}%`, "i");
    if (!pattern.test(surchargeText)) throw new Error(`Hawaii DOTAX page no longer contains the reviewed maximum pass-on rate for ${county.name}.`);
  }
  if (!/Kalawao County Sales[\s\S]{0,250}?not subject to the county surcharge/i.test(exemptionsText)) throw new Error("Hawaii DOTAX page no longer confirms Kalawao County's surcharge exemption.");
  return { baseRate: HAWAII_GET_BASE_RATE, countyTotalRate: HAWAII_GET_WITH_SURCHARGE_RATE, maximumPassOnRate: HAWAII_MAXIMUM_PASS_ON_RATE, counties };
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialHiRates({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const urls = [HAWAII_GET_URL, HAWAII_COUNTY_SURCHARGE_URL, HAWAII_SURCHARGE_EXEMPTIONS_URL];
      const responses = await Promise.all(urls.map((url) => fetchImpl(url, { headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal })));
      for (let index = 0; index < responses.length; index++) if (!responses[index].ok) throw new Error(`Hawaii DOTAX returned HTTP ${responses[index].status} for ${urls[index]}.`);
      const pages = await Promise.all(responses.map((response) => response.text()));
      if (pages.some((html) => html.length < 20_000)) throw new Error("Hawaii DOTAX returned an unexpectedly short guidance page.");
      const parsed = parseHawaiiGetRules(pages[0], pages[1], pages[2]);
      const asOfDate = now.toISOString().slice(0, 10);
      const rates = parsed.counties.map((county) => ({ jurisdictionType: "county", jurisdictionCode: county.name.toUpperCase(), name: `${county.name} County`, componentRate: 0.5, totalGeneralRate: parsed.countyTotalRate, generalInterstateRate: parsed.maximumPassOnRate, beginDate: county.beginDate, endDate: "2030-12-31" }));
      rates.push({ jurisdictionType: "county", jurisdictionCode: "KALAWAO", name: "Kalawao County", componentRate: 0, totalGeneralRate: parsed.baseRate, generalInterstateRate: Number((parsed.baseRate / (100 - parsed.baseRate) * 100).toFixed(4)), beginDate: null, endDate: null });
      const snapshot = {
        stateCode: "HI",
        source: "Hawaii Department of Taxation",
        sourceUrl: HAWAII_GET_URL,
        machineReadableSourceUrl: null,
        retrievedAt: now.toISOString(),
        asOfDate,
        stateRate: parsed.baseRate,
        sourceHash: createHash("sha256").update(pages.join("\n")).digest("hex"),
        rates,
        counts: { counties: 5, cities: 0, specialJurisdictions: 0 },
        effectivePeriod: `Current official pages retrieved ${asOfDate}`,
        policyModel: "seller-side-get-optional-pass-on",
        maximumVisiblePassOnRate: parsed.maximumPassOnRate,
        boundaryStatus: "Hawaii GET is a tax on the business, not a conventional customer sales tax. The retail GET base is 4%; Honolulu, Hawaii, Kauai, and Maui add a 0.5% county surcharge through 2030, while Kalawao is exempt. A seller may—but need not—pass on GET, capped at 4.712% in surcharge counties. TaxAP exposes this policy evidence but does not label a 0% customer pass-on as an automatic mismatch.",
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
