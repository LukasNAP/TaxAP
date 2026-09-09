import { readOfficialSstStateRates } from "./sst-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

const normalize = (text) => String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export async function readWestVirginiaAplusComparison(stateDetail, { readOfficial = () => readOfficialSstStateRates("WV") } = {}) {
  const officialSnapshot = await readOfficial();
  if (officialSnapshot.stateRate !== 6) throw new Error("West Virginia state rate changed; review municipal composition.");
  const cities = new Map();
  for (const rate of officialSnapshot.rates) {
    if (rate.jurisdictionType === "state") continue;
    if (rate.jurisdictionType !== "city" || !Number.isFinite(rate.componentRate) || rate.componentRate < 0 || rate.componentRate > 1) throw new Error("West Virginia municipal source scope changed.");
    const name = normalize(rate.name).replace(/ (?:city|town|village)$/, "");
    if (cities.has(name)) throw new Error("West Virginia municipality name is ambiguous.");
    cities.set(name, { ...rate, totalGeneralRate: Number((officialSnapshot.stateRate + rate.componentRate).toFixed(4)) });
  }
  return {
    ...reconcileDirectMappingAplus({ stateCode: "WV", stateDetail, matchOfficialRow: (row) => {
      if (!/^WV\d+$/.test(row.taxBody ?? "") || ["WV000", "WV961"].includes(row.taxBody) || isRetiredTaxBody(row) || row.currentRate == null || row.definitionStatus === "missing") return null;
      const name = normalize(row.description).replace(/^west virginia[ -]+/, "");
      if (row.taxBody === "WV0100" && /^(?:no local rt\.?|no local rate)$/.test(name)) return { name: "West Virginia — no local rate", totalGeneralRate: officialSnapshot.stateRate };
      return cities.get(name) ?? null;
    } }),
    officialSnapshot,
  };
}
