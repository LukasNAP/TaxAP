import assert from "node:assert/strict";
import test from "node:test";
import { readArizonaAplusComparison } from "../server/az-aplus.mjs";

const officialSnapshot = {
  rates: [
    { jurisdictionType: "county", name: "PINAL", componentRate: 6.7, totalGeneralRate: 6.7 },
    { jurisdictionType: "county", name: "NAVAJO", componentRate: 6.43, totalGeneralRate: 6.43 },
    { jurisdictionType: "county", name: "YUMA", componentRate: 6.712, totalGeneralRate: 6.712 },
    { jurisdictionType: "city", name: "MARICOPA", county: "PINAL", componentRate: 2.5, totalGeneralRate: 9.2 },
    { jurisdictionType: "city", name: "TAYLOR", county: null, componentRate: 3, totalGeneralRate: null },
    { jurisdictionType: "city", name: "YUMA", county: "YUMA", componentRate: 1.7, totalGeneralRate: 8.412 },
  ],
};

test("Arizona treats a bare place name with no Co suffix as a city, even if it shares a county's name", async () => {
  const stateDetail = { stateCode: "AZ", activeShipTos: 1, taxBodies: [{ taxBody: "AZ4002", description: "Arizona Yuma", activeShipTos: 1, currentRate: 8.41 }] };
  const result = await readArizonaAplusComparison(stateDetail, { readOfficialAzRates: async () => officialSnapshot });
  assert.equal(result.findings[0].officialRate, 8.412);
  assert.equal(result.findings[0].hasDifference, false);
});

test("Arizona resolves a city+county-named code (Maricopa/Pinal) to the summed total, not the bare county rate", async () => {
  const stateDetail = { stateCode: "AZ", activeShipTos: 1, taxBodies: [{ taxBody: "AZ203", description: "ARIZONA MARICOPA PINAL CO", activeShipTos: 1, currentRate: 6.7 }] };
  const result = await readArizonaAplusComparison(stateDetail, { readOfficialAzRates: async () => officialSnapshot });
  assert.equal(result.findings[0].officialRate, 9.2);
  assert.equal(result.findings[0].hasDifference, true);
  assert.equal(result.findings[0].rateDifference, 2.5);
});

test("Arizona resolves a self-describing '<City> <County> Co' code even when the city isn't in the static crosswalk", async () => {
  const stateDetail = { stateCode: "AZ", activeShipTos: 1, taxBodies: [{ taxBody: "AZ4052", description: "Arizona Taylor Navajo Co", activeShipTos: 1, currentRate: 6.43 }] };
  const result = await readArizonaAplusComparison(stateDetail, { readOfficialAzRates: async () => officialSnapshot });
  assert.equal(result.findings[0].officialRate, 9.43);
  assert.equal(result.findings[0].rateDifference, 3);
});

test("Arizona treats AZ000 and ZTEMP as misinputs", async () => {
  const stateDetail = {
    stateCode: "AZ", activeShipTos: 2,
    taxBodies: [
      { taxBody: "AZ000", description: "Arizona no tax", activeShipTos: 1, currentRate: 0 },
      { taxBody: "ZTEMP", description: "TAX BODY TEMP USE", activeShipTos: 1, currentRate: 0 },
    ],
  };
  const result = await readArizonaAplusComparison(stateDetail, { readOfficialAzRates: async () => officialSnapshot });
  assert.equal(result.totals.misinputShipTos, 2);
  assert.equal(result.totals.comparedShipTos, 0);
});

test("Arizona never reports a resolved-but-null official total as a confident 0% mismatch", async () => {
  const stateDetail = { stateCode: "AZ", activeShipTos: 1, taxBodies: [{ taxBody: "AZ9999", description: "Arizona Someplace Nowhere", activeShipTos: 1, currentRate: 7 }] };
  const result = await readArizonaAplusComparison(stateDetail, { readOfficialAzRates: async () => officialSnapshot });
  assert.equal(result.findings[0].matched, false);
  assert.equal(result.findings[0].officialRate, null);
  assert.equal(result.findings[0].hasDifference, false);
});
