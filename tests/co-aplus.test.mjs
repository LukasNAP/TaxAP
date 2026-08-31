import assert from "node:assert/strict";
import test from "node:test";
import { readColoradoAplusComparison } from "../server/co-aplus.mjs";

const officialSnapshot = { rates: [
  { jurisdictionCode: "010006", name: "DENVER", county: "DENVER", totalGeneralRate: 9.15 },
  { jurisdictionCode: "100001", name: "AURORA", county: "ARAPAHOE", totalGeneralRate: 8 },
  { jurisdictionCode: "120003", name: "AURORA", county: "ADAMS", totalGeneralRate: 8.5 },
  { jurisdictionCode: "040017", name: "COLORADO SPRINGS", county: "EL PASO", totalGeneralRate: 8.2 },
  { jurisdictionCode: "040001", name: "COLORADO SPRINGS (COMMERCIAL AERONAUTICAL ZONE)", county: "EL PASO", totalGeneralRate: 7.2 },
  { jurisdictionCode: "140206", name: "UNINCORPORATED", county: "FREMONT", totalGeneralRate: 5.4 },
  { jurisdictionCode: "030057", name: "GREELEY", county: "WELD", totalGeneralRate: 7.01 },
] };

test("Colorado compares a unique city and direct state jurisdiction code without using an address", async () => {
  const result = await readColoradoAplusComparison({ stateCode: "CO", activeShipTos: 4, taxBodies: [
    { taxBody: "CO004", description: "COLORADO DENVER", activeShipTos: 2, currentRate: 8.81 },
    { taxBody: "CO140206", description: "Colorado Canon City", activeShipTos: 1, currentRate: 5.4 },
    { taxBody: "CO033", description: "COLORADO GREELEY", activeShipTos: 1, currentRate: 7.01 },
  ] }, { readOfficialCoRates: async () => officialSnapshot });
  assert.deepEqual(result.findings.map((finding) => finding.officialRate), [9.15, 5.4, 7.01]);
  assert.equal(result.findings[0].hasDifference, true);
  assert.equal(result.findings[1].jurisdictionLabel, "UNINCORPORATED");
});

test("Colorado leaves multi-rate city names unmatched rather than selecting an official variant", async () => {
  const result = await readColoradoAplusComparison({ stateCode: "CO", activeShipTos: 1, taxBodies: [
    { taxBody: "CO001", description: "COLORADO AURORA", activeShipTos: 1, currentRate: 8 },
    { taxBody: "CO002", description: "COLORADO COLORADO SPRINGS", activeShipTos: 1, currentRate: 8.2 },
  ] }, { readOfficialCoRates: async () => officialSnapshot });
  assert.equal(result.findings[0].matched, false);
  assert.equal(result.findings[0].hasDifference, false);
  assert.equal(result.findings[1].matched, false);
});

test("Colorado exposes missing, equipment, temporary, and credit categories as exclusions", async () => {
  const result = await readColoradoAplusComparison({ stateCode: "CO", activeShipTos: 4, taxBodies: [
    { taxBody: "CO000", definitionStatus: "missing", activeShipTos: 1, currentRate: null },
    { taxBody: "CO042E", description: "Colorado Denver Equip", activeShipTos: 1, currentRate: 4.811 },
    { taxBody: "CO CR", description: "Colorado Credits", activeShipTos: 1, currentRate: 7.65 },
    { taxBody: "ZTEMP", description: "TAX BODY TEMP USE", activeShipTos: 1, currentRate: 0 },
  ] }, { readOfficialCoRates: async () => officialSnapshot });
  assert.equal(result.totals.misinputShipTos, 4);
  assert.equal(result.findings.length, 0);
});
