import { buildStoredZip } from "./helpers/xlsx.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { findCurrentMissouriWorkbook, parseMissouriRateWorkbook } from "../server/mo-rates.mjs";

function cell(column, row, value) {
  return typeof value === "number" ? `<c r="${column}${row}"><v>${value}</v></c>` : `<c r="${column}${row}" t="inlineStr"><is><t>${value}</t></is></c>`;
}

function workbookFixture({ duplicate = false, belowState = false, headerRow = 12 } = {}) {
  const headers = { B: "Jurisdiction Name", C: "Jurisdiction Code", D: "SalesTaxRate(0000)", E: "UseTaxRate(0000)(0010)", F: "FoodSalesTax(1001)", G: "FoodUseTax(1001)(1011)", I: "DomesticUtilityRate(3200)", J: "AMJ Rate(7004)" };
  const rows = [
    `<row r="${headerRow}">${Object.entries(headers).map(([column, value]) => cell(column, headerRow, value)).join("")}</row>`,
    `<row r="16">${cell("B", 16, "ADAIR COUNTY")}${cell("C", 16, "00000-001-000")}${cell("D", 16, belowState ? "4.0000%" : "5.9750%")} ${cell("E", 16, "5.4750%")} ${cell("F", 16, "2.9750%")} ${cell("G", 16, "2.4750%")} ${cell("I", 16, "1.0000%")} ${cell("J", 16, "8.9750%")} </row>`,
    `<row r="17">${cell("B", 17, "KANSAS CITY JACKSON COUNTY")}${cell("C", 17, duplicate ? "00000-001-000" : "38000-095-004")}${cell("D", 17, 0.09975)} ${cell("E", 17, 0.08975)} ${cell("F", 17, 0.06975)} ${cell("G", 17, 0.05975)} ${cell("I", 17, 0)} ${cell("J", 17, 0.12975)} </row>`,
  ];
  return buildStoredZip([
    ["xl/workbook.xml", '<workbook xmlns:r="r"><sheets><sheet name="Sales and Use Tax Rate Chart" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'],
    ["xl/worksheets/sheet1.xml", `<worksheet><sheetData>${rows.join("")}</sheetData></worksheet>`],
  ]);
}

test("selects Missouri's quarterly workbook covering the snapshot date", () => {
  const html = '<a href="/pdf/rates/2026/jan2026.xlsx">01/2026 - 03/2026 - XLS</a><a href="/pdf/rates/2026/july2026.xlsx">07/2026 - 09/2026 - XLS</a>';
  const current = findCurrentMissouriWorkbook(html, { asOfDate: "2026-09-04" });
  assert.deepEqual(current, { url: "https://dor.mo.gov/pdf/rates/2026/july2026.xlsx", beginDate: "2026-07-01", endDate: "2026-09-30" });
  assert.throws(() => findCurrentMissouriWorkbook(html, { asOfDate: "2026-10-01" }), /covering 2026-10-01/);
});

test("Missouri accepts a moved exact header without relaxing column validation", () => {
  assert.equal(parseMissouriRateWorkbook(workbookFixture({ headerRow: 13 }), { minimumRows: 2 }).rates.length, 2);
  assert.throws(() => parseMissouriRateWorkbook(workbookFixture({ headerRow: 18 }), { minimumRows: 2 }), /only 0 jurisdiction rows/i);
});



test("validates and normalizes Missouri's filing-code rates", () => {
  const parsed = parseMissouriRateWorkbook(workbookFixture(), { beginDate: "2026-07-01", endDate: "2026-09-30", minimumRows: 2 });
  assert.deepEqual(parsed.counts, { counties: 1, cities: 0, specialJurisdictions: 1 });
  assert.equal(parsed.rates[0].totalGeneralRate, 5.975);
  assert.equal(parsed.rates[0].componentRate, 1.75);
  assert.equal(parsed.rates[1].totalGeneralRate, 9.975);
  assert.equal(parsed.rates[1].generalInterstateRate, 8.975);
  assert.throws(() => parseMissouriRateWorkbook(workbookFixture({ duplicate: true }), { minimumRows: 2 }), /repeats jurisdiction code/);
  assert.throws(() => parseMissouriRateWorkbook(workbookFixture({ belowState: true }), { minimumRows: 2 }), /below the 4.225% state rate/);
});
