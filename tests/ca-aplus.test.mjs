import assert from "node:assert/strict";
import test from "node:test";
import { readCaliforniaAplusComparison } from "../server/ca-aplus.mjs";

const officialSnapshot = {
  rates: [
    { jurisdictionType: "county", name: "Los Angeles", county: "Los Angeles", totalGeneralRate: 9.75 },
    { jurisdictionType: "city", name: "Carson", county: "Los Angeles", totalGeneralRate: 10.5 },
    { jurisdictionType: "county", name: "Sacramento", county: "Sacramento", totalGeneralRate: 7.75 },
    { jurisdictionType: "city", name: "Sacramento", county: "Sacramento", totalGeneralRate: 8.75 },
    { jurisdictionType: "county", name: "San Bernardino", county: "San Bernardino", totalGeneralRate: 7.75 },
    { jurisdictionType: "city", name: "San Bernardino", county: "San Bernardino", totalGeneralRate: 8.75 },
    { jurisdictionType: "city", name: "Carmel-by-the-Sea", county: "Monterey", totalGeneralRate: 9.25 },
    { jurisdictionType: "city", name: "City of Commerce", county: "Los Angeles", totalGeneralRate: 10.5 },
    { jurisdictionType: "city", name: "Springfield", county: "One", totalGeneralRate: 8 },
    { jurisdictionType: "city", name: "Springfield", county: "Two", totalGeneralRate: 9 },
  ],
};

test("California uses A+'s explicit county and city markers, including known abbreviations", async () => {
  const result = await readCaliforniaAplusComparison({
    stateCode: "CA", activeShipTos: 7,
    taxBodies: [
      { taxBody: "CA1070", description: "California Los Angeles Co", activeShipTos: 2, currentRate: 10.25 },
      { taxBody: "CA1079", description: "California Carson", activeShipTos: 1, currentRate: 10.25 },
      { taxBody: "CA1203", description: "California San Bern Co.", activeShipTos: 1, currentRate: 7.75 },
      { taxBody: "CA1199", description: "California Sacramento(Cty", activeShipTos: 1, currentRate: 8.75 },
      { taxBody: "CA1080", description: "California Commerce", activeShipTos: 1, currentRate: 10.25 },
      { taxBody: "CA1145", description: "California CarmelbytheSea", activeShipTos: 1, currentRate: 9.25 },
    ],
  }, { readOfficialCaRates: async () => officialSnapshot });
  assert.deepEqual(result.findings.map((finding) => finding.officialRate), [9.75, 10.5, 7.75, 8.75, 10.5, 9.25]);
  assert.equal(result.findings[0].hasDifference, true);
  assert.equal(result.findings[1].hasDifference, true);
  assert.equal(result.findings[2].hasDifference, false);
  assert.equal(result.findings[3].hasDifference, false);
  assert.equal(result.findings[4].hasDifference, true);
  assert.equal(result.findings[5].hasDifference, false);
});

test("California does not pick between same-named official cities in different counties", async () => {
  const result = await readCaliforniaAplusComparison({
    stateCode: "CA", activeShipTos: 1,
    taxBodies: [{ taxBody: "CA9999", description: "California Springfield", activeShipTos: 1, currentRate: 8 }],
  }, { readOfficialCaRates: async () => officialSnapshot });
  assert.equal(result.findings[0].matched, false);
  assert.equal(result.findings[0].hasDifference, false);
});

test("California keeps missing-definition and equipment tax bodies as visible exclusions", async () => {
  const result = await readCaliforniaAplusComparison({
    stateCode: "CA", activeShipTos: 3,
    taxBodies: [
      { taxBody: "CA000", description: null, definitionStatus: "missing", activeShipTos: 2, currentRate: null },
      { taxBody: "CA1034E", description: "California FresnoCo EQUIP", definitionStatus: "configured", activeShipTos: 1, currentRate: 4.413 },
    ],
  }, { readOfficialCaRates: async () => officialSnapshot });
  assert.equal(result.totals.misinputShipTos, 3);
  assert.equal(result.findings.length, 0);
});
