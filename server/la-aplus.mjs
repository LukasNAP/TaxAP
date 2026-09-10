import { readOfficialLaRates } from "./la-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\bst\.?\s+/g, "saint ").replace(/\s+/g, " ");

export function louisianaAssignedJurisdictions(snapshot) {
  if (snapshot.stateCode !== "LA" || !Array.isArray(snapshot.parishes) || snapshot.parishes.length !== 64 || new Set(snapshot.parishes.map((p) => p.code)).size !== 64) throw new Error("Louisiana requires the complete parish context inventory.");
  const byName = new Map(), groups = new Map();
  const add = (name, rate) => byName.set(name, [...(byName.get(name) ?? []), rate]);
  const keys = new Set();
  for (const rate of snapshot.rates) {
    if (rate.jurisdictionType === "state") continue;
    if (!snapshot.parishes.some((p) => p.code === rate.parishCode) || keys.has(rate.jurisdictionCode) || !Number.isFinite(rate.totalGeneralRate)) throw new Error("Louisiana domicile context or rate is invalid.");
    keys.add(rate.jurisdictionCode);
    groups.set(rate.parishCode, [...(groups.get(rate.parishCode) ?? []), rate]);
    // Individual named cities/districts require an exact, unique source identity.
    // Parish base rows do not establish parish-wide coverage by themselves.
    if (rate.jurisdictionType !== "county") add(normalize(rate.name), rate);
  }
  const parishNames = new Set();
  for (const parish of snapshot.parishes) {
    const name = normalize(parish.name).replace(/ parish$/, "");
    const rows = groups.get(parish.code);
    if (!name || parishNames.has(name) || !rows?.length) throw new Error("Louisiana parish names or domicile coverage are incomplete.");
    parishNames.add(name);
    const uniform = rows.every((r) => r.totalGeneralRate === rows[0].totalGeneralRate);
    const rate = { name: `${parish.name} — parish-wide`, totalGeneralRate: uniform ? rows[0].totalGeneralRate : null };
    add(name, rate);
    add(`${name} parish`, rate);
  }
  return byName;
}

export async function readLouisianaAplusComparison(stateDetail, { readOfficial = readOfficialLaRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byName = louisianaAssignedJurisdictions(officialSnapshot);
  const result = reconcileDirectMappingAplus({ stateCode: "LA", stateDetail, matchOfficialRow: (row) => {
    if (!/^LA\d+$/.test(row.taxBody ?? "") || row.taxBody === "LA000" || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
    const candidates = byName.get(normalize(row.description).replace(/^louisiana[ -]+/, "")) ?? [];
    return candidates.length === 1 ? candidates[0] : null;
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, officialSnapshot, comparisonScope: "sales" };
}
