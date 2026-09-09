import assert from "node:assert/strict";
import test from "node:test";
import { readFlatStateAplusComparison } from "../server/aplus-connector.mjs";
import { readOfficialDcRates } from "../server/dc-rates.mjs";
import { flatStateFindingsFromReconciliation } from "../app/dashboard-findings.ts";

test("Rhode Island wiring reports a configured zero as a review difference", async () => {
  const result = await readFlatStateAplusComparison("RI", {
    readState: async (stateCode) => ({ stateCode, activeShipTos: 2, taxBodies: [
      { taxBody: "RI000", description: "Rhode Island", currentRate: 0, activeShipTos: 2 },
    ] }),
    readOfficial: async () => ({ stateCode: "RI", stateRate: 7 }),
  });
  assert.equal(result.expectedTaxBody, "RI000");
  assert.equal(result.rateDifference, 7);
  assert.equal(flatStateFindingsFromReconciliation(result)[0].stateCode, "RI");
});

test("D.C. wiring uses the effective official schedule and separates Honduras", async () => {
  const html = "<html>" + " ".repeat(21000) + "The general sales tax rate will remain 6% through Sept. 30, 2026 and increase to 7% for periods beginning on and after Oct. 1, 2026.</html>";
  for (const [date, expected] of [["2026-09-30", 6], ["2026-10-01", 7]]) {
    const result = await readFlatStateAplusComparison("DC", {
      readState: async (stateCode) => ({ stateCode, activeShipTos: 3, taxBodies: [
        { taxBody: "DC000", description: "District of Columbia no t", currentRate: 0, activeShipTos: 2 },
        { taxBody: "HN000", description: "HONDURAS no tax", currentRate: 0, activeShipTos: 1 },
      ] }),
      readOfficial: () => readOfficialDcRates({ fetchImpl: async () => new Response(html), now: new Date(`${date}T12:00:00Z`), bypassCache: true }),
    });
    assert.equal(result.officialRate, expected);
    assert.equal(result.totals.comparedShipTos, 2);
    assert.equal(result.totals.crossStateShipTos, 1);
    assert.equal(result.officialSnapshot.asOfDate, date);
    assert.equal(flatStateFindingsFromReconciliation(result)[0].officialRate, expected);
  }
});

test("new flat-state wiring propagates official-source failures", async () => {
  await assert.rejects(readFlatStateAplusComparison("DC", {
    readState: async () => ({ stateCode: "DC", taxBodies: [] }),
    readOfficial: async () => { throw new Error("official source unavailable"); },
  }), /official source unavailable/);
});
