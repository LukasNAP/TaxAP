import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialAlRates, AL_STATE_RATE } from "./al-rates.mjs";

// AL000 (no XATXBD definition) is a misinput per the project's standing default. Codes ending in
// "E" (equipment-tax variant, e.g. AL7049E) and any description naming a Police Jurisdiction ("PJ")
// are out of scope per Lukas's confirmed decision (general sales rate only) - excluded the same way
// a misinput is, though they're a scope choice, not a data error.
function isAlOutOfScope(row) {
  if (row.taxBody === "AL000" || row.definitionStatus === "missing") return true;
  if (/E$/.test(row.taxBody) && row.taxBody !== "ALE") return true;
  if (/\bPJ\b/i.test(row.description || "")) return true;
  return false;
}

function extractAlCode(taxBody) {
  return String(taxBody || "").match(/^AL(\d+)$/)?.[1] ?? null;
}

// Strips A+'s own qualifiers ("Co.", "Co", "(Uninc)", "Unincorp", "CL", parenthetical county
// hints) to get the bare place name for a cross-check against the CSV's own locality name -
// this never decides the RATE, only whether the numeric code's CSV row plausibly names the same
// place A+ says it does (see readArizonaAplusComparison-style safety net below).
function alExpectedNameToken(description) {
  const withoutPrefix = String(description || "").replace(/^Alabama\s+/i, "").trim();
  const withoutParen = withoutPrefix.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const withoutQualifiers = withoutParen.replace(/\s+(?:Co\.?|County|Unincorp\.?|CL)$/i, "").trim();
  return withoutQualifiers.toUpperCase();
}

// A handful of A+ codes for cities spanning more than one county explicitly name the county in a
// parenthetical hint (e.g. "Birmingham (Jeffe...", "Moody (St Clair)") - confirmed live 2026-08-27.
// When present, this is more reliable than the CSV row's own "County Number" field, which can be a
// multi-county placeholder value that doesn't correspond to any single real county (confirmed for
// Birmingham, whose own CSV row carries county number 69 - not Jefferson's 37 or Shelby's 58).
function alCountyHint(description) {
  const match = String(description || "").match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}

export async function readAlabamaAplusComparison(stateDetail, { readOfficialAlRates: readOfficial = readOfficialAlRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byCode = new Map(officialSnapshot.rates.map((rate) => [rate.localityCode ?? rate.jurisdictionCode, rate]));
  const countyRatesByName = officialSnapshot.countyRatesByName ?? Object.fromEntries(
    officialSnapshot.rates
      .filter((rate) => rate.jurisdictionType === "county")
      .map((rate) => [String(rate.name).replace(/\s+COUNTY$/i, "").toUpperCase(), Number(rate.componentRate)]),
  );

  return {
    ...reconcileDirectMappingAplus({
      stateCode: "AL",
      stateDetail,
      isMisinput: isAlOutOfScope,
      matchOfficialRow: (row) => {
        const code = extractAlCode(row.taxBody);
        if (!code) return null;
        const csvRow = byCode.get(code);
        if (!csvRow) return null;
        const expectedToken = alExpectedNameToken(row.description);
        const nameMatches = expectedToken.length > 0 && csvRow.name.toUpperCase().includes(expectedToken.slice(0, Math.min(6, expectedToken.length)));
        if (!nameMatches) return null; // the code number was reused for something else - don't guess
        const countyHint = alCountyHint(row.description);
        const hintedCountyName = countyHint
          ? Object.keys(countyRatesByName).find((name) => name.startsWith(countyHint.slice(0, Math.min(4, countyHint.length))))
          : null;
        if (hintedCountyName && csvRow.jurisdictionType === "city") {
          const total = Number((Number(csvRow.componentRate) + countyRatesByName[hintedCountyName] + AL_STATE_RATE).toFixed(4));
          return { ...csvRow, name: `${csvRow.name} (${hintedCountyName})`, totalGeneralRate: total };
        }
        return csvRow;
      },
    }),
    officialSnapshot,
  };
}
