import { createHash } from "node:crypto";
import { readSingleFileZip } from "./zip-utils.mjs";

export const GEORGIA_BOUNDARY_DIRECTORY_URL = "https://www.streamlinedsalestax.org/ratesandboundry/Boundary/";
const GEORGIA_STATE_FIPS = "13";

// Empirically confirmed against the current Georgia boundary archive (GAB2026Q3MAY19.csv, 2,081,787 rows):
// column 1 is the record type; only columns 1-32 ever carry data for Georgia, but the file reserves
// columns through 89. A file with a different total column count has changed schema and must be rejected
// rather than silently misread.
const EXPECTED_COLUMN_COUNT = 89;

const DIRECTIONS = new Map([
  ["N", "N"], ["NORTH", "N"], ["S", "S"], ["SOUTH", "S"], ["E", "E"], ["EAST", "E"], ["W", "W"], ["WEST", "W"],
  ["NE", "NE"], ["NORTHEAST", "NE"], ["NW", "NW"], ["NORTHWEST", "NW"], ["SE", "SE"], ["SOUTHEAST", "SE"], ["SW", "SW"], ["SOUTHWEST", "SW"],
]);

const STREET_SUFFIXES = new Map([
  ["ROAD", "RD"], ["RD", "RD"], ["DRIVE", "DR"], ["DR", "DR"], ["STREET", "ST"], ["ST", "ST"], ["LANE", "LN"], ["LN", "LN"],
  ["AVENUE", "AVE"], ["AVE", "AVE"], ["COURT", "CT"], ["CT", "CT"], ["CIRCLE", "CIR"], ["CIR", "CIR"], ["WAY", "WAY"],
  ["HIGHWAY", "HWY"], ["HWY", "HWY"], ["PARKWAY", "PKWY"], ["PKWY", "PKWY"], ["BOULEVARD", "BLVD"], ["BLVD", "BLVD"],
  ["TRAIL", "TRL"], ["TRL", "TRL"], ["PLACE", "PL"], ["PL", "PL"], ["TRACE", "TRCE"], ["TRCE", "TRCE"], ["TERRACE", "TER"], ["TER", "TER"],
  ["LOOP", "LOOP"], ["CROSSING", "XING"], ["XING", "XING"], ["RUN", "RUN"], ["RIDGE", "RDG"], ["RDG", "RDG"], ["EXTENSION", "EXT"], ["EXT", "EXT"],
  ["WALK", "WALK"], ["COVE", "CV"], ["CV", "CV"], ["POINT", "PT"], ["PT", "PT"], ["PATH", "PATH"], ["SQUARE", "SQ"], ["SQ", "SQ"],
  ["PASS", "PASS"], ["BEND", "BND"], ["BND", "BND"], ["PARK", "PARK"], ["LANDING", "LNDG"], ["LNDG", "LNDG"], ["CENTER", "CTR"], ["CTR", "CTR"],
  ["EXPRESSWAY", "EXPY"], ["EXPY", "EXPY"], ["SPUR", "SPUR"], ["ALLEY", "ALY"], ["ALY", "ALY"], ["VIEW", "VW"], ["VW", "VW"],
  ["GATEWAY", "GTWY"], ["GTWY", "GTWY"], ["PLAZA", "PLZ"], ["PLZ", "PLZ"], ["GLEN", "GLN"], ["GLN", "GLN"], ["HEIGHTS", "HTS"], ["HTS", "HTS"],
  ["HOLLOW", "HOLW"], ["HOLW", "HOLW"],
]);

const SECONDARY_DESIGNATORS = new Map([
  ["APARTMENT", "APT"], ["APT", "APT"], ["SUITE", "STE"], ["STE", "STE"], ["UNIT", "UNIT"], ["LOT", "LOT"], ["BUILDING", "BLDG"], ["BLDG", "BLDG"],
  ["OFFICE", "OFC"], ["OFC", "OFC"], ["FRONT", "FRNT"], ["FRNT", "FRNT"], ["ROOM", "RM"], ["RM", "RM"], ["STOP", "STOP"], ["FLOOR", "FL"], ["FL", "FL"],
  ["REAR", "REAR"], ["LOWER", "LOWR"], ["LOWR", "LOWR"], ["UPPER", "UPPR"], ["UPPR", "UPPR"], ["SIDE", "SIDE"], ["SPACE", "SPC"], ["SPC", "SPC"],
  ["TRAILER", "TRLR"], ["TRLR", "TRLR"], ["LOBBY", "LBBY"], ["LBBY", "LBBY"], ["PENTHOUSE", "PH"], ["PH", "PH"], ["BASEMENT", "BSMT"], ["BSMT", "BSMT"],
]);

