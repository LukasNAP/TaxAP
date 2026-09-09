import assert from "node:assert/strict";
import test from "node:test";
import { southCarolinaTablePage } from "../server/sc-pdf.mjs";
import { readSouthCarolinaAplusComparison } from "../server/sc-aplus.mjs";
const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
test("SC PDF row reconstruction keeps wrapped names and displaced county baselines with their own rate", () => {
  const items = [item("Municipality",36,733),item("County",140,733),item("North",36,714),item("Example",36,705),item("York",140,709),item("LO (1234)",209,709),item("7%",375,709),item("8%",440,709),item("1% LO",518,709),item("Next City",36,689),item("York",140,688),item("CP (1235)",209,689),item("8%",375,689),item("9%",440,689),item("0%",518,689)];
  const text = southCarolinaTablePage(items);
  assert.ok(text.startsWith("North Example  York  LO (1234)  7%  8%  1% LO\nNext City"));
  assert.throws(() => southCarolinaTablePage(items.filter((x) => x.str !== "County")), /coordinates/);
});
test("SC assigned-name comparisons reject multi-county municipalities and unknown identities", async () => {
  const rates = [{ jurisdictionType: "county", county: "Greenville", name: "Greenville County (unincorporated)", totalGeneralRate: 6 }, { jurisdictionType: "city", municipality: "Greenville", name: "Greenville", totalGeneralRate: 6 }, { jurisdictionType: "city", municipality: "Charleston", multiCounty: true, totalGeneralRate: 9 }];
  const rows = ["SC 01023 Greenville Co", "SC 02362 Greenville", "SC 02130 Charleston", "SC 09999 Unknown"];
  const result = await readSouthCarolinaAplusComparison({ stateCode: "SC", taxBodies: rows.map((description, i) => ({ taxBody: `SC${100+i}`, description, currentRate: 7, activeShipTos: 1 })) }, { readOfficial: async () => ({ rates }) });
  assert.equal(result.totals.comparedShipTos, 2);
  assert.equal(result.totals.unmatchedShipTos, 2);
  await assert.rejects(readSouthCarolinaAplusComparison({}, { readOfficial: async () => { throw new Error("source failed"); } }), /source failed/);
});
