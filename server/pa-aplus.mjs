import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialPaRates } from "./pa-rates.mjs";

// Confirmed live 2026-08-26/27 (see docs/states/pa.md, docs/pending-business-decisions.md): A+ has
// only 2 real Pennsylvania codes. PA000 ("Pennsylvania") is a generic catch-all standing in for the
// 65 counties that only carry PA's flat statewide base rate - not any one specific county, so it's
// compared against the base rate itself, not a named jurisdiction. PA001 ("Pennsylvania
// Philadelphia") is Philadelphia specifically. No A+ code exists for Allegheny at all (a confirmed,
// separate coverage gap - see the pending-decisions memo - not something this matcher can resolve).
function paOfficialRowFor(row, officialSnapshot) {
  if (row.taxBody === "PA001") {
    return officialSnapshot.rates.find((rate) => rate.name === "Philadelphia") ?? null;
  }
  if (row.taxBody === "PA000") {
    // Any non-Allegheny, non-Philadelphia county's row carries exactly the flat base rate -
    // Franklin is just a stable, alphabetically-uninteresting pick, not a real jurisdiction match.
    const baseRow = officialSnapshot.rates.find((rate) => rate.name !== "Allegheny" && rate.name !== "Philadelphia");
    return baseRow ? { ...baseRow, name: "Pennsylvania (statewide base rate)" } : null;
  }
  return null;
}

export async function readPennsylvaniaAplusComparison(stateDetail, { readOfficialPaRates: readOfficial = readOfficialPaRates } = {}) {
  const officialSnapshot = await readOfficial();
  return {
    ...reconcileDirectMappingAplus({
      stateCode: "PA",
      stateDetail,
      matchOfficialRow: (row) => paOfficialRowFor(row, officialSnapshot),
    }),
    officialSnapshot,
  };
}
