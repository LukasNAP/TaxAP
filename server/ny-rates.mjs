import { createHash } from "node:crypto";
import { extractPdfTableText } from "./pdf-utils.mjs";

export const NY_PUB718_URL = "https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf";
export const NY_STATE_RATE = 4;

const FRACTIONS = { "⅛": 0.125, "¼": 0.25, "⅜": 0.375, "½": 0.5, "⅝": 0.625, "¾": 0.75, "⅞": 0.875 };
const PLAUSIBLE_RATE_MIN = 3;
const PLAUSIBLE_RATE_MAX = 10;

// Confirmed live 2026-08-26/27 (see docs/states/ny.md): Publication 718 is a 3-column newsletter-
// style table. The in-process PDF extraction interleaves all 3 columns' text on one physical line per visual
// row, and a pure cross-reference row ("*Kings (Brooklyn) - see New York City") has no rate/code of
// its own, so it silently merges into the next column's real entry when scanned as one text stream.
// Rather than model the 3-column geometry, this adapter finds every (name, rate, code) triple
// directly wherever it occurs and discards everything before the last "New York City" phrase in a
// contaminated name - the real locality name is always the text immediately before its own rate.
const ENTRY_PATTERN = /([A-Za-z*][A-Za-z .,'’()–-]*?)[ \t]+(\d+)?([⅛¼⅜½⅝¾⅞])?[ \t]+(\d{4})(?!\d)/g;

function parseRateValue(whole, frac) {
  const base = whole ? Number(whole) : 0;
  return Number((base + (frac ? FRACTIONS[frac] ?? 0 : 0)).toFixed(4));
}

function cleanLocalityName(rawName) {
  // Only strip a leading "... see New York City" cross-reference prefix when there's real text
  // AFTER it (the next column's actual entry) - if the name ends at "New York City" itself, that
  // IS the real entry (the combined NYC rate row), not a cross-reference to discard.
  const marker = "New York City";
  const markerIndex = rawName.lastIndexOf(marker);
  const hasTrailingText = markerIndex >= 0 && rawName.slice(markerIndex + marker.length).trim().length > 0;
  const withoutCrossRef = hasTrailingText ? rawName.slice(markerIndex + marker.length) : rawName;
  return withoutCrossRef.replace(/^\*+/, "").trim().replace(/\s+/g, " ");
}

/**
 * Parses Publication 718's extracted table text into a flat list of {name, rate, code} rows -
 * every real jurisdiction line, regardless of which of the 3 visual columns or which "- except"
 * nesting level it came from. Matching (server/ny-aplus.mjs) only needs a name -> rate lookup, not
 * the county/sub-city hierarchy, so flattening loses nothing relevant while avoiding a much more
 * fragile column-geometry parser.
 */
export function parseNyRateText(text) {
  if (!/Rates by Jurisdiction/i.test(text)) throw new Error("Publication 718's text does not contain the expected \"Rates by Jurisdiction\" heading.");
  const effectiveMatch = text.match(/Effective\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})/);
  if (!effectiveMatch) throw new Error("Publication 718's text does not contain a recognizable effective date.");

  const rows = [];
  for (const match of text.matchAll(ENTRY_PATTERN)) {
    const [, rawName, whole, frac, code] = match;
    if (!whole && !frac) continue; // a bare 4-digit match with no preceding rate isn't a real row
    const rate = parseRateValue(whole, frac);
    if (rate < PLAUSIBLE_RATE_MIN || rate > PLAUSIBLE_RATE_MAX) continue; // filters stray page/footnote numbers
    const name = cleanLocalityName(rawName);
    if (!name) continue;
    rows.push({ name, rate, code });
  }

  const stateRow = rows.find((row) => row.name === "New York State only");
  if (!stateRow || stateRow.rate !== NY_STATE_RATE) throw new Error(`Publication 718 did not confirm the expected ${NY_STATE_RATE}% base state rate.`);
  const nycRow = rows.find((row) => row.name === "New York City");
  if (!nycRow) throw new Error("Publication 718 did not contain a recognizable New York City combined rate.");
  if (rows.length < 70 || rows.length > 90) throw new Error(`Publication 718 parsed to ${rows.length} rows, outside the plausible range (70-90) - the table format may have changed.`);

  return { effectiveDate: effectiveMatch[1], rows };
}

async function fetchPub718(fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(NY_PUB718_URL, { headers: { Accept: "application/pdf", "User-Agent": "TaxAP/0.1 official-rate monitor" }, signal: controller.signal });
    if (!response.ok) throw new Error(`NY Tax Department returned HTTP ${response.status} for Publication 718.`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 20_000 || buffer.readUInt32BE(0) !== 0x25504446) throw new Error("NY Tax Department did not return the expected Publication 718 PDF.");
    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;

export async function readOfficialNyRates({ fetchImpl = fetch, now = new Date(), bypassCache = false, extractText = extractPdfTableText } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  const pdfBuffer = await fetchPub718(fetchImpl);
  const text = await extractText(pdfBuffer, { tmpPrefix: "taxap-ny-" });
  const parsed = parseNyRateText(text);
  const rates = parsed.rows
    .filter((row) => row.name !== "New York State only")
    .map((row) => ({
      jurisdictionType: /\(city\)$/i.test(row.name) || row.name === "New York City" ? "city" : "county",
      jurisdictionCode: row.code,
      name: row.name.replace(/\s\(city\)$/i, "").replace(/\s[–-]\s*except$/i, ""),
      componentRate: null,
      totalGeneralRate: row.rate,
      generalInterstateRate: row.rate,
      beginDate: null,
      endDate: null,
    }));
  const snapshot = {
    stateCode: "NY",
    source: "New York State Department of Taxation and Finance (Publication 718)",
    sourceUrl: NY_PUB718_URL,
    machineReadableSourceUrl: null,
    retrievedAt: now.toISOString(),
    asOfDate: parsed.effectiveDate,
    stateRate: NY_STATE_RATE,
    sourceHash: createHash("sha256").update(pdfBuffer).digest("hex"),
    rates,
    counts: { counties: rates.filter((r) => r.jurisdictionType === "county").length, cities: rates.filter((r) => r.jurisdictionType === "city").length, specialJurisdictions: 0 },
    boundaryStatus: "Every real New York county and home-rule city with its own rate is connected. New York City's 5 boroughs (Bronx, Kings, New York, Queens, Richmond) share one combined rate, matching A+'s own single combined NYC tax body.",
  };
  if (!bypassCache) {
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
  }
  return snapshot;
}
