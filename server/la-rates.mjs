import { createHash } from "node:crypto";
import { getCACertificates, setDefaultCACertificates } from "node:tls";

export const LOUISIANA_REMOTE_SELLER_LOOKUP_URL = "https://remotesellersfiling.la.gov/lookup/lookup.aspx";
export const LOUISIANA_STATE_RATE_URL = "https://revenue.louisiana.gov/tax-education-and-faqs/faqs/sales-tax/what-is-the-sales-tax-rate-in-louisiana/";
export const LOUISIANA_STATE_RATE = 5;
export const LOUISIANA_EXPECTED_PARISHES = 64;

function decodeHtml(value) {
  return String(value).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
}

function plainText(value) {
  return decodeHtml(String(value).replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function isoFromUsDate(value) {
  const match = String(value).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) throw new Error("Louisiana lookup has an invalid filing period.");
  return `${match[3]}-${match[1]}-${match[2]}`;
}

export function parseLouisianaStateRate(html) {
  const text = plainText(html);
  if (!/(?:Sales Tax\s*;?|state sales tax rate is)\s*5(?:\.00)?%/i.test(text) || !/January 1, 2025/i.test(text)) {
    throw new Error("Louisiana DOR no longer confirms the 5% state sales-tax rate effective January 1, 2025.");
  }
  return LOUISIANA_STATE_RATE;
}

export function parseLouisianaLookupLanding(html, { expectedParishes = LOUISIANA_EXPECTED_PARISHES } = {}) {
  const jurisdictionSelect = String(html).match(/<select\b[^>]*id=["']ddlJurisdiction["'][^>]*>([\s\S]*?)<\/select>/i)?.[1];
  const periodSelect = String(html).match(/<select\b[^>]*id=["']ddlFilingPeriod["'][^>]*>([\s\S]*?)<\/select>/i)?.[1];
  if (!jurisdictionSelect || !periodSelect) throw new Error("Louisiana lookup is missing its parish or filing-period selector.");
  const parishes = [...jurisdictionSelect.matchAll(/<option\b[^>]*value=["'](\d{4})["'][^>]*>([\s\S]*?)<\/option>/gi)].map((match) => ({
    code: match[1], name: plainText(match[2]).replace(/\s*\(\d{4}\)\s*$/, ""),
  }));
  if (parishes.length !== expectedParishes || new Set(parishes.map((parish) => parish.code)).size !== parishes.length) {
    throw new Error(`Louisiana lookup returned ${parishes.length} parish selectors instead of ${expectedParishes}.`);
  }
  const selectedPeriod = [...periodSelect.matchAll(/<option\b([^>]*)value=["']([^"']+)["'][^>]*>/gi)].find((match) => /selected/i.test(match[1]))?.[2];
  if (!selectedPeriod) throw new Error("Louisiana lookup did not identify its current filing period.");
  const hiddenFields = [...String(html).matchAll(/<input\b[^>]*type=["']hidden["'][^>]*>/gi)].map((match) => {
    const name = match[0].match(/\bname=["']([^"']+)["']/i)?.[1];
    const value = match[0].match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? "";
    return [decodeHtml(name || ""), decodeHtml(value)];
  }).filter(([name]) => name);
  for (const required of ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]) {
    if (!hiddenFields.some(([name]) => name === required)) throw new Error(`Louisiana lookup is missing ${required}.`);
  }
  return { parishes, periodValue: selectedPeriod, asOfDate: isoFromUsDate(selectedPeriod), hiddenFields };
}

function percent(value, label) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)%$/);
  const rate = Number(match?.[1]);
  if (!Number.isFinite(rate) || rate < 0 || rate > 15) throw new Error(`Louisiana lookup has an invalid ${label}.`);
  return Number(rate.toFixed(4));
}

export function parseLouisianaParishPage(html, { parishCode, beginDate } = {}) {
  if (!/^\d{4}$/.test(parishCode || "") || !/^\d{4}-\d{2}-\d{2}$/.test(beginDate || "")) throw new Error("Louisiana parish page requires a validated parish and filing period.");
  const select = String(html).match(/<select\b[^>]*id=["']ddlJurisdiction["'][^>]*>([\s\S]*?)<\/select>/i)?.[1];
  const selected = select && [...select.matchAll(/<option\b([^>]*)value=["'](\d{4})["'][^>]*>/gi)].find((match) => /selected/i.test(match[1]))?.[2];
  if (selected !== parishCode) throw new Error(`Louisiana lookup returned parish ${selected || "(none)"} when ${parishCode} was requested.`);
  const table = String(html).match(/<table\b[^>]*id=["']grdRates["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table || !/Jurisdiction\s*\(Domicile Code\)/i.test(plainText(table))) throw new Error(`Louisiana lookup returned no rate table for parish ${parishCode}.`);
  const rates = [];
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => plainText(match[1]));
    if (cells.length === 0) continue;
    if (cells.length !== 5) throw new Error(`Louisiana lookup returned a malformed rate row for parish ${parishCode}.`);
    const identity = cells[0].match(/^(.+?)\s*\((\d{4})\)\s*$/);
    if (!identity) throw new Error(`Louisiana lookup returned a rate row without a domicile code for parish ${parishCode}.`);
    const name = identity[1].trim();
    const domicileCode = identity[2];
    const localRate = percent(cells[1], `${domicileCode} tax rate`);
    const lowerName = name.toLowerCase();
    const jurisdictionType = domicileCode.endsWith("00") && /parish/.test(lowerName) ? "county"
      : /\b(?:city|town|village)\b/.test(lowerName) ? "city" : "special";
    rates.push({
      jurisdictionType, jurisdictionCode: `LA:${parishCode}:${domicileCode}`, parishCode, domicileCode, name,
      componentRate: localRate, totalGeneralRate: Number((LOUISIANA_STATE_RATE + localRate).toFixed(4)),
      generalInterstateRate: Number((LOUISIANA_STATE_RATE + localRate).toFixed(4)), beginDate, endDate: null,
      vendorCompensationRate: percent(cells[2], `${domicileCode} vendor-compensation rate`),
      delinquencyRate: percent(cells[3], `${domicileCode} delinquency rate`), interestRate: percent(cells[4], `${domicileCode} interest rate`),
    });
  }
  if (rates.length === 0) throw new Error(`Louisiana lookup returned no domicile rates for parish ${parishCode}.`);
  return rates;
}

function formBody(landing, parishCode) {
  const body = new URLSearchParams(landing.hiddenFields);
  body.set("__EVENTTARGET", "ddlJurisdiction"); body.set("__EVENTARGUMENT", "");
  body.set("ddlStateSelect", "LA"); body.set("ddlAuthority", "1000"); body.set("ddlReturn", "1000");
  body.set("ddlJurisdiction", parishCode); body.set("ddlFilingPeriod", landing.periodValue);
  return body;
}

async function concurrentMap(values, limit, callback) {
  const results = new Array(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex; nextIndex += 1; results[index] = await callback(values[index], index);
    }
  }));
  return results;
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;
let systemCertificateAuthoritiesEnabled = false;

function enableSystemCertificateAuthorities() {
  if (systemCertificateAuthoritiesEnabled) return;
  const certificates = [...new Set([...getCACertificates("default"), ...getCACertificates("system")])];
  if (certificates.length > 0) setDefaultCACertificates(certificates);
  systemCertificateAuthoritiesEnabled = true;
}

export async function readOfficialLaRates({ fetchImpl = fetch, now = new Date(), bypassCache = false, expectedParishes = LOUISIANA_EXPECTED_PARISHES, minimumRates = 400 } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    enableSystemCertificateAuthorities();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const headers = { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" };
      const [landingResponse, stateResponse] = await Promise.all([
        fetchImpl(LOUISIANA_REMOTE_SELLER_LOOKUP_URL, { headers, signal: controller.signal }),
        fetchImpl(LOUISIANA_STATE_RATE_URL, { headers, signal: controller.signal }),
      ]);
      if (!landingResponse.ok) throw new Error(`Louisiana remote-seller lookup returned HTTP ${landingResponse.status}.`);
      if (!stateResponse.ok) throw new Error(`Louisiana DOR state-rate page returned HTTP ${stateResponse.status}.`);
      const landingHtml = await landingResponse.text(); const stateHtml = await stateResponse.text();
      parseLouisianaStateRate(stateHtml);
      const landing = parseLouisianaLookupLanding(landingHtml, { expectedParishes });
      if (landing.asOfDate > now.toISOString().slice(0, 10)) throw new Error(`Louisiana lookup selected future filing period ${landing.asOfDate}.`);
      const pages = await concurrentMap(landing.parishes, 8, async (parish) => {
        if (parish.code === landing.parishes[0].code) return landingHtml;
        const response = await fetchImpl(LOUISIANA_REMOTE_SELLER_LOOKUP_URL, {
          method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody(landing, parish.code), signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Louisiana lookup returned HTTP ${response.status} for parish ${parish.code}.`);
        return response.text();
      });
      const sourceRates = pages.flatMap((html, index) => parseLouisianaParishPage(html, { parishCode: landing.parishes[index].code, beginDate: landing.asOfDate }));
      const ratesByCode = new Map();
      for (const rate of sourceRates) {
        const previous = ratesByCode.get(rate.jurisdictionCode);
        if (!previous) { ratesByCode.set(rate.jurisdictionCode, rate); continue; }
        if (previous.vendorCompensationRate !== rate.vendorCompensationRate || previous.delinquencyRate !== rate.delinquencyRate || previous.interestRate !== rate.interestRate) {
          throw new Error(`Louisiana lookup repeats composite domicile ${rate.jurisdictionCode} with conflicting administrative rates.`);
        }
        previous.name = `${previous.name} + ${rate.name}`;
        previous.jurisdictionType = "special";
        previous.componentRate = Number((previous.componentRate + rate.componentRate).toFixed(4));
        previous.totalGeneralRate = Number((LOUISIANA_STATE_RATE + previous.componentRate).toFixed(4));
        previous.generalInterstateRate = previous.totalGeneralRate;
      }
      const rates = [...ratesByCode.values()];
      if (rates.length < minimumRates) throw new Error(`Louisiana lookup returned only ${rates.length} current domicile rows.`);
      const counts = {
        counties: rates.filter((rate) => rate.jurisdictionType === "county").length,
        cities: rates.filter((rate) => rate.jurisdictionType === "city").length,
        specialJurisdictions: rates.filter((rate) => rate.jurisdictionType === "special").length,
      };
      const snapshot = {
        stateCode: "LA", source: "Louisiana Sales and Use Tax Commission for Remote Sellers / Louisiana DOR",
        sourceUrl: LOUISIANA_REMOTE_SELLER_LOOKUP_URL, machineReadableSourceUrl: LOUISIANA_REMOTE_SELLER_LOOKUP_URL,
        retrievedAt: now.toISOString(), asOfDate: landing.asOfDate, stateRate: LOUISIANA_STATE_RATE,
        sourceHash: createHash("sha256").update(landingHtml).update(stateHtml).update(pages.join("\n")).digest("hex"),
        rates: rates.sort((left, right) => left.jurisdictionCode.localeCompare(right.jurisdictionCode)), counts,
        effectivePeriod: `Current filing period beginning ${landing.asOfDate}`,
        boundaryStatus: "Current remote-seller domicile rates are connected for all 64 parish selectors. Domicile codes can carry different rates in different parish contexts, so TaxAP keys them by parish plus domicile and never collapses them by code alone. The official address explorer is interactive; address-to-domicile and A+ comparison remain unresolved, especially because A+ assigns nearly all Louisiana ship-tos to one flat LA000 rate.",
      };
      cachedSnapshot = snapshot; cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000; return snapshot;
    } finally { clearTimeout(timeout); }
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