function compactDate(value) {
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})$/);
  return match ? `${match[1]}${match[2]}${match[3]}` : null;
}

export function normalizeStreetToken(token) {
  return String(token || "").trim().toUpperCase().replace(/[.,]/g, "");
}

/**
 * Splits a freeform A+ ship-to address line into the components the Streamlined boundary file uses.
 * Returns null when the line cannot be parsed with confidence (no leading house number), so callers
 * fall back to ZIP-level matching instead of guessing.
 */
export function parseShipToStreetLine(line) {
  const tokens = String(line || "").trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const houseNumberMatch = tokens[0].match(/^(\d+)[A-Z]?$/);
  if (!houseNumberMatch) return null;
  const houseNumber = Number(houseNumberMatch[1]);
  let rest = tokens.slice(1);
  let predir = "";
  if (rest.length > 1 && DIRECTIONS.has(rest[0])) {
    predir = DIRECTIONS.get(rest[0]);
    rest = rest.slice(1);
  }
  let postdir = "";
  if (rest.length > 2 && DIRECTIONS.has(rest.at(-1))) {
    postdir = DIRECTIONS.get(rest.at(-1));
    rest = rest.slice(0, -1);
  }
  let suffix = "";
  if (rest.length > 1 && STREET_SUFFIXES.has(rest.at(-1))) {
    suffix = STREET_SUFFIXES.get(rest.at(-1));
    rest = rest.slice(0, -1);
  }
  if (rest.length === 0) return null;
  return { houseNumber, predir, streetName: rest.map(normalizeStreetToken).join(" "), suffix, postdir };
}

/** Parses a secondary-address line (unit/suite/apartment) such as "STE 201". Returns null when not recognized. */
export function parseShipToSecondaryLine(line) {
  const tokens = String(line || "").trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || !SECONDARY_DESIGNATORS.has(tokens[0])) return null;
  const designator = SECONDARY_DESIGNATORS.get(tokens[0]);
  const number = tokens.slice(1).join(" ");
  return { designator, number };
}

export function normalizeZip(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 9) return { zip5: digits.slice(0, 5), zip4: digits.slice(5, 9) };
  if (digits.length >= 5) return { zip5: digits.slice(0, 5), zip4: null };
  return { zip5: null, zip4: null };
}

function matchesOddEven(oddEvenCode, houseNumber) {
  if (oddEvenCode === "B" || !oddEvenCode) return true;
  const isOdd = houseNumber % 2 === 1;
  return oddEvenCode === "O" ? isOdd : !isOdd;
}

function isActive(row, asOfDate) {
  return row.beginDate !== null && row.endDate !== null && row.beginDate <= asOfDate && row.endDate >= asOfDate;
}

/** Builds the set of normalized "city|zip5|predir name suffix postdir" keys worth retaining address-level rows for. */
export function buildWantedAddressKeys(shipToAddresses) {
  const keys = new Set();
  for (const address of shipToAddresses) {
    const parsed = parseShipToStreetLine(address.streetLine);
    if (!parsed) continue;
    const zip = normalizeZip(address.zip);
    if (!zip.zip5) continue;
    keys.add(addressGroupKey(normalizeStreetToken(address.city), zip.zip5, parsed));
  }
  return keys;
}

function addressGroupKey(city, zip5, parsed) {
  return `${city}|${zip5}|${parsed.predir}|${parsed.streetName}|${parsed.suffix}|${parsed.postdir}`;
}

