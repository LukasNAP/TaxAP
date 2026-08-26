import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import test from "node:test";
import {
  buildWantedAddressKeys,
  findLatestBoundaryZip,
  matchGeorgiaAddress,
  normalizeZip,
  parseBoundaryCsv,
  parseShipToStreetLine,
  reconcileGeorgiaBoundary,
} from "../server/ga-boundary.mjs";
import { readSingleFileZip, readZipEntries } from "../server/zip-utils.mjs";

const COLUMN_COUNT = 89;

function boundaryRow(fields) {
  const columns = new Array(COLUMN_COUNT).fill("");
  columns[0] = fields.type ?? "A";
  columns[1] = fields.begin ?? "20220101";
  columns[2] = fields.end ?? "29991231";
  columns[3] = fields.low ?? "";
  columns[4] = fields.high ?? "";
  columns[5] = fields.oddEven ?? "";
  columns[6] = fields.predir ?? "";
  columns[7] = fields.name ?? "";
  columns[8] = fields.suffix ?? "";
  columns[9] = fields.postdir ?? "";
  columns[10] = fields.secDesig ?? "";
  columns[11] = fields.secLow ?? "";
  columns[12] = fields.secHigh ?? "";
  columns[13] = fields.secOddEven ?? "";
  columns[14] = fields.city ?? "";
  columns[15] = fields.zip5 ?? "";
  columns[16] = fields.zip4 ?? "";
  columns[17] = fields.zipLow ?? "";
  columns[18] = fields.zipExtLow ?? "";
  columns[19] = fields.zipHigh ?? "";
  columns[20] = fields.zipExtHigh ?? "";
  columns[22] = fields.fipsState ?? "13";
  columns[23] = fields.fipsStateIndicator ?? "13";
  columns[24] = fields.fipsCounty ?? "";
  columns[25] = fields.fipsPlace ?? "";
  columns[26] = fields.placeClass ?? "";
  columns[29] = fields.specialCode ? "ST" : "";
  columns[30] = fields.specialCode ?? "";
  columns[31] = fields.specialCode ? "63" : "";
  return columns.join(",");
}

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

test("reads a minimal single-file ZIP archive built with raw deflate", () => {
  const zip = buildZip("data.csv", "hello,world\n1,2\n");
  const entry = readSingleFileZip(zip);
  assert.equal(entry.name, "data.csv");
  assert.equal(entry.data.toString("utf8"), "hello,world\n1,2\n");
  assert.equal(readZipEntries(zip).length, 1);
});

test("discovers the current dated Georgia boundary archive filename", () => {
  const html = '<a href="/ratesandboundry/Boundary/GAB2025Q4AUG01.zip">GA</a><a href="/ratesandboundry/Boundary/GAB2026Q3MAY19.zip">GA</a>';
  const url = findLatestBoundaryZip(html, "GA");
  assert.match(url, /GAB2026Q3MAY19\.zip$/);
});

test("parses a freeform A+ street line into boundary-comparable components", () => {
  assert.deepEqual(parseShipToStreetLine("2500 DANIELLS BRIDGE RD"), {
    houseNumber: 2500, predir: "", streetName: "DANIELLS BRIDGE", suffix: "RD", postdir: "",
  });
  assert.deepEqual(parseShipToStreetLine("1101 E BEECHWOOD DRIVE NW"), {
    houseNumber: 1101, predir: "E", streetName: "BEECHWOOD", suffix: "DR", postdir: "NW",
  });
  assert.equal(parseShipToStreetLine("PO BOX 135"), null);
  assert.equal(parseShipToStreetLine(""), null);
});

test("normalizes 5-digit and 9-digit ZIP codes and rejects short codes", () => {
  assert.deepEqual(normalizeZip("30606-6104"), { zip5: "30606", zip4: "6104" });
  assert.deepEqual(normalizeZip("306066104"), { zip5: "30606", zip4: "6104" });
  assert.deepEqual(normalizeZip("30606"), { zip5: "30606", zip4: null });
  assert.deepEqual(normalizeZip("123"), { zip5: null, zip4: null });
});

