import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialAlRates, AL_STATE_RATE } from "./al-rates.mjs";
import { aggregateAlMatchDiagnostic } from "./al-match-diagnostic.mjs";

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
  const withoutParen = withoutPrefix.replace(/\s*\([^)]*\)?\s*$/, "").trim();
  const withoutQualifiers = withoutParen.replace(/\s+(?:Co\.?|County|Unincorp\.?|CL)$/i, "").trim();
  return withoutQualifiers.toUpperCase();
}

// A handful of A+ codes for cities spanning more than one county explicitly name the county in a
// parenthetical hint (e.g. "Birmingham (Jeffe...", "Moody (St Clair)") - confirmed live 2026-08-27.
// When present, this is more reliable than the CSV row's own "County Number" field, which can be a
// multi-county placeholder value that doesn't correspond to any single real county (confirmed for
// Birmingham, whose own CSV row carries county number 69 - not Jefferson's 37 or Shelby's 58).
function alCountyHint(description) {
  const match = String(description || "").match(/\(([^)]*)\)?\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}

export async function readAlabamaAplusComparison(stateDetail, { readOfficialAlRates: readOfficial = readOfficialAlRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byCode = new Map();
  const countyComponents = new Map();
  for (const rate of officialSnapshot.rates) {
    // PJ entries can share a locality code with the corporate-limits row.
    if (!["county", "city"].includes(rate.jurisdictionType)) continue;
    const code = rate.localityCode ?? rate.jurisdictionCode;
    byCode.set(code, [...(byCode.get(code) ?? []), rate]);
    if (rate.jurisdictionType === "county") {
      const name = String(rate.name).replace(/\s+COUNTY$/i, "").toUpperCase();
      countyComponents.set(name, [...(countyComponents.get(name) ?? []), rate.componentRate]);
    }
  }
  const countyRatesByName = officialSnapshot.countyRatesByName ?? Object.fromEntries(
    [...countyComponents].filter(([, components]) => components.every(value => Number.isFinite(value) && value === components[0]))
      .map(([name, components]) => [name, components[0]]),
  );
  const diagnostics = new Map();
  const countyRows = officialSnapshot.rates.filter(rate => rate.jurisdictionType === 'county');
  const countyName = rate => String(rate.name).replace(/\s+COUNTY$/i, '').toUpperCase();
  function record(row, reason, candidates = [], candidateBasis = 'locality-code') {
    const expectedName = alExpectedNameToken(row.description);
    diagnostics.set(row.taxBody, aggregateAlMatchDiagnostic({
      stateCode: 'AL', reason, candidateBasis, localityCode: extractAlCode(row.taxBody), expectedName,
      nameCheckToken: expectedName.slice(0, Math.min(6, expectedName.length)), countyHint: alCountyHint(row.description),
      source: officialSnapshot,
      candidates: candidates.map(rate => ({ ...rate,
        localityCode: rate.localityCode ?? rate.jurisdictionCode,
        countyReferences: rate.countyCode ? countyRows.filter(county => (county.localityCode ?? county.jurisdictionCode) === rate.countyCode)
          .map(county => ({ name: county.name, localityCode: county.localityCode ?? county.jurisdictionCode, componentRate: county.componentRate })) : [],
      })).sort((a, b) => JSON.stringify([a.localityCode, a.countyCode, a.name, a.componentRate]).localeCompare(JSON.stringify([b.localityCode, b.countyCode, b.name, b.componentRate]))),
    }));
  }

  const reconciliation = reconcileDirectMappingAplus({
      stateCode: "AL",
      stateDetail,
      isMisinput: isAlOutOfScope,
      matchOfficialRow: (row) => {
        const code = extractAlCode(row.taxBody);
        if (!code) { record(row, 'unsupported_code'); return null; }
        const codeCandidates = byCode.get(code) ?? [];
        if (codeCandidates.length !== 1) {
          record(row, codeCandidates.length ? 'multiple_locality_rows' : 'locality_code_not_found', codeCandidates);
          return codeCandidates.length ? { name: row.description, totalGeneralRate: null, identityStatus: "ambiguous" } : null;
        }
        const csvRow = codeCandidates[0];
        const expectedToken = alExpectedNameToken(row.description);
        const nameMatches = expectedToken.length > 0 && csvRow.name.toUpperCase().includes(expectedToken.slice(0, Math.min(6, expectedToken.length)));
        if (!nameMatches) { record(row, 'name_mismatch', codeCandidates); return null; } // don't guess from code alone
        const countyHint = alCountyHint(row.description);
        const countyCandidates = countyHint
          ? Object.keys(countyRatesByName).filter((name) => name.startsWith(countyHint))
          : [];
        if (countyHint !== null && (!countyHint || countyCandidates.length !== 1)) {
          record(row, !countyHint ? 'empty_county_hint' : countyCandidates.length > 1 ? 'county_hint_ambiguous' : 'county_hint_not_found',
            countyRows.filter(rate => countyCandidates.includes(countyName(rate))), 'county-hint');
          return { name: row.description, totalGeneralRate: null, identityStatus: countyCandidates.length > 1 ? "ambiguous" : "unresolved" };
        }
        const hintedCountyName = countyCandidates[0] ?? null;
        if (hintedCountyName && csvRow.jurisdictionType === "city") {
          const total = Number((Number(csvRow.componentRate) + countyRatesByName[hintedCountyName] + AL_STATE_RATE).toFixed(4));
          return { ...csvRow, name: `${csvRow.name} (${hintedCountyName})`, totalGeneralRate: total };
        }
        if (csvRow.totalGeneralRate == null) record(row, 'official_rate_unavailable', codeCandidates);
        return csvRow;
      },
    });
  // Excluded groups also get a precise scope explanation, without changing their classification.
  for (const row of reconciliation.misinputAssignments) {
    record(row, row.definitionStatus === 'missing' ? 'missing_definition' : row.taxBody === 'AL000' ? 'excluded_code'
      : /E$/.test(row.taxBody) && row.taxBody !== 'ALE' ? 'equipment_scope' : /\bPJ\b/i.test(row.description || '') ? 'police_jurisdiction_scope' : 'excluded_code', [], 'scope');
  }
  const attach = row => diagnostics.has(row.taxBody) ? { ...row, matchDiagnostic: diagnostics.get(row.taxBody) } : row;
  return { ...reconciliation, findings: reconciliation.findings.map(attach), misinputAssignments: reconciliation.misinputAssignments.map(attach), officialSnapshot };
}
