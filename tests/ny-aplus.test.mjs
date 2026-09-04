import assert from "node:assert/strict";
import test from "node:test";
import { readNewYorkAplusComparison } from "../server/ny-aplus.mjs";

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