test("matches an address-level boundary record and prefers it over ZIP fallbacks", () => {
  const csv = [
    boundaryRow({ type: "A", low: "1", high: "99", oddEven: "O", name: "DANIELLS BRIDGE", suffix: "RD", city: "ATHENS", zip5: "30606", fipsCounty: "219" }),
    boundaryRow({ type: "4", zipLow: "30606", zipExtLow: "0000", zipHigh: "30606", zipExtHigh: "9999", fipsCounty: "999" }),
    boundaryRow({ type: "Z", zipLow: "30606", zipHigh: "30606", fipsCounty: "888" }),
  ].join("\n");
  const address = { streetLine: "1 DANIELLS BRIDGE RD", secondaryLine: "", city: "ATHENS", zip: "30606-6104" };
  const wanted = buildWantedAddressKeys([address]);
  const dataset = parseBoundaryCsv(csv, { wantedAddressKeys: wanted });
  const result = matchGeorgiaAddress(dataset, address, "20260818");
  assert.equal(result.tier, "address");
  assert.equal(result.jurisdiction.fipsCounty, "219");
});

test("falls back to ZIP+4 then ZIP-5 when no address-level record is retained or matches", () => {
  const csv = [
    boundaryRow({ type: "4", zipLow: "30606", zipExtLow: "6000", zipHigh: "30606", zipExtHigh: "6999", fipsCounty: "219" }),
    boundaryRow({ type: "Z", zipLow: "30606", zipHigh: "30606", fipsCounty: "888" }),
  ].join("\n");
  const dataset = parseBoundaryCsv(csv, {});

  const zip9Address = { streetLine: "500 UNKNOWN AVE", secondaryLine: "", city: "ATHENS", zip: "30606-6500" };
  assert.deepEqual(matchGeorgiaAddress(dataset, zip9Address, "20260818"), { tier: "zip9", jurisdiction: { fipsCounty: "219", fipsPlace: null, specialCode: null } });

  const zip5Address = { streetLine: "500 UNKNOWN AVE", secondaryLine: "", city: "ATHENS", zip: "30606-1000" };
  assert.deepEqual(matchGeorgiaAddress(dataset, zip5Address, "20260818"), { tier: "zip5", jurisdiction: { fipsCounty: "888", fipsPlace: null, specialCode: null } });
});

test("prefers an explicit ZIP-5 row over agreeing ZIP+4 sub-ranges, even without a +4 on the address", () => {
  // Real case (30720/Whitfield County): an explicit Z-type row always outranks inferring from
  // ZIP+4 agreement, so a plain 5-digit ZIP still gets the file's authoritative answer, not a guess.
  const csv = [
    boundaryRow({ type: "4", zipLow: "30606", zipExtLow: "6000", zipHigh: "30606", zipExtHigh: "6999", fipsCounty: "219" }),
    boundaryRow({ type: "Z", zipLow: "30606", zipHigh: "30606", fipsCounty: "888" }),
  ].join("\n");
  const dataset = parseBoundaryCsv(csv, {});
  const noPlusFour = { streetLine: "500 UNKNOWN AVE", secondaryLine: "", city: "ATHENS", zip: "30606" };
  assert.deepEqual(matchGeorgiaAddress(dataset, noPlusFour, "20260818"), { tier: "zip5", jurisdiction: { fipsCounty: "888", fipsPlace: null, specialCode: null } });
});

