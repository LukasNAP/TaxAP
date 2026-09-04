import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { FLORIDA_COUNTIES, readOfficialFlRates } from "./fl-rates.mjs";

// IMPORTANT: FL### is NOT a reliable alphabetical index into FLORIDA_COUNTIES - an earlier
// investigation claimed this and it held for 4 spot-checked codes (FL011 Collier, FL017 Flagler,
// FL023 Hamilton, FL050 Palm Beach), but a full live run (2026-08-27) found real counterexamples:
// FL055's own TBTXNAM says "Florida St. Johns" (St. Johns is alphabetically 58th, not 55th) and
// FL058 says "Florida Sarasota" (56th, not 58th) - the numbers don't reliably encode alphabetical
// position. Matching by the real county NAME A+ already put in TBTXNAM is the only safe approach -
// exactly the lesson this project has hit before (NE's "config-only" claim, also wrong until
// actually run). The numeric code is not used for matching at all here, only for display.
const FLORIDA_COUNTY_SET = new Set(FLORIDA_COUNTIES);

function normalizeFloridaCountyName(value) {
  return String(value || "")
    .replace(/^Florida\s+/i, "")
    .replace(/\bSt\.?\b/gi, "ST")
    .replace(/[^A-Za-z0-9 -]/g, "")
    .trim()
    .toUpperCase();
}

function floridaCountyForTaxBody(row) {
  const name = normalizeFloridaCountyName(row.description);
  return FLORIDA_COUNTY_SET.has(name) ? name : null;
}

// FL000 has no XATXBD definition at all (confirmed live, 1/1,479 active ship-tos) - a misinput
// per the project's standing default, not a real jurisdiction. Every other FLNNN code either maps
// to a real county above or isn't a recognized FL code at all (excluded as unmatched, not guessed).
function isFloridaMisinput(row) {
  return row.taxBody === "FL000" || row.definitionStatus === "missing";
}

export async function readFloridaAplusComparison(stateDetail, { readOfficialFlRates: readOfficial = readOfficialFlRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byCounty = new Map(officialSnapshot.rates.map((rate) => [rate.county, rate]));
  return {
    ...reconcileDirectMappingAplus({
      stateCode: "FL",
      stateDetail,
      isMisinput: isFloridaMisinput,
      matchOfficialRow: (row) => {
        const county = floridaCountyForTaxBody(row);
        return county ? byCounty.get(county) ?? null : null;
      },
    }),
    officialSnapshot,
  };
}
