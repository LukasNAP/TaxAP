import assert from "node:assert/strict";
import test from "node:test";
import { parseMinnesotaCombinedText, readMinnesotaAplusComparison, readMinnesotaCombinedRates, parseMinnesotaMap, readMinnesotaMapRates } from "../server/mn-aplus.mjs";
const text = `Effective 7/1/2026 – 9/30/2026
o Metro Area Sales and Use Tax for Housing (0.25%)
County/City Local Area
Austin, City of 0.50% 0.50% 6.875% 7.875%
Blaine* 1.00% 0.25% 6.875% 8.125%
Townships: Atlanta, Audubon 0.50% 6.875% 7.375%`;
test("Minnesota draft parser validates period and components without treating township lists as cities", () => {
  const rates = parseMinnesotaCombinedText(text, { asOfDate: "2026-09-09", minimumRows: 2 });
  assert.equal(rates.length, 2);
  assert.equal(rates[0].name, "Austin");
  assert.equal(rates[1].ambiguousArea, true);
  assert.throws(() => parseMinnesotaCombinedText(text, { asOfDate: "2026-10-01", minimumRows: 2 }), /date/);
  assert.throws(() => parseMinnesotaCombinedText(text.replace("7.875%", "8.875%"), { asOfDate: "2026-09-09", minimumRows: 2 }), /component/);
});
test("Minnesota draft keeps multiple-area, county and unknown assignments unmatched", async () => {
  const rates = parseMinnesotaCombinedText(text, { asOfDate: "2026-09-09", minimumRows: 2 });
  const result = await readMinnesotaAplusComparison({ stateCode: "MN", taxBodies: ["Austin", "Blaine", "Hennepin Co.", "No Local Rate"].map((name, i) => ({ taxBody: `MN${100+i}`, description: `Minnesota ${name}`, currentRate: 7, activeShipTos: 1 })) }, { readOfficial: async () => ({ rates }) });
  assert.equal(result.totals.comparedShipTos, 1);
  assert.equal(result.totals.unmatchedShipTos, 3);
});
test("Minnesota refuses a missing current guide instead of using next quarter", async () => {
  const urls = [];
  await assert.rejects(readMinnesotaCombinedRates({ now: new Date("2026-09-09"), fetchImpl: async (url) => {
    urls.push(url);
    return urls.length === 1 ? { ok: true, text: async () => '<a href="/local-sales-and-use-tax-rate-guide-2026-q4.pdf">Guide</a>' } : { ok: false };
  } }), /unavailable/);
  assert.match(urls[1], /2026-q3/);
});

test("Minnesota map includes metro components and refuses partial or inconsistent totals", () => {
  const attributes = { NameLabel: "Hennepin County", NameFrmal: "Hennepin", CountyName: "Hennepin", StFrmal: "6.875%", CtyFrmal: "0.15%", Spec01Frmal: "0.5%", Spec03Frmal: "0.75%", Spec04Frmal: "0.25%", TotalFrmal: "8.525%" };
  const data = { features: [{ attributes }] };
  assert.equal(parseMinnesotaMap(data, { minimumRows: 1 })[0].totalGeneralRate, 8.525);
  assert.throws(() => parseMinnesotaMap({ ...data, exceededTransferLimit: true }, { minimumRows: 1 }), /incomplete/);
  assert.throws(() => parseMinnesotaMap({ features: [{ attributes: { ...attributes, TotalFrmal: "7.525%" } }] }, { minimumRows: 1 }), /disagree/);
  assert.equal(parseMinnesotaMap({ features: [{ attributes: { ...attributes, NameFrmal: "Wrong" } }] }, { minimumRows: 1 })[0].ambiguousArea, true);
});
test("Minnesota map matching preserves conflicting totals and official identity mismatches", async () => {
  const rates = [{ name: "Hennepin County", totalGeneralRate: 8.525 }, { name: "St Cloud Area", totalGeneralRate: 7.875 }, { name: "St Cloud Area", totalGeneralRate: 8 }, { name: "Mankato", totalGeneralRate: 7.875, ambiguousArea: true }];
  const result = await readMinnesotaAplusComparison({ stateCode: "MN", taxBodies: ["Hennepin Co.", "St Cloud Area", "Mankato"].map((name, i) => ({ taxBody: `MN${100+i}`, description: `Minnesota ${name}`, currentRate: 7, activeShipTos: 1 })) }, { readOfficial: async () => ({ rates }) });
  assert.equal(result.totals.comparedShipTos, 1);
  assert.equal(result.totals.unmatchedShipTos, 2);
});
test("Minnesota map refuses to select a different quarter", async () => {
  await assert.rejects(readMinnesotaMapRates({ now: new Date("2026-09-09"), fetchImpl: async () => ({ ok: true, json: async () => ({ operationalLayers: [{ title: "locgnrl_sales_usetax_areas_2026Q4", url: "https://example.test" }] }) }) }), /current-period/);
});
