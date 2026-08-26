import assert from "node:assert/strict";
import test from "node:test";
import { SC_COUNTIES, SC_STATE_RATE, parseSt575Table, readOfficialScRates } from "../server/sc-rates.mjs";

const HEADER = "Municipality           County           Local Taxes and Codes              Rate       Accommodations  Unprepared Foods";
const REVISION_LINE = "                                              SOUTH CAROLINA SALES TAX RATE                           (Rev. 2/5/26)";

function municipalityLine({ prefix = "", name, county, rate = 7, accommodations = 8, note = "1% LO", taxes = "LO (2005)" }) {
  return `${prefix}${name}${" ".repeat(2)}${county}${" ".repeat(2)}${taxes}${" ".repeat(2)}${rate}%${" ".repeat(9)}${accommodations}%${" ".repeat(14)}${note}`;
}

function countyLines() {
  return SC_COUNTIES.map((county, index) => {
    // Give one county a distinct rate so the fixture isn't uniform, same trick NC's fixture uses.
    const rate = index === 9 ? 9 : 7;
    return municipalityLine({ name: "Unincorporated", county, rate, accommodations: rate + 1, taxes: `LO (${1000 + index})` });
  });
}

function baseFixtureLines({ omitCounty, duplicateCounty, badRateCounty, extraUnrecognizedLine, duplicateMunicipality } = {}) {
  const lines = [REVISION_LINE, "", HEADER, ""];
  lines.push(municipalityLine({ name: "Abbeville", county: "Abbeville" }));
  lines.push("");
  lines.push(municipalityLine({ prefix: "* ", name: "Andrews", county: "Georgetown", rate: 7, accommodations: 8, taxes: "CP (1022)" }));
  lines.push("");
  lines.push(municipalityLine({ prefix: "* ", name: "Andrews", county: "Williamsburg", rate: 8, accommodations: 9, taxes: "CP (1045), LO (2026)" }));
  lines.push("");
  if (duplicateMunicipality) {
    lines.push(municipalityLine({ prefix: "* ", name: "Andrews", county: "Williamsburg", rate: 8, accommodations: 9, taxes: "CP (1045), LO (2026)" }));
    lines.push("");
  }
  if (extraUnrecognizedLine) {
    lines.push(extraUnrecognizedLine);
    lines.push("");
  }
  // mid-document page break: repeated header + trailing page number, both must be skipped
  lines.push("                                                               1");
  lines.push(HEADER);
  lines.push("");

  let county = countyLines();
  if (omitCounty) county = county.filter((line) => !line.includes(`  ${omitCounty}  `));
  if (duplicateCounty) county = [...county, county.find((line) => line.includes(`  ${duplicateCounty}  `))];
  if (badRateCounty) {
    county = county.map((line) => (line.includes(`  ${badRateCounty}  `) ? municipalityLine({ name: "Unincorporated", county: badRateCounty, rate: 40, accommodations: 41 }) : line));
  }
  lines.push(...county);
  return lines.join("\n");
}

test("parses ST-575's revision date, county rows, and multi-county municipality rows", () => {
  const parsed = parseSt575Table(baseFixtureLines());
  assert.equal(parsed.asOfDate, "2026-02-05");
  assert.equal(parsed.countyRows.length, SC_COUNTIES.length);
  assert.equal(parsed.municipalityRows.length, 3);
  const andrewsRows = parsed.municipalityRows.filter((row) => row.name === "Andrews");
  assert.equal(andrewsRows.length, 2);
  assert.ok(andrewsRows.every((row) => row.multiCounty));
  assert.deepEqual(andrewsRows.map((row) => row.county).sort(), ["Georgetown", "Williamsburg"]);
});

test("rejects a table missing one of SC's 46 counties", () => {
  assert.throws(() => parseSt575Table(baseFixtureLines({ omitCounty: "Cherokee" })), /Cherokee/);
});

test("rejects a table with a duplicate Unincorporated row for the same county", () => {
  assert.throws(() => parseSt575Table(baseFixtureLines({ duplicateCounty: "Aiken" })), /more than one Unincorporated row for Aiken/);
});

test("rejects a table with a duplicate municipality/county pair", () => {
  assert.throws(() => parseSt575Table(baseFixtureLines({ duplicateMunicipality: true })), /Andrews in Williamsburg County more than once/);
});

test("rejects an implausible total rate rather than trusting it", () => {
  assert.throws(() => parseSt575Table(baseFixtureLines({ badRateCounty: "Anderson" })), /implausible total rate/);
});

test("refuses to guess at an unrecognized table line instead of silently dropping it", () => {
  assert.throws(() => parseSt575Table(baseFixtureLines({ extraUnrecognizedLine: "Something Weird Happened Here" })), /unrecognized table line/);
});

test("rejects text with no recognizable revision date", () => {
  assert.throws(() => parseSt575Table("no revision date anywhere\n" + HEADER), /revision date/);
});

test("readOfficialScRates wires the parsed rows into rate/jurisdiction records, keyed by county and municipality", async () => {
  const pdfBuffer = Buffer.concat([Buffer.from("%PDF-1.6"), Buffer.alloc(20_000)]);
  const snapshot = await readOfficialScRates({
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => pdfBuffer }),
    extractText: async () => baseFixtureLines(),
    now: new Date("2026-08-26T00:00:00Z"),
  });
  assert.equal(snapshot.stateCode, "SC");
  assert.equal(snapshot.stateRate, SC_STATE_RATE);
  assert.equal(snapshot.counts.counties, SC_COUNTIES.length);
  assert.equal(snapshot.counts.cities, 3);
  assert.equal(snapshot.rates.length, SC_COUNTIES.length + 3);
  const georgetownAndrews = snapshot.rates.find((rate) => rate.jurisdictionCode === "SC:GEORGETOWN:ANDREWS");
  assert.ok(georgetownAndrews);
  assert.equal(georgetownAndrews.multiCounty, true);
  assert.equal(georgetownAndrews.totalGeneralRate, 7);
});
