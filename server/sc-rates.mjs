import { extractSouthCarolinaPdf } from "./sc-pdf.mjs";
import { createHash } from "node:crypto";

export const SC_ST575_URL = "https://dor.sc.gov/sites/dor/files/forms/ST575.pdf";
export const SC_STATE_RATE = 6;

// South Carolina's 46 counties. Unlike NC's adapter, this list is used only to validate
// completeness of the "Unincorporated" rows parsed from ST-575 — it never synthesizes a
// tax-body code, since SC's real county/municipality identity comes from the document text.
export const SC_COUNTIES = [
  "Abbeville", "Aiken", "Allendale", "Anderson", "Bamberg", "Barnwell", "Beaufort", "Berkeley", "Calhoun", "Charleston",
  "Cherokee", "Chester", "Chesterfield", "Clarendon", "Colleton", "Darlington", "Dillon", "Dorchester", "Edgefield", "Fairfield",
  "Florence", "Georgetown", "Greenville", "Greenwood", "Hampton", "Horry", "Jasper", "Kershaw", "Lancaster", "Laurens",
  "Lee", "Lexington", "Marion", "Marlboro", "McCormick", "Newberry", "Oconee", "Orangeburg", "Pickens", "Richland",
  "Saluda", "Spartanburg", "Sumter", "Union", "Williamsburg", "York",
];

// A single ST-575 data row, once `pdftotext -table` has kept it glued to its own rate cells:
//   [* ]<Municipality>  <County>  <Local Taxes and Codes>  <Total>%  <Accommodations>%  <Unprepared Foods text>
// The leading "* " marks a municipality that spans more than one county (a distinct row per county portion).
const ROW_PATTERN = /^(\*\s+)?(\S.*?)\s{2,}(\S.*?)\s{2,}(.*?)\s{2,}(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s+(.*)$/;
const HEADER_PATTERN = /^\s*(Municipality\s+County|Total Tax\b)/;
const PAGE_NUMBER_PATTERN = /^\s*\d+\s*$/;
const REVISION_DATE_PATTERN = /\(Rev\.\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\)/;

function normalizedRevisionYear(text) {
  return text.length === 2 ? `20${text}` : text;
}

/**
 * Parses the plain-text output of `pdftotext -table` run against ST-575 into structured rate
 * rows. Kept separate from PDF extraction so it's testable against a fixture without shelling
 * out to poppler or hitting the network.
 */
export function parseSt575Table(text) {
  const revisionMatch = text.match(REVISION_DATE_PATTERN);
  if (!revisionMatch) throw new Error("ST-575 text does not contain a recognizable revision date.");
  const asOfDate = `${normalizedRevisionYear(revisionMatch[3])}-${revisionMatch[1].padStart(2, "0")}-${revisionMatch[2].padStart(2, "0")}`;

  const firstHeaderIndex = text.split(/\r?\n/).findIndex((line) => /^Municipality\s+County/.test(line));
  if (firstHeaderIndex < 0) throw new Error("ST-575 text does not contain the expected 'Municipality County ...' table header.");
  const lines = text.split(/\r?\n/).slice(firstHeaderIndex + 1);

  const countyRows = [];
  const municipalityRows = [];
  const unrecognizedLines = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) continue;
    if (HEADER_PATTERN.test(line)) continue;
    if (PAGE_NUMBER_PATTERN.test(line)) continue;
    const match = line.match(ROW_PATTERN);
    if (!match) {
      unrecognizedLines.push(rawLine);
      continue;
    }
    const row = {
      multiCounty: Boolean(match[1]),
      name: match[2].trim(),
      county: match[3].trim(),
      localTaxes: match[4].trim(),
      totalRate: Number(match[5]),
      accommodationsRate: Number(match[6]),
      unpreparedFoodsNote: match[7].trim(),
    };
    if (row.name === "Unincorporated") countyRows.push(row);
    else municipalityRows.push(row);
  }

  // ST-575 is a fixed legal-boilerplate-plus-table document. Once the table header is found,
  // every remaining non-blank, non-header, non-page-number line must parse as a data row —
  // an unrecognized line means the document's shape changed and this parser needs a look,
  // not a silent skip (the project's "never guess" rule applies to the parser too).
  if (unrecognizedLines.length > 0) {
    throw new Error(`ST-575 has ${unrecognizedLines.length} unrecognized table line(s), e.g. "${unrecognizedLines[0].trim()}". Refusing to guess — the source format may have changed.`);
  }

  const countyRateByName = new Map();
  for (const row of countyRows) {
    if (countyRateByName.has(row.county)) throw new Error(`ST-575 lists more than one Unincorporated row for ${row.county} County.`);
    countyRateByName.set(row.county, row);
  }
  const missingCounties = SC_COUNTIES.filter((county) => !countyRateByName.has(county));
  const unexpectedCounties = [...countyRateByName.keys()].filter((county) => !SC_COUNTIES.includes(county));
  if (missingCounties.length > 0) throw new Error(`ST-575 is missing an Unincorporated row for: ${missingCounties.join(", ")}.`);
  if (unexpectedCounties.length > 0) throw new Error(`ST-575 has an Unincorporated row for an unrecognized county: ${unexpectedCounties.join(", ")}.`);

  for (const row of [...countyRows, ...municipalityRows]) {
    if (row.totalRate < SC_STATE_RATE || row.totalRate > SC_STATE_RATE + 5) {
      throw new Error(`ST-575 has an implausible total rate (${row.totalRate}%) for ${row.name}, ${row.county} County.`);
    }
  }

  // Multi-county municipalities (marked with "*") get one row per county portion — collisions
  // here would mean the same municipality/county pair appeared twice, which should never happen.
  const municipalityKeys = new Set();
  for (const row of municipalityRows) {
    const key = `${row.name}|${row.county}`;
    if (municipalityKeys.has(key)) throw new Error(`ST-575 lists ${row.name} in ${row.county} County more than once.`);
    municipalityKeys.add(key);
  }

  return { asOfDate, countyRows, municipalityRows };
}

