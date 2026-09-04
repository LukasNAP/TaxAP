import assert from "node:assert/strict";
import test from "node:test";
import { readTexasAplusComparison } from "../server/tx-aplus.mjs";

const officialSnapshot = {
  rates: [
    { name: "Dallas (Collin Co)", county: "Collin", totalGeneralRate: 8.25 },
    { name: "Dallas (Dallas Co)", county: "Dallas", totalGeneralRate: 8.25 },
    { name: "Carrollton (Collin Co)", county: "Collin", totalGeneralRate: 8.25 },
    { name: "Carrollton (Dallas Co)", county: "Dallas", totalGeneralRate: 8.25 },
    { name: "Garland", county: null, totalGeneralRate: 6.75 },
    { name: "Garland (Dallas Co)", county: "Dallas", totalGeneralRate: 8.25 },
    { name: "Midland", county: null, totalGeneralRate: 8.25 },
    { name: "Midland (Martin Co)", county: "Martin", totalGeneralRate: 7.5 },
  ],
};

test("Texas compares uniform county variants and explicit A+ county hints without choosing a county", async () => {
  const result = await readTexasAplusComparison({
    stateCode: "TX", activeShipTos: 4,
    taxBodies: [
      { taxBody: "TX0555", description: "Texas Dallas", activeShipTos: 2, currentRate: 8.25 },
      { taxBody: "TX0344", description: "Texas Carrollton(CollinCo", activeShipTos: 2, currentRate: 8.25 },
    ],
  }, { readOfficialTxRates: async () => officialSnapshot });
  assert.equal(result.findings.every((finding) => finding.matched), true);
  assert.equal(result.findings.every((finding) => !finding.hasDifference), true);
  assert.match(result.findings[0].jurisdictionLabel, /official variants; same rate/);
});

test("Texas leaves an ambiguous code unmatched when its A+ rate matches one valid county candidate", async () => {
  const result = await readTexasAplusComparison({
    stateCode: "TX", activeShipTos: 1,
    taxBodies: [{ taxBody: "TX0792", description: "Texas Garland", activeShipTos: 1, currentRate: 8.25 }],
  }, { readOfficialTxRates: async () => officialSnapshot });
  assert.equal(result.findings[0].matched, false);
  assert.equal(result.findings[0].hasDifference, false);
});

test("Texas flags Midland when A+ matches none of the official candidates", async () => {
  const result = await readTexasAplusComparison({
    stateCode: "TX", activeShipTos: 9,
    taxBodies: [{ taxBody: "TX1421", description: "Texas Midland", activeShipTos: 9, currentRate: 8 }],
  }, { readOfficialTxRates: async () => officialSnapshot });
  assert.equal(result.findings[0].matched, true);
  assert.equal(result.findings[0].officialRate, 8.25);
  assert.equal(result.findings[0].rateDifference, 0.25);
  assert.equal(result.findings[0].hasDifference, true);
});

test("Texas keeps a missing TX000 definition as a visible misinput exclusion", async () => {
  const result = await readTexasAplusComparison({
    stateCode: "TX", activeShipTos: 2,
    taxBodies: [{ taxBody: "TX000", description: null, activeShipTos: 2, currentRate: null, definitionStatus: "missing" }],
  }, { readOfficialTxRates: async () => officialSnapshot });
  assert.equal(result.totals.misinputShipTos, 2);
  assert.equal(result.findings.length, 0);
});
