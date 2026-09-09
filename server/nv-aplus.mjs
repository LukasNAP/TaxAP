import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialSstStateRates } from "./sst-rates.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

// County names establish the scope of the assigned tax body, not the physical
// location of a ship-to. Never interpret Nevada's internal code numbers as FIPS.
const COUNTIES = new Set([
  "carson city", "churchill", "clark", "douglas", "elko", "esmeralda",
  "eureka", "humboldt", "lander", "lincoln", "lyon", "mineral", "nye",
  "pershing", "storey", "washoe", "white pine",
]);
function countyName(value) {
  return String(value ?? "").trim().toLowerCase()
    .replace(/^nevada[\s-]+/, "").replace(/\s+(?:county|co\.?)$/, "")
    .replace(/\s+/g, " ");
}

export async function readNevadaAplusComparison(stateDetail, {
  readOfficial = () => readOfficialSstStateRates("NV"),
} = {}) {
  const officialSnapshot = await readOfficial();
  const counties = new Map();
  for (const rate of officialSnapshot.rates) {
    if (rate.jurisdictionType !== "county") continue;
    const name = countyName(rate.name);
    if (!COUNTIES.has(name) || counties.has(name) || !Number.isFinite(rate.totalGeneralRate)) {
      throw new Error("Nevada official county inventory is ambiguous or invalid.");
    }
    counties.set(name, rate);
  }
  if (counties.size !== COUNTIES.size) throw new Error("Nevada requires all 17 official county equivalents.");
  const represented = new Set();
  const result = reconcileDirectMappingAplus({
    stateCode: "NV", stateDetail,
    matchOfficialRow: (row) => {
      if (!/^NV\d+$/.test(row.taxBody ?? "") || row.taxBody === "NV000" || isRetiredTaxBody(row)) return null;
      const name = countyName(row.description);
      const rate = counties.get(name);
      if (!rate) return null;
      if (Number(row.activeShipTos) > 0) represented.add(name);
      return rate;
    },
  });
  return {
    ...result, officialSnapshot,
    unrepresentedOfficialCounties: [...counties].filter(([name]) => !represented.has(name)).map(([, rate]) => rate.name),
  };
}
