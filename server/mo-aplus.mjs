import { readOfficialMoRates } from "./mo-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export async function readMissouriAplusComparison(stateDetail, { readOfficial = readOfficialMoRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byName = new Map();
  for (const rate of officialSnapshot.rates) {
    const name = normalize(rate.name);
    byName.set(name, [...(byName.get(name) ?? []), rate]);
  }
  const result = reconcileDirectMappingAplus({ stateCode: "MO", stateDetail, matchOfficialRow: (row) => {
    if (!/^MO\d+$/.test(row.taxBody ?? "") || ["MO000", "MO9999"].includes(row.taxBody) || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
    const name = normalize(row.description).replace(/^missouri[ -]+/, "").replace(/ co\.?$/, " county");
    const candidates = byName.get(name) ?? [];
    // Count every record, including special and differing-use records, before selecting.
    if (candidates.length !== 1) return null;
    const rate = candidates[0];
    return Number.isFinite(rate.totalGeneralRate) && rate.totalGeneralRate === rate.generalInterstateRate ? rate : null;
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, officialSnapshot };
}
