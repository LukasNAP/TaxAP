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
  assert.match(
    findLatestSstCsv('<a href="/ratesandboundry/Rates/NDR2026Q4AUG20.zip">ND</a><a href="/ratesandboundry/Rates/WYR2026Q4AUG20.csv">WY</a>', "ND"),
    /NDR2026Q4AUG20\.zip$/,
  );
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

test("keeps Iowa's non-county 199 row visible without pretending Iowa has 100 counties", async () => {
  const countyCodes = Array.from({ length: 99 }, (_, index) => String((index * 2) + 1).padStart(3, "0"));
  const countyRows = countyCodes.map((code) => `19,00,${code},0.01,0.01,0,0,20240101,29991231`);
  const csv = [
    "19,45,19,0.06,0.06,0,0,20240101,29991231",
    ...countyRows,
    "19,00,199,0.01,0.01,0,0,20240101,29991231",
    "19,01,00190,0.01,0.01,0,0,20240101,29991231",
    "19,63,123,0.01,0.01,0,0,20240101,29991231",
  ].join("\n");
  const zip = buildZip("IAR2025Q3MAY30.csv", csv);
  const countyNames = ["USPS|GEOID|NAME", ...countyCodes.map((code) => `IA|19${code}|County ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="IAR2025Q3MAY30.zip">IA</a>');
    if (value.endsWith("IAR2025Q3MAY30.zip")) return new Response(zip);
    if (value.includes("gaz_counties_19")) return new Response(countyNames);
    if (value.includes("gaz_place_19")) return new Response("USPS|GEOID|NAME\nIA|1900190|Alpha city");
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("IA", { fetchImpl, now: new Date("2026-08-31T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6);
  assert.equal(snapshot.counts.counties, 99);
  assert.equal(snapshot.counts.specialJurisdictions, 2);
  assert.equal(snapshot.rates.find((rate) => rate.jurisdictionCode === "199").jurisdictionType, "special");
});

test("keeps Kansas alphanumeric special-jurisdiction codes without treating them as geographic codes", async () => {
  const countyCodes = Array.from({ length: 105 }, (_, index) => String(index + 1).padStart(3, "0"));
  const countyRows = countyCodes.map((code) => `20,00,${code},0.01,0.01,0,0,20240101,29991231`);
  const csv = [
    "20,45,20,0.065,0.065,0,0,20240101,29991231",
    ...countyRows,
    "20,01,00200,0.01,0.01,0,0,20240101,29991231",
    "20,63,20902,0.006,0.006,0,0,20240101,29991231",
    "20,79,11KAN,0.03875,0.03875,0,0,20240101,29991231",
  ].join("\n");
  const zip = buildZip("KSR2026Q3MAY20.csv", csv);
  const countyNames = ["USPS|GEOID|NAME", ...countyCodes.map((code) => `KS|20${code}|County ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="KSR2026Q3MAY20.zip">KS</a>');
    if (value.endsWith("KSR2026Q3MAY20.zip")) return new Response(zip);
    if (value.includes("gaz_counties_20")) return new Response(countyNames);
    if (value.includes("gaz_place_20")) return new Response("USPS|GEOID|NAME\nKS|2000200|Alpha city");
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("KS", { fetchImpl, now: new Date("2026-08-31T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6.5);
  assert.equal(snapshot.counts.counties, 105);
  assert.equal(snapshot.rates.find((rate) => rate.jurisdictionCode === "11KAN").jurisdictionType, "special");
});

test("connects Minnesota's active local components without pretending all 87 counties levy a local tax", async () => {
  const countyCodes = Array.from({ length: 62 }, (_, index) => String(index + 1).padStart(3, "0"));
  const countyRows = countyCodes.map((code) => `27,00,${code},0.005,0.005,0,0,20240101,29991231`);
  const csv = [
    "27,45,27,0.06875,0.06875,0,0,20240101,29991231",
    ...countyRows,
    "27,01,00460,0.005,0.005,0,0,20240101,29991231",
    "27,63,27101,0.01,0.01,0,0,20240101,29991231",
  ].join("\n");
  const zip = buildZip("MNR2026Q4AUG18.csv", csv);
  const countyNames = ["USPS|GEOID|NAME", ...countyCodes.map((code) => `MN|27${code}|County ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="MNR2026Q4AUG18.zip">MN</a>');
    if (value.endsWith("MNR2026Q4AUG18.zip")) return new Response(zip);
    if (value.includes("gaz_counties_27")) return new Response(countyNames);
    if (value.includes("gaz_place_27")) return new Response("USPS|GEOID|NAME\nMN|2700460|Alpha city");
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("MN", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6.875);
  assert.equal(snapshot.counts.counties, 62);
  assert.equal(snapshot.counts.cities, 1);
  assert.equal(snapshot.counts.specialJurisdictions, 1);
});

test("connects North Dakota's complete county and home-rule city component file", async () => {
  const countyCodes = Array.from({ length: 53 }, (_, index) => String(index + 1).padStart(3, "0"));
  const cityCodes = Array.from({ length: 352 }, (_, index) => String(index + 1).padStart(5, "0"));
  const csv = [
    "38,45,38,0.05,0.05,0,0,20240101,29991231",
    ...countyCodes.map((code) => `38,00,${code},0.01,0.01,0,0,20240101,29991231`),
    ...cityCodes.map((code) => `38,01,${code},0.02,0.02,0,0,20240101,29991231`),
  ].join("\n");
  const zip = buildZip("NDR2026Q4AUG14.csv", csv);
  const countyNames = ["USPS|GEOID|NAME", ...countyCodes.map((code) => `ND|38${code}|County ${code}`)].join("\n");
  const placeNames = ["USPS|GEOID|NAME", ...cityCodes.map((code) => `ND|38${code}|City ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="/ratesandboundry/Rates/NDR2026Q4AUG14.zip">ND</a><a href="/ratesandboundry/Rates/WYR2026Q4AUG20.csv">WY</a>');
    if (value.endsWith("NDR2026Q4AUG14.zip")) return new Response(zip);
    if (value.includes("gaz_counties_38")) return new Response(countyNames);
    if (value.includes("gaz_place_38")) return new Response(placeNames);
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("ND", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 5);
  assert.equal(snapshot.counts.counties, 53);
  assert.equal(snapshot.counts.cities, 352);
  assert.equal(snapshot.counts.specialJurisdictions, 0);
});

test("connects Nebraska's city-driven file without synthesizing county tax rows", async () => {
  const cityCodes = Array.from({ length: 270 }, (_, index) => String(index + 1).padStart(5, "0"));
  const csv = [
    "31,45,31,0.055,0.055,0,0,20240101,29991231",
    "31,00,043,0.005,0.005,0,0,20240101,29991231",
    ...cityCodes.map((code) => `31,01,${code},0.015,0.015,0,0,20240101,29991231`),
    ...Array.from({ length: 5 }, (_, index) => `31,63,${String(index + 1).padStart(5, "0")},0.005,0.005,0,0,20240101,29991231`),
  ].join("\n");
  const zip = buildZip("NER2026Q4AUG21.csv", csv);
  const placeNames = ["USPS|GEOID|NAME", ...cityCodes.map((code) => `NE|31${code}|City ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="NER2026Q4AUG21.zip">NE</a>');
    if (value.endsWith("NER2026Q4AUG21.zip")) return new Response(zip);
    if (value.includes("gaz_counties_31")) return new Response("USPS|GEOID|NAME\nNE|31043|Dakota County");
    if (value.includes("gaz_place_31")) return new Response(placeNames);
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("NE", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 5.5);
  assert.equal(snapshot.counts.counties, 1);
  assert.equal(snapshot.counts.cities, 270);
  assert.equal(snapshot.counts.specialJurisdictions, 5);
});

test("connects Nevada's published combined totals without double-counting its 6.85% base", async () => {
  const countyCodes = ["001", "003", "005", "007", "009", "011", "013", "015", "017", "019", "021", "023", "027", "029", "031", "033", "510"];
  const csv = [
    "32,45,32,0,0,0,0,20240101,29991231",
    ...countyCodes.map((code, index) => `32,00,${code},${index === 1 ? "0.08375" : "0.071"},${index === 1 ? "0.08375" : "0.071"},0,0,20240101,29991231`),
    "32,63,32601,0.08265,0.08265,0,0,20250101,29991231",
  ].join("\n");
  const zip = buildZip("NVR2025Q4NOV05.csv", csv);
  const countyNames = ["USPS|GEOID|NAME", ...countyCodes.map((code) => `NV|32${code}|County ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="NVR2025Q4NOV05.zip">NV</a>');
    if (value.endsWith("NVR2025Q4NOV05.zip")) return new Response(zip);
    if (value.includes("gaz_counties_32")) return new Response(countyNames);
    if (value.includes("gaz_place_32")) return new Response("USPS|GEOID|NAME\n");
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("NV", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  const clark = snapshot.rates.find((rate) => rate.jurisdictionCode === "003");
  const special = snapshot.rates.find((rate) => rate.jurisdictionCode === "32601");
  assert.equal(snapshot.stateRate, 6.85);
  assert.equal(snapshot.counts.counties, 17);
  assert.equal(snapshot.counts.specialJurisdictions, 1);
  assert.equal(clark.componentRate, 1.525);
  assert.equal(clark.totalGeneralRate, 8.375);
  assert.equal(special.componentRate, 1.415);
  assert.equal(special.totalGeneralRate, 8.265);
});

test("connects Oklahoma's complete county, municipality, and special-component inventory", async () => {
  const countyCodes = Array.from({ length: 77 }, (_, index) => String(index + 1).padStart(3, "0"));
  const cityCodes = Array.from({ length: 798 }, (_, index) => String(index + 1).padStart(5, "0"));
  const csv = [
    "40,45,40,0.045,0.045,0,0,20240101,29991231",
    ...countyCodes.map((code) => `40,00,${code},0.01,0.01,0,0,20240101,29991231`),
    ...cityCodes.map((code, index) => `40,01,${code},${index === 0 ? "0" : "0.03"},${index === 0 ? "0" : "0.03"},0,0,20240101,29991231`),
    ...Array.from({ length: 744 }, (_, index) => `40,63,${String(index + 1).padStart(5, "0")},0.005,0.005,0,0,20240101,29991231`),
  ].join("\n");
  const zip = buildZip("OKR2026Q4AUG17.csv", csv);
  const countyNames = ["USPS|GEOID|NAME", ...countyCodes.map((code) => `OK|40${code}|County ${code}`)].join("\n");
  const placeNames = ["USPS|GEOID|NAME", ...cityCodes.map((code) => `OK|40${code}|City ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="OKR2026Q4AUG17.zip">OK</a>');
    if (value.endsWith("OKR2026Q4AUG17.zip")) return new Response(zip);
    if (value.includes("gaz_counties_40")) return new Response(countyNames);
    if (value.includes("gaz_place_40")) return new Response(placeNames);
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("OK", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 4.5);
  assert.equal(snapshot.counts.counties, 77);
  assert.equal(snapshot.counts.cities, 798);
  assert.equal(snapshot.counts.specialJurisdictions, 744);
  assert.equal(snapshot.rates.find((rate) => rate.jurisdictionCode === "00001" && rate.jurisdictionType === "city").componentRate, 0);
});

test("connects South Dakota while keeping tribal replacement rates as unresolved special rows", async () => {
  const countyCodes = Array.from({ length: 66 }, (_, index) => String(index + 1).padStart(3, "0"));
  const cityCodes = Array.from({ length: 254 }, (_, index) => String(index + 1).padStart(5, "0"));
  const csv = [
    "46,45,46,0.042,0.042,0.042,0.042,20230701,29991231",
    ...countyCodes.map((code) => `46,00,${code},0,0,0,0,20240101,29991231`),
    ...cityCodes.map((code) => `46,01,${code},0.02,0.02,0,0,20240101,29991231`),
    ...Array.from({ length: 6 }, (_, index) => `46,49,${String(index + 1).padStart(5, "0")},${index === 0 ? "0" : "0.042"},${index === 0 ? "0" : "0.042"},0,0,20240101,29991231`),
  ].join("\n");
  const zip = buildZip("SDR2026Q3JUN02.csv", csv);
  const countyNames = ["USPS|GEOID|NAME", ...countyCodes.map((code) => `SD|46${code}|County ${code}`)].join("\n");
  const placeNames = ["USPS|GEOID|NAME", ...cityCodes.map((code) => `SD|46${code}|City ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="SDR2026Q3JUN02.zip">SD</a>');
    if (value.endsWith("SDR2026Q3JUN02.zip")) return new Response(zip);
    if (value.includes("gaz_counties_46")) return new Response(countyNames);
    if (value.includes("gaz_place_46")) return new Response(placeNames);
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("SD", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 4.2);
  assert.equal(snapshot.counts.counties, 66);
  assert.equal(snapshot.counts.cities, 254);
  assert.equal(snapshot.counts.specialJurisdictions, 6);
  assert.ok(snapshot.rates.filter((rate) => rate.jurisdictionType === "special").every((rate) => rate.totalGeneralRate === null));
});

test("connects Utah's complete county and active city component inventory", async () => {
  const countyCodes = Array.from({ length: 29 }, (_, index) => String(index * 2 + 1).padStart(3, "0"));
  const cityCodes = Array.from({ length: 181 }, (_, index) => String(index + 1).padStart(5, "0"));
  const csv = [
    "49,45,49,0.0485,0.0485,0.03,0.03,20190401,99991231",
    ...countyCodes.map((code) => `49,00,${code},0.015,0.015,0,0,20240101,99991231`),
    ...cityCodes.map((code) => `49,01,${code},0.001,0.001,0,0,20240101,99991231`),
  ].join("\n");
  const countyNames = ["USPS|GEOID|NAME", ...countyCodes.map((code) => `UT|49${code}|County ${code}`)].join("\n");
  const placeNames = ["USPS|GEOID|NAME", ...cityCodes.map((code) => `UT|49${code}|City ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="UTR2026Q4AUG11.csv">UT</a>');
    if (value.endsWith("UTR2026Q4AUG11.csv")) return new Response(csv);
    if (value.includes("gaz_counties_49")) return new Response(countyNames);
    if (value.includes("gaz_place_49")) return new Response(placeNames);
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("UT", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 4.85);
  assert.equal(snapshot.counts.counties, 29);
  assert.equal(snapshot.counts.cities, 181);
  assert.equal(snapshot.counts.specialJurisdictions, 0);
  assert.equal(snapshot.rates.find((rate) => rate.jurisdictionType === "county").totalGeneralRate, 6.35);
});

test("connects Vermont's municipal local options without misclassifying zero county rows as flat", async () => {
  const cityCodes = Array.from({ length: 36 }, (_, index) => String(index + 1).padStart(5, "0"));
  const csv = [
    "50,45,50,0.06,0.06,0,0,20240101,99991231",
    ...cityCodes.map((code) => `50,01,${code},0.01,0.01,0,0,20240101,99991231`),
  ].join("\n");
  const placeNames = ["USPS|GEOID|NAME", ...cityCodes.map((code) => `VT|50${code}|City ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="VTR2026Q4AUG20.zip">VT</a>');
    if (value.endsWith("VTR2026Q4AUG20.zip")) return new Response(buildZip("VTR2026Q4AUG20.csv", csv));
    if (value.includes("gaz_counties_50")) return new Response("USPS|GEOID|NAME\n");
    if (value.includes("gaz_place_50")) return new Response(placeNames);
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("VT", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6);
  assert.equal(snapshot.counts.counties, 0);
  assert.equal(snapshot.counts.cities, 36);
  assert.equal(snapshot.counts.specialJurisdictions, 0);
  assert.match(snapshot.boundaryStatus, /boundary reconciliation/);
  assert.doesNotMatch(snapshot.boundaryStatus, /single flat statewide rate/);
});

test("connects Washington without treating its five non-Census county-type codes as counties", async () => {
  const countyCodes = Array.from({ length: 39 }, (_, index) => String(index * 2 + 1).padStart(3, "0"));
  const extraCountyTypeCodes = ["079", "081", "083", "085", "087"];
  const cityCodes = Array.from({ length: 277 }, (_, index) => String(index + 1).padStart(5, "0"));
  const csv = [
    "53,45,53,0.065,0.065,0.065,0.065,20240101,99991231",
    ...countyCodes.map((code) => `53,00,${code},0.015,0.015,0,0,20240101,99991231`),
    ...extraCountyTypeCodes.map((code) => `53,00,${code},0.024,0.024,0,0,20240101,99991231`),
    ...cityCodes.map((code) => `53,01,${code},0.025,0.025,0,0,20240101,99991231`),
    ...Array.from({ length: 1153 }, (_, index) => `53,63,L${String(index + 1).padStart(4, "0")},0.02,0.02,0,0,20240101,99991231`),
  ].join("\n");
  const countyNames = ["USPS|GEOID|NAME", ...countyCodes.map((code) => `WA|53${code}|County ${code}`)].join("\n");
  const placeNames = ["USPS|GEOID|NAME", ...cityCodes.map((code) => `WA|53${code}|City ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="WAR2026Q4AUG27.zip">WA</a>');
    if (value.endsWith("WAR2026Q4AUG27.zip")) return new Response(buildZip("WAR2026Q4AUG27.csv", csv));
    if (value.includes("gaz_counties_53")) return new Response(countyNames);
    if (value.includes("gaz_place_53")) return new Response(placeNames);
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("WA", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6.5);
  assert.equal(snapshot.counts.counties, 39);
  assert.equal(snapshot.counts.cities, 277);
  assert.equal(snapshot.counts.specialJurisdictions, 1158);
  assert.ok(extraCountyTypeCodes.every((code) => snapshot.rates.find((rate) => rate.jurisdictionCode === code)?.jurisdictionType === "special"));
});

test("connects Wisconsin's complete county and municipality inventory including zero city rows", async () => {
  const countyCodes = Array.from({ length: 72 }, (_, index) => String(index + 1).padStart(3, "0"));
  const cityCodes = Array.from({ length: 1851 }, (_, index) => String(index + 1).padStart(5, "0"));
  const csv = [
    "55,45,55,0.05,0.05,0.05,0.05,20240101,99991231",
    ...countyCodes.map((code, index) => `55,00,${code},${index === 0 ? "0.009" : "0.005"},${index === 0 ? "0.009" : "0.005"},0,0,20240101,99991231`),
    ...cityCodes.map((code, index) => `55,01,${code},${index === 0 ? "0.02" : "0"},${index === 0 ? "0.02" : "0"},0,0,20240101,99991231`),
  ].join("\n");
  const countyNames = ["USPS|GEOID|NAME", ...countyCodes.map((code) => `WI|55${code}|County ${code}`)].join("\n");
  const placeNames = ["USPS|GEOID|NAME", ...cityCodes.map((code) => `WI|55${code}|City ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="WIR2026Q4AUG17.csv">WI</a>');
    if (value.endsWith("WIR2026Q4AUG17.csv")) return new Response(csv);
    if (value.includes("gaz_counties_55")) return new Response(countyNames);
    if (value.includes("gaz_place_55")) return new Response(placeNames);
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("WI", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 5);
  assert.equal(snapshot.counts.counties, 72);
  assert.equal(snapshot.counts.cities, 1851);
  assert.equal(snapshot.counts.specialJurisdictions, 0);
  assert.equal(snapshot.rates.filter((rate) => rate.jurisdictionType === "city" && rate.componentRate === 0).length, 1850);
});

test("connects West Virginia's municipal components without misclassifying zero county rows as flat", async () => {
  const cityCodes = Array.from({ length: 101 }, (_, index) => String(index + 1).padStart(5, "0"));
  const csv = [
    "54,45,54,0.06,0.06,0,0,20130701,99991231",
    ...cityCodes.map((code) => `54,01,${code},0.01,0.01,0,0,20240101,99991231`),
  ].join("\n");
  const placeNames = ["USPS|GEOID|NAME", ...cityCodes.map((code) => `WV|54${code}|City ${code}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="WVR2026Q3FEB25.csv">WV</a>');
    if (value.endsWith("WVR2026Q3FEB25.csv")) return new Response(csv);
    if (value.includes("gaz_counties_54")) return new Response("USPS|GEOID|NAME\n");
    if (value.includes("gaz_place_54")) return new Response(placeNames);
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("WV", { fetchImpl, now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6);
  assert.equal(snapshot.counts.counties, 0);
  assert.equal(snapshot.counts.cities, 101);
  assert.equal(snapshot.counts.specialJurisdictions, 0);
  assert.match(snapshot.boundaryStatus, /boundary reconciliation/);
  assert.doesNotMatch(snapshot.boundaryStatus, /single flat statewide rate/);
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
