import { readOfficialScRates } from "./sc-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";
const normalize = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export async function readSouthCarolinaAplusComparison(stateDetail, { readOfficial = readOfficialScRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byName = new Map();
  for (const rate of officialSnapshot.rates) {
    const name = normalize(rate.jurisdictionType === "county" ? `${rate.county} county` : rate.municipality);
    byName.set(name, [...(byName.get(name) ?? []), rate]);
  }
  const result = reconcileDirectMappingAplus({ stateCode: "SC", stateDetail, matchOfficialRow: (row) => {
    if (!/^SC\d+[A-Z]?$/.test(row.taxBody ?? "") || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
    const name = normalize(row.description).replace(/^sc \d{5}\s+/, "").replace(/^south carolina\s+/, "").replace(/ co\.?$/, " county");
    const candidates = byName.get(name) ?? [];
    if (candidates.length !== 1 || candidates[0].multiCounty || !Number.isFinite(candidates[0].totalGeneralRate)) return null;
    return candidates[0];
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, officialSnapshot };
}
