import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialSstStateRates } from "./sst-rates.mjs";

// Confirmed live 2026-08-26/27 (see docs/states/oh.md, docs/pending-business-decisions.md): A+'s
// OH001-OH088 codes map 1:1 to real Ohio counties by name - TBTXNAM literally spells "OHIO <county>
// CO." (e.g. "OHIO KNOX CO."), while the official SST file's rows are named "<County> County" (Title
// Case). Matching by the real county name (not the numeric code) is the safe, verified approach.
function normalizeOhioCountyName(value) {
  return String(value || "")
    .replace(/^OHIO\s+/i, "")
    .replace(/\bCO\.?$/i, "")
    .replace(/\bCOUNTY$/i, "")
    .replace(/[^A-Za-z ]/g, "")
    .trim()
    .toUpperCase();
}

// OH000 ("Ohio", implausible flat 0%, not DO-NOT-USE-tagged) is a misinput per the project's
// standing default - it does not represent any real Ohio county.
function isOhioMisinput(row) {
  return row.taxBody === "OH000";
}

// Real, confirmed comparability wrinkle (Step 2, docs/states/oh.md): ~16 Ohio counties have a
// county-coextensive transit-authority (RTA) surcharge that the official SST file reports as a
// SEPARATE "special" jurisdiction row, not folded into the county row's own total - even though
// A+'s single TBCRATE already correctly includes it. Comparing A+ only against the bare county row
// would falsely flag every one of those counties as stale. A live 2026-08-27 run found the crosswalk:
// the special row's jurisdictionCode is "<A+'s own OH### number, no leading zero>000" (e.g. Franklin
// is OH025 and its surcharge is special code "25000"; Cuyahoga is OH018 -> "18000") - confirmed
// against 10 of Ohio's counties by exact rate match before trusting this pattern. A handful of
// special codes (87100, 93000, 94000, 96000, 98000) don't correspond to any real OH001-OH088 number
// and are left unmapped - they don't affect any active ship-to today (no A+ code exists past OH088).
function ohioTransitSurchargeCode(taxBody) {
  const match = String(taxBody || "").match(/^OH(\d{3})$/);
  if (!match) return null;
  const countyNumber = Number(match[1]);
  return `${String(countyNumber).padStart(2, "0")}000`;
}

export async function readOhioAplusComparison(stateDetail, { readOfficialSstStateRates: readOfficial = readOfficialSstStateRates } = {}) {
  const officialSnapshot = await readOfficial("OH");
  const byCounty = new Map(
    officialSnapshot.rates
      .filter((rate) => rate.jurisdictionType === "county")
      .map((rate) => [normalizeOhioCountyName(rate.name), rate]),
  );
  const bySpecialCode = new Map(
    officialSnapshot.rates
      .filter((rate) => rate.jurisdictionType === "special")
      .map((rate) => [rate.jurisdictionCode, rate]),
  );

  return {
    ...reconcileDirectMappingAplus({
      stateCode: "OH",
      stateDetail,
      isMisinput: isOhioMisinput,
      matchOfficialRow: (row) => {
        const county = byCounty.get(normalizeOhioCountyName(row.description));
        if (!county) return null;
        const surcharge = bySpecialCode.get(ohioTransitSurchargeCode(row.taxBody));
        if (!surcharge) return county;
        return {
          ...county,
          name: `${county.name} (incl. transit-authority surcharge)`,
          totalGeneralRate: Number((Number(county.totalGeneralRate) + Number(surcharge.componentRate)).toFixed(4)),
        };
      },
    }),
    officialSnapshot,
  };
}