function parseBoundaryLine(line, lineNumber) {
  const columns = line.split(",");
  if (columns.length !== EXPECTED_COLUMN_COUNT) {
    throw new Error(`Boundary row ${lineNumber} has ${columns.length} columns, expected ${EXPECTED_COLUMN_COUNT}.`);
  }
  const recordType = columns[0];
  if (!["A", "Z", "4"].includes(recordType)) return { invalid: true, reason: `unknown record type "${recordType}"` };
  const beginDate = compactDate(columns[1]);
  const endDate = compactDate(columns[2]);
  if (!beginDate || !endDate) return { invalid: true, reason: "unparsable effective date" };
  const fipsState = columns[22];
  if (fipsState !== GEORGIA_STATE_FIPS) return { invalid: true, reason: "unexpected FIPS state code" };
  const base = {
    recordType, beginDate, endDate,
    fipsCounty: columns[24] || null,
    fipsPlace: columns[25] || null,
    specialCode: columns[30] || null,
  };
  if (recordType === "A") {
    const low = Number(columns[3]);
    const high = Number(columns[4]);
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      // Alpha or fractional address ranges (PO boxes, "1256 1/2") are a documented, legitimate boundary
      // format that TaxAP's numeric house-number matcher does not support. These addresses fall back to
      // ZIP+4/ZIP-5 matching rather than being treated as a file-corruption signal.
      return { unsupportedAddressRange: true };
    }
    return {
      ...base,
      addrLow: low, addrHigh: high, oddEven: columns[5] || "B",
      predir: columns[6], streetName: normalizeStreetToken(columns[7]), suffix: columns[8], postdir: columns[9],
      secondaryDesignator: columns[10] || "", secondaryLow: columns[11] || null, secondaryHigh: columns[12] || null, secondaryOddEven: columns[13] || "B",
      city: normalizeStreetToken(columns[14]), zip5: columns[15] || null,
    };
  }
  if (recordType === "Z") {
    const zipLow = columns[17];
    const zipHigh = columns[19];
    if (!/^\d{5}$/.test(zipLow) || !/^\d{5}$/.test(zipHigh)) return { invalid: true, reason: "non-numeric zip range" };
    return { ...base, zipLow, zipHigh };
  }
  const zipLow = columns[17];
  const zipExtLow = columns[18];
  const zipHigh = columns[19];
  const zipExtHigh = columns[20];
  if (!/^\d{5}$/.test(zipLow) || !/^\d{5}$/.test(zipHigh) || !/^\d{4}$/.test(zipExtLow) || !/^\d{4}$/.test(zipExtHigh)) {
    return { invalid: true, reason: "non-numeric zip+4 range" };
  }
  return { ...base, zipLow, zipExtLow, zipHigh, zipExtHigh };
}

/**
 * Parses the Georgia Streamlined boundary CSV into address, ZIP+4, and ZIP-5 lookup structures.
 * Address-level rows are discarded unless they fall in `wantedAddressKeys`, keeping memory bounded to the
 * active A+ Georgia ship-to addresses instead of the archive's ~2 million address-range rows.
 */
export function parseBoundaryCsv(csvText, { wantedAddressKeys = new Set() } = {}) {
  const addressRanges = new Map();
  const zip9Ranges = new Map();
  const zip5Ranges = new Map();
  const recordTypeCounts = { A: 0, Z: 0, 4: 0 };
  let invalidRowCount = 0;
  let unsupportedAddressRangeCount = 0;
  let totalRows = 0;

  let start = 0;
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const length = text.length;
  while (start < length) {
    let end = text.indexOf("\n", start);
    if (end === -1) end = length;
    let lineEnd = end;
    if (lineEnd > start && text[lineEnd - 1] === "\r") lineEnd--;
    if (lineEnd > start) {
      totalRows++;
      const line = text.slice(start, lineEnd);
      const parsed = parseBoundaryLine(line, totalRows);
      if (parsed.unsupportedAddressRange) {
        unsupportedAddressRangeCount++;
      } else if (parsed.invalid) {
        invalidRowCount++;
      } else {
        recordTypeCounts[parsed.recordType]++;
        if (parsed.recordType === "A") {
          const key = `${parsed.city}|${parsed.zip5}|${parsed.predir}|${parsed.streetName}|${parsed.suffix}|${parsed.postdir}`;
          if (wantedAddressKeys.has(key)) {
            if (!addressRanges.has(key)) addressRanges.set(key, []);
            addressRanges.get(key).push(parsed);
          }
        } else if (parsed.recordType === "Z") {
          if (!zip5Ranges.has(parsed.zipLow)) zip5Ranges.set(parsed.zipLow, []);
          zip5Ranges.get(parsed.zipLow).push(parsed);
        } else {
          if (!zip9Ranges.has(parsed.zipLow)) zip9Ranges.set(parsed.zipLow, []);
          zip9Ranges.get(parsed.zipLow).push(parsed);
        }
      }
    }
    start = end + 1;
  }

  if (totalRows === 0) throw new Error("The Georgia boundary file contained no data rows.");
  if (invalidRowCount / totalRows > 0.005) {
    throw new Error(`The Georgia boundary file failed validation: ${invalidRowCount} of ${totalRows} rows were invalid.`);
  }
  return { addressRanges, zip9Ranges, zip5Ranges, recordTypeCounts, invalidRowCount, unsupportedAddressRangeCount, totalRows };
}

