import { createHash } from "node:crypto";
import { extractPdfTableText } from "./pdf-utils.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export const MINNESOTA_RATE_PAGE = "https://www.revenue.state.mn.us/local-sales-tax-information";
const archivedGuides = { "2026-q3": "https://www.revenue.state.mn.us/sites/default/files/2026-05/local-sales-and-use-tax-rate-guide-2026-q3.pdf" };
export function parseMinnesotaCombinedText(text, { asOfDate, minimumRows = 300 } = {}) {
  const periods = [...text.matchAll(/Effective (\d{1,2})\/(\d{1,2})\/(\d{4})\s*[–-]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/g)];
  const iso = (y, m, d) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  if (!periods.length || periods.some((m) => iso(m[3], m[1], m[2]) > asOfDate || iso(m[6], m[4], m[5]) < asOfDate)) throw new Error("Minnesota guide does not cover the comparison date.");
  const rates = [];
  let inTable = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, " ");
    if (line.startsWith("County/City")) inTable = true;
    if (!inTable) continue;
    if (!line.includes("%") || /^Townships:/i.test(line)) continue;
    const split = line.search(/\d+(?:\.\d+)?\s*%/);
    if (split < 0) continue;
    const name = line.slice(0, split).trim();
    // Township lists wrap across physical lines; only a single municipality label is accepted.
    if (!/^[A-Za-z][A-Za-z .’'()-]*\*?(?:, City of)?$/.test(name)) continue;
    const values = [...line.slice(split).matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
    if (values.length < 2 || values.at(-2) !== 6.875 || values.at(-1) > 20 || Math.abs(values.slice(0, -1).reduce((a, b) => a + b, 0) - values.at(-1)) > .00001) throw new Error("Minnesota combined row failed component validation.");
    rates.push({ name: name.replace(/, City of$/, "").replace(/\*$/, ""), totalGeneralRate: values.at(-1), ambiguousArea: name.includes("*") });
  }
  if (rates.length < minimumRows) throw new Error("Minnesota municipality inventory is incomplete.");
  return rates;
}

export async function readMinnesotaCombinedRates({ fetchImpl = fetch, now = new Date() } = {}) {
  const key = `${now.getUTCFullYear()}-q${Math.floor(now.getUTCMonth() / 3) + 1}`;
  const page = await fetchImpl(MINNESOTA_RATE_PAGE, { signal: AbortSignal.timeout(20000) });
  if (!page.ok) throw new Error("Minnesota rate directory is unavailable.");
  const html = await page.text();
  const link = [...html.matchAll(/href="([^"]*local-sales-and-use-tax-rate-guide-[^"]+\.pdf)"/g)].map((m) => m[1]).find((url) => url.includes(key));
  const url = link ? new URL(link, MINNESOTA_RATE_PAGE).href : archivedGuides[key];
  if (!url) throw new Error("Minnesota current-period guide is not available.");
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Minnesota current-period PDF is unavailable.");
  const buffer = Buffer.from(await response.arrayBuffer());
  const rates = parseMinnesotaCombinedText(await extractPdfTableText(buffer), { asOfDate: now.toISOString().slice(0, 10) });
  return { stateCode: "MN", rates, sourceUrl: MINNESOTA_RATE_PAGE, machineReadableSourceUrl: url, effectivePeriod: key, retrievedAt: now.toISOString(), sourceHash: createHash("sha256").update(buffer).digest("hex") };
}

const normalize = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export function parseMinnesotaMap(data, { minimumRows = 150 } = {}) {
  if (data.error || data.exceededTransferLimit || !Array.isArray(data.features) || data.features.length < minimumRows) throw new Error("Minnesota map inventory is incomplete.");
  const percent = (value) => {
    if (value == null) return 0;
    if (!/^\d+(?:\.\d+)?%?$/.test(value)) throw new Error("Minnesota map rate format changed.");
    return Number(value.replace(/%$/, ""));
  };
  return data.features.map(({ attributes: a }) => {
    if (!a?.NameLabel || !a.NameFrmal || !a.CountyName || !a.TotalFrmal || !a.StFrmal) throw new Error("Minnesota map identity or total is missing.");
    const components = [a.StFrmal, a.CityFrmal, a.CtyFrmal, a.Spec01Frmal, a.Spec02Frmal, a.Spec03Frmal, a.Spec04Frmal].map(percent);
    const total = percent(a.TotalFrmal);
    if (components[0] !== 6.875 || total > 20 || Math.abs(components.reduce((x, y) => x + y, 0) - total) > .00001) throw new Error("Minnesota map components disagree with the total.");
    const label = normalize(a.NameLabel).replace(/ county$/, "");
    // Preserve inconsistent official identity records as ambiguity, rather than fixing a name.
    return { name: a.NameLabel, county: a.CountyName, totalGeneralRate: total, ambiguousArea: label !== normalize(a.NameFrmal) };
  });
}

export async function readMinnesotaMapRates({ fetchImpl = fetch, now = new Date() } = {}) {
  const period = `${now.getUTCFullYear()}Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
  const key = `locgnrl_sales_usetax_areas_${period}`;
  const mapUrl = "https://www.arcgis.com/sharing/rest/content/items/97be9ae93d9649bfa826c8b092a267dd/data?f=json";
  const response = await fetchImpl(mapUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Minnesota official map is unavailable.");
  const map = await response.json();
  const urls = [...new Set((map.operationalLayers ?? []).filter((layer) => layer.title === key || layer.title === `${key}-Copy`).map((layer) => layer.url))];
  if (urls.length !== 1 || !urls[0].startsWith("https://services9.arcgis.com/LLh6i97mwBitl1k5/arcgis/rest/services/") || !urls[0].endsWith(`/${key}/FeatureServer/0`)) throw new Error("Minnesota current-period map layer is not uniquely published.");
  const query = new URLSearchParams({ f: "json", where: "1=1", outFields: "NameLabel,NameFrmal,CountyName,StFrmal,CityFrmal,CtyFrmal,Spec01Frmal,Spec02Frmal,Spec03Frmal,Spec04Frmal,TotalFrmal", returnGeometry: "false", resultRecordCount: "2000" });
  const url = `${urls[0]}/query?${query}`;
  const dataResponse = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!dataResponse.ok) throw new Error("Minnesota jurisdiction map query failed.");
  const text = await dataResponse.text();
  const rates = parseMinnesotaMap(JSON.parse(text));
  return { stateCode: "MN", rates, sourceUrl: "https://taxmaps.state.mn.us/salestax/", machineReadableSourceUrl: url, effectivePeriod: period, retrievedAt: now.toISOString(), sourceHash: createHash("sha256").update(text).digest("hex") };
}

export async function readMinnesotaAplusComparison(stateDetail, { readOfficial = readMinnesotaMapRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byName = new Map();
  for (const rate of officialSnapshot.rates) {
    const name = normalize(rate.name);
    byName.set(name, [...(byName.get(name) ?? []), rate]);
  }
  const result = reconcileDirectMappingAplus({ stateCode: "MN", stateDetail, matchOfficialRow: (row) => {
    if (!/^MN\d+$/.test(row.taxBody ?? "") || row.taxBody === "MN000" || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
    const name = normalize(row.description).replace(/^minnesota[ -]+/, "").replace(/ co\.?$/, " county");
    const candidates = byName.get(name) ?? [];
    if (!candidates.length || candidates.some((r) => r.ambiguousArea || !Number.isFinite(r.totalGeneralRate)) || new Set(candidates.map((r) => r.totalGeneralRate)).size !== 1) return null;
    return candidates[0];
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, officialSnapshot };
}
