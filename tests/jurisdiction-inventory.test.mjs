import test from "node:test";
import assert from "node:assert/strict";
import { applyInventoryReviews, inventoryRows, inventoryCsv } from "../app/jurisdiction-inventory.ts";
import { directMappingFindingsFromReconciliation, flatStateFindingsFromReconciliation, gaFindingsFromReconciliation } from "../app/dashboard-findings.ts";
import { findingReviewEvidence } from "../app/finding-review.ts";
import { createReviewStore } from "../server/review-store.mjs";
import { matchesJurisdictionFilters } from "../app/jurisdiction-filters.ts";

const today = "2026-09-22";
const assignment = { taxBody: "TEST", description: "Test jurisdiction", activeShipTos: 12, currentRate: 6 };
const match = { taxBody: "TEST", jurisdictionLabel: "Test County", activeShipTos: 12, officialRate: 7, aplusRate: 6, rateDifference: 1, hasDifference: true, matched: true };

test("published components never become combined totals or inferred A+ matches", () => {
  const [row] = inventoryRows("GA", { rates: [{ jurisdictionType: "county", jurisdictionCode: "001", name: "Test County", componentRate: 3, totalGeneralRate: null }] }, null, today);
  assert.equal(row.componentRate, 3);
  assert.equal(row.officialRate, null);
  assert.equal(row.shipTos, null);
  assert.equal(row.comparisonStatus, "not-checked");
  assert.equal(row.effectiveState, "undated");
});
test("explicit direct comparison and unknown assignments remain distinct", () => {
  const rows = inventoryRows("FL", null, { findings: [match], stateDetail: { taxBodies: [assignment, { ...assignment, taxBody: "UNKNOWN" }] } }, today);
  assert.equal(rows[0].comparisonStatus, "mismatch");
  assert.equal(rows[0].reviewKey, "FL-TEST-current:a6:o7");
  assert.equal(rows[1].comparisonStatus, "not-checked");
  assert.equal(rows[1].officialRate, null);
});
test("ambiguous Georgia boundaries do not show a confirmed comparison", () => {
  const [row] = inventoryRows("GA", null, { taxBodyFindings: [{ ...match, jurisdictionAssignmentConsistent: false }] }, today);
  assert.equal(row.comparisonStatus, "not-checked");
  assert.equal(row.officialRate, null);
});
test("flat-state evidence applies only to its expected body", () => {
  const rows = inventoryRows("NJ", null, { expectedTaxBody: "TEST", officialRate: 6, comparisonStatus: "matched", stateDetail: { taxBodies: [assignment, { ...assignment, taxBody: "OTHER" }] } }, today);
  assert.equal(rows[0].comparisonStatus, "matched");
  assert.equal(rows[1].comparisonStatus, "not-checked");
});
test("zero rates are retained but absent rates are not treated as zero", () => {
  const [zero] = inventoryRows("AK", null, { findings: [{ ...match, officialRate: 0, aplusRate: 0, rateDifference: 0, hasDifference: false }] }, today);
  assert.equal(zero.comparisonStatus, "matched");
  const [unknown] = inventoryRows("AK", null, { findings: [{ ...match, officialRate: null }] }, today);
  assert.equal(unknown.comparisonStatus, "not-checked");
});
test("expired records excluded; upcoming dates and all state filters work", () => {
  const rates = [
    { name: "Future City", jurisdictionType: "city", jurisdictionCode: "1", totalGeneralRate: 8, beginDate: "2027-01-01" },
    { name: "Expired", jurisdictionType: "county", jurisdictionCode: "2", endDate: "2025-01-01" },
  ];
  const rows = inventoryRows("CA", { rates }, null, today);
  assert.equal(rows.length, 1);
  const filters = { query: "future", state: "CA", jurisdictionType: "city", comparison: "not-checked", effective: "upcoming", source: "validated", review: "unreviewed" };
  assert.equal(matchesJurisdictionFilters(rows[0], filters), true);
  assert.equal(matchesJurisdictionFilters(rows[0], { ...filters, state: "NC" }), false);
});
test("CSV retains state and missing values and neutralizes formulas", () => {
  const rows = inventoryRows("TX", { rates: [{ name: '=TEST("x")', jurisdictionType: "city", jurisdictionCode: "1", totalGeneralRate: null }] }, null, today);
  const csv = inventoryCsv(rows);
  assert.match(csv, /"TX"/);
  assert.match(csv, /"'=TEST\(""x""\)"/);
  assert.match(csv, /"not-checked"/);
});

