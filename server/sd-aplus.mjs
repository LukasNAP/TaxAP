import { readOfficialSstStateRates } from "./sst-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

const normalize = (text) => String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export async function readSouthDakotaAplusComparison(stateDetail, { readOfficial = () => readOfficialSstStateRates("SD") } = {}) {
  const officialSnapshot = await readOfficial();
  if (officialSnapshot.stateRate !== 4.2) throw new Error("South Dakota state rate changed; review comparison scope.");
  const cities = new Map();
  for (const rate of officialSnapshot.rates) {
    if (rate.jurisdictionType !== "city") continue;
    const name = normalize(rate.name).replace(/ (?:city|town|village)$/, "");
    // DOR's current municipal table explicitly lists Roslyn at 3% (code 315-2).
    // Its SST/Census place identifier is 56380; do not generalize this exception.
    const reviewedRoslyn = name === "roslyn" && rate.jurisdictionCode === "56380" && rate.componentRate === 3;
    if (!Number.isFinite(rate.componentRate) || rate.componentRate < 0 || (rate.componentRate > 2 && !reviewedRoslyn)) throw new Error("South Dakota general municipal component changed scope.");
    if (cities.has(name)) throw new Error("South Dakota municipal name is ambiguous.");
    cities.set(name, { ...rate, totalGeneralRate: Number((officialSnapshot.stateRate + rate.componentRate).toFixed(4)) });
  }
  if (!cities.size) throw new Error("South Dakota municipal inventory is empty.");
  return {
    ...reconcileDirectMappingAplus({ stateCode: "SD", stateDetail, matchOfficialRow: (row) => {
      if (!/^SD\d+$/.test(row.taxBody ?? "") || row.taxBody === "SD000" || row.currentRate == null || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
      const name = normalize(row.description).replace(/^south dakota[ -]+/, "");
      return cities.get(name) ?? null;
    } }),
    officialSnapshot,
  };
}
