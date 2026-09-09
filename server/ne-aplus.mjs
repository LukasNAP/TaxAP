import { readOfficialSstStateRates } from "./sst-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

const normalize = (text) => String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export async function readNebraskaAplusComparison(stateDetail, { readOfficial = () => readOfficialSstStateRates("NE") } = {}) {
  const officialSnapshot = await readOfficial();
  const cities = new Map();
  for (const rate of officialSnapshot.rates.filter((rate) => rate.jurisdictionType === "city")) {
    if (cities.has(rate.jurisdictionCode) || !Number.isFinite(rate.totalGeneralRate)) throw new Error("Nebraska city inventory is duplicated or has unresolved totals.");
    cities.set(rate.jurisdictionCode, rate);
  }
  return {
    ...reconcileDirectMappingAplus({ stateCode: "NE", stateDetail, matchOfficialRow: (row) => {
      const code = /^NE(\d{5})$/.exec(row.taxBody ?? "")?.[1];
      if (!code || isRetiredTaxBody(row) || row.definitionStatus === "missing" || row.currentRate == null) return null;
      const rate = cities.get(code);
      if (!rate) return null;
      const officialName = normalize(rate.name).replace(/ (?:city|town|village)$/, "");
      const assignedName = normalize(row.description).replace(/^nebraska[ -]+/, "");
      // Both identifiers must agree. A plausible numeric suffix alone is not a crosswalk.
      return assignedName === officialName ? rate : null;
    } }),
    officialSnapshot,
  };
}
