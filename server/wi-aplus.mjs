import { readOfficialSstStateRates } from "./sst-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export async function readWisconsinAplusComparison(stateDetail, { readOfficial = () => readOfficialSstStateRates("WI") } = {}) {
  const officialSnapshot = await readOfficial();
  const counties = new Map();
  for (const rate of officialSnapshot.rates.filter((rate) => rate.jurisdictionType === "county")) {
    const name = normalize(rate.name).replace(/ county$/, "");
    if (counties.has(name) || !Number.isFinite(rate.totalGeneralRate)) throw new Error("Wisconsin county source is ambiguous or invalid.");
    counties.set(name, rate);
  }
  if (counties.size !== 72) throw new Error("Wisconsin requires all 72 official counties.");
  const milwaukeeCities = officialSnapshot.rates.filter((rate) => rate.jurisdictionType === "city" && normalize(rate.name) === "milwaukee city");
  if (milwaukeeCities.length !== 1 || !Number.isFinite(milwaukeeCities[0].componentRate)) throw new Error("Wisconsin Milwaukee city component is missing or ambiguous.");
  return {
    ...reconcileDirectMappingAplus({ stateCode: "WI", stateDetail, matchOfficialRow: (row) => {
      if (!/^WI\d+$/.test(row.taxBody ?? "") || row.taxBody === "WI000" || row.currentRate == null || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
      const name = normalize(row.description).replace(/^wisconsin[ -]+/, "");
      if (name === "city of milwaukee" || name === "milwaukee city") {
        const county = counties.get("milwaukee");
        if (!county) return null;
        return { ...milwaukeeCities[0], name: "City of Milwaukee (state, county and city)", totalGeneralRate: Number((county.totalGeneralRate + milwaukeeCities[0].componentRate).toFixed(4)) };
      }
      const countyName = /^(.*) (?:county|co\.?)$/.exec(name)?.[1];
      // The saved Milwaukee County group may include deliveries inside the city.
      // Do not certify that group against the lower county-only rate.
      if (!countyName || countyName === "milwaukee") return null;
      return counties.get(countyName) ?? null;
    } }),
    officialSnapshot,
  };
}