async function downloadSt575(fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(SC_ST575_URL, {
      headers: { Accept: "application/pdf", "User-Agent": "TaxAP/0.1 official-rate monitor" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`SC DOR returned HTTP ${response.status} for ST-575.`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 20_000 || buffer.readUInt32BE(0) !== 0x25504446) throw new Error("SC DOR did not return the expected ST-575 PDF.");
    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

function toRateRows(parsed) {
  const rates = [];
  for (const row of parsed.countyRows) {
    rates.push({
      jurisdictionType: "county",
      jurisdictionCode: `SC:${row.county.toUpperCase()}:UNINCORPORATED`,
      name: `${row.county} County (unincorporated)`,
      county: row.county,
      municipality: null,
      multiCounty: false,
      localTaxes: row.localTaxes,
      componentRate: Number((row.totalRate - SC_STATE_RATE).toFixed(4)),
      totalGeneralRate: row.totalRate,
      generalInterstateRate: row.totalRate,
      accommodationsRate: row.accommodationsRate,
      unpreparedFoodsNote: row.unpreparedFoodsNote,
      beginDate: null,
      endDate: null,
    });
  }
  for (const row of parsed.municipalityRows) {
    rates.push({
      jurisdictionType: "city",
      jurisdictionCode: `SC:${row.county.toUpperCase()}:${row.name.toUpperCase()}`,
      name: row.multiCounty ? `${row.name} (${row.county} County portion)` : row.name,
      county: row.county,
      municipality: row.name,
      multiCounty: row.multiCounty,
      localTaxes: row.localTaxes,
      componentRate: Number((row.totalRate - SC_STATE_RATE).toFixed(4)),
      totalGeneralRate: row.totalRate,
      generalInterstateRate: row.totalRate,
      accommodationsRate: row.accommodationsRate,
      unpreparedFoodsNote: row.unpreparedFoodsNote,
      beginDate: null,
      endDate: null,
    });
  }
  return rates.sort((left, right) => left.jurisdictionCode.localeCompare(right.jurisdictionCode));
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

/** Reads ST-575 using the bundled PDF.js table extractor and validates every county row. */
export async function readOfficialScRates({ fetchImpl = fetch, now = new Date(), bypassCache = false, extractText = extractSouthCarolinaPdf } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const pdfBuffer = await downloadSt575(fetchImpl);
    const text = await extractText(pdfBuffer);
    const parsed = parseSt575Table(text);
    const rates = toRateRows(parsed);
    const snapshot = {
      stateCode: "SC",
      source: "South Carolina Department of Revenue (Form ST-575)",
      sourceUrl: SC_ST575_URL,
      machineReadableSourceUrl: null,
      retrievedAt: now.toISOString(),
      asOfDate: parsed.asOfDate,
      stateRate: SC_STATE_RATE,
      sourceHash: createHash("sha256").update(pdfBuffer).digest("hex"),
      rates,
      counts: {
        counties: parsed.countyRows.length,
        cities: parsed.municipalityRows.length,
        specialJurisdictions: 0,
      },
      boundaryStatus: `${parsed.countyRows.length}/46 county totals and ${parsed.municipalityRows.length} municipality totals parsed and validated from ST-575. Assigned-name comparisons are connected; multi-county and address-level matching remain unresolved.`,
    };
    cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
    return snapshot;
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try {
    return await read;
  } finally {
    inFlightRead = null;
  }
}
