import assert from "node:assert/strict";
import test from "node:test";
import {
  NEW_MEXICO_STATE_GRT_RATE,
  findCurrentNewMexicoDataset,
  parseNewMexicoRateArchive,
  readOfficialNmRates,
} from "../server/nm-rates.mjs";

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
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(offset, 42);
    const localEntry = Buffer.concat([local, nameBuffer, data]);
    localEntries.push(localEntry); centralEntries.push(Buffer.concat([central, nameBuffer])); offset += localEntry.length;
  }
  const centralDirectory = Buffer.concat(centralEntries);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localEntries, centralDirectory, eocd]);
}

const HEADERS = "OBJECTID_1,name,county,locat_cdr,locat_cd1,locat_cd2,grt_rate,note_key,bndry_ref,SHAPE_Leng,grt_rate2,Shape_Area";

function sourceArchive({ conflict = false } = {}) {
  const rows = [];
  for (let index = 1; index <= 32; index += 1) {
    const code = `${String(index).padStart(2, "0")}-${String(index).padStart(3, "0")}`;
    rows.push(`0,Remainder of County - County ${index},County ${index},${code},,,6.25,,,1,0,1`);
  }
  for (let index = 0; index < 176; index += 1) {
    rows.push(`0,City ${index},County 33,33-${String(index + 100).padStart(3, "0")},,,7.5,,,1,0,1`);
  }
  for (let index = 0; index < 21; index += 1) {
    rows.push(`0,Pueblo ${index},County 1,,34-${String(index * 2 + 100).padStart(3, "0")},34-${String(index * 2 + 101).padStart(3, "0")},6.5,,,1,0,1`);
  }
  if (conflict) rows.push("0,Changed City,County 33,33-100,,,8.0,,,1,0,1");
  const metadata = "<metadata>boundaries for New Mexico's gross receipts tax districts Tribal Location Code (1) Gross receipts tax rate for Isleta Pueblo class 2</metadata>";
  return buildStoredZip([
    ["New_Mexico_gross_receipts_tax.csv", `${HEADERS}\n${rows.join("\n")}\n`],
    ["New_Mexico_gross_receipts_tax.xml", metadata],
  ]);
}

test("selects the New Mexico GRT dataset whose effective period contains today", () => {
  const html = [
    '<a href="https://rgis.unm.edu/rgis6/dataset.html?uuid=11111111-1111-1111-1111-111111111111">Gross Receipts Tax Rates and Boundaries: July 1, 2025 to June 30, 2026</a>',
    '<a href="https://rgis.unm.edu/rgis6/dataset.html?uuid=22222222-2222-2222-2222-222222222222">Gross Receipts Tax Rates and Boundaries: July 1, 2026 to June 30, 2027</a>',
  ].join("");
  const dataset = findCurrentNewMexicoDataset(html, { asOfDate: "2026-09-03" });
  assert.equal(dataset.uuid, "22222222-2222-2222-2222-222222222222");
  assert.equal(dataset.beginDate, "2026-07-01");
  assert.equal(dataset.endDate, "2027-06-30");
  assert.throws(() => findCurrentNewMexicoDataset(html, { asOfDate: "2028-01-01" }), /covering 2028-01-01/);
});

test("parses county, municipal, and paired tribal New Mexico location codes", () => {
  const parsed = parseNewMexicoRateArchive(sourceArchive(), { beginDate: "2026-07-01", endDate: "2027-06-30" });
  assert.equal(parsed.sourceRows, 229);
  assert.equal(parsed.rates.length, 250);
  assert.deepEqual(parsed.counts, { counties: 32, cities: 176, specialJurisdictions: 42 });
  assert.equal(parsed.rates.find((rate) => rate.locationCode === "01-001").componentRate, 1.125);
  assert.equal(parsed.rates.find((rate) => rate.locationCode === "34-100").jurisdictionType, "special");
  assert.throws(() => parseNewMexicoRateArchive(sourceArchive({ conflict: true }), { beginDate: "2026-07-01", endDate: "2027-06-30" }), /conflicting values/);
});

test("returns a current New Mexico snapshot from the TRD and RGIS source chain", async () => {
  const uuid = "22222222-2222-2222-2222-222222222222";
  const archiveUrl = `https://gstore.unm.edu/apps/rgis/datasets/${uuid}/rates.derived.csv`;
  const html = `<a href="https://rgis.unm.edu/rgis6/dataset.html?uuid=${uuid}">Gross Receipts Tax Rates and Boundaries: July 1, 2026 to June 30, 2027</a>`;
  const archive = sourceArchive();
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("data-download/")) return new Response(html);
    if (value.endsWith("services.json")) return new Response(JSON.stringify({ description: "New Mexico Gross Receipts Tax July 2026-June 2027", downloads: [{ csv: archiveUrl }] }));
    if (value === archiveUrl) return new Response(archive);
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialNmRates({ fetchImpl, now: new Date("2026-09-03T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, NEW_MEXICO_STATE_GRT_RATE);
  assert.equal(snapshot.rates.length, 250);
  assert.equal(snapshot.effectivePeriod, "2026-07-01 through 2027-06-30");
  assert.match(snapshot.boundaryStatus, /seller-side tax/);
  assert.match(snapshot.sourceHash, /^[a-f0-9]{64}$/);
});
