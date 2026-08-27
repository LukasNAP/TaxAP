import assert from "node:assert/strict";
import test from "node:test";
import { readAlabamaAplusComparison } from "../server/al-aplus.mjs";

const officialSnapshot = {
  rates: [
    { jurisdictionType: "county", jurisdictionCode: "7049", name: "MOBILE COUNTY", componentRate: 1.5, totalGeneralRate: 5.5 },
    { jurisdictionType: "city", jurisdictionCode: "9149", name: "MOBILE", componentRate: 5, totalGeneralRate: 10.5 },
    { jurisdictionType: "city", jurisdictionCode: "7058", name: "SHELBY COUNTY", componentRate: 1, totalGeneralRate: 5 },
    { jurisdictionType: "city", jurisdictionCode: "9137", name: "BIRMINGHAM", componentRate: 4, totalGeneralRate: null },
  ],
  countyRatesByName: { JEFFERSON: 2, SHELBY: 1 },
};

test("Alabama matches a single-county city by its own numeric locality code", async () => {
  const stateDetail = { stateCode: "AL", activeShipTos: 1, taxBodies: [{ taxBody: "AL9149", description: "Alabama Mobile", activeShipTos: 1, currentRate: 9.5 }] };
  const result = await readAlabamaAplusComparison(stateDetail, { readOfficialAlRates: async () => officialSnapshot });
  assert.equal(result.findings[0].officialRate, 10.5);
  assert.equal(result.findings[0].hasDifference, true);
  assert.equal(result.findings[0].rateDifference, 1);
});

test("Alabama refuses to trust a reused locality-code number that names a different place", async () => {
  // AL7058's own code (7058) is Shelby County's own CSV locality code, reused by A+ for
  // "Birmingham within Shelby" - the CSV name ("SHELBY COUNTY") doesn't contain "Birmingham", so
  // this must be reported unmatched rather than compared against Shelby County's own rate.
  const stateDetail = { stateCode: "AL", activeShipTos: 1, taxBodies: [{ taxBody: "AL7058", description: "Alabama Birmingham(Shelby", activeShipTos: 1, currentRate: 9 }] };
  const result = await readAlabamaAplusComparison(stateDetail, { readOfficialAlRates: async () => officialSnapshot });
  assert.equal(result.findings[0].matched, false);
  assert.equal(result.findings[0].officialRate, null);
});

test("Alabama uses a parenthetical county hint to combine a multi-county city's real total", async () => {
  const stateDetail = { stateCode: "AL", activeShipTos: 1, taxBodies: [{ taxBody: "AL9137", description: "Alabama Birmingham (Jefferson)", activeShipTos: 1, currentRate: 10 }] };
  const result = await readAlabamaAplusComparison(stateDetail, { readOfficialAlRates: async () => officialSnapshot });
  assert.equal(result.findings[0].officialRate, 10); // 4 (state) + 2 (Jefferson) + 4 (Birmingham's own)
  assert.equal(result.findings[0].hasDifference, false);
});

test("Alabama treats AL000, equipment-suffixed codes, and Police Jurisdiction codes as out of scope", async () => {
  const stateDetail = {
    stateCode: "AL", activeShipTos: 3,
    taxBodies: [
      { taxBody: "AL000", description: null, activeShipTos: 1, currentRate: null, definitionStatus: "missing" },
      { taxBody: "AL7049E", description: "Alabama Mobile Co. Equip", activeShipTos: 1, currentRate: 1.5 },
      { taxBody: "AL7157", description: "Alabama Russell Co PJ", activeShipTos: 1, currentRate: 6.5 },
    ],
  };
  const result = await readAlabamaAplusComparison(stateDetail, { readOfficialAlRates: async () => officialSnapshot });
  assert.equal(result.totals.misinputShipTos, 3);
  assert.equal(result.totals.comparedShipTos, 0);
});
