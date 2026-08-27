import assert from "node:assert/strict";
import test from "node:test";
import { parseVirginiaRateWorkbook } from "../server/va-rates.mjs";
import { readVirginiaAplusComparison } from "../server/va-aplus.mjs";

test("parseVirginiaRateWorkbook rejects a workbook with the wrong header", () => {
  assert.throws(() => parseVirginiaRateWorkbook(Buffer.from("not an xlsx")), /Error/);
});

const officialSnapshot = {
  rates: [
    { jurisdictionType: "county", name: "Richmond County", bareName: "Richmond", totalGeneralRate: 5.3 },
    { jurisdictionType: "city", name: "Richmond City", bareName: "Richmond", totalGeneralRate: 6 },
    { jurisdictionType: "county", name: "Pittsylvania County", bareName: "Pittsylvania", totalGeneralRate: 6.3 },
    { jurisdictionType: "city", name: "Waynesboro City", bareName: "Waynesboro", totalGeneralRate: 5.3 },
  ],
};

test("Virginia disambiguates a county/city name-duplicate pair by the (city) suffix", async () => {
  const stateDetail = {
    stateCode: "VA",
    activeShipTos: 3,
    taxBodies: [
      { taxBody: "VA076", description: "Virginia Richmond", activeShipTos: 1, currentRate: 5.3 },
      { taxBody: "VA216", description: "Virginia Richmond (city)", activeShipTos: 1, currentRate: 6 },
      { taxBody: "VA071", description: "Virginia Pittsylvania", activeShipTos: 1, currentRate: 5.3 },
    ],
  };
  const result = await readVirginiaAplusComparison(stateDetail, { readOfficialVaRates: async () => officialSnapshot });
  const richmondCounty = result.findings.find((f) => f.taxBody === "VA076");
  const richmondCity = result.findings.find((f) => f.taxBody === "VA216");
  const pittsylvania = result.findings.find((f) => f.taxBody === "VA071");
  assert.equal(richmondCounty.officialRate, 5.3);
  assert.equal(richmondCounty.hasDifference, false, "Richmond County's own rate is correct - the real issue is ship-to assignment, not this code's rate");
  assert.equal(richmondCity.officialRate, 6);
  assert.equal(pittsylvania.hasDifference, true);
  assert.equal(pittsylvania.rateDifference, 1);
});

test("Virginia falls back to the city row for a standalone city with no county name-duplicate", async () => {
  const stateDetail = { stateCode: "VA", activeShipTos: 1, taxBodies: [{ taxBody: "VA084", description: "Virginia Waynesboro", activeShipTos: 1, currentRate: 5.3 }] };
  const result = await readVirginiaAplusComparison(stateDetail, { readOfficialVaRates: async () => officialSnapshot });
  assert.equal(result.findings[0].officialRate, 5.3);
  assert.equal(result.findings[0].matched, true);
});

test("Virginia handles the hyphenated 'Virginia-Danville' description", async () => {
  const stateDetail = { stateCode: "VA", activeShipTos: 1, taxBodies: [{ taxBody: "VA205", description: "Virginia-Danville", activeShipTos: 1, currentRate: 6.3 }] };
  const snapshot = { rates: [{ jurisdictionType: "city", name: "Danville City", bareName: "Danville", totalGeneralRate: 6.3 }] };
  const result = await readVirginiaAplusComparison(stateDetail, { readOfficialVaRates: async () => snapshot });
  assert.equal(result.findings[0].matched, true);
  assert.equal(result.findings[0].hasDifference, false);
});
