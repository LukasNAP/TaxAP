import test from "node:test";
import assert from "node:assert/strict";
import { applyFindingTreatments } from "../app/finding-treatment.ts";

const findings = [{ taxBody: "TEST", activeShipTos: 12 }];
const oldSnapshot = { taxBodies: [{ taxBody: "TEST", treatments: [{ treatmentCode: "0", activeShipTos: 0 }, { treatmentCode: "3", activeShipTos: 12 }] }] };
const visible = rows => rows.filter(row => row.rateRiskShipTos === null || row.rateRiskShipTos > 0);

test("failed or pending reads cannot suppress findings using a previous zero-risk snapshot", () => {
  assert.equal(visible(applyFindingTreatments(findings, oldSnapshot, "ready")).length, 0);
  for (const status of ["loading", "error", "idle"]) {
    const rows = applyFindingTreatments(findings, oldSnapshot, status);
    assert.equal(visible(rows).length, 1);
    assert.equal(rows[0].rateRiskShipTos, null);
    assert.equal(rows[0].neverTaxedShipTos, null);
    assert.equal(rows[0].activeShipTos, 12);
  }
  const recovered = { taxBodies: [{ taxBody: "TEST", treatments: [{ treatmentCode: "0", activeShipTos: 5 }, { treatmentCode: "J", activeShipTos: 7 }] }] };
  const rows = applyFindingTreatments(findings, recovered, "ready");
  assert.equal(visible(rows).length, 1);
  assert.equal(rows[0].activeShipTos, 5);
  assert.equal(rows[0].lineLevelReviewShipTos, 7);
  assert.equal(rows[0].totalAssignedShipTos, 12);
});

test("missing treatment snapshot or tax body is unknown, not zero", () => {
  for (const snapshot of [null, { taxBodies: [] }]) {
    const rows = applyFindingTreatments(findings, snapshot, "ready");
    assert.equal(visible(rows).length, 1);
    assert.equal(rows[0].rateRiskShipTos, null);
  }
});
