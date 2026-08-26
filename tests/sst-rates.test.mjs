import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import test from "node:test";
import { findLatestSstCsv, readOfficialSstStateRates } from "../server/sst-rates.mjs";
import { readOfficialMdRates, MARYLAND_STATE_RATE } from "../server/md-rates.mjs";

// Mirrors tests/ga-boundary.test.mjs's buildZip helper - a minimal single-file ZIP, stored/deflate only.
function buildZip(fileName, content) {
  const data = Buffer.from(content, "utf8");
  const compressed = deflateRawSync(data);
  const crc = crc32(data);
  const nameBuf = Buffer.from(fileName, "utf8");

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(8, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(compressed.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const localEntry = Buffer.concat([localHeader, nameBuf, compressed]);
  const centralEntry = Buffer.concat([centralHeader, nameBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralEntry.length, 12);
  eocd.writeUInt32LE(localEntry.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localEntry, centralEntry, eocd]);
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ~crc >>> 0;
}

test("findLatestSstCsv discovers a .zip rate file, not just a bare .csv", () => {
  assert.match(findLatestSstCsv('<a href="ARR2026Q3JUN02.zip">AR</a>', "AR"), /ARR2026Q3JUN02\.zip$/);
  assert.match(findLatestSstCsv('<a href="ARR2026Q3JUN02.csv">AR</a>', "AR"), /ARR2026Q3JUN02\.csv$/);
});

test("reads Arkansas's zipped SST rate file as a drop-in county-model state", async () => {
  const countyRows = Array.from({ length: 75 }, (_, index) => `05,00,${String(index + 1).padStart(3, "0")},0.01,0.01,0.01,0.01,20240101,29991231`);
  const csv = ["05,45,05,0.065,0.065,0,0,20240101,29991231", ...countyRows].join("\n");
  const zip = buildZip("ARR2026Q3JUN02.csv", csv);
  const countyNames = ["USPS|GEOID|NAME", ...Array.from({ length: 75 }, (_, index) => `AR|05${String(index + 1).padStart(3, "0")}|County ${index + 1}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="ARR2026Q3JUN02.zip">AR</a>');
    if (value.endsWith("ARR2026Q3JUN02.zip")) return new Response(zip);
    if (value.includes("gaz_counties_05")) return new Response(countyNames);
    if (value.includes("gaz_place_05")) return new Response("USPS|GEOID|NAME\n");
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("AR", { fetchImpl, now: new Date("2026-08-26T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6.5);
  assert.equal(snapshot.counts.counties, 75);
  assert.equal(snapshot.boundaryStatus, "Official jurisdiction components are connected. City and special totals require boundary reconciliation before comparison with A+.");
});

test("validates a flat no-local-tax state (Kentucky) as a single statewide row, not a per-county file", async () => {
  const csv = "21,45,21,0.06,0.06,0.06,0.06,20060601,29991231";
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="KYR2012Q4Aug13.csv">KY</a>');
    if (value.endsWith("KYR2012Q4Aug13.csv")) return new Response(csv);
    if (value.includes("gaz_counties_21")) return new Response("USPS|GEOID|NAME\nKY|21001|County 1\n");
    if (value.includes("gaz_place_21")) return new Response("USPS|GEOID|NAME\n");
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("KY", { fetchImpl, now: new Date("2026-08-26T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6);
  assert.equal(snapshot.counts.counties, 0);
  assert.equal(snapshot.rates.length, 1);
  assert.match(snapshot.boundaryStatus, /single flat statewide rate/);
});

test("rejects a flat state's rate file if it unexpectedly grows county rows", async () => {
  const csv = ["21,45,21,0.06,0.06,0.06,0.06,20060601,29991231", "21,00,001,0.01,0.01,0.01,0.01,20260101,29991231"].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="KYR2012Q4Aug13.csv">KY</a>');
    if (value.endsWith("KYR2012Q4Aug13.csv")) return new Response(csv);
    if (value.includes("gaz_counties_21")) return new Response("USPS|GEOID|NAME\nKY|21001|County 1\n");
    if (value.includes("gaz_place_21")) return new Response("USPS|GEOID|NAME\n");
    return new Response("Not found", { status: 404 });
  };
  await assert.rejects(
    () => readOfficialSstStateRates("KY", { fetchImpl, now: new Date("2026-08-26T12:00:00Z"), bypassCache: true }),
    /Kentucky SST rate file returned 1 counties instead of 0/,
  );
});

test("Maryland reads as a flat 6% statewide rate with no live fetch", async () => {
  const snapshot = await readOfficialMdRates({ now: new Date("2026-08-26T12:00:00Z") });
  assert.equal(snapshot.stateRate, MARYLAND_STATE_RATE);
  assert.equal(snapshot.rates.length, 1);
  assert.equal(snapshot.rates[0].totalGeneralRate, 6);
  assert.equal(snapshot.counts.counties, 0);
  assert.match(snapshot.boundaryStatus, /preempts local general sales tax/);
});

test("accepts alphanumeric special-district jurisdiction codes instead of throwing", async () => {
  // Confirmed live 2026-08-26: Nebraska's real SST file has 5 special-district rows (GL801-GL805,
  // a transit district) with alphanumeric codes the original numeric-only regex rejected outright.
  const csv = [
    "31,45,31,0.055,0.055,0.055,0.055,20061001,29991231",
    "31,00,043,0.005,0.005,0.005,0.005,20200101,29991231", // Dakota Co., NE's one active county option tax
    "31,01,18580,0.02,0.02,0.02,0.02,20221001,29991231", // Gering city
    "31,63,GL801,0.0275,0.0275,0.0275,0.0275,20240401,29991231",
  ].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="NER2026Q3MAY26.csv">NE</a>');
    if (value.endsWith("NER2026Q3MAY26.csv")) return new Response(csv);
    if (value.includes("gaz_counties_31")) return new Response("USPS|GEOID|NAME\nNE|31043|Dakota County\n");
    if (value.includes("gaz_place_31")) return new Response("USPS|GEOID|NAME\nNE|3118580|Gering city\n");
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("NE", { fetchImpl, now: new Date("2026-08-26T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 5.5);
  assert.equal(snapshot.counts.specialJurisdictions, 1);
  const special = snapshot.rates.find((rate) => rate.jurisdictionType === "special");
  assert.equal(special.jurisdictionCode, "GL801");
  assert.equal(special.name, "Special jurisdiction GL801");
});

test("cityRateIsFullLocal computes a city row's total the same way as a county row, only when opted in", async () => {
  const csv = [
    "31,45,31,0.055,0.055,0.055,0.055,20061001,29991231",
    "31,00,043,0.005,0.005,0.005,0.005,20200101,29991231",
    "31,01,18580,0.02,0.02,0.02,0.02,20221001,29991231", // Gering: 5.5 state + 2 city = 7.5 total
  ].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="NER2026Q3MAY26.csv">NE</a>');
    if (value.endsWith("NER2026Q3MAY26.csv")) return new Response(csv);
    if (value.includes("gaz_counties_31")) return new Response("USPS|GEOID|NAME\nNE|31043|Dakota County\n");
    if (value.includes("gaz_place_31")) return new Response("USPS|GEOID|NAME\nNE|3118580|Gering city\n");
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("NE", { fetchImpl, now: new Date("2026-08-26T12:00:00Z"), bypassCache: true });
  const gering = snapshot.rates.find((rate) => rate.jurisdictionType === "city");
  assert.equal(gering.totalGeneralRate, 7.5);

  // Without the flag (e.g. OH), a city row's total must stay null - stacking city onto a separate
  // county total is a different, unconfirmed computation for any state that hasn't opted in.
  const ohCountyRows = Array.from({ length: 88 }, (_, index) => `39,00,${String(index + 1).padStart(3, "0")},0.01,0.01,0.01,0.01,20260101,29991231`);
  const ohCsv = ["39,45,39,0.0575,0.0575,0,0,20260101,29991231", ...ohCountyRows, "39,01,00100,0.01,0.01,0.01,0.01,20260101,29991231"].join("\n");
  const ohCountyNames = ["USPS|GEOID|NAME", ...Array.from({ length: 88 }, (_, index) => `OH|39${String(index + 1).padStart(3, "0")}|County ${index + 1}`)].join("\n");
  const ohFetch = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="OHR2026Q3JUN01.csv">OH</a>');
    if (value.endsWith("OHR2026Q3JUN01.csv")) return new Response(ohCsv);
    if (value.includes("gaz_counties_39")) return new Response(ohCountyNames);
    if (value.includes("gaz_place_39")) return new Response("USPS|GEOID|NAME\nOH|39000100|Some City\n");
    return new Response("Not found", { status: 404 });
  };
  const ohSnapshot = await readOfficialSstStateRates("OH", { fetchImpl: ohFetch, now: new Date("2026-08-26T12:00:00Z"), bypassCache: true });
  const ohCity = ohSnapshot.rates.find((rate) => rate.jurisdictionType === "city");
  assert.equal(ohCity.totalGeneralRate, null);
});
