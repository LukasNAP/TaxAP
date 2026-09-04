import assert from "node:assert/strict";
import test from "node:test";
import {
  NEW_YORK_EXPECTED_RATE_ROWS,
  findNewYorkPublicationUrl,
  parseNewYorkPublicationText,
  readOfficialNyRates,
} from "../server/ny-rates.mjs";

function publicationFixture({ duplicate = false, stateRate = "4" } = {}) {
  const letters = (index) => `${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`;
  const countyRows = [
    ["Suffolk", "8¾", "4711"],
    ["Westchester – except", "8⅜", "5581"],
    ...Array.from({ length: 55 }, (_, index) => [`County ${letters(index)}`, "8", String(6000 + index)]),
  ];
  const cityRows = [
    ["New York City", "8⅞", "8081"],
    ["Yonkers (city)", "8⅞", "6511"],
    ["White Plains (city)", "8⅜", "6513"],
    ...Array.from({ length: 16 }, (_, index) => [`City ${letters(index)} (city)`, "8", String(7000 + index)]),
  ];
  const entries = [["New York State only", stateRate, "0021"], ...countyRows, ...cityRows];
  if (duplicate) entries.at(-1)[2] = "0021";
  assert.equal(entries.length, NEW_YORK_EXPECTED_RATE_ROWS);
  return `Publication 718\nEffective March 1, 2025\n${entries.map((row) => row.join(" ")).join("   ")}`;
}

test("resolves Publication 718 from New York's current-rate landing page", () => {
  assert.equal(
    findNewYorkPublicationUrl('<a href="/pdf/publications/sales/pub718.pdf">Publication 718</a>'),
    "https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf",
  );
  assert.throws(() => findNewYorkPublicationUrl("<main>No PDF</main>"), /did not link Publication 718/);
});

test("parses all reviewed New York combined-rate rows and exact fractional rates", () => {
  const parsed = parseNewYorkPublicationText(publicationFixture());
  assert.equal(parsed.effectiveDate, "2025-03-01");
  assert.deepEqual(parsed.counts, { counties: 57, cities: 19, specialJurisdictions: 0 });
  assert.equal(parsed.rates.length, NEW_YORK_EXPECTED_RATE_ROWS);
  assert.equal(parsed.rates.find((row) => row.reportingCode === "4711").totalGeneralRate, 8.75);
  assert.equal(parsed.rates.find((row) => row.reportingCode === "6511").componentRate, 4.875);
  assert.equal(parsed.rates.find((row) => row.reportingCode === "6513").totalGeneralRate, 8.375);
});

test("fails closed when Publication 718's reviewed inventory or state rate changes", () => {
  assert.throws(() => parseNewYorkPublicationText(publicationFixture().replace(/City AP \(city\) 8 7015/, "")), /76 rate rows/);
  assert.throws(() => parseNewYorkPublicationText(publicationFixture({ duplicate: true })), /repeats reporting code/);
  assert.throws(() => parseNewYorkPublicationText(publicationFixture({ stateRate: "5" })), /state-only row changed/);
});

test("returns a linked New York snapshot while keeping ZIP and A+ matching unresolved", async () => {
  const html = '<html><body><a href="/pdf/publications/sales/pub718.pdf">Publication 718</a></body></html>'.padEnd(5_001, " ");
  const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(20_000)]);
  const snapshot = await readOfficialNyRates({
    fetchImpl: async (url) => String(url).endsWith("pub718.pdf") ? new Response(pdf) : new Response(html),
    extractTextImpl: async () => publicationFixture(),
    now: new Date("2026-09-03T12:00:00Z"),
    bypassCache: true,
  });
  assert.equal(snapshot.stateCode, "NY");
  assert.equal(snapshot.stateRate, 4);
  assert.equal(snapshot.rates.length, NEW_YORK_EXPECTED_RATE_ROWS);
  assert.match(snapshot.boundaryStatus, /does not derive a jurisdiction from ZIP code/);
  assert.match(snapshot.boundaryStatus, /Suffolk\/Yonkers/);
});