test("saved direct, flat and Georgia reviews drive inventory status filters and CSV", () => {
  const scenarios = [
    { state: "FL", payload: { findings: [match] }, adapt: directMappingFindingsFromReconciliation },
    { state: "NJ", payload: { expectedTaxBody: "TEST", officialRate: 7, aplusRate: 6, rateDifference: 1, hasDifference: true, comparisonStatus: "difference", totals: { comparedShipTos: 12 }, stateDetail: { taxBodies: [assignment] } }, adapt: flatStateFindingsFromReconciliation },
    { state: "GA", payload: { taxBodyFindings: [{ ...match, description: "Test County", jurisdictionAssignmentConsistent: true }] }, adapt: payload => gaFindingsFromReconciliation(payload.taxBodyFindings) },
    { state: "GA", payload: { taxBodyFindings: [{ ...match, description: "Test County", jurisdictionAssignmentConsistent: false }] }, adapt: payload => gaFindingsFromReconciliation(payload.taxBodyFindings) },
  ];
  const store = createReviewStore({ filename: ":memory:" });
  const filters = { query: "", state: "all", jurisdictionType: "all", comparison: "all", effective: "all", source: "all", review: "all" };
  try {
    for (const { state, payload, adapt } of scenarios) {
      const [finding] = adapt({ ...payload, stateCode: state });
      for (const status of ["in_review", "approved", "resolved", "not_applicable"]) {
        const saved = store.saveDecision({ ...findingReviewEvidence(finding), status, actor: "Liv", note: "Synthetic review evidence." }, { verification: status === "approved" ? { verified: true } : null });
        const reviews = new Map([[saved.findingKey, saved]]);
        const [row] = applyInventoryReviews(inventoryRows(state, null, payload, today), reviews);
        assert.equal(row.reviewStatus, status, `${state} ${status}`);
        assert.equal(matchesJurisdictionFilters(row, { ...filters, review: status }), true);
        assert.equal(matchesJurisdictionFilters(row, { ...filters, review: "unreviewed" }), false);
        assert.ok(inventoryCsv([row]).endsWith(`"${status}"`));
      }
    }
  } finally { store.close(); }
});

test("changed rates and absent evidence do not inherit an older inventory review", () => {
  const [finding] = directMappingFindingsFromReconciliation({ stateCode: "FL", findings: [match] });
  const old = findingReviewEvidence(finding);
  const reviews = new Map([[old.findingKey, { status: "resolved" }]]);
  for (const changed of [
    { ...match, aplusRate: 6.625 },
    { ...match, officialRate: 7.125 },
    { ...match, officialRate: null, matched: false, rateDifference: null },
  ]) {
    const [row] = applyInventoryReviews(inventoryRows("FL", null, { findings: [changed] }, today), reviews);
    assert.equal(row.reviewStatus, null);
    assert.notEqual(row.reviewKey, old.findingKey);
  }
  const [zero] = inventoryRows("FL", null, { findings: [{ ...match, officialRate: 0, aplusRate: 0, rateDifference: 0, hasDifference: false }] }, today);
  assert.equal(zero.reviewKey, "FL-TEST-current:a0:o0");
  const [source] = applyInventoryReviews(inventoryRows("FL", { rates: [{ name: "Test County", jurisdictionType: "county", jurisdictionCode: "TEST" }] }, null, today), reviews);
  assert.equal(source.reviewStatus, null);
  assert.equal(source.reviewKey, null);
});
