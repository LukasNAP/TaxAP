import assert from "node:assert/strict";
import test from "node:test";
import { CONFIRMED_NO_TAX_BODIES, reconcileConfirmedNoTax } from "../server/no-tax-policy-aplus.mjs";
import { readDirectMappingAplusComparison } from "../server/aplus-connector.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";
const row = (taxBody, changes = {}) => ({ taxBody, description: "Deliberate no tax", definitionStatus: "configured", currentRate: 0, activeShipTos: 1, ...changes });

test("All four confirmed no-tax states execute their registered connector path without inventing official zero rates", async () => {
  for (const [stateCode, codes] of Object.entries(CONFIRMED_NO_TAX_BODIES)) {
    const stateDetail = { stateCode, activeShipTos: codes.length, taxBodies: codes.map((c) => row(c)) };
    const result = await readDirectMappingAplusComparison(stateCode, { readState: async (code) => { assert.equal(code, stateCode); return stateDetail; } });
    assert.equal(result.totals.intentionalNoTaxShipTos, codes.length);
    assert.equal(result.totals.comparedShipTos, 0);
    assert.equal(result.totals.unmatchedShipTos, 0);
    assert.equal(result.noTaxPolicy.confirmedOn, "2026-09-10");
    assert.deepEqual(result.findings, []);
    assert.deepEqual(directMappingFindingsFromReconciliation(result), []);
  }
});

test("No-tax policies never spread to changed rates, unknown codes or missing/retired definitions", () => {
  for (const [stateCode, codes] of Object.entries(CONFIRMED_NO_TAX_BODIES)) {
    for (const changes of [{ currentRate: 1 }, { currentRate: null }, { currentRate: "" }, { definitionStatus: "missing" }, { description: "DO NOT USE" }, { taxBody: `${stateCode}999` }]) {
      const r = reconcileConfirmedNoTax(stateCode, { stateCode, activeShipTos: 1, taxBodies: [row(codes[0], changes)] });
      assert.equal(r.totals.intentionalNoTaxShipTos, 0);
      assert.equal(r.totals.unmatchedShipTos, 1);
      assert.equal(r.findings[0].officialRate, null);
      assert.equal(r.findings[0].hasDifference, false);
    }
  }
});

test("No-tax policies retain cross-state exclusions and reject unsupported state context", () => {
  const r = reconcileConfirmedNoTax("AK", { stateCode: "AK", activeShipTos: 1, taxBodies: [row("AK000", { description: "North Carolina" })] });
  assert.equal(r.totals.crossStateShipTos, 1);
  assert.equal(r.totals.intentionalNoTaxShipTos, 0);
  assert.throws(() => reconcileConfirmedNoTax("AK", { stateCode: "WY" }), /same state/);
  assert.throws(() => reconcileConfirmedNoTax("LA", { stateCode: "LA" }), /No deliberate/);
});
