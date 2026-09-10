import assert from "node:assert/strict";
import test from "node:test";
import { parseVermontSalesAreas, readVermontAplusComparison, readVermontSalesRates } from "../server/vt-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";

const now = new Date("2026-09-09T12:00:00Z");
const stamp = (day) => Date.parse(`${day}T04:00:00Z`);
const area = (name, sales = 0.06, start = null, end = null) => ({ attributes: { TOWNNAME: name, Sales: sales, LOT_Sales: sales === 0.07 ? "Y" : "N", Start_Sales: start && stamp(start), End_Sales: end && stamp(end) } });
const data = { features: [area("ESSEX JUNCTION", 0.07, "2022-10-01"), area("PERU", 0.07, "2026-10-01"), area("MONTGOMERY", 0.06, "2022-10-01", "2025-10-01"), area("SANDGATE")] };
const html = '<h2>Municipalities that have a 1% Local Option Sales Tax</h2><table><tr><td>City of Essex Junction</td><td>October 2022</td></tr><tr><td>Peru</td><td>October 2026 (Effective beginning 10/1/2026)</td></tr><tr><td>Montgomery</td><td>October 2022 (Rescinded as of 10/1/2025)</td></tr></table><h2>Meals Tax</h2><table><tr><td>Sandgate</td><td>July 2020</td></tr></table>';
const parse = (source = data, page = html, time = now) => parseVermontSalesAreas(source, page, { now: time, expectedAreas: 4 });

test("Vermont separates sales from meals and applies future and rescinded dates", () => {
  assert.deepEqual(parse().rates.map((r) => r.totalGeneralRate), [7, 6, 6, 6]);
  assert.equal(parse().localSalesAreas, 1);
  assert.equal(parse(data, html, new Date("2026-10-01T12:00:00Z")).rates[1].totalGeneralRate, 7);
});

test("Vermont rejects truncated, duplicate, conflicting and invalid source evidence", () => {
  for (const mutate of [
    (d) => { d.exceededTransferLimit = true; },
    (d) => { d.features.pop(); },
    (d) => { d.features[3] = d.features[0]; },
    (d) => { d.features[0].attributes.Sales = null; },
    (d) => { d.features[0].attributes.Start_Sales = "2022-10-01"; },
    (d) => { d.features[0].attributes.Start_Sales = stamp("2027-01-01"); },
    (d) => { d.features[3].attributes.LOT_Sales = "Y"; },
  ]) {
    const changed = structuredClone(data); mutate(changed);
    assert.throws(() => parse(changed), /Vermont/);
  }
  assert.throws(() => parse(data, html.replace("1% Local Option Sales Tax", "1% Meals Tax")), /Vermont/);
  assert.throws(() => parse(data, html.replace("October 2022", "Unknown date")), /Vermont/);
  assert.throws(() => parse(data, html.replace("10/1/2025", "unknown")), /Vermont/);
});

test("Vermont exact municipality comparison preserves ambiguity and sales-only inbox scope", async () => {
  const source = { rates: [...parse().rates, { name: "SAINT ALBANS TOWN", totalGeneralRate: 7 }, { name: "SAINT ALBANS CITY", totalGeneralRate: 7 }] };
  const names = ["Vermont Essex Junction", "Vermont Sandgate", "Vermont St. Albans Town", "Vermont St Albans", "Vermont Washington Co.", "Vermonth Burlington", "Vermont S. Burlington", "Vermont Manchester Center", "Vermont Sandgate", "Vermont Sandgate", "North Carolina Mecklenburg"];
  const taxBodies = names.map((description, i) => ({ taxBody: i === 8 ? "VT000" : i === 10 ? "NC060" : `VT${i + 1}`, description, currentRate: i === 9 ? null : 6, activeShipTos: 1 }));
  const result = await readVermontAplusComparison({ stateCode: "VT", activeShipTos: 11, taxBodies }, { readOfficial: async () => source });
  assert.equal(result.totals.comparedShipTos, 3);
  assert.equal(result.totals.unmatchedShipTos, 7);
  assert.equal(result.totals.crossStateShipTos, 1);
  assert.equal(result.comparisonScope, "sales");
  const inbox = directMappingFindingsFromReconciliation(result);
  assert.equal(inbox.length, 2);
  assert.ok(inbox.every((r) => r.jurisdictionLabel.endsWith("(sales tax)")));
});

test("Vermont source failures propagate without guessed comparison results", async () => {
  await assert.rejects(readVermontAplusComparison({ stateCode: "VT", taxBodies: [] }, { readOfficial: async () => { throw new Error("unavailable"); } }), /unavailable/);
  await assert.rejects(readVermontSalesRates({ readBase: async () => ({ stateRate: 6 }), fetchImpl: async () => ({ ok: false }) }), /unavailable/);
});

test("Vermont reader validates all source layers and requests no address or geometry fields", async () => {
  const complete = structuredClone(data);
  for (let i = 4; i < 256; i++) complete.features.push(area(`Fixture ${i}`));
  const base = { stateRate: 6, sourceHash: "fixture", rates: [{ jurisdictionType: "state", componentRate: 6 }, { jurisdictionType: "city", componentRate: 1 }] };
  const fetchImpl = async (url) => {
    if (url.includes("/query?")) {
      const query = new URL(url).searchParams;
      assert.equal(query.get("returnGeometry"), "false");
      assert.equal(query.get("outFields"), "TOWNNAME,Sales,LOT_Sales,Start_Sales,End_Sales");
      return { ok: true, text: async () => JSON.stringify(complete) };
    }
    return { ok: true, text: async () => html };
  };
  const result = await readVermontSalesRates({ now, fetchImpl, readBase: async () => base });
  assert.equal(result.rates.length, 256);
  assert.equal(result.comparisonScope, "sales");
  await assert.rejects(readVermontSalesRates({ now, fetchImpl, readBase: async () => ({ ...base, rates: [] }) }), /disagree/);
});
