import { createHash } from "node:crypto";
import { readOfficialSstStateRates } from "./sst-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export const VT_LOCAL_OPTION_URL = "https://tax.vermont.gov/business/local-option-tax";
// Layer used by the Department of Taxes' linked Local Option Tax Finder.
export const VT_SALES_LAYER_URL = "https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/VT%20Data%20-%20Local%20Option%20Tax%20Rates%20-%20WM/FeatureServer/0";
const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\bst\.?\s+/g, "saint ").replace(/\s+/g, " ");
const text = (value) => value.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
const date = (value) => {
  if (value == null) return null;
  if (!Number.isFinite(value) || Number.isNaN(new Date(value).getTime())) throw new Error("Vermont sales-tax effective date is invalid.");
  return new Date(value).toISOString().slice(0, 10);
};

export function parseVermontSalesAreas(data, html, { now = new Date(), expectedAreas = 256 } = {}) {
  const today = now.toISOString().slice(0, 10);
  const table = html.match(/<h2[^>]*>\s*Municipalities that have a 1% Local Option Sales Tax\s*<\/h2>\s*(<table\b[\s\S]*?<\/table>)/i)?.[1];
  if (!table || data.error || data.exceededTransferLimit || data.features?.length !== expectedAreas) throw new Error("Vermont sales-tax source inventory is incomplete or changed.");
  const published = new Set();
  const allPublished = new Set();
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => text(cell[1]));
    if (!cells.length) continue;
    if (cells.length !== 2) throw new Error("Vermont sales-tax table columns changed.");
    const name = normalize(cells[0]).replace(/^city of essex junction$/, "essex junction");
    const begin = cells[1].match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/);
    const end = cells[1].match(/Rescinded as of\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (!name || !begin || allPublished.has(name) || (/rescinded/i.test(cells[1]) && !end)) throw new Error("Vermont sales-tax table identity or effective date is ambiguous.");
    allPublished.add(name);
    const beginDate = new Date(`${begin[1]} 1, ${begin[2]} 00:00:00 UTC`).toISOString().slice(0, 10);
    const endDate = end ? `${end[3]}-${end[1].padStart(2, "0")}-${end[2].padStart(2, "0")}` : null;
    if (beginDate <= today && (!endDate || today < endDate)) published.add(name);
  }
  if (!published.size) throw new Error("Vermont current local sales-tax list is empty.");
  const names = new Set();
  const active = new Set();
  const rates = data.features.map(({ attributes: a }) => {
    const name = normalize(a?.TOWNNAME);
    const start = date(a?.Start_Sales), end = date(a?.End_Sales);
    if (!name || names.has(name) || ![0.06, 0.07].includes(a.Sales) || !["Y", "N"].includes(a.LOT_Sales) || (start && end && end <= start)) throw new Error("Vermont municipality identity or sales rate is invalid.");
    names.add(name);
    if ((a.LOT_Sales === "Y" && (a.Sales !== 0.07 || !start)) || (a.LOT_Sales === "N" && (a.Sales !== 0.06 || (start && !end)))) throw new Error("Vermont local sales-tax fields conflict.");
    const hasLocal = Boolean(start && start <= today && (!end || today < end));
    if (hasLocal) active.add(name);
    if (hasLocal !== published.has(name)) throw new Error("Vermont map and published sales-tax list disagree.");
    return { name: a.TOWNNAME, jurisdictionType: "city", jurisdictionCode: `VT:${name}`, totalGeneralRate: hasLocal ? 7 : 6, beginDate: start, endDate: end };
  });
  if (active.size !== published.size) throw new Error("Vermont map omits a published sales-tax municipality.");
  return { rates, localSalesAreas: active.size };
}

export async function readVermontSalesRates({ fetchImpl = fetch, now = new Date(), readBase = () => readOfficialSstStateRates("VT", { now }) } = {}) {
  const query = new URLSearchParams({ f: "json", where: "1=1", outFields: "TOWNNAME,Sales,LOT_Sales,Start_Sales,End_Sales", returnGeometry: "false", resultRecordCount: "1000" });
  const [base, mapResponse, pageResponse] = await Promise.all([readBase(), fetchImpl(`${VT_SALES_LAYER_URL}/query?${query}`, { signal: AbortSignal.timeout(25000) }), fetchImpl(VT_LOCAL_OPTION_URL, { signal: AbortSignal.timeout(25000) })]);
  if (base.stateRate !== 6 || !mapResponse.ok || !pageResponse.ok) throw new Error("Vermont official sales-tax sources are unavailable or changed.");
  const [mapText, html] = await Promise.all([mapResponse.text(), pageResponse.text()]);
  const parsed = parseVermontSalesAreas(JSON.parse(mapText), html, { now });
  const locals = base.rates.filter((r) => r.jurisdictionType !== "state");
  if (locals.length !== parsed.localSalesAreas || locals.some((r) => r.jurisdictionType !== "city" || r.componentRate !== 1)) throw new Error("Vermont SST and local sales-tax inventory disagree.");
  return { ...base, ...parsed, sourceUrl: VT_LOCAL_OPTION_URL, machineReadableSourceUrl: VT_SALES_LAYER_URL, sourceHash: createHash("sha256").update(base.sourceHash).update(mapText).update(html).digest("hex"), comparisonScope: "sales", boundaryStatus: "Sales-tax-only comparison of assigned municipality names. County-only, unknown and ambiguous names remain unresolved; delivery boundaries and use-tax treatment are not inferred." };
}

export async function readVermontAplusComparison(stateDetail, { readOfficial = readVermontSalesRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byName = new Map();
  for (const rate of officialSnapshot.rates) {
    const name = normalize(rate.name);
    if (!name || byName.has(name) || ![6, 7].includes(rate.totalGeneralRate)) throw new Error("Vermont comparison inventory is ambiguous or invalid.");
    byName.set(name, rate);
  }
  const result = reconcileDirectMappingAplus({ stateCode: "VT", stateDetail, matchOfficialRow: (row) => {
    if (!/^VT\d+$/.test(row.taxBody ?? "") || row.taxBody === "VT000" || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
    return byName.get(normalize(row.description).replace(/^vermont[ -]+/, "")) ?? null;
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, comparisonScope: "sales", officialSnapshot };
}
