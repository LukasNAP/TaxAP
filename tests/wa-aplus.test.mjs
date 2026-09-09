import assert from "node:assert/strict";
import test from "node:test";
import { parseWashingtonGeneralRates, readWashingtonAplusComparison, readWashingtonGeneralRates } from "../server/wa-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";

const now = new Date("2026-09-08T12:00:00Z");
const tableRow = (code, name, local, total) => `<tr>${["No", "King", name, code, local, ".0650", total].map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
const html = (rows) => `<h2>Quarter 3 - Effective July 1 through September 30, 2026</h2><table>${rows}</table>`;
const seattle = tableRow("1726", "Seattle", ".0405", ".1055");
const parse = (body) => parseWashingtonGeneralRates(body, { now, minimumRows: 1 });

test("Washington parses the general combined rate and preserves dated evidence", () => {
  const source = parse(html(seattle));
  assert.equal(source.rates[0].totalGeneralRate, 10.55);
  assert.equal(source.rates[0].name, "Seattle (King County)");
  assert.equal(source.rates[0].beginDate, "2026-07-01");
  assert.equal(source.rates[0].endDate, "2026-09-30");
  assert.match(source.sourceHash, /^[a-f0-9]{64}$/);
});

test("Washington fails closed on stale dates, partial inventories and malformed rates", () => {
  for (const body of [html(seattle + seattle), html(seattle).replace(".1055", ".1155"),
    html(seattle).replace(".0650", ".0600"), html(seattle).replace("July 1", "July 2"),
    html(seattle).replace("2026", "2025"), html(seattle).replace(".1055", ""),
    html(seattle) + '<li class="pager__item--next">Next</li>']) {
    assert.throws(() => parse(body), /Washington/);
  }
  assert.throws(() => parseWashingtonGeneralRates(html(seattle), { now }), /incomplete/);
  assert.throws(() => parseWashingtonGeneralRates(html(seattle), { now: new Date("2026-10-01"), minimumRows: 1 }), /stale/);
});

test("Washington exact code comparison never guesses from city names or undefined codes", async () => {
  const rows = [
    ["WA1726", "Washington Seattle", 10.4],
    ["WA000", null, null], ["WA3500", null, null],
    ["WA9999", "Washington Seattle", 10.55],
    ["WA1726M", "Washington Seattle motor vehicles", 10.55],
    ["WA0100", "Washington motor vehicles", 10.55],
    ["NC060", "North Carolina Mecklenburg", 8.25],
  ];
  const result = await readWashingtonAplusComparison({ stateCode: "WA", activeShipTos: rows.length,
    taxBodies: rows.map(([taxBody, description, currentRate]) => ({ taxBody, description, currentRate, activeShipTos: 1 })),
  }, { readOfficial: async () => parse(html(seattle + tableRow("0100", "Adams", ".0150", ".0800"))) });
  assert.equal(result.findings[0].rateDifference, 0.15);
  assert.equal(result.totals.unmatchedShipTos, 5);
  assert.equal(result.totals.crossStateShipTos, 1);
  assert.equal(directMappingFindingsFromReconciliation(result).length, 1);
});

test("Washington propagates an official fetch failure", async () => {
  await assert.rejects(readWashingtonGeneralRates({ fetchImpl: async () => new Response("Unavailable", { status: 503 }), now }), /HTTP 503/);
});
