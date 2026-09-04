import assert from "node:assert/strict";
import test from "node:test";
import { reconcileFlatStateAplus } from "../server/flat-state-aplus.mjs";

test("matches a flat state's sole tax body against the official rate", () => {
  const result = reconcileFlatStateAplus({
    stateCode: "MD",
    expectedTaxBody: "MD000",
    stateDetail: {
      stateCode: "MD",
      activeShipTos: 731,
      taxBodies: [
        { taxBody: "MD000", description: "Maryland", activeShipTos: 729, currentRate: 6 },
        { taxBody: "NC060", description: "North Carolina Mecklenburg", activeShipTos: 2, currentRate: 8.25 },
      ],
    },
    officialRate: 6,
  });

  assert.equal(result.comparisonStatus, "matched");
  assert.equal(result.hasDifference, false);
  assert.deepEqual(result.totals, { activeShipTos: 731, comparedShipTos: 729, crossStateShipTos: 2, unclassifiedShipTos: 0 });
  assert.deepEqual(result.crossStateAssignments.map((row) => row.taxBody), ["NC060"]);
});

test("flags a real rate difference without folding in unclassified assignments", () => {
  const result = reconcileFlatStateAplus({
    stateCode: "RI",
    expectedTaxBody: "RI000",
    stateDetail: {
      stateCode: "RI",
      activeShipTos: 3,
      taxBodies: [
        { taxBody: "RI000", description: "Rhode Island", activeShipTos: 2, currentRate: 0 },
        { taxBody: null, description: null, activeShipTos: 1, currentRate: null },
      ],
    },
    officialRate: 7,
  });

  assert.equal(result.comparisonStatus, "difference");
  assert.equal(result.rateDifference, 7);
  assert.equal(result.totals.unclassifiedShipTos, 1);
});

test("fails closed when assignment groups do not reconcile to the active total", () => {
  assert.throws(() => reconcileFlatStateAplus({
    stateCode: "KY",
    expectedTaxBody: "KY000",
    stateDetail: { stateCode: "KY", activeShipTos: 10, taxBodies: [{ taxBody: "KY000", activeShipTos: 9, currentRate: 6 }] },
    officialRate: 6,
  }), /do not reconcile/);
});

test("fails closed on a state-detail/stateCode mismatch instead of silently comparing", () => {
  assert.throws(() => reconcileFlatStateAplus({
    stateCode: "IN",
    expectedTaxBody: "IN000",
    stateDetail: { stateCode: "KY", activeShipTos: 1, taxBodies: [] },
    officialRate: 7,
  }), /requires an A\+ state-detail snapshot/);
});
