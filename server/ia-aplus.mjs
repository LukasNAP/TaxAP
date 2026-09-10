import { createHash } from "node:crypto";
import { readXlsxRows } from "./xlsx-utils.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export const IA_LOST_URL = "https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/local-option-sales-tax-lost";
export const IA_LOST_WORKBOOK_URL = "https://revenue.iowa.gov/media/195/download?inline";
export const IA_GUIDE_URL = "https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/sales-use-tax-guide";
export const IA_COUNTIES_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_gaz_counties_19.txt";
async function readIowaBase(fetchImpl, now) {
  const responses = await Promise.all([IA_GUIDE_URL, IA_COUNTIES_URL].map((url) => fetchImpl(url, { signal: AbortSignal.timeout(25000) })));
  if (responses.some((r) => !r.ok)) throw new Error("Iowa state-rate or county source is unavailable.");
  const [guide, geography] = await Promise.all(responses.map((r) => r.text()));
  if (!/rate for both is 6%/.test(guide.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "))) throw new Error("Iowa official state-rate guidance changed.");
  const lines = geography.trim().split(/\r?\n/).map((line) => line.split(geography.startsWith("USPS|") ? "|" : "\t").map((s) => s.trim()));
  const header = lines.shift(), nameColumn = header.indexOf("NAME"), codeColumn = header.indexOf("GEOID");
  if (nameColumn < 0 || codeColumn < 0 || lines.length !== 99 || lines.some((r) => !/^19\d{3}$/.test(r[codeColumn]))) throw new Error("Iowa Census county inventory changed.");
  return { stateCode: "IA", stateRate: 6, retrievedAt: now.toISOString(), source: "Iowa Department of Revenue", sourceHash: createHash("sha256").update(guide).update(geography).digest("hex"), rates: lines.map((r) => ({ jurisdictionType: "county", name: r[nameColumn] })) };
}
const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const excelDate = (value) => {
  if (!/^\d+$/.test(String(value)) || Number(value) < 2 || Number(value) > 100000) throw new Error("Iowa LOST effective date is invalid.");
  return new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000).toISOString().slice(0, 10);
};

export function parseIowaSalesRows(rows, { now = new Date(), expectedRows = 1136, expectedCounties = 99 } = {}) {
  const today = now.toISOString().slice(0, 10);
  const half = `${now.getUTCFullYear()}-${now.getUTCMonth() < 6 ? "01" : "07"}-01`;
  const heading = String(rows[0]?.A).match(/^Effective (Jan|Jul) 1, (\d{4})$/);
  if (!heading || `${heading[2]}-${heading[1] === "Jan" ? "01" : "07"}-01` !== half) throw new Error("Iowa LOST workbook does not cover the current half-year.");
  const headers = ["County", "County", "City", "Jurisdiction has LOST", "Unincorporated Jurisdiction", "Jurisdiction LOST Rate", "Unincorporated LOST Rate", "Total Rate", "LOST From", "Sunset Date"];
  if (headers.some((h, i) => rows[2]?.[String.fromCharCode(65 + i)] !== h) || !/Any jurisdiction not listed falls under the unincorporated county/.test(rows[1]?.A ?? "")) throw new Error("Iowa LOST workbook scope or columns changed.");
  const records = rows.slice(3).filter((r) => r.A || r.B);
  if (records.length !== expectedRows) throw new Error("Iowa LOST workbook jurisdiction inventory changed.");
  const keys = new Set(), counties = new Map();
  const rates = records.map((r) => {
    const county = normalize(r.B), name = normalize(r.C), countyNumber = Number(r.A);
    const unincorporated = r.E === "YES", hasLocal = r.D === "YES";
    const key = `${county}:${name}`;
    if (!Number.isInteger(countyNumber) || countyNumber < 1 || countyNumber > 99 || !county || !name || keys.has(key) || !["YES", "NO"].includes(r.D) || !["YES", "NO"].includes(r.E) || unincorporated !== (name === "unincorporated")) throw new Error("Iowa LOST jurisdiction identity is invalid or duplicated.");
    keys.add(key);
    const expectedLocal = hasLocal ? "0.01" : "0";
    if ((hasLocal ? r.F !== expectedLocal : !["0", "n/a"].includes(r.F)) || (unincorporated ? r.G !== expectedLocal : r.G !== "n/a") || r.H !== (hasLocal ? "7%" : "6%")) throw new Error("Iowa LOST components disagree with the published total.");
    const beginDate = hasLocal ? excelDate(r.I) : null;
    const endDate = r.J ? excelDate(r.J) : null;
    if (beginDate && endDate && endDate <= beginDate) throw new Error("Iowa LOST dates conflict.");
    const totalGeneralRate = (beginDate && beginDate > today) || (endDate && endDate <= today) ? null : hasLocal ? 7 : 6;
    const rate = { jurisdictionType: unincorporated ? "county" : "city", jurisdictionCode: `IA:${key}`, name: unincorporated ? `${r.B} unincorporated` : r.C, county, countyNumber, totalGeneralRate, beginDate, endDate };
    const group = counties.get(county) ?? [];
    if (group.some((item) => item.countyNumber !== countyNumber)) throw new Error("Iowa county identity conflicts.");
    counties.set(county, [...group, rate]);
    return rate;
  });
  if (counties.size !== expectedCounties || new Set([...counties.values()].map((r) => r[0].countyNumber)).size !== expectedCounties || [...counties.values()].some((r) => r.filter((x) => x.jurisdictionType === "county").length !== 1)) throw new Error("Iowa LOST inventory must include each county and its unincorporated area exactly once.");
  return { rates, asOfDate: half };
}

export async function readIowaSalesRates({ fetchImpl = fetch, now = new Date(), readBase = () => readIowaBase(fetchImpl, now) } = {}) {
  const [base, response] = await Promise.all([readBase(), fetchImpl(IA_LOST_WORKBOOK_URL, { signal: AbortSignal.timeout(25000) })]);
  if (!response.ok || base.stateRate !== 6) throw new Error("Iowa sales-tax sources are unavailable or the state rate changed.");
  const buffer = Buffer.from(await response.arrayBuffer());
  const parsed = parseIowaSalesRows(readXlsxRows(buffer), { now });
  const counties = new Set(base.rates.filter((r) => r.jurisdictionType === "county").map((r) => normalize(r.name).replace(/ county$/, "")));
  if (counties.size !== 99 || parsed.rates.some((r) => !counties.has(r.county))) throw new Error("Iowa workbook county inventory disagrees with the Census geography.");
  return { ...base, ...parsed, sourceUrl: IA_LOST_URL, machineReadableSourceUrl: IA_LOST_WORKBOOK_URL, sourceHash: createHash("sha256").update(base.sourceHash).update(buffer).digest("hex"), comparisonScope: "sales", boundaryStatus: "Sales-tax-only assigned-jurisdiction comparison. County labels compare only where every listed city and unincorporated area shares one rate. Mixed counties, unknown names and expired rates remain unresolved." };
}

export async function readIowaAplusComparison(stateDetail, { readOfficial = readIowaSalesRates } = {}) {
  const officialSnapshot = await readOfficial();
  const counties = new Map(), cities = new Map();
  for (const rate of officialSnapshot.rates) {
    counties.set(rate.county, [...(counties.get(rate.county) ?? []), rate]);
    if (rate.jurisdictionType === "city") {
      const name = normalize(rate.name);
      cities.set(name, [...(cities.get(name) ?? []), rate]);
    }
  }
  const uniqueTotal = (rows, name) => rows?.length && rows.every((r) => Number.isFinite(r.totalGeneralRate) && r.totalGeneralRate === rows[0].totalGeneralRate) ? { name, totalGeneralRate: rows[0].totalGeneralRate } : null;
  const result = reconcileDirectMappingAplus({ stateCode: "IA", stateDetail, matchOfficialRow: (row) => {
    if (!/^IA\d+$/.test(row.taxBody ?? "") || row.taxBody === "IA000" || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
    const name = normalize(row.description).replace(/^iowa[ -]+/, "");
    const county = name.match(/^(.+) (?:county|co\.?)$/)?.[1];
    if (county) return uniqueTotal(counties.get(county), `${county} County`);
    return uniqueTotal(cities.get(name), name);
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, officialSnapshot, comparisonScope: "sales" };
}
