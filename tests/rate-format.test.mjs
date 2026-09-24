import test from "node:test";
import assert from "node:assert/strict";
import { formatRate, formatRateText } from "../app/rate-format.ts";
import { inventoryCsv } from "../app/jurisdiction-inventory.ts";
test("rates always show three decimal places without rescaling", () => {
  for (const [input, expected] of [[0,"0.000%"],[7,"7.000%"],[6.5,"6.500%"],[6.625,"6.625%"],[8.875,"8.875%"],[0.001,"0.001%"]]) assert.equal(formatRate(input),expected);
});
test("historical and descriptive percentages keep signs and tax-body identifiers", () => {
  assert.equal(formatRateText("7.25% to 8.25%, +1% and -0.25%; NC7%CR NC6.75%"), "7.250% to 8.250%, +1.000% and -0.250%; NC7%CR NC6.75%");
});
test("CSV formats rates to three decimals and preserves unknown values", () => {
  const csv=inventoryCsv([{stateCode:"NJ",jurisdictionName:"Example",jurisdictionType:"state",taxBody:"NJ000",officialRate:6.625,componentRate:null,aplusRate:7,shipTos:2,comparisonStatus:"mismatch",effectiveDate:null,sourceStatus:"validated",reviewStatus:null}]);
  assert.ok(csv.includes('"6.625","","7.000","2"'));
});
