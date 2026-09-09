import assert from "node:assert/strict";
import test from "node:test";
import { readMissouriAplusComparison } from "../server/mo-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";
const rate = (name, totalGeneralRate, generalInterstateRate = totalGeneralRate) => ({ name, totalGeneralRate, generalInterstateRate });
test("Missouri requires full unique names and equal sales/use totals", async () => {
  const rates = [rate("ANDREW COUNTY", 6.425), rate("JOPLIN JASPER COUNTY", 8), rate("EXAMPLE COUNTY", 7, 6), rate("DUPLICATE", 7), rate("DUPLICATE", 7)];
  const rows = [["MO003", "Missouri Andrew Co."], ["MO097", "Missouri Joplin"], ["MO004", "Missouri Example County"], ["MO005", "Missouri Duplicate"], ["MO9999", "Missouri Andrew County"], ["MO000", "Missouri Andrew County"], ["MO006", "Missouri Andrew County Ambulance District"]];
  const result = await readMissouriAplusComparison({ stateCode: "MO", activeShipTos: rows.length, taxBodies: rows.map(([taxBody, description]) => ({ taxBody, description, currentRate: 6, activeShipTos: 1 })) }, { readOfficial: async () => ({ rates }) });
  assert.equal(result.totals.comparedShipTos, 1);
  assert.equal(result.totals.unmatchedShipTos, 6);
  assert.equal(directMappingFindingsFromReconciliation(result).length, 1);
});
test("Missouri source failures are not converted to empty success", async () => {
  await assert.rejects(readMissouriAplusComparison({}, { readOfficial: async () => { throw new Error("unavailable"); } }), /unavailable/);
});
