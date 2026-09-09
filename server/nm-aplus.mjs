import { readOfficialNmRates } from "./nm-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export async function readNewMexicoAplusComparison(stateDetail, { readOfficial = readOfficialNmRates } = {}) {
  const officialSnapshot = await readOfficial();
  const locations = new Map();
  for (const rate of officialSnapshot.rates) {
    if (!/^\d{2}-\d{3}$/.test(rate.locationCode) || locations.has(rate.locationCode) ||
        !Number.isFinite(rate.totalGeneralRate)) {
      throw new Error("New Mexico GRT inventory has invalid or duplicate locations or unresolved rates.");
    }
    locations.set(rate.locationCode, rate);
  }
  const result = reconcileDirectMappingAplus({ stateCode: "NM", stateDetail, matchOfficialRow: (row) => {
    const code = /^NM(\d{2})(\d{3})$/.exec(row.taxBody ?? "");
    if (!code || isRetiredTaxBody(row) || row.definitionStatus === "missing" ||
        row.currentRate == null || !Number.isFinite(Number(row.currentRate))) return null;
    const rate = locations.get(`${code[1]}-${code[2]}`);
    if (!rate || rate.jurisdictionType !== "city") return null;
    const assignedName = normalize(row.description).replace(/^(?:new mexico|nm)[ -]+/, "");
    // Preserve county qualifiers and special-district identities; never use prefix matching.
    const officialName = normalize(rate.name).replace(/ \(city\)$/, "");
    return assignedName === officialName ? { ...rate, name: `${rate.name} (GRT)` } : null;
  } });
  result.totals.comparedShipTos = result.findings.filter((row) => row.matched)
    .reduce((sum, row) => sum + Number(row.activeShipTos || 0), 0);
  return { ...result, officialSnapshot };
}
