import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coloradoUploadDirectory, readColoradoUploadedWorkbook, readOfficialCoRates, saveColoradoUploadedWorkbook } from "../server/co-rates.mjs";
import { aggregateEvidence } from "../server/state-evidence.mjs";
import { comparisonHealth } from "../server/comparison-health.mjs";
import { createConnectorServer } from "../server/aplus-connector.mjs";

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

const cell = (column, row, value) => typeof value === "number" ? `<c r="${column}${row}"><v>${value}</v></c>` : `<c r="${column}${row}" t="inlineStr"><is><t>${value}</t></is></c>`;

// Synthetic two-row workbook, padded past the real workbook's minimum size check.
function workbookFixture({ duplicate = false, auroraCity = 3.75 } = {}) {
  const headers = ["Location Code", "Jurisdiction Code", "County", "Self Collected Home Rule", "City Exemptions (state-collected cities)", "County Exemptions", "Special Dist Exemptions", "Total Rate"];
  for (let index = 0; index < 12; index += 1) headers.push("Tax Type", "Rate", "Service Fee Rate");
  const rowValues = (name, code, county, total, layers) => {
    const values = [name, code, county, "", "", "", "", total];
    for (const [type, rate] of layers) values.push(type, rate, 0);
    while (values.length < 44) values.push("");
    return values;
  };
  const rows = [
    headers,
    rowValues("AURORA", "100001", "ARAPAHOE", Number((2.9 + 0.25 + auroraCity + 1.1).toFixed(4)), [["State", 2.9], ["County", 0.25], ["City", auroraCity], ["RTD", 1], ["CD", 0.1]]),
    rowValues("FREMONT COUNTY", duplicate ? "100001" : "140206", "FREMONT", 5.4, [["State", 2.9], ["County", 2.5]]),
  ];
  const rowXml = rows.map((values, rowIndex) => `<row r="${rowIndex + 1}">${values.map((value, columnIndex) => value === "" ? "" : cell(columnName(columnIndex + 1), rowIndex + 1, value)).join("")}</row>`).join("");
  const sheetNames = ["By Name", "By Juris Codes", "Exemption Codes", "Tax Codes", "Alternate City Rates", "State Service Fee Rates"];
  const files = [
    ["xl/workbook.xml", `<workbook xmlns:r="r"><sheets>${sheetNames.map((name, index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<Relationships>${sheetNames.map((_, index) => `<Relationship Id="rId${index + 1}" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}</Relationships>`],
    ["xl/worksheets/sheet1.xml", `<worksheet><sheetData>${rowXml}</sheetData></worksheet>`],
  ];
  for (let index = 2; index <= 6; index += 1) files.push([`xl/worksheets/sheet${index}.xml`, "<worksheet><sheetData/></worksheet>"]);
  files.push(["docProps/padding.txt", "x".repeat(60_000)]);
  return buildStoredZip(files);
}

const NAME = "Colorado_Jurisdiction_Codes_Rates_July-Dec2026.xlsx";
const NOV = new Date("2026-11-09T15:00:00Z");
const blocked = async () => new Response("Just a moment...", { status: 403, headers: { "content-type": "text/html" } });

function withDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), "taxap-co-upload-"));
  return Promise.resolve().then(() => run(directory)).finally(() => rmSync(directory, { recursive: true, force: true }));
}

const save = (directory, overrides = {}) => saveColoradoUploadedWorkbook({ fileName: NAME, workbook: workbookFixture(), uploadedBy: "Test Reviewer", now: NOV, directory, minimumRows: 2, ...overrides });

test("stores a validated official Colorado upload keyed by its half-year period", () => withDirectory((directory) => {
  const metadata = save(directory);
  assert.equal(metadata.beginDate, "2026-07-01");
  assert.equal(metadata.endDate, "2026-12-31");
  assert.equal(metadata.rows, 2);
  assert.equal(metadata.uploadedBy, "Test Reviewer");
  assert.match(metadata.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(readdirSync(coloradoUploadDirectory(directory)).sort(), ["2026-07-01.json", "2026-07-01.xlsx"]);
  const stored = readColoradoUploadedWorkbook({ now: NOV, directory, minimumRows: 2 });
  assert.equal(stored.metadata.sha256, metadata.sha256);
  assert.equal(stored.parsed.rates.length, 2);
}));

test("rejects renamed, expired, early, unattributed, non-workbook and invalid uploads without storing them", () => withDirectory((directory) => {
  assert.throws(() => save(directory, { fileName: "colorado rates.xlsx" }), /without renaming/);
  assert.throws(() => save(directory, { fileName: "../Colorado_Jurisdiction_Codes_Rates_July-Dec2026.xlsx" }), /without renaming/);
  assert.throws(() => save(directory, { fileName: "Colorado_Jurisdiction_Codes_Rates_Jan-June2026.xlsx" }), /has ended/);
  assert.throws(() => save(directory, { fileName: "Colorado_Jurisdiction_Codes_Rates_July-Dec2027.xlsx" }), /within 62 days/);
  assert.throws(() => save(directory, { uploadedBy: " " }), /uploader's name/);
  assert.throws(() => save(directory, { uploadedBy: "<script>" }), /uploader's name/);
  assert.throws(() => save(directory, { workbook: Buffer.from("not a workbook".repeat(5000)) }), /expected XLSX/);
  assert.throws(() => save(directory, { workbook: workbookFixture({ duplicate: true }) }), /repeats jurisdiction code/);
  assert.equal(readColoradoUploadedWorkbook({ now: NOV, directory, minimumRows: 2 }), null);
}));

test("uses a manual upload only when automatic retrieval fails, and labels it", () => withDirectory(async (directory) => {
  await assert.rejects(readOfficialCoRates({ fetchImpl: blocked, now: NOV, bypassCache: true, uploadDirectory: directory, minimumRows: 2 }), /HTTP 403/);
  const metadata = save(directory);
  const snapshot = await readOfficialCoRates({ fetchImpl: blocked, now: NOV, bypassCache: true, uploadDirectory: directory, minimumRows: 2 });
  assert.equal(snapshot.retrievalMethod, "manual-upload");
  assert.equal(snapshot.machineReadableSourceUrl, null);
  assert.equal(snapshot.retrievedAt, metadata.uploadedAt);
  assert.equal(snapshot.sourceHash, metadata.sha256);
  assert.equal(snapshot.effectivePeriod, "2026-07-01 through 2026-12-31");
  assert.deepEqual(snapshot.manualUpload, { fileName: NAME, uploadedAt: metadata.uploadedAt, uploadedBy: "Test Reviewer", sha256: metadata.sha256 });
  assert.equal(snapshot.rates.find((rate) => rate.filingCode === "100001").totalGeneralRate, 8);
}));

test("prefers a successful automatic download over a stored upload", () => withDirectory(async (directory) => {
  save(directory);
  const official = workbookFixture({ auroraCity: 4 });
  const fetchImpl = async (url) => String(url).endsWith(".xlsx")
    ? new Response(official, { status: 200 })
    : new Response(`<a href="/sites/default/files/documents/${NAME}">workbook</a>`, { status: 200 });
  const snapshot = await readOfficialCoRates({ fetchImpl, now: NOV, bypassCache: true, uploadDirectory: directory, minimumRows: 2 });
  assert.equal(snapshot.retrievalMethod, "automatic");
  assert.equal(snapshot.manualUpload, undefined);
  assert.match(snapshot.machineReadableSourceUrl, /July-Dec2026\.xlsx$/);
  assert.equal(snapshot.rates.find((rate) => rate.filingCode === "100001").totalGeneralRate, 8.25);
}));

test("never carries an upload into a new period and accepts the next file shortly before it starts", () => withDirectory(async (directory) => {
  save(directory);
  const january = new Date("2027-01-02T15:00:00Z");
  assert.equal(readColoradoUploadedWorkbook({ now: january, directory, minimumRows: 2 }), null);
  await assert.rejects(readOfficialCoRates({ fetchImpl: blocked, now: january, bypassCache: true, uploadDirectory: directory, minimumRows: 2 }), /HTTP 403/);
  const december = new Date("2026-12-20T15:00:00Z");
  const next = save(directory, { fileName: "Colorado_Jurisdiction_Codes_Rates_Jan-June2027.xlsx", now: december });
  assert.equal(next.beginDate, "2027-01-01");
  assert.equal(readColoradoUploadedWorkbook({ now: december, directory, minimumRows: 2 }).metadata.beginDate, "2026-07-01");
  assert.equal(readColoradoUploadedWorkbook({ now: january, directory, minimumRows: 2 }).metadata.beginDate, "2027-01-01");
}));

test("rejects a stored workbook that no longer matches its recorded fingerprint", () => withDirectory((directory) => {
  save(directory);
  writeFileSync(join(coloradoUploadDirectory(directory), "2026-07-01.xlsx"), workbookFixture({ auroraCity: 4 }));
  assert.throws(() => readColoradoUploadedWorkbook({ now: NOV, directory, minimumRows: 2 }), /integrity validation/);
}));

test("keeps the manual-upload label in retained evidence and coverage health", () => {
  const officialSnapshot = { stateCode: "CO", sourceUrl: "https://tax.colorado.gov/how-to-look-up-sales-use-tax-rates", retrievedAt: "2026-11-09T15:00:00.000Z", retrievalMethod: "manual-upload",
    manualUpload: { fileName: NAME, uploadedAt: "2026-11-09T15:00:00.000Z", uploadedBy: "Test Reviewer", sha256: "a".repeat(64), extra: "dropped" } };
  const evidence = aggregateEvidence("CO", { stateCode: "CO", officialSnapshot, findings: [] });
  assert.equal(evidence.officialSnapshot.retrievalMethod, "manual-upload");
  assert.deepEqual(evidence.officialSnapshot.manualUpload, { fileName: NAME, uploadedAt: "2026-11-09T15:00:00.000Z", uploadedBy: "Test Reviewer", sha256: "a".repeat(64) });
  const health = comparisonHealth({ stateCode: "CO", officialSnapshot, totals: { activeShipTos: 3 }, findings: [] });
  assert.equal(health.sourceRetrieval, "manual-upload");
  assert.equal(health.sourceRetrievedAt, "2026-11-09T15:00:00.000Z");
  assert.equal(comparisonHealth({ stateCode: "CO", officialSnapshot: { ...officialSnapshot, retrievalMethod: "automatic" }, totals: {}, findings: [] }).sourceRetrieval, undefined);
});

test("accepts Colorado workbook uploads only as same-origin binary requests", async () => {
  const calls = [];
  const server = createConnectorServer({ saveCoWorkbook: (input) => { calls.push(input); return { fileName: input.fileName, beginDate: "2026-07-01", endDate: "2026-12-31", rows: 2, sha256: "b".repeat(64), uploadedBy: input.uploadedBy }; } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/official/states/CO/workbook`;
    const headers = { Origin: "http://localhost:3000", "Content-Type": "application/octet-stream", "X-TaxAP-File-Name": encodeURIComponent(NAME), "X-TaxAP-Uploaded-By": encodeURIComponent("Test Reviewer") };
    assert.equal((await fetch(url, { method: "POST", headers: { ...headers, Origin: "https://example.com" }, body: "x" })).status, 403);
    assert.equal((await fetch(url, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" })).status, 400);
    const response = await fetch(url, { method: "POST", headers, body: Buffer.from("workbook-bytes") });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).upload.beginDate, "2026-07-01");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].fileName, NAME);
    assert.equal(calls[0].uploadedBy, "Test Reviewer");
    assert.equal(calls[0].workbook.toString(), "workbook-bytes");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