export function findLatestBoundaryZip(directoryHtml, stateCode) {
  const expression = new RegExp(`href=["']([^"']*${stateCode}B[^"']*\\.zip)["']`, "gi");
  const files = [...String(directoryHtml).matchAll(expression)].map((match) => match[1]);
  if (files.length === 0) throw new Error(`No current ${stateCode} boundary archive was listed.`);
  return new URL(files.sort().at(-1), GEORGIA_BOUNDARY_DIRECTORY_URL).href;
}

function jurisdictionFromRow(row) {
  return { fipsCounty: row.fipsCounty || null, fipsPlace: row.fipsPlace || null, specialCode: row.specialCode || null };
}

function sameJurisdiction(a, b) {
  return a.fipsCounty === b.fipsCounty && a.fipsPlace === b.fipsPlace && a.specialCode === b.specialCode;
}

/** Resolves a single active jurisdiction from a set of candidate rows, or null/`"ambiguous"` when it cannot. */
function resolveActiveRows(rows, asOfDate) {
  const active = rows.filter((row) => isActive(row, asOfDate));
  if (active.length === 0) return { tier: "unmatched" };
  const first = jurisdictionFromRow(active[0]);
  if (active.some((row) => !sameJurisdiction(jurisdictionFromRow(row), first))) return { tier: "ambiguous" };
  return { tier: "matched", jurisdiction: first };
}

/**
 * Matches one normalized Georgia ship-to address against the boundary dataset, preferring the most
 * specific tier available: address, then ZIP+4, then ZIP-5. Never guesses — an address that cannot be
 * parsed, or that resolves to conflicting jurisdictions, is reported as unmatched or ambiguous instead.
 */
export function matchGeorgiaAddress(dataset, address, asOfDate) {
  const zip = normalizeZip(address.zip);
  if (!zip.zip5) return { tier: "unmatched", reason: "missing ZIP code" };

  const parsedStreet = parseShipToStreetLine(address.streetLine);
  if (parsedStreet) {
    const key = addressGroupKey(normalizeStreetToken(address.city), zip.zip5, parsedStreet);
    const candidates = (dataset.addressRanges.get(key) || []).filter((row) =>
      row.addrLow <= parsedStreet.houseNumber && parsedStreet.houseNumber <= row.addrHigh && matchesOddEven(row.oddEven, parsedStreet.houseNumber));
    const secondary = parseShipToSecondaryLine(address.secondaryLine);
    const secondaryFiltered = candidates.filter((row) => {
      if (!row.secondaryDesignator) return true;
      if (!secondary || secondary.designator !== row.secondaryDesignator) return false;
      const secondaryNumber = Number(secondary.number);
      if (!Number.isFinite(secondaryNumber) || row.secondaryLow === null || row.secondaryHigh === null) return secondary.number === row.secondaryLow;
      return Number(row.secondaryLow) <= secondaryNumber && secondaryNumber <= Number(row.secondaryHigh) && matchesOddEven(row.secondaryOddEven, secondaryNumber);
    });
    const pool = secondaryFiltered.length > 0 ? secondaryFiltered : candidates;
    if (pool.length > 0) {
      const resolved = resolveActiveRows(pool, asOfDate);
      if (resolved.tier === "matched") return { tier: "address", jurisdiction: resolved.jurisdiction };
      if (resolved.tier === "ambiguous") return { tier: "ambiguous", reason: "conflicting address-level boundary rows" };
    }
  }

  if (zip.zip4) {
    const candidates = (dataset.zip9Ranges.get(zip.zip5) || []).filter((row) =>
      (row.zipLow < zip.zip5 || (row.zipLow === zip.zip5 && row.zipExtLow <= zip.zip4)) &&
      (row.zipHigh > zip.zip5 || (row.zipHigh === zip.zip5 && row.zipExtHigh >= zip.zip4)));
    if (candidates.length > 0) {
      const resolved = resolveActiveRows(candidates, asOfDate);
      if (resolved.tier === "matched") return { tier: "zip9", jurisdiction: resolved.jurisdiction };
      if (resolved.tier === "ambiguous") return { tier: "ambiguous", reason: "conflicting ZIP+4 boundary rows" };
    }
  }

  const zip5Candidates = [...(dataset.zip5Ranges.get(zip.zip5) || [])].filter((row) => row.zipLow <= zip.zip5 && zip.zip5 <= row.zipHigh);
  if (zip5Candidates.length > 0) {
    const resolved = resolveActiveRows(zip5Candidates, asOfDate);
    if (resolved.tier === "matched") return { tier: "zip5", jurisdiction: resolved.jurisdiction };
    if (resolved.tier === "ambiguous") return { tier: "ambiguous", reason: "conflicting ZIP-5 boundary rows" };
    // resolved.tier === "unmatched": rows exist for this ZIP, but none cover the comparison date —
    // a staleness gap, distinct from the ZIP being absent from the archive entirely below.
    return { tier: "unmatched", reason: "boundary rows exist for this ZIP but none are active as of the comparison date" };
  }

  return { tier: "unmatched", reason: "no boundary row in the archive covers this ZIP code" };
}

