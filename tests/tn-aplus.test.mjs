import assert from "node:assert/strict";
import test from "node:test";
import { reconcileTennesseeInventory, readTennesseeAplusComparison } from "../server/tn-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";
const attributes = (situs, cityfips = null, extra = {}) => ({ situs, cityfips, stjfips: null, county: "DAVIDSON", generalrateintrastate: .0225, generalrateinterstate: .0225, generalsurchargeintrastate: .005, generalsurchargeinterstate: .005, cbid: null, ...extra });
const data = { features: [attributes("1900"), attributes("1901", 52006), attributes("1905", null, { stjfips: 91905 })].map((attributes) => ({ attributes })) };
const sst = { stateRate: 7, rates: [{ jurisdictionType: "county", name: "Davidson County", componentRate: 2.25 }, { jurisdictionType: "city", jurisdictionCode: "52006", name: "Nashville-Davidson metropolitan government (balance)", componentRate: 2.25 }] };
const options = { minimumRows: 3, expectedCounties: 1 };
test("Tennessee includes the transit surcharge and preserves unidentified special jurisdictions", async () => {
  const rates = reconcileTennesseeInventory(data, sst, options);
  assert.equal(rates[0].totalGeneralRate, 9.75);
  assert.equal(rates[1].totalGeneralRate, 9.75);
  assert.equal(rates[2].totalGeneralRate, null);
  const rows = [ ["TN1900", "Tennessee Davidson Co.", 9.75], ["TN1900", "Tennessee Davidson Co.", 9.25],
    ["TN1901", "Tennessee Nashville", 9.75], ["TN1905", "Tennessee Berry Hill", 9.75], ["TN000", null, null] ];
  const result = await readTennesseeAplusComparison({ stateCode: "TN", activeShipTos: 5, taxBodies: rows.map(([taxBody, description, currentRate]) => ({ taxBody, description, currentRate, activeShipTos: 1 })) }, { readOfficial: async () => ({ rates }) });
  assert.equal(result.totals.comparedShipTos, 2);
  assert.equal(result.totals.unmatchedShipTos, 3);
  assert.equal(directMappingFindingsFromReconciliation(result).length, 1);
});
test("Tennessee fails closed for partial inventory and disagreed or invalid components", () => {
  for (const invalid of [{ ...data, exceededTransferLimit: true }, { ...data, features: data.features.slice(1) },
    { features: data.features.map((x, i) => i ? x : { attributes: { ...x.attributes, generalrateintrastate: null } }) }]) {
    assert.throws(() => reconcileTennesseeInventory(invalid, sst, options), /Tennessee/);
  }
  assert.throws(() => reconcileTennesseeInventory(data, { ...sst, rates: sst.rates.map((x) => ({ ...x, componentRate: 2.75 })) }, options), /disagree/);
});
test("Tennessee never chooses one of multiple records for a SITUS code", async () => {
  const rate = { jurisdictionCode: "1900", name: "Davidson County", totalGeneralRate: 9.75 };
  const result = await readTennesseeAplusComparison({ stateCode: "TN", taxBodies: [{ taxBody: "TN1900", description: "Tennessee Davidson Co.", currentRate: 9.25, activeShipTos: 1 }] }, { readOfficial: async () => ({ rates: [rate, { ...rate, totalGeneralRate: null }] }) });
  assert.equal(result.findings[0].matched, false);
  await assert.rejects(readTennesseeAplusComparison({}, { readOfficial: async () => { throw new Error("unavailable"); } }), /unavailable/);
});