test("resolves a ZIP with no ZIP-5 row when every ZIP+4 sub-range agrees on jurisdiction", () => {
  // The real 30720 case: the archive publishes only ZIP+4 sub-ranges for this ZIP (no Z-type row),
  // but every sub-range agrees on the same county, so a plain 5-digit ZIP can resolve safely.
  const csv = [
    boundaryRow({ type: "4", zipLow: "30720", zipExtLow: "0001", zipHigh: "30720", zipExtHigh: "4999", fipsCounty: "313" }),
    boundaryRow({ type: "4", zipLow: "30720", zipExtLow: "5000", zipHigh: "30720", zipExtHigh: "9999", fipsCounty: "313" }),
  ].join("\n");
  const dataset = parseBoundaryCsv(csv, {});
  const noPlusFour = { streetLine: "1 UNKNOWN LN", secondaryLine: "", city: "DALTON", zip: "30720" };
  assert.deepEqual(matchGeorgiaAddress(dataset, noPlusFour, "20260818"), { tier: "zip5FromZip9", jurisdiction: { fipsCounty: "313", fipsPlace: null, specialCode: null } });
});

test("reports ambiguous, not a guess, when a ZIP's ZIP+4 sub-ranges disagree and no ZIP-5 row exists", () => {
  const csv = [
    boundaryRow({ type: "4", zipLow: "30720", zipExtLow: "0001", zipHigh: "30720", zipExtHigh: "4999", fipsCounty: "313" }),
    boundaryRow({ type: "4", zipLow: "30720", zipExtLow: "5000", zipHigh: "30720", zipExtHigh: "9999", fipsCounty: "999" }),
  ].join("\n");
  const dataset = parseBoundaryCsv(csv, {});
  const noPlusFour = { streetLine: "1 UNKNOWN LN", secondaryLine: "", city: "DALTON", zip: "30720" };
  const result = matchGeorgiaAddress(dataset, noPlusFour, "20260818");
  assert.equal(result.tier, "ambiguous");
  assert.match(result.reason, /disagree on jurisdiction/);
});

test("reports ambiguous rather than guessing when active boundary rows disagree", () => {
  const csv = [
    boundaryRow({ type: "Z", zipLow: "30606", zipHigh: "30606", fipsCounty: "219", begin: "20220101", end: "29991231" }),
    boundaryRow({ type: "Z", zipLow: "30606", zipHigh: "30606", fipsCounty: "888", begin: "20220101", end: "29991231" }),
  ].join("\n");
  const dataset = parseBoundaryCsv(csv, {});
  const result = matchGeorgiaAddress(dataset, { streetLine: "1 X ST", secondaryLine: "", city: "ATHENS", zip: "30606" }, "20260818");
  assert.equal(result.tier, "ambiguous");
});

test("excludes boundary rows outside their effective-date window instead of matching them", () => {
  const csv = [
    boundaryRow({ type: "Z", zipLow: "30606", zipHigh: "30606", fipsCounty: "219", begin: "20200101", end: "20211231" }),
    boundaryRow({ type: "Z", zipLow: "30606", zipHigh: "30606", fipsCounty: "220", begin: "20220101", end: "29991231" }),
  ].join("\n");
  const dataset = parseBoundaryCsv(csv, {});
  const result = matchGeorgiaAddress(dataset, { streetLine: "1 X ST", secondaryLine: "", city: "ATHENS", zip: "30606" }, "20260818");
  assert.equal(result.tier, "zip5");
  assert.equal(result.jurisdiction.fipsCounty, "220");
});

test("treats alpha and fractional PO-box address ranges as unsupported rather than corrupt", () => {
  const csv = [
    boundaryRow({ type: "A", low: "N", high: "N", name: "PO BOX", city: "JEFFERSON", zip5: "30549", fipsCounty: "157" }),
    boundaryRow({ type: "Z", zipLow: "30549", zipHigh: "30549", fipsCounty: "157" }),
  ].join("\n");
  const dataset = parseBoundaryCsv(csv, {});
  assert.equal(dataset.unsupportedAddressRangeCount, 1);
  assert.equal(dataset.invalidRowCount, 0);
});

