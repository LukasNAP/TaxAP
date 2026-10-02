import assert from "node:assert/strict";
import test from "node:test";
import { parseUtahCombinedRows, readUtahAplusComparison, readUtahCombinedRates } from "../server/ut-aplus.mjs";
const header = { A: "Location", C: "Code", E: "ST*", Z: "Sales Rate" };
const row = { A: "Hurricane", C: "27-008", E: "0.0485", G: "0.01", H: "0.0025", M: "0.003", O: "0.0025", S: "0.001", Y: "0.0033", Z: "0.0708" };
test("Utah validates full component totals including the FD column and stops at the next section", () => {
  const rates = parseUtahCombinedRows([header, row, { A: "Location" }, { ...row, Z: "0.99" }], { minimumRows: 1 });
  assert.equal(rates.length, 1);
  assert.equal(rates[0].totalGeneralRate, 7.08);
  assert.throws(() => parseUtahCombinedRows([header, { ...row, Y: "" }], { minimumRows: 1 }), /validation/);
  assert.throws(() => parseUtahCombinedRows([header, row]), /incomplete/);
});
test("Utah requires a code AND exact name and reports actual compared assignments", async () => {
  const r = await readUtahAplusComparison({ stateCode: "UT", activeShipTos: 3, taxBodies: [
    { taxBody: "UT27008", description: "Utah Hurricane", currentRate: 6.75, activeShipTos: 1 },
    { taxBody: "UT29000", description: "Utah Farr West", currentRate: 7.25, activeShipTos: 1 },
    { taxBody: "UT000", description: null, currentRate: null, activeShipTos: 1 },
  ] }, { readOfficial: async () => ({ rates: [
    { jurisdictionCode: "27-008", name: "Hurricane", totalGeneralRate: 7.08 },
    { jurisdictionCode: "29-000", name: "Weber County", totalGeneralRate: 7.25 },
  ] }) });
  assert.equal(r.findings[0].rateDifference, 0.33);
  assert.equal(r.totals.comparedShipTos, 1);
  assert.equal(r.totals.unmatchedShipTos, 2);
});
test("Utah will not choose the published future quarter when the current file is absent", async () => {
  await assert.rejects(readUtahCombinedRates({ now: new Date("2026-09-08"), fetchImpl: async () => new Response('<a href="https://files.tax.utah.gov/tax/salestax/rate/26q4combined.xlsx">Future</a>') }), /current-quarter/);
});

import { buildStoredZip } from "./helpers/xlsx.mjs";
function quarterWorkbook(period = "October 1, 2026") {
  const strings = []; const cell = (col, r, value) => {
    if (typeof value === "number") return `<c r="${col}${r}"><v>${value}</v></c>`;
    strings.push(value); return `<c r="${col}${r}" t="s"><v>${strings.length - 1}</v></c>`;
  };
  const rows = [{ E: `Rates In effect as of ${period}` }, header, ...Array.from({ length: 300 }, (_, i) => ({ ...row, A: `Synthetic ${i}`, C: `01-${String(i).padStart(3, "0")}` }))];
  const xml = rows.map((values, i) => `<row r="${i + 1}">${Object.entries(values).map(([col, value]) => cell(col, i + 1, typeof value === "string" && /^0\.\d+$/.test(value) ? Number(value) : value)).join("")}</row>`).join("");
  return buildStoredZip([["xl/sharedStrings.xml", `<sst>${strings.map(s => `<si><t>${s}</t></si>`).join("")}</sst>`], ["xl/worksheets/sheet1.xml", `<worksheet><sheetData>${xml}</sheetData></worksheet>`]]);
}
test("Utah validates the official current workbook during a directory outage", async () => {
  const calls = [];
  const result = await readUtahCombinedRates({ now: new Date("2026-10-02"), fetchImpl: async url => { calls.push(url); return url.endsWith(".xlsx") ? new Response(quarterWorkbook()) : new Response("", { status: 403 }); } });
  assert.equal(result.rates.length, 300); assert.match(calls[1], /26q4combined/); assert.equal(result.effectivePeriod, "2026 Q4");
  await assert.rejects(readUtahCombinedRates({ now: new Date("2026-10-02"), fetchImpl: async url => url.endsWith(".xlsx") ? new Response(quarterWorkbook("July 1, 2026")) : new Response("", { status: 403 }) }), /effective date/);
});
