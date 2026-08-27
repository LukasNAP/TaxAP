import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialVaRates } from "./va-rates.mjs";

// Confirmed live 2026-08-26/27 (see docs/states/va.md): A+'s TBTXNAM reads "Virginia <Locality>"
// for a county (no suffix) and "Virginia <Locality> (city)" for the small number of independent
// cities that share a name with a county (Fairfax, Franklin, Richmond, Roanoke, and the legacy
// Bedford code). Every other independent city (Waynesboro, Norfolk, Virginia Beach, ...) has no
// name-duplicate county and is just "Virginia <City>" with no suffix at all - Virginia's own
// workbook distinguishes County vs. City by a literal suffix on the locality name, so matching by
// that real convention (not a guess) resolves the disambiguation correctly either way.
function parseVirginiaLocality(description) {
  // One live code (VA205) reads "Virginia-Danville" with a hyphen instead of the usual space -
  // confirmed live 2026-08-27, a cosmetic inconsistency in A+'s own data, not a parsing bug to
  // work around silently; handled explicitly here rather than guessed at.
  const withoutPrefix = String(description || "").replace(/^Virginia[\s-]+/i, "").trim();
  const cityMatch = withoutPrefix.match(/^(.*)\s\(city\)$/i);
  return cityMatch ? { bareName: cityMatch[1].trim(), isCitySuffixed: true } : { bareName: withoutPrefix, isCitySuffixed: false };
}

export async function readVirginiaAplusComparison(stateDetail, { readOfficialVaRates: readOfficial = readOfficialVaRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byBareName = new Map();
  for (const rate of officialSnapshot.rates) {
    if (!byBareName.has(rate.bareName)) byBareName.set(rate.bareName, {});
    byBareName.get(rate.bareName)[rate.jurisdictionType] = rate;
  }

  return {
    ...reconcileDirectMappingAplus({
      stateCode: "VA",
      stateDetail,
      matchOfficialRow: (row) => {
        const { bareName, isCitySuffixed } = parseVirginiaLocality(row.description);
        const candidates = byBareName.get(bareName);
        if (!candidates) return null;
        // A+'s "(city)" suffix only appears for the small set of real name-duplicate pairs, where
        // Virginia's own workbook has both a County and a City row for the same bare name - use it
        // to pick the right one. Every other city has no County row to disambiguate against at all,
        // so its City row is the only real candidate regardless of the (absent) suffix.
        if (isCitySuffixed) return candidates.city ?? null;
        return candidates.county ?? candidates.city ?? null;
      },
    }),
    officialSnapshot,
  };
}
