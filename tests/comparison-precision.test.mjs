import test from "node:test";
import assert from "node:assert/strict";
import { hasRateDifference } from "../app/rate-comparison.ts";
import { reconcileDirectMappingAplus } from "../server/direct-mapping-aplus.mjs";
import { reconcileFlatStateAplus } from "../server/flat-state-aplus.mjs";
import { reconcileNewJerseyAplus } from "../server/nj-aplus.mjs";
import { parseBoundaryCsv, reconcileGeorgiaBoundary } from "../server/ga-boundary.mjs";

test("all comparison paths flag thousandth-point differences in either direction", () => {
  const columns = new Array(89).fill("");
  Object.assign(columns, { 0: "Z", 1: "20200101", 2: "29991231", 17: "30606", 19: "30606", 22: "13", 23: "13", 24: "219" });
  const boundaryDataset = parseBoundaryCsv(columns.join(","), {});
  for (const delta of [0, 0.0009, 0.001, -0.001, 0.005, -0.005, 0.01]) {
    const officialRate = 6.625;
    const aplusRate = officialRate - delta;
    const expected = Math.abs(delta) >= 0.001;
    const stateDetail = stateCode => ({ stateCode, activeShipTos: 1, taxBodies: [{ taxBody: stateCode === "NJ" ? "NJ000" : "TEST", currentRate: aplusRate, activeShipTos: 1 }] });
    const direct = reconcileDirectMappingAplus({ stateCode: "FL", stateDetail: stateDetail("FL"), matchOfficialRow: () => ({ name: "Synthetic County", totalGeneralRate: officialRate }) }).findings[0];
    const flat = reconcileFlatStateAplus({ stateCode: "MD", expectedTaxBody: "TEST", stateDetail: stateDetail("MD"), officialRate });
    const nj = reconcileNewJerseyAplus({ stateDetail: stateDetail("NJ"), officialSnapshot: { stateCode: "NJ", rates: [{ jurisdictionCode: "NJ", totalGeneralRate: officialRate }] } });
    const ga = reconcileGeorgiaBoundary({ addresses: [{ streetLine: "1 MAIN ST", secondaryLine: "", city: "TEST", zip: "30606", taxBody: "TEST" }], boundaryDataset,
      rateSnapshot: { stateRate: 4, rates: [{ jurisdictionType: "county", jurisdictionCode: "219", componentRate: 2.625 }] }, taxBodyRates: new Map([["TEST", aplusRate]]), asOfDate: "20261002" }).taxBodyFindings[0];
    for (const [path, result] of Object.entries({ direct, flat, nj, ga })) {
      assert.equal(result.hasDifference, expected, `${path}: ${delta}`);
      assert.equal(hasRateDifference(result.rateDifference), expected, `shared/NC: ${delta}`);
    }
    assert.equal(flat.comparisonStatus, expected ? "difference" : "matched");
    assert.equal(nj.comparisonStatus, expected ? "difference" : "matched");
  }
});

test("missing and nonfinite differences never become rate discrepancies", () => {
  for (const value of [null, NaN, Infinity, -Infinity]) assert.equal(hasRateDifference(value), false);
});
