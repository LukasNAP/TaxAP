import assert from "node:assert/strict";
import test from "node:test";
import { readNevadaAplusComparison } from "../server/nv-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";

// Department of Taxation county table; intentionally no customer-level data.
const countyRates = {
  "Carson City": 7.6, Churchill: 7.6, Clark: 8.375, Douglas: 7.1,
  Elko: 7.1, Esmeralda: 6.85, Eureka: 6.85, Humboldt: 6.85, Lander: 7.1,
  Lincoln: 7.1, Lyon: 7.1, Mineral: 6.85, Nye: 7.6, Pershing: 7.1,
  Storey: 7.6, Washoe: 8.265, "White Pine": 7.725,
};
const snapshot = { rates: Object.entries(countyRates).map(([name, totalGeneralRate]) => ({
  name: name === "Carson City" ? name : `${name} County`, jurisdictionType: "county", totalGeneralRate,
})) };
const row = (taxBody, description, currentRate = 7.1) => ({ taxBody, description, currentRate, activeShipTos: 1 });
const compare = (taxBodies, official = snapshot) => readNevadaAplusComparison({
  stateCode: "NV", activeShipTos: taxBodies.length, taxBodies,
}, { readOfficial: async () => official });

test("Nevada compares named county totals and feeds a difference to the shared inbox", async () => {
  const result = await compare([
    row("NV999", "Nevada Clark", 8.25), row("NV123", "Nevada Washoe Co.", 8.265),
    row("NV555", "Nevada Carson City", 7.6), row("NV456", "Nevada White Pine County", 7.725),
  ]);
  assert.ok(result.findings.every((finding) => finding.matched));
  assert.equal(result.findings[0].rateDifference, 0.125);
  assert.equal(result.unrepresentedOfficialCounties.length, 13);
  assert.deepEqual(directMappingFindingsFromReconciliation(result).map((finding) => finding.taxBody), ["NV999"]);
});

test("Nevada does not guess from an ordinal code, city, fallback, or special district", async () => {
  const result = await compare([
    row("NV000", "Nevada Clark", null), row("NV003", "Nevada Las Vegas"),
    row("NV007", "Nevada Clark/Washoe"), row("NV010", "DO NOT USE Clark"),
    row("NV011", "County FIPS 003"), row("NV012", "Nevada Clark Special"),
    row("NC060", "North Carolina Mecklenburg"),
  ], { rates: [...snapshot.rates, { name: "Clark Special", jurisdictionType: "special", totalGeneralRate: 8.375 }] });
  assert.equal(result.totals.crossStateShipTos, 1);
  assert.equal(result.totals.unmatchedShipTos, 6);
  assert.ok(result.findings.every((finding) => finding.officialRate === null));
  assert.deepEqual(directMappingFindingsFromReconciliation(result), []);
});

test("Nevada rejects missing, duplicate, unknown and nonnumeric official counties", async () => {
  for (const rates of [snapshot.rates.slice(1), [...snapshot.rates, snapshot.rates[0]],
    snapshot.rates.map((rate, i) => i ? rate : { ...rate, name: "Unknown" }),
    snapshot.rates.map((rate, i) => i ? rate : { ...rate, totalGeneralRate: null })]) {
    await assert.rejects(compare([], { rates }), /Nevada/);
  }
});

test("Nevada source failures propagate without a fabricated comparison", async () => {
  await assert.rejects(readNevadaAplusComparison({ stateCode: "NV", taxBodies: [] }, {
    readOfficial: async () => { throw new Error("source unavailable"); },
  }), /source unavailable/);
});
