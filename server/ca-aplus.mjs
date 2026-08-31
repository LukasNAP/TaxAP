import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialCaRates } from "./ca-rates.mjs";

// California's A+ descriptions are intentionally the only source used to classify a tax body as
// a county or a city.  We do not infer a county from a ship-to's mailing city or ZIP: CDTFA's
// own address lookup exists precisely because those are not reliable jurisdiction boundaries.
function normalize(value) {
  return String(value || "")
    .replace(/^Calif(?:ornia)?\s+/i, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

// These are literal A+ spelling/truncation variants confirmed in the aggregate tax-body snapshot
// on 2026-08-28.  They are not geographic guesses; each maps a tax body's self-described place
// name to the corresponding CDTFA spelling.
const LOCALITY_ALIASES = new Map([
  ["SAN BERN", "SAN BERNARDINO"],
  ["SAN BERNADINO", "SAN BERNARDINO"],
  ["CARMELBYTHESEA", "CARMEL BY THE SEA"],
  ["COMMERCE", "CITY OF COMMERCE"],
  ["LAHABRA", "LA HABRA"],
  ["LAPALMA", "LA PALMA"],
  ["SCOTT S VALLEY", "SCOTTS VALLEY"],
  ["SANTA FE SPRIN", "SANTA FE SPRINGS"],
  ["W SACRAMENTO", "WEST SACRAMENTO"],
]);

function canonicalLocality(value) {
  const normalized = normalize(value);
  return LOCALITY_ALIASES.get(normalized) ?? normalized;
}

function parseCaliforniaLocality(description) {
  const raw = String(description || "").replace(/^Calif(?:ornia)?\s+/i, "").trim();
  if (!raw) return null;

  // A+ consistently marks unincorporated/county tax bodies with Co, Co., or its one-character
  // field-length truncation (e.g. "Contra Costa C").  "UNINCO" is an additional county marker.
  const countyMatch = raw.match(/^(.*?)\s+(?:CO\.?|C)(?:\s+UNINCO)?$/i);
  if (countyMatch || /\s+UNINCO$/i.test(raw)) {
    const name = canonicalLocality((countyMatch?.[1] ?? raw).replace(/\s+UNINCO$/i, ""));
    return name ? { jurisdictionType: "county", name } : null;
  }

  // Several city descriptions were stored without the closing parenthesis because of the legacy
  // field width ("Sacramento(Cty", "Fresno (City").  The marker is meaningful and removes the
  // city/county duplicate ambiguity; a bare name is treated as a city only when CDTFA has exactly
  // one city row with that name.
  const cityName = raw
    .replace(/\s*\((?:CITY|CTY)\)?$/i, "")
    // One A+ code reads "Ukiah (Mendoci"; that is an explicitly named auxiliary county hint,
    // not part of the municipality name.  A county hint is not needed when the CDTFA city row is
    // unique, so discard it rather than fabricate a county from the truncated text.
    .replace(/\s*\([^)]*$/i, "")
    .trim();
  const name = canonicalLocality(cityName);
  return name ? { jurisdictionType: "city", name } : null;
}

function isCaliforniaMisinputOrSpecialCategory(row) {
  // CA000/CA001/CA003 lack any configured A+ definition.  Per the standing project decision,
  // missing definition rows are visible misinputs, never silently compared as a zero rate.
  // E-suffixed tax bodies are equipment-category variants (CA1034E is confirmed live); CDTFA's
  // general sales/use rate table is not comparable to them.
  return row.definitionStatus === "missing" || /E$/i.test(String(row.taxBody || ""));
}

function californiaOfficialRowFor(row, officialSnapshot) {
  const locality = parseCaliforniaLocality(row.description);
  if (!locality) return null;
  const candidates = officialSnapshot.rates.filter((candidate) => (
    candidate.jurisdictionType === locality.jurisdictionType
    && canonicalLocality(locality.jurisdictionType === "county" ? candidate.county : candidate.name) === locality.name
  ));
  // If CDTFA has more than one same-named city (in different counties), a tax-body description
  // alone does not tell us which one A+ means.  Keep it unmatched rather than choose a county.
  return candidates.length === 1 ? candidates[0] : null;
}

export async function readCaliforniaAplusComparison(stateDetail, { readOfficialCaRates: readOfficial = readOfficialCaRates } = {}) {
  const officialSnapshot = await readOfficial();
  return {
    ...reconcileDirectMappingAplus({
      stateCode: "CA",
      stateDetail,
      isMisinput: isCaliforniaMisinputOrSpecialCategory,
      matchOfficialRow: (row) => californiaOfficialRowFor(row, officialSnapshot),
    }),
    officialSnapshot,
  };
}
