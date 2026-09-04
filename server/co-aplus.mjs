import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialCoRates } from "./co-rates.mjs";

function normalize(value) {
  return String(value || "")
    .replace(/^Colorado\s+/i, "")
    .replace(/^Ft\.?\s+/i, "Fort ")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

const NAME_ALIASES = new Map([
  ["CEDAREDGE", "CEDAREDGE"],
  ["STEAMBOAT SPRING", "STEAMBOAT SPRINGS"],
]);

function canonicalName(value) {
  const name = normalize(value);
  return NAME_ALIASES.get(name) ?? name;
}

// Colorado DOR denotes several distinct slices of the same city by appending a parenthetical
// qualifier (for example, "COLORADO SPRINGS (COMMERCIAL AERONAUTICAL ZONE)"). A bare A+ city
// description must see those variants too; otherwise selecting the plain official row would be a
// silent, false claim that the rate applies everywhere in the city.
function officialBaseName(value) {
  return canonicalName(String(value || "").replace(/\s*\(.+$/, ""));
}

function parseColoradoDescription(description) {
  const raw = String(description || "").replace(/^Colorado\s+/i, "").trim();
  if (!raw) return null;
  const parentheticalCounty = raw.match(/^(.*?)\s*\(([^)]*)$/);
  if (parentheticalCounty) return { name: canonicalName(parentheticalCounty[1]), county: canonicalName(parentheticalCounty[2]) };
  const trailingCounty = raw.match(/^(.*?)\s+([A-Za-z]+)\s+C(?:O\.?|$)/i);
  if (trailingCounty) return { name: canonicalName(trailingCounty[1]), county: canonicalName(trailingCounty[2]) };
  if (/\s+CO\.?$/i.test(raw)) return null; // County-wide/unincorporated label: no unique official location total.
  return { name: canonicalName(raw), county: null };
}

function coloradoOfficialRowFor(row, officialSnapshot) {
  const numericCode = String(row.taxBody || "").match(/^CO(\d{6})$/i)?.[1];
  if (numericCode) return officialSnapshot.rates.find((rate) => rate.jurisdictionCode === numericCode) ?? null;

  const parsed = parseColoradoDescription(row.description);
  if (!parsed) return null;
  const candidates = officialSnapshot.rates.filter((rate) => (
    officialBaseName(rate.name) === parsed.name
    && (!parsed.county || canonicalName(rate.county) === parsed.county)
  ));
  return candidates.length === 1 ? candidates[0] : null;
}

function isColoradoMisinputOrSpecialCategory(row) {
  return row.definitionStatus === "missing"
    || row.taxBody === "CO CR"
    || row.taxBody === "ZTEMP"
    || /E$/i.test(String(row.taxBody || ""));
}

export async function readColoradoAplusComparison(stateDetail, { readOfficialCoRates: readOfficial = readOfficialCoRates } = {}) {
  const officialSnapshot = await readOfficial();
  return {
    ...reconcileDirectMappingAplus({
      stateCode: "CO",
      stateDetail,
      isMisinput: isColoradoMisinputOrSpecialCategory,
      matchOfficialRow: (row) => coloradoOfficialRowFor(row, officialSnapshot),
    }),
    officialSnapshot,
  };
}