test("rejects a boundary file with the wrong column count or an out-of-state FIPS row", () => {
  assert.throws(() => parseBoundaryCsv("A,1,2,3\nA,1,2,3\nA,1,2,3\n"), /has 4 columns, expected 89/);
  const manyBadRows = Array.from({ length: 10 }, () => boundaryRow({ type: "Z", zipLow: "30606", zipHigh: "30606", fipsState: "29", fipsCounty: "1" })).join("\n");
  assert.throws(() => parseBoundaryCsv(manyBadRows), /failed validation/);
});

test("reconciles matched, unmatched, and ambiguous ship-tos to the live A+ total for a tax body", () => {
  const csv = [
    boundaryRow({ type: "A", low: "1", high: "99", oddEven: "O", name: "MAIN", suffix: "ST", city: "ATHENS", zip5: "30606", fipsCounty: "219" }),
  ].join("\n");
  const addresses = [
    { streetLine: "1 MAIN ST", secondaryLine: "", city: "ATHENS", zip: "30606", taxBody: "GA219" },
    { streetLine: "3 MAIN ST", secondaryLine: "", city: "ATHENS", zip: "30606", taxBody: "GA219" },
    { streetLine: "999 NOWHERE LN", secondaryLine: "", city: "NOTOWN", zip: "30001", taxBody: "GA219" },
  ];
  const wanted = buildWantedAddressKeys(addresses);
  const boundaryDataset = parseBoundaryCsv(csv, { wantedAddressKeys: wanted });
  const rateSnapshot = { stateRate: 4, rates: [{ jurisdictionType: "county", jurisdictionCode: "219", componentRate: 3 }] };
  const taxBodyRates = new Map([["GA219", 7.5]]);
  const reconciliation = reconcileGeorgiaBoundary({ addresses, boundaryDataset, rateSnapshot, taxBodyRates, asOfDate: "20260818" });

  assert.equal(reconciliation.totals.activeShipTos, 3);
  assert.equal(reconciliation.totals.matched, 2);
  assert.equal(reconciliation.totals.unmatched, 1);
  assert.equal(reconciliation.totals.matched + reconciliation.totals.unmatched + reconciliation.totals.ambiguous, reconciliation.totals.activeShipTos);
  const finding = reconciliation.taxBodyFindings.find((row) => row.taxBody === "GA219");
  assert.equal(finding.matchedShipTos, 2);
  assert.equal(finding.officialRate, 7);
  assert.equal(finding.aplusRate, 7.5);
  assert.equal(finding.hasDifference, true);
  assert.equal(reconciliation.excludedForNoAplusRate, 0);
  assert.deepEqual(reconciliation.unmatchedReasons, [{ reason: "no boundary row in the archive covers this ZIP code", count: 1 }]);
});

test("distinguishes a ZIP entirely absent from the archive from one whose rows are just out of date", () => {
  const csv = [
    boundaryRow({ type: "Z", zipLow: "30606", zipHigh: "30606", fipsCounty: "219", begin: "20200101", end: "20211231" }),
  ].join("\n");
  const addresses = [
    // 30606 exists in the archive, but only for a window that ended before the comparison date.
    { streetLine: "1 UNKNOWN LN", secondaryLine: "", city: "ATHENS", zip: "30606", taxBody: "GA219" },
    // 30099 never appears in the archive at all.
    { streetLine: "1 UNKNOWN LN", secondaryLine: "", city: "NOTOWN", zip: "30099", taxBody: "GA219" },
  ];
  const boundaryDataset = parseBoundaryCsv(csv, {});
  const rateSnapshot = { stateRate: 4, rates: [] };
  const reconciliation = reconcileGeorgiaBoundary({ addresses, boundaryDataset, rateSnapshot, taxBodyRates: new Map(), asOfDate: "20260818" });

  assert.equal(reconciliation.totals.unmatched, 2);
  const reasons = Object.fromEntries(reconciliation.unmatchedReasons.map((row) => [row.reason, row.count]));
  assert.equal(reasons["boundary rows exist for this ZIP but none are active as of the comparison date"], 1);
  assert.equal(reasons["no boundary row in the archive covers this ZIP code"], 1);
});

