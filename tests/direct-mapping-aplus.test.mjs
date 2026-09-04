import assert from "node:assert/strict";
import test from "node:test";
import { reconcileDirectMappingAplus } from "../server/direct-mapping-aplus.mjs";

test("matches direct-mapping tax bodies by whatever the caller's matcher decides", () => {
  const result = reconcileDirectMappingAplus({
    stateCode: "FL",
    stateDetail: {
      stateCode: "FL",
      activeShipTos: 10,
      taxBodies: [
        { taxBody: "FL011", description: "Florida Collier", activeShipTos: 5, currentRate: 7 },
        { taxBody: "FL050", description: "Florida Palm Beach", activeShipTos: 3, currentRate: 7 },
        { taxBody: "NC060", description: "North Carolina Mecklenburg", activeShipTos: 2, currentRate: 8.25 },
      ],
    },
    matchOfficialRow: (row) => (row.taxBody === "FL011" ? { name: "COLLIER County", totalGeneralRate: 6 } : row.taxBody === "FL050" ? { name: "PALM BEACH County", totalGeneralRate: 6.5 } : null),
  });

  assert.deepEqual(result.totals, { activeShipTos: 10, comparedShipTos: 8, crossStateShipTos: 2, misinputShipTos: 0, unmatchedShipTos: 0 });
  const mismatches = result.findings.filter((f) => f.hasDifference);
  assert.equal(mismatches.length, 2);
  assert.equal(mismatches.find((f) => f.taxBody === "FL011").rateDifference, -1);
  assert.equal(mismatches.find((f) => f.taxBody === "FL050").rateDifference, -0.5);
  assert.deepEqual(result.crossStateAssignments.map((row) => row.taxBody), ["NC060"]);
});

test("excludes misinputs from the comparison and reports them separately", () => {
  const result = reconcileDirectMappingAplus({
    stateCode: "OH",
    stateDetail: {
      stateCode: "OH",
      activeShipTos: 5,
      taxBodies: [
        { taxBody: "OH000", description: "Ohio", activeShipTos: 3, currentRate: 0 },
        { taxBody: "OH042", description: "OHIO KNOX CO.", activeShipTos: 2, currentRate: 6.75 },
      ],
    },
    isMisinput: (row) => row.taxBody === "OH000",
    matchOfficialRow: (row) => (row.taxBody === "OH042" ? { name: "Knox County", totalGeneralRate: 7.25 } : null),
  });

  assert.equal(result.totals.misinputShipTos, 3);
  assert.equal(result.totals.comparedShipTos, 2);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].hasDifference, true);
});

test("reports an unmatched row as unmatched rather than guessing a rate", () => {
  const result = reconcileDirectMappingAplus({
    stateCode: "FL",
    stateDetail: { stateCode: "FL", activeShipTos: 1, taxBodies: [{ taxBody: "ZTEMP", description: "TAX BODY TEMP USE", activeShipTos: 1, currentRate: 0 }] },
    matchOfficialRow: () => null,
  });

  assert.equal(result.findings[0].matched, false);
  assert.equal(result.findings[0].hasDifference, false);
  assert.equal(result.findings[0].officialRate, null);
});

test("fails closed on a state-detail/stateCode mismatch", () => {
  assert.throws(() => reconcileDirectMappingAplus({
    stateCode: "FL",
    stateDetail: { stateCode: "OH", activeShipTos: 1, taxBodies: [] },
    matchOfficialRow: () => null,
  }), /requires an A\+ state-detail snapshot/);
});

test("never coerces a matched row with an unresolved (null) official total into a confident 0% mismatch", () => {
  const result = reconcileDirectMappingAplus({
    stateCode: "FL",
    stateDetail: { stateCode: "FL", activeShipTos: 1, taxBodies: [{ taxBody: "FL999", description: "Florida Somewhere", activeShipTos: 1, currentRate: 7 }] },
    matchOfficialRow: () => ({ name: "Somewhere", totalGeneralRate: null }),
  });
  assert.equal(result.findings[0].matched, false, "a matched row with no resolvable rate must not count as matched");
  assert.equal(result.findings[0].officialRate, null);
  assert.equal(result.findings[0].hasDifference, false);
});

test("fails closed without a matchOfficialRow function", () => {
  assert.throws(() => reconcileDirectMappingAplus({
    stateCode: "FL",
    stateDetail: { stateCode: "FL", activeShipTos: 0, taxBodies: [] },
  }), /requires a matchOfficialRow function/);
});
