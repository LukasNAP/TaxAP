import assert from "node:assert/strict";
import test from "node:test";
import { findCurrentColoradoWorkbook, parseColoradoRateWorkbook } from "../server/co-rates.mjs";

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ~crc >>> 0;
}

function buildStoredZip(files) {
  const localEntries = [];
  const centralEntries = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBuffer = Buffer.from(name); const data = Buffer.from(content); const checksum = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(offset, 42);
    const entry = Buffer.concat([local, nameBuffer, data]); localEntries.push(entry); centralEntries.push(Buffer.concat([central, nameBuffer])); offset += entry.length;
  }
  const directory = Buffer.concat(centralEntries); const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10); eocd.writeUInt32LE(directory.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localEntries, directory, eocd]);
}

function columnName(index) {
  let value = index; let result = "";
  while (value > 0) { value -= 1; result = String.fromCharCode(65 + (value % 26)) + result; value = Math.floor(value / 26); }
  return result;
}

function cell(column, row, value) {
  return typeof value === "number" ? `<c r="${column}${row}"><v>${value}</v></c>` : `<c r="${column}${row}" t="inlineStr"><is><t>${value}</t></is></c>`;
}

function workbookFixture({ duplicate = false, badTotal = false } = {}) {
  const firstHeaders = ["Location Code", "Jurisdiction   Code", "County", "Self Collected Home Rule", "City Exemptions      (state-collected cities)", "County Exemptions", "Special Dist Exemptions", "Total Rate"];
  const headers = [...firstHeaders];
  for (let index = 0; index < 12; index += 1) headers.push("Tax Type", "Rate", "Service Fee Rate");
  const rowValues = (name, code, county, total, layers, homeRule = "") => {
    const values = [name, code, county, homeRule, "", "", "", total];
    for (const [type, rate] of layers) values.push(type, rate, 0);
    while (values.length < 44) values.push("");
    return values;
  };
  const rows = [
    headers,
    rowValues("AURORA", "100001", "ARAPAHOE", badTotal ? 8.1 : 8, [["State", 2.9], ["County", 0.25], ["City", 3.75], ["RTD", 1], ["CD", 0.1]], "Self-collected"),
    rowValues("FREMONT COUNTY", duplicate ? "100001" : "140206", "FREMONT", 5.4, [["State", 2.9], ["County", 2.5]]),
  ];
  const rowXml = rows.map((values, rowIndex) => `<row r="${rowIndex + 1}">${values.map((value, columnIndex) => value === "" ? "" : cell(columnName(columnIndex + 1), rowIndex + 1, value)).join("")}</row>`).join("");
  const sheetNames = ["By Name", "By Juris Codes", "Exemption Codes", "Tax Codes", "Alternate City Rates", "State Service Fee Rates"];
  const workbook = `<workbook xmlns:r="r"><sheets>${sheetNames.map((name, index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`;
  const relationships = `<Relationships>${sheetNames.map((_, index) => `<Relationship Id="rId${index + 1}" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}</Relationships>`;
  const files = [["xl/workbook.xml", workbook], ["xl/_rels/workbook.xml.rels", relationships], ["xl/worksheets/sheet1.xml", `<worksheet><sheetData>${rowXml}</sheetData></worksheet>`]];
  for (let index = 2; index <= 6; index += 1) files.push([`xl/worksheets/sheet${index}.xml`, "<worksheet><sheetData/></worksheet>"]);
  return buildStoredZip(files);
}

test("selects Colorado's half-year workbook covering the snapshot date", () => {
  const html = '<a href="/files/Colorado_Jurisdiction_Codes_Rates_Jan-June2026_Apr26.xlsx">first</a><a href="/files/Colorado_Jurisdiction_Codes_Rates_July-Dec2026.xlsx">second</a>';
  const current = findCurrentColoradoWorkbook(html, { asOfDate: "2026-09-03" });
  assert.equal(current.beginDate, "2026-07-01");
  assert.equal(current.endDate, "2026-12-31");
  assert.match(current.url, /July-Dec2026\.xlsx$/);
});

test("validates Colorado jurisdiction codes, tax layers, totals, and home-rule flags", () => {
  const parsed = parseColoradoRateWorkbook(workbookFixture(), { beginDate: "2026-07-01", endDate: "2026-12-31", minimumRows: 2 });
  assert.deepEqual(parsed.counts, { counties: 1, cities: 1, specialJurisdictions: 0 });
  assert.equal(parsed.homeRuleRows, 1);
  const aurora = parsed.rates.find((rate) => rate.filingCode === "100001");
  assert.equal(aurora.totalGeneralRate, 8);
  assert.equal(aurora.componentRate, 5.1);
  assert.equal(aurora.layers.length, 5);
  assert.throws(() => parseColoradoRateWorkbook(workbookFixture({ duplicate: true }), { beginDate: "2026-07-01", endDate: "2026-12-31", minimumRows: 2 }), /repeats jurisdiction code/);
  assert.throws(() => parseColoradoRateWorkbook(workbookFixture({ badTotal: true }), { beginDate: "2026-07-01", endDate: "2026-12-31", minimumRows: 2 }), /layers total/);
});
