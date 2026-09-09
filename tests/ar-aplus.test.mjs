import assert from "node:assert/strict";
import test from "node:test";
import { parseArkansasLocalTable, readArkansasAplusComparison, readArkansasCombinedRates } from "../server/ar-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";

const text = `JULY - SEPTEMBER 2026
- CITY LIST -
Van Buren (city) 17-02 07/01/26 2.500% Crawford 1.250% 3.750%
Springdale 72-10 07/01/26 2.000% Washington/Benton See Below Varies
- COUNTY LIST -
Crawford County 17-00 01/01/24 1.250%`;
const options = { period: "JULY - SEPTEMBER 2026", stateRate: 6.5, minimumCities: 2, expectedCounties: 1 };
const row = (taxBody, description, currentRate = 9.25) => ({ taxBody, description, currentRate, activeShipTos: 1 });

test("Arkansas uses published local totals, preserves county-only scope and varying city rates", async () => {
  const rates = parseArkansasLocalTable(text, options);
  assert.equal(rates[0].totalGeneralRate, 10.25);
  assert.equal(rates[1].totalGeneralRate, null);
  assert.equal(rates[2].totalGeneralRate, 7.75);
  const taxBodies = [row("AR1702", "Arkansas Van Buren"), row("AR1700", "Arkansas Crawford Co.", 7.75),
    row("AR7210", "Arkansas Springdale"), row("AR000", null, null), row("AR1702", "Arkansas Alma"),
    row("AR1702", "Arkansas Van Buren equipment"), row("AR1702", "Arkansas Van Buren", null),
    row("TX001", "Texas", 0)];
  const result = await readArkansasAplusComparison({ stateCode: "AR", activeShipTos: 8, taxBodies }, { readOfficial: async () => ({ rates }) });
  assert.equal(result.totals.comparedShipTos, 2);
  assert.equal(result.totals.unmatchedShipTos, 5);
  assert.equal(result.totals.crossStateShipTos, 1);
  assert.equal(directMappingFindingsFromReconciliation(result).length, 1);
});

test("Arkansas rejects stale periods, missing inventory, duplicate codes and corrupt sums", () => {
  for (const invalid of [text.replace("JULY", "APRIL"), text.replace("3.750%", "3.500%"),
    text.replace("Crawford County 17-00 01/01/24 1.250%", ""),
    text + "\nCrawford County 17-00 01/01/24 1.250%", text.replace("See Below Varies", "Unknown")]) {
    assert.throws(() => parseArkansasLocalTable(invalid, options), /Arkansas/);
  }
  assert.throws(() => parseArkansasLocalTable(text, { ...options, stateRate: 6 }), /scope/);
});

test("Arkansas refuses an unpublished current quarter and propagates source failure", async () => {
  await assert.rejects(readArkansasCombinedRates({ now: new Date("2026-10-01"), fetchImpl: async () => ({ ok: true, text: async () => "cityCountyTaxTable_Jul_Sep_2026.pdf" }) }), /not published/);
  await assert.rejects(readArkansasAplusComparison({}, { readOfficial: async () => { throw new Error("unavailable"); } }), /unavailable/);
});