test("excludes tax bodies with no A+ rate configured, and counts what was excluded", () => {
  const csv = [
    boundaryRow({ type: "A", low: "1", high: "99", oddEven: "O", name: "MAIN", suffix: "ST", city: "ATHENS", zip5: "30606", fipsCounty: "219" }),
  ].join("\n");
  const addresses = [
    // GA219 has a real, non-zero A+ rate: kept.
    { streetLine: "1 MAIN ST", secondaryLine: "", city: "ATHENS", zip: "30606", taxBody: "GA219" },
    // NORATE has no XATXBD row at all (absent from taxBodyRates) — no A+ rate set up.
    { streetLine: "3 MAIN ST", secondaryLine: "", city: "ATHENS", zip: "30606", taxBody: "NORATE" },
    // ZERORATE has a real row, but it was configured at 0% — treated the same as unset.
    { streetLine: "5 MAIN ST", secondaryLine: "", city: "ATHENS", zip: "30606", taxBody: "ZERORATE" },
  ];
  const wanted = buildWantedAddressKeys(addresses);
  const boundaryDataset = parseBoundaryCsv(csv, { wantedAddressKeys: wanted });
  const rateSnapshot = { stateRate: 4, rates: [{ jurisdictionType: "county", jurisdictionCode: "219", componentRate: 3 }] };
  const taxBodyRates = new Map([["GA219", 7.5], ["ZERORATE", 0]]);
  const reconciliation = reconcileGeorgiaBoundary({ addresses, boundaryDataset, rateSnapshot, taxBodyRates, asOfDate: "20260818" });

  assert.deepEqual(reconciliation.taxBodyFindings.map((row) => row.taxBody), ["GA219"]);
  assert.equal(reconciliation.excludedForNoAplusRate, 2);
  // Ship-to totals are unaffected by the exclusion — only the rate-comparison rows are filtered.
  assert.equal(reconciliation.totals.activeShipTos, 3);
});

test("separates cross-state tax bodies from Georgia findings without dropping their ship-to counts", () => {
  const addresses = [
    { streetLine: "1 MAIN ST", city: "ATHENS", zip: "30606", taxBody: "GA219" },
    { streetLine: "2 MAIN ST", city: "ATHENS", zip: "30606", taxBody: "NC060" },
    { streetLine: "3 MAIN ST", city: "ATHENS", zip: "30606", taxBody: "NC060" },
  ];
  const reconciliation = reconcileGeorgiaBoundary({
    addresses,
    boundaryDataset: parseBoundaryCsv(boundaryRow({ type: "Z", zipLow: "30606", zipHigh: "30606", fipsCounty: "219" })),
    rateSnapshot: { stateRate: 4, rates: [{ jurisdictionType: "county", jurisdictionCode: "219", componentRate: 3 }] },
    taxBodyRates: new Map([["GA219", 7], ["NC060", 8.25]]),
    taxBodyDescriptions: new Map([["GA219", "Georgia Clarke"], ["NC060", "North Carolina Mecklenburg"]]),
    asOfDate: "20260826",
  });

  assert.deepEqual(reconciliation.taxBodyFindings.map((row) => row.taxBody), ["GA219"]);
  assert.equal(reconciliation.crossStateAssignments.taxBodyCount, 1);
  assert.equal(reconciliation.crossStateAssignments.shipToCount, 2);
  assert.equal(reconciliation.crossStateAssignments.rateBearingTaxBodyCount, 1);
  assert.equal(reconciliation.crossStateAssignments.rateBearingShipToCount, 2);
  assert.equal(reconciliation.crossStateAssignments.taxBodies[0].taxBody, "NC060");
  assert.equal(reconciliation.crossStateAssignments.taxBodies[0].officialRate, null);
  assert.equal(reconciliation.totals.activeShipTos, 3);
});
