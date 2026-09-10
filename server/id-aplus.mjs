import { createHash } from "node:crypto";
import { readOfficialIdRates, IDAHO_TAX_COMMISSION_CITY_TAX_URL } from "./id-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export const ID_GEOGRAPHY_URL = "https://services.arcgis.com/91hXl6NfvLGEi8x5/arcgis/rest/services/Idaho_City_Taxing_Districts/FeatureServer";
const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
function names(data, expected, allowDuplicates = false) {
  if (data.error || data.exceededTransferLimit || data.features?.length !== expected) throw new Error("Idaho official geography is incomplete or changed.");
  const result = data.features.map((f) => normalize(f.attributes?.NAME));
  if (result.some((n) => !n) || (!allowDuplicates && new Set(result).size !== expected)) throw new Error("Idaho official geography names are ambiguous.");
  return result;
}

export function buildIdahoSalesAreas({ cities, counties, resortCities, resortCounties, stateRate }) {
  if (stateRate !== 6 || !resortCities.length || new Set(resortCities).size !== resortCities.length) throw new Error("Idaho state rate or resort inventory changed.");
  const excludedCounties = new Set();
  for (const city of resortCities) {
    const matches = resortCounties[city];
    if (!cities.includes(city) || !Array.isArray(matches) || !matches.length || matches.some((n) => !counties.includes(n))) throw new Error("Idaho resort-city county coverage is unresolved.");
    matches.forEach((n) => excludedCounties.add(n));
  }
  return {
    rates: [
      ...cities.map((name) => ({ name, jurisdictionType: "city", totalGeneralRate: resortCities.includes(name) ? null : stateRate })),
      ...counties.map((name) => ({ name, jurisdictionType: "county", totalGeneralRate: excludedCounties.has(name) ? null : stateRate })),
    ],
    unresolvedResortCounties: [...excludedCounties].sort(),
  };
}

let cached = null;
let expires = 0;
export async function readIdahoSalesAreas({ fetchImpl = fetch, readBase = readOfficialIdRates, bypassCache = false } = {}) {
  if (!bypassCache && fetchImpl === fetch && cached && Date.now() < expires) return cached;
  const get = async (url, options = {}) => {
    const r = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error("Idaho official geography or resort list is unavailable.");
    return r;
  };
  const query = (geometry) => new URLSearchParams({ f: "json", where: "1=1", outFields: "NAME", returnGeometry: String(geometry), outSR: "4326", resultRecordCount: "1000" });
  const [base, citiesResponse, countiesResponse, listResponse] = await Promise.all([readBase(), get(`${ID_GEOGRAPHY_URL}/6/query?${query(true)}`), get(`${ID_GEOGRAPHY_URL}/7/query?${query(false)}`), get(IDAHO_TAX_COMMISSION_CITY_TAX_URL)]);
  const [cityData, countyData, html] = await Promise.all([citiesResponse.json(), countiesResponse.json(), listResponse.text()]);
  const cityNames = names(cityData, 200, true), cities = [...new Set(cityNames)], counties = names(countyData, 44);
  const list = html.match(/Cities with local sales taxes[\s\S]*?<ul\b[^>]*>([\s\S]*?)<\/ul>/i)?.[1];
  const resortCities = [...(list ?? "").matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => normalize(m[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").split(/&ndash;|–/)[0]));
  if (!list || resortCities.length !== base.unavailableLocalJurisdictions.length || base.unavailableLocalJurisdictions.some((n) => !resortCities.includes(normalize(n)))) throw new Error("Idaho current resort-city list changed; review local sales-tax scope.");
  const resortCounties = {};
  for (let i = 0; i < resortCities.length; i += 4) {
    await Promise.all(resortCities.slice(i, i + 4).map(async (city) => {
      const parts = cityData.features.filter((f) => normalize(f.attributes?.NAME) === city);
      if (!parts.length || cityData.spatialReference?.wkid !== 4326) throw new Error("Idaho resort-city geometry is unavailable or uses an unexpected coordinate system.");
      const intersections = new Set();
      for (const feature of parts) {
        if (!feature.geometry?.rings?.length) throw new Error("Idaho resort-city geometry is unavailable.");
        const body = new URLSearchParams({ f: "json", geometry: JSON.stringify(feature.geometry), inSR: "4326", geometryType: "esriGeometryPolygon", spatialRel: "esriSpatialRelIntersects", outFields: "NAME", returnGeometry: "false" });
        const data = await (await get(`${ID_GEOGRAPHY_URL}/7/query`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body })).json();
        if (!data.features?.length) throw new Error("Idaho resort-city county intersection failed.");
        names(data, data.features.length).forEach((n) => intersections.add(n));
      }
      resortCounties[city] = [...intersections];
    }));
  }
  const areas = buildIdahoSalesAreas({ cities, counties, resortCities, resortCounties, stateRate: base.stateRate });
  const snapshot = { ...base, ...areas, comparisonScope: "sales", geographySourceUrl: ID_GEOGRAPHY_URL, sourceHash: createHash("sha256").update(base.sourceHash).update(JSON.stringify({ cityData, countyData, resortCounties })).update(html).digest("hex"), boundaryStatus: "Sales-tax comparison for assigned non-resort cities and counties with no intersecting listed resort city. Resort cities and their counties remain unresolved. Public geography does not establish any ship-to's delivery boundary or exemption status." };
  if (fetchImpl === fetch) { cached = snapshot; expires = Date.now() + 6 * 60 * 60 * 1000; }
  return snapshot;
}

export async function readIdahoAplusComparison(stateDetail, { readOfficial = readIdahoSalesAreas } = {}) {
  const officialSnapshot = await readOfficial();
  const byName = new Map();
  for (const rate of officialSnapshot.rates) {
    const name = normalize(rate.name);
    if (!name || byName.has(name) || ![null, 6].includes(rate.totalGeneralRate)) throw new Error("Idaho comparison inventory is ambiguous.");
    byName.set(name, rate);
  }
  const result = reconcileDirectMappingAplus({ stateCode: "ID", stateDetail, matchOfficialRow: (row) => {
    if (!/^ID\d+$/.test(row.taxBody ?? "") || row.taxBody === "ID000" || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
    const name = normalize(row.description).replace(/^idaho[ -]+/, "").replace(/ co\.?$/, " county");
    return byName.get(name) ?? null;
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, officialSnapshot, comparisonScope: "sales" };
}
