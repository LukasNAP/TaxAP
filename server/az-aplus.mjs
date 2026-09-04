import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialAzRates, AZ_CITY_COUNTY } from "./az-rates.mjs";

const AZ_COUNTY_NAMES = new Set([
  "APACHE", "COCHISE", "COCONINO", "GILA", "GRAHAM", "GREENLEE", "LA PAZ", "MARICOPA",
  "MOHAVE", "NAVAJO", "PIMA", "PINAL", "SANTA CRUZ", "YAVAPAI", "YUMA",
]);

// AZ000 ("Arizona no tax", 0%) and ZTEMP ("TAX BODY TEMP USE") are misinputs per the project's
// standing default - confirmed live 2026-08-27, AZ000 is the largest AZ tax-body bucket (47/336).
function isAzMisinput(row) {
  return row.taxBody === "AZ000" || row.taxBody === "ZTEMP";
}

/**
 * Classifies one A+ Arizona tax-body description into either a pure county row (e.g. "Arizona
 * Santa Cruz Co.") or a city, with its real county either named explicitly in the description
 * itself (e.g. "Arizona Taylor Navajo Co", "ARIZONA MARICOPA PINAL CO" - confirmed live 2026-08-27,
 * A+ spells the county out directly for exactly these two codes) or looked up in AZ_CITY_COUNTY
 * when it isn't (every other city code).
 */
function parseAzLocality(description) {
  const withoutPrefix = String(description || "").replace(/^Arizona\s+/i, "").trim().toUpperCase();
  const withoutCoSuffix = withoutPrefix.replace(/\s+CO\.?$/i, "").trim();
  const hadCoSuffix = withoutCoSuffix.length !== withoutPrefix.length;
  // A bare place name with NO "Co"/"Co." suffix is always a city in A+'s own convention, even when
  // it happens to share its name with a county exactly (confirmed live 2026-08-27: "Arizona Yuma"
  // is the City of Yuma, not Yuma County - its rate only matches once county + city are summed).
  // Only an EXPLICIT "Co"/"Co." suffix can mean "this code is a county," and only when nothing
  // else precedes the county name (see the "<City> <County> Co" branch below for the other case).
  if (hadCoSuffix && AZ_COUNTY_NAMES.has(withoutCoSuffix)) return { jurisdictionType: "county", countyName: withoutCoSuffix };
  // "<City> <County> Co" - the last word(s) before "Co"/"Co." name a real AZ county explicitly.
  // Only applies when a "Co"/"Co." suffix was actually present - otherwise a city name that
  // coincidentally ends with a county name would be misparsed.
  for (const countyName of hadCoSuffix ? AZ_COUNTY_NAMES : []) {
    if (withoutCoSuffix.endsWith(` ${countyName}`) && withoutCoSuffix.length > countyName.length + 1) {
      const cityName = withoutCoSuffix.slice(0, withoutCoSuffix.length - countyName.length - 1).trim();
      return { jurisdictionType: "city", cityName, countyName };
    }
  }
  const countyName = AZ_CITY_COUNTY.get(withoutPrefix) ?? null;
  return { jurisdictionType: "city", cityName: withoutPrefix, countyName };
}

export async function readArizonaAplusComparison(stateDetail, { readOfficialAzRates: readOfficial = readOfficialAzRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byCounty = new Map(officialSnapshot.rates.filter((r) => r.jurisdictionType === "county").map((r) => [r.name, r]));
  const byCity = new Map(officialSnapshot.rates.filter((r) => r.jurisdictionType === "city").map((r) => [r.name, r]));

  return {
    ...reconcileDirectMappingAplus({
      stateCode: "AZ",
      stateDetail,
      isMisinput: isAzMisinput,
      matchOfficialRow: (row) => {
        const parsed = parseAzLocality(row.description);
        if (parsed.jurisdictionType === "county") return byCounty.get(parsed.countyName) ?? null;
        const cityRow = byCity.get(parsed.cityName);
        if (!cityRow) return null;
        // Always recompute the total fresh rather than trusting server/az-rates.mjs's own
        // precomputed total, which only used the static AZ_CITY_COUNTY crosswalk - a code whose
        // own description names its real county explicitly (e.g. "Taylor Navajo Co") takes
        // priority over that crosswalk, and may resolve a county the crosswalk doesn't have yet.
        const countyName = parsed.countyName ?? cityRow.county;
        const countyRow = countyName ? byCounty.get(countyName) : null;
        if (!countyRow) return { ...cityRow, totalGeneralRate: null };
        const total = Number((Number(countyRow.totalGeneralRate) + Number(cityRow.componentRate)).toFixed(4));
        return { ...cityRow, name: `${cityRow.name} (${countyName})`, totalGeneralRate: total };
      },
    }),
    officialSnapshot,
  };
}