function officialRateForJurisdiction(jurisdiction, rateSnapshot) {
  const componentByCode = (jurisdictionType, code) => {
    if (!code) return 0;
    const rate = rateSnapshot.rates.find((row) => row.jurisdictionType === jurisdictionType && row.jurisdictionCode === code);
    return rate ? rate.componentRate : null;
  };
  const county = componentByCode("county", jurisdiction.fipsCounty);
  const place = componentByCode("city", jurisdiction.fipsPlace);
  const special = componentByCode("special", jurisdiction.specialCode);
  if (jurisdiction.fipsCounty && county === null) return null;
  if (jurisdiction.fipsPlace && place === null) return null;
  if (jurisdiction.specialCode && special === null) return null;
  return Number((rateSnapshot.stateRate + (county || 0) + (place || 0) + (special || 0)).toFixed(4));
}

function jurisdictionKey(jurisdiction) {
  return `${jurisdiction.fipsCounty || ""}|${jurisdiction.fipsPlace || ""}|${jurisdiction.specialCode || ""}`;
}

/**
 * Aggregates matched/unmatched/ambiguous Georgia ship-to addresses by A+ tax body and reconciles each
 * tax body's resolved official rate against its configured XATXBD rate. Never returns ship-to-level
 * address or customer data — only aggregate counts and rate comparisons.
 */
