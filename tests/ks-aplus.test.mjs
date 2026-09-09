import assert from "node:assert/strict";
import test from "node:test";
import { parseKansasCombinedRows, readKansasAplusComparison } from "../server/ks-aplus.mjs";
const header = { C: "Business Location and Delivery Sales", M: "Total Tax Rate Non Food" };
const ordinary = { A: "Abilene", C: "ABIDK", D: ".0935", H: ".0175", I: ".011", J: "0", K: ".065", M: ".0935", G: "45839" };
const options = { asOfDate: "2026-09-08", minimumRows: 1 };
test("Kansas validates general components and excludes address continuation rows", () => {
  const rates = parseKansasCombinedRows([header, ordinary, { ...ordinary, A: "", B: "public source address" }], options);
  assert.equal(rates.length, 1);
  assert.equal(rates[0].totalGeneralRate, 9.35);
  assert.equal("B" in rates[0], false);
  for (const bad of [{ ...ordinary, M: ".1" }, { ...ordinary, G: "50000" }, { ...ordinary, K: "" }]) assert.throws(() => parseKansasCombinedRows([header, bad], options), /Kansas/);
  assert.throws(() => parseKansasCombinedRows([header, ordinary, ordinary], options), /duplicated/);
});
test("Kansas requires unique full names and preserves county and special-district distinctions", async () => {
  const rates = [{ name: "Abilene", jurisdictionCode: "ABIDK", totalGeneralRate: 9.35 }, { name: "Holton", jurisdictionCode: "HOLJA", totalGeneralRate: 8.9 }, { name: "Abilene CID", jurisdictionCode: "ABIC4", totalGeneralRate: 11.35, specialDistrict: true }];
  const rows = [["KS004", "Kansas Abilene"], ["KSHOLJA", "Kansas Holton"], ["KS123", "Kansas Abilene CID"], ["KSABIC4", "Kansas Abilene CID"], ["KS004", "Kansas Abilene County"], ["KS000", "Kansas Abilene"], ["KSXXXXX", "Kansas Holton"]];
  const result = await readKansasAplusComparison({ stateCode: "KS", activeShipTos: rows.length, taxBodies: rows.map(([taxBody, description]) => ({ taxBody, description, currentRate: 8, activeShipTos: 1 })) }, { readOfficial: async () => ({ rates }) });
  assert.equal(result.totals.comparedShipTos, 3);
  assert.equal(result.totals.unmatchedShipTos, 4);
  const duplicate = await readKansasAplusComparison({ stateCode: "KS", taxBodies: [{ taxBody: "KS004", description: "Kansas Abilene", currentRate: 8 }] }, { readOfficial: async () => ({ rates: [rates[0], rates[0]] }) });
  assert.equal(duplicate.findings[0].matched, false);
});
