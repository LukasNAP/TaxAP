import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialNyRates } from "./ny-rates.mjs";

// Confirmed live 2026-08-26/27 (see docs/states/ny.md): A+'s TBTXNAM reads "New York <Locality>
// County" for a county and "New York <Locality> City" for a home-rule city - both suffixes appear
// with real-world abbreviation/truncation noise ("Co." for County, a DB-length-truncated "Cit" for
// City) that this parser tolerates explicitly rather than silently failing to match. New York City
// itself is one combined A+ code ("New York New York City"), matching Publication 718's own single
// combined NYC rate - not 5 separate borough codes.
// One confirmed live cosmetic typo (2026-08-27): NY2911's TBTXNAM reads "Niagra County" - the
// official jurisdiction code (2911) matches Niagara County exactly, removing any doubt this is a
// misspelling of a real place, not a different or ambiguous one - the same cosmetic-typo shape as
// Arkansas's "Arizona Beebe" and Nevada's "Esmaralda". Documented explicitly, not silently guessed.
const KNOWN_TYPO_ALIASES = new Map([["Niagra", "Niagara"]]);

function parseNyLocality(description) {
  const withoutPrefix = String(description || "").replace(/^New York\s+/i, "").trim();
  if (/^New York City$/i.test(withoutPrefix)) return { bareName: "New York City", jurisdictionType: "city" };
  const cityMatch = withoutPrefix.match(/^(.*)\s(?:City|Cit)$/i);
  if (cityMatch) return { bareName: KNOWN_TYPO_ALIASES.get(cityMatch[1].trim()) ?? cityMatch[1].trim(), jurisdictionType: "city" };
  const countyMatch = withoutPrefix.match(/^(.*)\s(?:County|Co\.?)$/i);
  if (countyMatch) return { bareName: KNOWN_TYPO_ALIASES.get(countyMatch[1].trim()) ?? countyMatch[1].trim(), jurisdictionType: "county" };
  // A small number of live codes (e.g. "New York Saratoga Springs") omit the usual County/City
  // suffix entirely - confirmed live 2026-08-27, a real naming inconsistency in A+'s own data, not
  // a parsing gap. These are always real home-rule cities with no county sharing the same bare
  // name (unlike Fairfax/Franklin/Richmond/Roanoke-style duplicates in Virginia), so trying the
  // bare name against the city list is a safe fallback, not a guess.
  const bareName = KNOWN_TYPO_ALIASES.get(withoutPrefix) ?? withoutPrefix;
  return bareName ? { bareName, jurisdictionType: "city", noSuffixFallback: true } : null;
}

// NY000 has no XATXBD definition at all (confirmed live) - a misinput per the project's standing
// default, not a real jurisdiction.
function isNyMisinput(row) {
  return row.taxBody === "NY000" || row.definitionStatus === "missing";
}

export async function readNewYorkAplusComparison(stateDetail, { readOfficialNyRates: readOfficial = readOfficialNyRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byKey = new Map(officialSnapshot.rates.map((rate) => {
    const name = rate.jurisdictionType === "city" ? String(rate.name).replace(/\s+\(city\)$/i, "") : rate.name;
    return [`${rate.jurisdictionType}|${name}`, rate];
  }));

  return {
    ...reconcileDirectMappingAplus({
      stateCode: "NY",
      stateDetail,
      isMisinput: isNyMisinput,
      matchOfficialRow: (row) => {
        const parsed = parseNyLocality(row.description);
        if (!parsed) return null;
        const direct = byKey.get(`${parsed.jurisdictionType}|${parsed.bareName}`);
        if (direct) return direct;
        // Fallback path only fires when neither County/City/Co./Cit suffix was present at all -
        // try the county list too, in case a future no-suffix code turns out to be a county.
        return parsed.noSuffixFallback ? byKey.get(`county|${parsed.bareName}`) ?? null : null;
      },
    }),
    officialSnapshot,
  };
}
