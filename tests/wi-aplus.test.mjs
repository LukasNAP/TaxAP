import assert from "node:assert/strict";
import test from "node:test";
import { readWisconsinAplusComparison } from "../server/wi-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";
const counties = Array.from({ length: 72 }, (_, i) => ({ jurisdictionType: "county", name: `${i === 0 ? "Milwaukee" : i === 1 ? "Dane" : `Fixture ${i}`} County`, totalGeneralRate: i === 0 ? 5.9 : 5.5 }));
const source = { rates: [...counties, { jurisdictionType: "city", name: "Milwaukee city", componentRate: 2 }] };
const row = (taxBody, description, currentRate = 5.5) => ({ taxBody, description, currentRate, activeShipTos: 1 });
const compare = (rows, snapshot = source) => readWisconsinAplusComparison({ stateCode: "WI", activeShipTos: rows.length, taxBodies: rows }, { readOfficial: async () => snapshot });

test("Wisconsin distinguishes explicit city from unresolved Milwaukee county assignments", async () => {
  const result = await compare([row("WI001", "Wisconsin Dane Co.", 5), row("WI002", "Wisconsin Milwaukee County", 5.9), row("WI003", "Wisconsin City of Milwaukee", 5.9)]);
  assert.equal(result.findings[0].officialRate, 5.5);
  assert.equal(result.findings[1].matched, false);
  assert.equal(result.findings[2].officialRate, 7.9);
  assert.equal(directMappingFindingsFromReconciliation(result).length, 2);
});
test("Wisconsin never infers county scope from bare, resort, undefined or unknown labels", async () => {
  const result = await compare([row("WI000", "Wisconsin Dane County"), row("WI004", "Wisconsin Dane"), row("WI005", "Wisconsin Dane resort County"), row("WI006", "Wisconsin Unknown County"), row("NC060", "North Carolina Mecklenburg")]);
  assert.equal(result.totals.unmatchedShipTos, 4);
  assert.equal(result.totals.crossStateShipTos, 1);
});
test("Wisconsin rejects partial, duplicate and unresolved official county/city inventories", async () => {
  for (const rates of [source.rates.slice(1), [...source.rates, counties[0]], counties,
    source.rates.map((r, i) => i ? r : { ...r, totalGeneralRate: null })]) {
    await assert.rejects(compare([], { rates }), /Wisconsin/);
  }
});
