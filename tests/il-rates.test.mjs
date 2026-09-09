import assert from "node:assert/strict";
import test from "node:test";
import { ILLINOIS_COUNTY_COUNT, ILLINOIS_STATE_RATE, parseIllinoisRates, readOfficialIlRates } from "../server/il-rates.mjs";

function row({ locationId, locationName, county, addressOverride = "N", effectiveDate = "20260801", rate = "06250" }) {
  return `${locationId}${locationName.padEnd(25)}${county.padEnd(25)}${addressOverride}${effectiveDate}${rate}01000${rate}01000N06250010000625001000N06250062500000000000N`;
}

function fixture({ overrideRate, conflictingDuplicate, malformed } = {}) {
  const rows = Array.from({ length: ILLINOIS_COUNTY_COUNT }, (_, index) => row({
    locationId: `${String(index + 1).padStart(3, "0")}-5000-1`,
    locationName: `County ${index + 1}`,
    county: `County ${index + 1}`,
    rate: index === 0 ? "10250" : "06250",
  }));
  rows.push(...Array.from({ length: 900 }, (_, index) => row({
    locationId: `${String(index + 1).padStart(3, "0")}-0001-1`,
    locationName: `City ${index + 1}`,
    county: `County ${(index % ILLINOIS_COUNTY_COUNT) + 1}`,
    rate: index === 15 ? "10250" : "06250",
  })));
  rows.push(row({ locationId: "060-5000-2", locationName: "Madison County", county: "County 60", addressOverride: "Y", rate: overrideRate ?? "00000" }));
  if (conflictingDuplicate) rows.push(row({ locationId: "001-5000-1", locationName: "County 1", county: "County 1", rate: "06250" }));
  if (malformed) rows[0] = "short";
  return rows.join("\n");
}

test("parses the documented Illinois fixed-width general-merchandise rate fields", () => {
  const parsed = parseIllinoisRates(fixture(), { minRateRows: 1 });
  assert.equal(parsed.counties.length, ILLINOIS_COUNTY_COUNT);
  assert.equal(parsed.rows.length, ILLINOIS_COUNTY_COUNT + 901);
  assert.equal(parsed.rates.length, ILLINOIS_COUNTY_COUNT + 900);
  assert.equal(parsed.rates.find((rate) => rate.jurisdictionCode === "IL:001-5000-1").totalGeneralRate, 10.25);
  assert.equal(parsed.rates.find((rate) => rate.jurisdictionCode === "IL:016-0001-1").jurisdictionType, "city");
  assert.equal(parsed.rows.find((source) => source.locationId === "060-5000-2").addressOverride, true);
});

test("refuses to use a jurisdiction-wide rate when IDOR says address-level lookup is required", () => {
  assert.throws(() => parseIllinoisRates(fixture({ overrideRate: "06250" }), { minRateRows: 1 }), /address-specific/);
});

test("fails closed on conflicting duplicate IDs and malformed fixed-width rows", () => {
  assert.throws(() => parseIllinoisRates(fixture({ conflictingDuplicate: true }), { minRateRows: 1 }), /conflicting current records/);
  assert.throws(() => parseIllinoisRates(fixture({ malformed: true }), { minRateRows: 1 }), /too short/);
});

test("returns an official Illinois snapshot without turning address overrides into guessed rates", async () => {
  const text = fixture().padEnd(150_001, "\n");
  const snapshot = await readOfficialIlRates({
    fetchImpl: async () => new Response(text),
    now: new Date("2026-08-31T00:00:00Z"),
    bypassCache: true,
  });
  assert.equal(snapshot.stateCode, "IL");
  assert.equal(snapshot.stateRate, ILLINOIS_STATE_RATE);
  assert.equal(snapshot.counts.counties, ILLINOIS_COUNTY_COUNT);
  assert.equal(snapshot.counts.specialJurisdictions, 1);
  assert.deepEqual(snapshot.addressOverrideLocationIds, ["060-5000-2"]);
  assert.doesNotMatch(JSON.stringify(snapshot.rates), /060-5000-2/);
});
