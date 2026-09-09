import assert from "node:assert/strict";
import test from "node:test";
import { readSouthDakotaAplusComparison } from "../server/sd-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";

const city = { jurisdictionType: "city", name: "South Shore town", componentRate: 2 };
const source = { stateRate: 4.2, rates: [city, { jurisdictionType: "special", name: "Rosebud", componentRate: 4.2 }, { jurisdictionType: "county", name: "Codington County", componentRate: 0 }] };
const row = (taxBody, description, currentRate = 6.2) => ({ taxBody, description, currentRate, activeShipTos: 1 });
const compare = (rows, snapshot = source) => readSouthDakotaAplusComparison({ stateCode: "SD", taxBodies: rows, activeShipTos: rows.length }, { readOfficial: async () => snapshot });

test("South Dakota compares the current municipal rate, without stacking special jurisdictions", async () => {
  const result = await compare([row("SD123", "South Dakota South Shore", 5.2)]);
  assert.equal(result.findings[0].officialRate, 6.2);
  assert.equal(result.findings[0].rateDifference, 1);
  assert.equal(directMappingFindingsFromReconciliation(result).length, 1);
});

test("South Dakota leaves unknown, tribal, county and category assignments unmatched", async () => {
  const result = await compare([
    row("SD000", "South Dakota South Shore", 0), row("SD400", "South Dakota Rosebud"),
    row("SD401", "South Dakota Codington County"), row("SD402", "South Dakota South Shore tourism"),
    row("SD403", "South Dakota Unknown"), row("SD404", "DO NOT USE South Shore"),
    row("SD405", "South Dakota No Local Rt", 4.2), row("NC060", "North Carolina Mecklenburg"),
  ]);
  assert.equal(result.totals.unmatchedShipTos, 7);
  assert.equal(result.totals.crossStateShipTos, 1);
  assert.deepEqual(directMappingFindingsFromReconciliation(result), []);
});

test("South Dakota rejects duplicate names, invalid components and changed state rates", async () => {
  for (const snapshot of [{ ...source, rates: [city, city] }, { ...source, rates: [{ ...city, componentRate: null }] },
    { ...source, rates: [] }, { ...source, stateRate: 4.5 }]) {
    await assert.rejects(compare([], snapshot), /South Dakota/);
  }
});

test("South Dakota accepts the official Roslyn exception without allowing other 3% rows", async () => {
  const roslyn = { jurisdictionType: "city", jurisdictionCode: "56380", name: "Roslyn town", componentRate: 3 };
  const result = await compare([row("SD315", "South Dakota Roslyn", 6.2)], { ...source, rates: [roslyn] });
  assert.equal(result.findings[0].officialRate, 7.2);
  await assert.rejects(compare([], { ...source, rates: [{ ...city, componentRate: 3 }] }), /changed scope/);
});