export function reconcileGeorgiaBoundary({ addresses, boundaryDataset, rateSnapshot, taxBodyRates = new Map(), asOfDate }) {
  const perTaxBody = new Map();
  let matchedCount = 0;
  let unmatchedCount = 0;
  let ambiguousCount = 0;
  const tierCounts = { address: 0, zip9: 0, zip5: 0 };
  // Aggregate-only breakdown of why an address didn't match — counts and reason strings, never the
  // ship-to address itself, so this stays within the same privacy boundary as everything else here.
  const unmatchedReasons = new Map();
  const ambiguousReasons = new Map();

  for (const address of addresses) {
    const taxBody = address.taxBody || "(unassigned)";
    if (!perTaxBody.has(taxBody)) perTaxBody.set(taxBody, { taxBody, activeShipTos: 0, unmatched: 0, ambiguous: 0, jurisdictionCounts: new Map() });
    const bucket = perTaxBody.get(taxBody);
    bucket.activeShipTos++;

    const result = matchGeorgiaAddress(boundaryDataset, address, asOfDate);
    if (result.tier === "unmatched") {
      unmatchedCount++;
      bucket.unmatched++;
      unmatchedReasons.set(result.reason, (unmatchedReasons.get(result.reason) ?? 0) + 1);
      continue;
    }
    if (result.tier === "ambiguous") {
      ambiguousCount++;
      bucket.ambiguous++;
      ambiguousReasons.set(result.reason, (ambiguousReasons.get(result.reason) ?? 0) + 1);
      continue;
    }
    matchedCount++;
    tierCounts[result.tier]++;
    const key = jurisdictionKey(result.jurisdiction);
    if (!bucket.jurisdictionCounts.has(key)) bucket.jurisdictionCounts.set(key, { jurisdiction: result.jurisdiction, count: 0 });
    bucket.jurisdictionCounts.get(key).count++;
  }

  const allTaxBodyFindings = [...perTaxBody.values()].map((bucket) => {
    const jurisdictions = [...bucket.jurisdictionCounts.values()].sort((a, b) => b.count - a.count);
    const majority = jurisdictions[0] ?? null;
    const consistent = jurisdictions.length <= 1;
    const officialRate = majority ? officialRateForJurisdiction(majority.jurisdiction, rateSnapshot) : null;
    const aplusRate = taxBodyRates.has(bucket.taxBody) ? taxBodyRates.get(bucket.taxBody) : null;
    const rateDifference = officialRate !== null && aplusRate !== null ? Number((officialRate - aplusRate).toFixed(4)) : null;
    return {
      taxBody: bucket.taxBody,
      activeShipTos: bucket.activeShipTos,
      matchedShipTos: bucket.activeShipTos - bucket.unmatched - bucket.ambiguous,
      unmatchedShipTos: bucket.unmatched,
      ambiguousShipTos: bucket.ambiguous,
      jurisdictionAssignmentConsistent: consistent,
      jurisdiction: majority ? majority.jurisdiction : null,
      officialRate,
      aplusRate,
      rateDifference,
      hasDifference: rateDifference !== null && Math.abs(rateDifference) >= 0.01,
    };
  });

  // Per instruction: drop tax bodies with no real A+ rate configured. `aplusRate === null` already
  // covers both "no XATXBD row exists" and "the only row is retired/DO NOT USE" — the caller
  // (readGeorgiaBoundaryReconciliation) excludes retired definitions from taxBodyRates before this
  // function ever sees them, so a retired-only tax body arrives here as null, not a stale rate.
  // `aplusRate === 0` covers a real, non-retired row whose rate was simply never assigned — no
  // active Georgia jurisdiction actually charges 0%, so a configured 0 reads as unset, not exempt.
  // Never silently drop the ship-to counts alongside it: totals/matched/unmatched above are
  // unaffected, and the exclusion count is reported so a reviewer can see what was left out.
  const taxBodyFindings = allTaxBodyFindings
    .filter((finding) => finding.aplusRate !== null && finding.aplusRate !== 0)
    .sort((a, b) => b.activeShipTos - a.activeShipTos || a.taxBody.localeCompare(b.taxBody));
  const excludedForNoAplusRate = allTaxBodyFindings.length - taxBodyFindings.length;

  const sortReasons = (reasons) => [...reasons.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }));

  return {
    asOfDate,
    excludedForNoAplusRate,
    totals: { activeShipTos: addresses.length, matched: matchedCount, unmatched: unmatchedCount, ambiguous: ambiguousCount },
    matchTierCounts: tierCounts,
    unmatchedReasons: sortReasons(unmatchedReasons),
    ambiguousReasons: sortReasons(ambiguousReasons),
    taxBodyFindings,
  };
}

let cachedBoundaryFile = null;
let cacheExpiresAt = 0;

async function fetchBinary(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetchImpl(url, { headers: { "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Official boundary source returned HTTP ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { headers: { Accept: "text/html", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Official boundary source returned HTTP ${response.status}.`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Discovers, downloads, and validates the current Georgia boundary archive, returning its raw CSV text
 * plus evidence (URL, retrieval time, SHA-256 fingerprint). Cached for six hours like the rate adapter.
 */
export async function readGeorgiaBoundaryArchive({ fetchImpl = fetch, now = new Date(), bypassCache = false } = {}) {
  if (!bypassCache && cachedBoundaryFile && Date.now() < cacheExpiresAt) return cachedBoundaryFile;
  const directoryHtml = await fetchText(GEORGIA_BOUNDARY_DIRECTORY_URL, fetchImpl);
  const boundaryFileUrl = findLatestBoundaryZip(directoryHtml, "GA");
  const zipBuffer = await fetchBinary(boundaryFileUrl, fetchImpl);
  const entry = readSingleFileZip(zipBuffer);
  const csvText = entry.data.toString("utf8");
  const result = {
    boundaryFileUrl,
    retrievedAt: now.toISOString(),
    sourceHash: createHash("sha256").update(entry.data).digest("hex"),
    csvText,
  };
  if (!bypassCache) {
    cachedBoundaryFile = result;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
  }
  return result;
}
