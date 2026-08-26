import assert from "node:assert/strict";
import test from "node:test";
import { reconcileNewJerseyAplus } from "../server/nj-aplus.mjs";

const officialSnapshot = (rate = 6.625) => ({
  stateCode: "NJ",
  rates: [{ jurisdictionCode: "NJ", totalGeneralRate: rate }],
});

test("compares NJ000 and visibly excludes the known Georgia assignment", () => {
  const result = reconcileNewJerseyAplus({
    stateDetail: {
      stateCode: "NJ",
      activeShipTos: 600,
      taxBodies: [
        { taxBody: "NJ000", description: "New Jersey", activeShipTos: 599, currentRate: 6.625 },
        { taxBody: "GA060", description: "Georgia Fulton", activeShipTos: 1, currentRate: 8.9 },
      ],
    },
    officialSnapshot: officialSnapshot(),
  });

  assert.equal(result.comparisonStatus, "matched");
  assert.equal(result.hasDifference, false);
  assert.deepEqual(result.totals, { activeShipTos: 600, comparedShipTos: 599, crossStateShipTos: 1, unclassifiedShipTos: 0 });
  assert.deepEqual(result.crossStateAssignments.map((row) => row.taxBody), ["GA060"]);
});

test("flags a real NJ000 rate difference without folding in unclassified assignments", () => {
  const result = reconcileNewJerseyAplus({
    stateDetail: {
      stateCode: "NJ",
      activeShipTos: 3,
      taxBodies: [
        { taxBody: "NJ000", description: "New Jersey", activeShipTos: 2, currentRate: 6.5 },
        { taxBody: null, description: null, activeShipTos: 1, currentRate: null },
      ],
    },
    officialSnapshot: officialSnapshot(),
  });

  assert.equal(result.comparisonStatus, "difference");
  assert.equal(result.rateDifference, 0.125);
  assert.equal(result.totals.unclassifiedShipTos, 1);
});

test("fails closed when assignment groups do not reconcile to the active total", () => {
  assert.throws(() => reconcileNewJerseyAplus({
    stateDetail: { stateCode: "NJ", activeShipTos: 10, taxBodies: [{ taxBody: "NJ000", activeShipTos: 9, currentRate: 6.625 }] },
    officialSnapshot: officialSnapshot(),
  }), /do not reconcile/);
});
