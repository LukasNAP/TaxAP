import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

export const NEW_YORK_CURRENT_RATES_URL = "https://www.tax.ny.gov/pubs_and_bulls/publications/sales/local_rates_current.htm";
export const NEW_YORK_STATE_RATE = 4;
export const NEW_YORK_EXPECTED_RATE_ROWS = 77;

const RATE_FRACTIONS = new Map([
  ["¼", 0.25], ["½", 0.5], ["¾", 0.75], ["⅛", 0.125],
  ["⅜", 0.375], ["⅝", 0.625], ["⅞", 0.875],
]);
const RATE_ROW_PATTERN = /(\*?[A-Za-z][A-Za-z .()'’\-–]*?)\s+(\d(?:[¼½¾⅛⅜⅝⅞])?)\s+(\d{4})(?=\s|$)/g;

function decodeHtml(value) {
  return String(value).replace(/&amp;/gi, "&").replace(/&#0*39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
}

export function findNewYorkPublicationUrl(html) {
  const match = String(html).match(/href=["']([^"']*\/pub718\.pdf(?:\?[^"']*)?)["']/i);
  if (!match) throw new Error("New York DTF current-rate page did not link Publication 718.");
  return new URL(decodeHtml(match[1]), NEW_YORK_CURRENT_RATES_URL).href;
}

function parsePublishedRate(value) {
  const match = String(value).match(/^(\d)([¼½¾⅛⅜⅝⅞])?$/);
  if (!match) throw new Error(`Publication 718 contains an unrecognized rate: ${value}.`);
  return Number(match[1]) + (match[2] ? RATE_FRACTIONS.get(match[2]) : 0);
}

function cleanExtractedName(value) {
  // Layout extraction can place a non-rate "see New York City" cross-reference immediately
  // before the next real table entry. Keep only the rate-bearing name after that note.
  return String(value).split(/see New York City/i).at(-1).trim().replace(/^\*\s*/, "");
}

export function parseNewYorkPublicationText(text) {
  const sourceText = String(text);
  if (!/Publication\s+718/i.test(sourceText)) throw new Error("New York rate PDF is not Publication 718.");
  const effective = sourceText.match(/Effective\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  if (!effective) throw new Error("Publication 718 does not contain a recognizable effective date.");
  const effectiveDate = new Date(`${effective[1]} 00:00:00 UTC`);
  if (Number.isNaN(effectiveDate.getTime())) throw new Error("Publication 718 contains an invalid effective date.");

  const seenCodes = new Set();
  const entries = [];
  for (const match of sourceText.matchAll(RATE_ROW_PATTERN)) {
    const name = cleanExtractedName(match[1]);
    const reportingCode = match[3];
    if (!name) throw new Error(`Publication 718 has no jurisdiction name for reporting code ${reportingCode}.`);
    if (seenCodes.has(reportingCode)) throw new Error(`Publication 718 repeats reporting code ${reportingCode}.`);
    seenCodes.add(reportingCode);
    entries.push({ name, totalGeneralRate: parsePublishedRate(match[2]), reportingCode });
  }
  if (entries.length !== NEW_YORK_EXPECTED_RATE_ROWS) {
    throw new Error(`Publication 718 has ${entries.length} rate rows instead of the reviewed ${NEW_YORK_EXPECTED_RATE_ROWS}; review the official table before accepting it.`);
  }

  const stateEntry = entries.find((entry) => entry.reportingCode === "0021");
  if (!stateEntry || stateEntry.name !== "New York State only" || stateEntry.totalGeneralRate !== NEW_YORK_STATE_RATE) {
    throw new Error(`Publication 718's state-only row changed from the reviewed ${NEW_YORK_STATE_RATE}%.`);
  }
  const cityCount = entries.filter((entry) => entry.name.endsWith("(city)") || entry.name === "New York City").length;
  if (cityCount !== 19) throw new Error(`Publication 718 has ${cityCount} city rows instead of the reviewed 19.`);

  const rates = entries.map((entry) => {
    const jurisdictionType = entry.reportingCode === "0021"
      ? "state"
      : entry.name.endsWith("(city)") || entry.name === "New York City" ? "city" : "county";
    return {
      jurisdictionType,
      jurisdictionCode: `NY:${entry.reportingCode}`,
      reportingCode: entry.reportingCode,
      name: entry.name,
      componentRate: jurisdictionType === "state" ? NEW_YORK_STATE_RATE : Number((entry.totalGeneralRate - NEW_YORK_STATE_RATE).toFixed(4)),
      totalGeneralRate: entry.totalGeneralRate,
      generalInterstateRate: entry.totalGeneralRate,
      beginDate: effectiveDate.toISOString().slice(0, 10),
      endDate: null,
    };
  });
  return {
    effectiveDate: effectiveDate.toISOString().slice(0, 10),
    rates,
    counts: { counties: entries.length - cityCount - 1, cities: cityCount, specialJurisdictions: 0 },
  };
}

function runWithInput(command, args, input, label, { env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, env });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      if (!settled) { settled = true; reject(new Error(`${label} timed out.`)); }
    }, 20_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(error); }
    });
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code !== 0) reject(new Error(`${label} failed (${code}): ${Buffer.concat(stderr).toString("utf8").trim()}`));
      else resolve(Buffer.concat(stdout).toString("utf8"));
    });
    child.stdin.end(input);
  });
}

