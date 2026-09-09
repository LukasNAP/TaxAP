import { createHash } from "node:crypto";
import { readOfficialSstStateRates } from "./sst-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export const TENNESSEE_LOOKUP_PAGE = "https://tnmap.tn.gov/sst/sst.html";
export const TENNESSEE_RATE_SERVICE = "https://tnmap.tn.gov/arcgis/rest/services/COMMUNITY/SST/MapServer/4/query";
const fields = "situs,cityfips,stjfips,county,generalrateinterstate,generalrateintrastate,generalsurchargeinterstate,generalsurchargeintrastate,cbid";
const normalize = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function reconcileTennesseeInventory(data, sst, { minimumRows = 400, expectedCounties = 95 } = {}) {
  if (data.error || data.exceededTransferLimit || !Array.isArray(data.features) || data.features.length < minimumRows || sst.stateRate !== 7) throw new Error("Tennessee jurisdiction inventory is incomplete or has changed scope.");
  const rates = [];
  const seenCounties = new Set();
  const counties = new Map(sst.rates.filter((r) => r.jurisdictionType === "county").map((r) => [normalize(r.name).replace(/ county$/, ""), r]));
  const cities = new Map(sst.rates.filter((r) => r.jurisdictionType === "city").map((r) => [r.jurisdictionCode, r]));
  for (const { attributes: a } of data.features) {
    if (!a || !/^\d{4}$/.test(a.situs) || !counties.has(normalize(a.county))) throw new Error("Tennessee location identity is invalid.");
    const base = a.generalrateintrastate;
    const surcharge = a.generalsurchargeintrastate ?? 0;
    if (!Number.isFinite(base) || !Number.isFinite(surcharge) || base < 0 || base > 0.0275 || surcharge < 0 || surcharge > 0.01 || a.generalrateinterstate !== base || (a.generalsurchargeinterstate ?? 0) !== surcharge) throw new Error("Tennessee rate scope is unresolved.");
    const isCounty = a.situs.endsWith("00") && a.cityfips == null && a.stjfips == null;
    if (isCounty) seenCounties.add(normalize(a.county));
    const official = isCounty ? counties.get(normalize(a.county)) : a.cityfips != null && a.stjfips == null ? cities.get(String(a.cityfips).padStart(5, "0")) : null;
    // All rows participate in code-ambiguity detection, including unresolved special rows.
    if (official && Math.abs(official.componentRate - base * 100) > 0.00001) throw new Error("Tennessee lookup and effective SST base rates disagree.");
    rates.push({ jurisdictionCode: a.situs, name: official?.name ?? null, county: a.county,
      totalGeneralRate: official && a.cbid == null ? Number((7 + 100 * (base + surcharge)).toFixed(4)) : null,
      surchargeRate: 100 * surcharge });
  }
  if (seenCounties.size !== expectedCounties) throw new Error("Tennessee county inventory is incomplete.");
  return rates;
}

export async function readTennesseeCombinedRates({ fetchImpl = fetch, readSst = () => readOfficialSstStateRates("TN") } = {}) {
  const query = new URLSearchParams({ f: "json", where: "1=1", outFields: fields, returnDistinctValues: "true", returnGeometry: "false", orderByFields: "situs", resultRecordCount: "2000" });
  const url = `${TENNESSEE_RATE_SERVICE}?${query}`;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Tennessee public rate service is unavailable.");
  const text = await response.text();
  const sstSnapshot = await readSst();
  const rates = reconcileTennesseeInventory(JSON.parse(text), sstSnapshot);
  return { stateCode: "TN", rates, sstSnapshot, sourceUrl: TENNESSEE_LOOKUP_PAGE, machineReadableSourceUrl: url, retrievedAt: new Date().toISOString(), sourceHash: createHash("sha256").update(text).digest("hex") };
}

export async function readTennesseeAplusComparison(stateDetail, { readOfficial = readTennesseeCombinedRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byCode = new Map();
  for (const rate of officialSnapshot.rates) byCode.set(rate.jurisdictionCode, [...(byCode.get(rate.jurisdictionCode) ?? []), rate]);
  const result = reconcileDirectMappingAplus({ stateCode: "TN", stateDetail, matchOfficialRow: (row) => {
    const code = /^TN(\d{4})$/.exec(row.taxBody ?? "")?.[1];
    if (!code || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
    const candidates = byCode.get(code) ?? [];
    if (candidates.length !== 1 || !Number.isFinite(candidates[0].totalGeneralRate)) return null;
    const rate = candidates[0];
    const assigned = normalize(row.description).replace(/^tennessee[ -]+/, "").replace(/ co\.?$/, " county");
    const official = normalize(rate.name).replace(/ (?:city|town)$/, "");
    return assigned === official ? rate : null;
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, officialSnapshot };
}
