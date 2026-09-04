import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { readOfficialTxRates } from "./tx-rates.mjs";

function normalize(value) {
  return String(value || "")
    .replace(/^Texas\s+/i, "")
    .replace(/\bCounty\b/gi, "Co")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

// A+ descriptions contain a mix of bare cities ("Texas Dallas") and explicit county slices
// ("Texas Carrollton(CollinCo", "Texas Fort Worth/Wise Co"). We only use an explicit county
// hint when A+ itself supplies it; a bare city never gets assigned to an arbitrary county.
function parseTexasDescription(description) {
  const raw = String(description || "").replace(/^Texas\s+/i, "").trim();
  if (!raw) return null;
  const parenthetical = raw.match(/\(([^)]*)/);
  const slashCounty = raw.match(/\/\s*([^/]+?)(?:\s+Co\b|$)/i);
  const trailingCounty = raw.match(/\s+([A-Za-z][A-Za-z .'-]*?)\s+C(?:O\.?|\b)/i);
  const countyHint = normalize(parenthetical?.[1] ?? slashCounty?.[1] ?? trailingCounty?.[1]).replace(/CO$/, "");
  const locality = raw
    .replace(/\(.*$/, "")
    .replace(/\/.*$/, "")
    .replace(/\s+[A-Za-z][A-Za-z .'-]*?\s+C(?:O\.?|\b).*$/i, "")
    .trim();
  return locality ? { locality: normalize(locality), countyHint: countyHint || null } : null;
}

function officialLocalityName(row) {
  return normalize(String(row.name || "").replace(/\(.*$/, "").replace(/\/.*$/, ""));
}

function rateValues(rows) {
  return [...new Set(rows.map((row) => Number(row.totalGeneralRate)))];
}

function texasOfficialRowFor(row, officialSnapshot) {
  const parsed = parseTexasDescription(row.description);
  if (!parsed) return null;
  const candidates = officialSnapshot.rates.filter((candidate) => officialLocalityName(candidate) === parsed.locality);
  if (candidates.length === 0) return null;

  if (parsed.countyHint) {
    return candidates.find((candidate) => normalize(candidate.county) === parsed.countyHint) ?? null;
  }
  if (candidates.length === 1) return candidates[0];

  const rates = rateValues(candidates);
  if (rates.length === 1) {
    return { ...candidates[0], name: `${candidates[0].name} (${candidates.length} official variants; same rate)` };
  }

  // A bare official locality is a directly named candidate. If A+'s rate matches no candidate,
  // it is a confirmed discrepancy regardless of the county slice; use that exact bare row for a
  // legible comparison. If A+ matches one candidate, the address is still ambiguous and stays
  // unmatched rather than pretending the code identifies a county.
  const aplusRate = Number(row.currentRate);
  if (!rates.includes(aplusRate)) {
    const bareOfficial = candidates.find((candidate) => normalize(candidate.name) === parsed.locality);
    return bareOfficial ? { ...bareOfficial, name: `${bareOfficial.name} (A+ matches no official candidate)` } : null;
  }
  return null;
}

function isTexasMisinput(row) {
  return row.taxBody === "TX000" || row.definitionStatus === "missing";
}

export async function readTexasAplusComparison(stateDetail, { readOfficialTxRates: readOfficial = readOfficialTxRates } = {}) {
  const officialSnapshot = await readOfficial();
  return {
    ...reconcileDirectMappingAplus({
      stateCode: "TX",
      stateDetail,
      isMisinput: isTexasMisinput,
      matchOfficialRow: (row) => texasOfficialRowFor(row, officialSnapshot),
    }),
    officialSnapshot,
  };
}