export async function extractNewYorkPublicationText(pdfBuffer, { pdftotextPath = "pdftotext", pythonPath = process.env.TAXAP_PYTHON_PATH } = {}) {
  try {
    return await runWithInput(pdftotextPath, ["-layout", "-enc", "UTF-8", "-", "-"], pdfBuffer, "pdftotext");
  } catch (error) {
    if (error?.code !== "ENOENT" || !pythonPath) {
      const suffix = error?.code === "ENOENT" ? " Set TAXAP_PYTHON_PATH to a Python runtime with pdfplumber, or install poppler-utils." : "";
      throw new Error(`Publication 718 PDF extraction is unavailable: ${error.message}.${suffix}`);
    }
    const script = "import io,sys,pdfplumber; d=pdfplumber.open(io.BytesIO(sys.stdin.buffer.read())); sys.stdout.write('\\n'.join((p.extract_text(layout=True) or '') for p in d.pages))";
    return runWithInput(pythonPath, ["-c", script], pdfBuffer, "pdfplumber", {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
  }
}

let cachedSnapshot = null;
let cacheExpiresAt = 0;
let inFlightRead = null;

export async function readOfficialNyRates({ fetchImpl = fetch, now = new Date(), bypassCache = false, extractTextImpl = extractNewYorkPublicationText } = {}) {
  if (!bypassCache && cachedSnapshot && Date.now() < cacheExpiresAt) return cachedSnapshot;
  if (!bypassCache && inFlightRead) return inFlightRead;
  const read = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const headers = { Accept: "text/html,application/pdf", "User-Agent": "TaxAP/0.1 official-rate monitor" };
      const landingResponse = await fetchImpl(NEW_YORK_CURRENT_RATES_URL, { headers, signal: controller.signal });
      if (!landingResponse.ok) throw new Error(`New York DTF returned HTTP ${landingResponse.status}.`);
      const landingHtml = await landingResponse.text();
      if (landingHtml.length < 5_000) throw new Error("New York DTF returned an unexpectedly short current-rate page.");
      const publicationUrl = findNewYorkPublicationUrl(landingHtml);
      const pdfResponse = await fetchImpl(publicationUrl, { headers, signal: controller.signal });
      if (!pdfResponse.ok) throw new Error(`New York DTF Publication 718 returned HTTP ${pdfResponse.status}.`);
      const pdf = Buffer.from(await pdfResponse.arrayBuffer());
      if (pdf.length < 20_000 || pdf.subarray(0, 4).toString("ascii") !== "%PDF") throw new Error("New York DTF did not return the expected Publication 718 PDF.");
      const extractedText = await extractTextImpl(pdf);
      const parsed = parseNewYorkPublicationText(extractedText);
      const snapshot = {
        stateCode: "NY",
        source: "New York State Department of Taxation and Finance",
        sourceUrl: NEW_YORK_CURRENT_RATES_URL,
        machineReadableSourceUrl: publicationUrl,
        retrievedAt: now.toISOString(),
        asOfDate: parsed.effectiveDate,
        stateRate: NEW_YORK_STATE_RATE,
        sourceHash: createHash("sha256").update(landingHtml).update(pdf).digest("hex"),
        rates: parsed.rates,
        counts: parsed.counts,
        effectivePeriod: `Publication 718 effective ${parsed.effectiveDate}`,
        boundaryStatus: "Publication 718 supplies combined state/local rates and reporting codes. TaxAP preserves those codes and totals, but does not derive a jurisdiction from ZIP code. A+ matching remains withheld because known code aliases and the current Suffolk/Yonkers discrepancies require business review.",
      };
      cachedSnapshot = snapshot;
      cacheExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
      return snapshot;
    } finally { clearTimeout(timeout); }
  })();
  if (bypassCache) return read;
  inFlightRead = read;
  try { return await read; } finally { inFlightRead = null; }
}
