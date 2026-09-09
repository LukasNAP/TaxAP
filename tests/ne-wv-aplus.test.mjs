import assert from "node:assert/strict";
import test from "node:test";
import { readNebraskaAplusComparison } from "../server/ne-aplus.mjs";
import { readWestVirginiaAplusComparison } from "../server/wv-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";

const row = (taxBody, description, currentRate) => ({ taxBody, description, currentRate, activeShipTos: 1 });
const detail = (stateCode, taxBodies) => ({ stateCode, taxBodies, activeShipTos: taxBodies.length });
const ne = { stateRate: 5.5, rates: [
  { jurisdictionType: "city", jurisdictionCode: "46030", name: "South Sioux City city", totalGeneralRate: 7 },
  { jurisdictionType: "city", jurisdictionCode: "37000", name: "Omaha city", totalGeneralRate: 7 },
  { jurisdictionType: "county", jurisdictionCode: "043", name: "Dakota County", totalGeneralRate: 6 },
  { jurisdictionType: "special", jurisdictionCode: "GL801", name: "Special jurisdiction GL801", totalGeneralRate: null },
] };
const wv = { stateRate: 6, rates: [
  { jurisdictionType: "city", jurisdictionCode: "14600", name: "Charleston city", componentRate: 1 },
] };

test("Nebraska requires city code AND name and never stacks Dakota County onto South Sioux City", async () => {
  const result = await readNebraskaAplusComparison(detail("NE", [
    row("NE46030", "Nebraska South Sioux City", 7.5), row("NE37000", "Nebraska Omaha", 7),
    row("NE000", null, null), row("NE043", "Nebraska Dakota County", 6),
    row("NE99999", "Nebraska Omaha", 7), row("NE37000", "Nebraska Lincoln", 7),
    row("NE37000X", "Nebraska Omaha", 7), row("NE37000", "Nebraska Omaha equipment", 7),
  ]), { readOfficial: async () => ne });
  assert.equal(result.findings[0].officialRate, 7);
  assert.equal(result.findings[0].rateDifference, -0.5);
  assert.equal(result.totals.unmatchedShipTos, 6);
  assert.equal(directMappingFindingsFromReconciliation(result).length, 1);
});

test("Nebraska rejects duplicate codes and unresolved source totals", async () => {
  for (const rates of [[...ne.rates, ne.rates[0]], [{ ...ne.rates[0], totalGeneralRate: null }]]) {
    await assert.rejects(readNebraskaAplusComparison(detail("NE", []), { readOfficial: async () => ({ ...ne, rates }) }), /Nebraska/);
  }
});

test("West Virginia compares exact municipal names and the explicit no-local group", async () => {
  const result = await readWestVirginiaAplusComparison(detail("WV", [
    row("WV200", "West Virginia Charleston", 6), row("WV0100", "West Virginia No Local Rt", 6),
    row("WV000", null, null), row("WV961", "Missouri Lewisburg", 7),
    row("WV500", "West Virginia Unknown", 7), row("WV600", "West Virginia Charleston County", 7),
    row("WV601", "West Virginia Charleston equipment", 7),
    row("NC060", "North Carolina Mecklenburg", 8.25),
  ]), { readOfficial: async () => wv });
  assert.equal(result.findings[0].officialRate, 7);
  assert.equal(result.findings[1].officialRate, 6);
  assert.equal(result.totals.unmatchedShipTos, 5);
  assert.equal(result.totals.crossStateShipTos, 1);
  assert.equal(directMappingFindingsFromReconciliation(result).length, 1);
});

test("West Virginia fails closed on changed scope, duplicate names, and missing components", async () => {
  for (const rates of [[...wv.rates, wv.rates[0]], [{ ...wv.rates[0], componentRate: null }],
    [{ ...wv.rates[0], jurisdictionType: "special" }]]) {
    await assert.rejects(readWestVirginiaAplusComparison(detail("WV", []), { readOfficial: async () => ({ ...wv, rates }) }), /West Virginia/);
  }
});

test("both new state readers propagate source failures", async () => {
  for (const reader of [readNebraskaAplusComparison, readWestVirginiaAplusComparison]) {
    await assert.rejects(reader({}, { readOfficial: async () => { throw new Error("source failed"); } }), /source failed/);
  }
});
