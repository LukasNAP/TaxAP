import assert from "node:assert/strict";
import test from "node:test";
import { findCurrentMissouriWorkbook, parseMissouriRateWorkbook } from "../server/mo-rates.mjs";

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ~crc >>> 0;
}

function buildStoredZip(files) {
  const localEntries = []; const centralEntries = []; let offset = 0;
  for (const [name, content] of files) {
    const nameBuffer = Buffer.from(name); const data = Buffer.from(content); const checksum = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(offset, 42);
    const entry = Buffer.concat([local, nameBuffer, data]); localEntries.push(entry); centralEntries.push(Buffer.concat([central, nameBuffer])); offset += entry.length;
  }
  const directory = Buffer.concat(centralEntries); const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10); eocd.writeUInt32LE(directory.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localEntries, directory, eocd]);
}

function cell(column, row, value) {
  return typeof value === "number" ? `<c r="${column}${row}"><v>${value}</v></c>` : `<c r="${column}${row}" t="inlineStr"><is><t>${value}</t></is></c>`;
}

function workbookFixture({ duplicate = false, belowState = false } = {}) {
  const headers = { B: "Jurisdiction Name", C: "Jurisdiction Code", D: "SalesTaxRate(0000)", E: "UseTaxRate(0000)(0010)", F: "FoodSalesTax(1001)", G: "FoodUseTax(1001)(1011)", I: "DomesticUtilityRate(3200)", J: "AMJ Rate(7004)" };
  const rows = [
    `<row r="12">${Object.entries(headers).map(([column, value]) => cell(column, 12, value)).join("")}</row>`,
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
