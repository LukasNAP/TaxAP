import assert from "node:assert/strict";
import test from "node:test";
import { parseNyRateText } from "../server/ny-rates.mjs";
import { readNewYorkAplusComparison } from "../server/ny-aplus.mjs";

// Publication 718 lists ~77 real rows; the parser validates the total is in a plausible range
// (70-90) as a sanity check that the table format hasn't changed, so this fixture pads out to a
// realistic size with synthetic county rows rather than only the handful of rows this test cares
// about checking - the same "build a full-size fixture" convention docs/state-rollout.md's GA/OH
// tests already use.
const PADDING_ROWS = Array.from({ length: 70 }, (_, index) => `Countyx${String.fromCharCode(97 + (index % 26))} 8 ${String(1000 + index).padStart(4, "0")}`).join(" ");
const FIXTURE_TEXT = `
New York State Sales and Use Tax
Rates by Jurisdiction
Effective March 1, 2025
County or          Tax     Reporting
New York State only            4    0021       Suffolk                     8¾  4711
*Yonkers (city)          8⅞         6511       *New York City               8⅞  8081
Erie                        8¾      1451       Niagara                      8   2911
${PADDING_ROWS}
`;

test("parseNyRateText extracts a flat name/rate/code list from the 3-column layout", () => {
  const parsed = parseNyRateText(FIXTURE_TEXT);
  const byName = new Map(parsed.rows.map((r) => [r.name, r]));
  assert.equal(byName.get("Suffolk").rate, 8.75);
  assert.equal(byName.get("Yonkers (city)").rate, 8.875);
  assert.equal(byName.get("New York City").rate, 8.875);
});

test("parseNyRateText does not merge a preceding physical line into the first table row", () => {
  const parsed = parseNyRateText(`Publication explanation ends here\n${FIXTURE_TEXT}`);
  assert.equal(parsed.rows.find((row) => row.name === "New York State only")?.rate, 4);
});

test("parseNyRateText rejects text with no recognizable heading", () => {
  assert.throws(() => parseNyRateText("Sales tax information"), /Rates by Jurisdiction/);
});

const officialSnapshot = {
  rates: [
    { jurisdictionType: "county", name: "Suffolk", totalGeneralRate: 8.75 },
    { jurisdictionType: "city", name: "Yonkers", totalGeneralRate: 8.875 },
    { jurisdictionType: "city", name: "New York City", totalGeneralRate: 8.875 },
    { jurisdictionType: "county", name: "Niagara", totalGeneralRate: 8 },
    { jurisdictionType: "city", name: "Saratoga Springs", totalGeneralRate: 7 },
  ],
};

test("New York matches confirmed live stale rates on Suffolk and Yonkers", async () => {
  const stateDetail = {
    stateCode: "NY",
    activeShipTos: 3,
    taxBodies: [
      { taxBody: "NY4711", description: "New York Suffolk County", activeShipTos: 1, currentRate: 8.625 },
      { taxBody: "NY6511", description: "New York Yonkers City", activeShipTos: 1, currentRate: 8.375 },
      { taxBody: "NY000", description: null, activeShipTos: 1, currentRate: null, definitionStatus: "missing" },
    ],
  };
  const result = await readNewYorkAplusComparison(stateDetail, { readOfficialNyRates: async () => officialSnapshot });
  const suffolk = result.findings.find((f) => f.taxBody === "NY4711");
  const yonkers = result.findings.find((f) => f.taxBody === "NY6511");
  assert.equal(suffolk.hasDifference, true);
  assert.equal(suffolk.rateDifference, 0.125);
  assert.equal(yonkers.hasDifference, true);
  assert.equal(yonkers.rateDifference, 0.5);
  assert.equal(result.totals.misinputShipTos, 1);
});

test("New York tolerates a confirmed cosmetic typo (Niagra) and a missing City suffix (Saratoga Springs)", async () => {
  const stateDetail = {
    stateCode: "NY",
    activeShipTos: 2,
    taxBodies: [
      { taxBody: "NY2911", description: "New York Niagra County", activeShipTos: 1, currentRate: 8 },
      { taxBody: "NY4131", description: "New York Saratoga Springs", activeShipTos: 1, currentRate: 7 },
    ],
  };
  const result = await readNewYorkAplusComparison(stateDetail, { readOfficialNyRates: async () => officialSnapshot });
  assert.equal(result.findings.every((f) => f.matched), true);
  assert.equal(result.findings.every((f) => !f.hasDifference), true);
});
