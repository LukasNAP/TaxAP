import assert from "node:assert/strict";
import test from "node:test";
import { combineFindings, gaFindingsFromReconciliation } from "../app/dashboard-findings.ts";

const consistentDifference = {
  taxBody: "GA027",
  activeShipTos: 7,
  officialRate: 9,
  aplusRate: 7,
  rateDifference: 2,
  hasDifference: true,
  jurisdictionAssignmentConsistent: true,
};

const inconsistentDifference = {
  taxBody: "GA060A",
  activeShipTos: 17,
  officialRate: 7.75,
  aplusRate: 8.9,
  rateDifference: -1.15,
  hasDifference: true,
  jurisdictionAssignmentConsistent: false,
};

const noDifference = {
  taxBody: "GA155",
  activeShipTos: 200,
  officialRate: 7,
  aplusRate: 7,
  rateDifference: 0,
  hasDifference: false,
  jurisdictionAssignmentConsistent: false,
};

const zeroShipTos = {
  taxBody: "GA999",
  activeShipTos: 0,
  officialRate: 8,
  aplusRate: 6,
  rateDifference: 2,
  hasDifference: true,
  jurisdictionAssignmentConsistent: true,
};

test("keeps only rows with a rate difference and at least one active ship-to", () => {
  const findings = gaFindingsFromReconciliation([consistentDifference, inconsistentDifference, noDifference, zeroShipTos]);
  assert.deepEqual(findings.map((finding) => finding.taxBody), ["GA027", "GA060A"]);
});

test("flags inconsistent jurisdiction assignment instead of dropping it", () => {
  const [confirmed, unverified] = gaFindingsFromReconciliation([consistentDifference, inconsistentDifference]);
  assert.equal(confirmed.confidence, "confirmed");
  assert.equal(confirmed.confidenceNote, null);
  assert.equal(unverified.confidence, "unverified");
  assert.match(unverified.confidenceNote ?? "", /more than one official jurisdiction/);
});

test("builds a stable finding shape for the shared inbox", () => {
  const [finding] = gaFindingsFromReconciliation([consistentDifference]);
  assert.equal(finding.id, "GA-GA027");
  assert.equal(finding.reviewFindingKey, "GA-GA027-current");
  assert.equal(finding.stateCode, "GA");
  assert.equal(finding.jurisdictionLabel, "GA027");
  assert.equal(finding.comparisonStatus, "mismatch");
  assert.equal(finding.effectiveDate, null);
});

test("returns an empty list rather than throwing when reconciliation has not loaded", () => {
  assert.deepEqual(gaFindingsFromReconciliation(null), []);
  assert.deepEqual(gaFindingsFromReconciliation(undefined), []);
});

test("combines findings from multiple states, largest ship-to impact first", () => {
  const nc = [{ id: "NC-NC060", reviewFindingKey: "NC060-current", stateCode: "NC", jurisdictionLabel: "Mecklenburg County", taxBody: "NC060", officialRate: 8.25, aplusRate: 7.25, rateDifference: 1, activeShipTos: 500, comparisonStatus: "mismatch", confidence: "confirmed", confidenceNote: null, effectiveDate: null, sourceUrl: null }];
  const ga = gaFindingsFromReconciliation([consistentDifference, inconsistentDifference]);
  const combined = combineFindings(nc, ga);
  assert.deepEqual(combined.map((finding) => finding.id), ["NC-NC060", "GA-GA060A", "GA-GA027"]);
});
