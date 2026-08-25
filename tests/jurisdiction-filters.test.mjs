import assert from "node:assert/strict";
import test from "node:test";
import { matchesJurisdictionFilters } from "../app/jurisdiction-filters.ts";

const row = {
  stateCode: "NC",
  jurisdictionType: "county",
  jurisdictionName: "Mecklenburg County",
  taxBody: "NC060",
  comparisonStatus: "recent-match",
  effectiveState: "current",
  sourceStatus: "validated",
  reviewStatus: "resolved",
};

const all = {
  query: "",
  state: "all",
  jurisdictionType: "all",
  comparison: "all",
  effective: "all",
  source: "all",
  review: "all",
};

test("filters jurisdictions across every dashboard dimension", () => {
  assert.equal(matchesJurisdictionFilters(row, all), true);
  assert.equal(matchesJurisdictionFilters(row, { ...all, query: "nc060" }), true);
  assert.equal(matchesJurisdictionFilters(row, { ...all, query: "mecklen" }), true);
  assert.equal(matchesJurisdictionFilters(row, { ...all, state: "GA" }), false);
  assert.equal(matchesJurisdictionFilters(row, { ...all, jurisdictionType: "city" }), false);
  assert.equal(matchesJurisdictionFilters(row, { ...all, comparison: "mismatch" }), false);
  assert.equal(matchesJurisdictionFilters(row, { ...all, effective: "upcoming" }), false);
  assert.equal(matchesJurisdictionFilters(row, { ...all, source: "unavailable" }), false);
  assert.equal(matchesJurisdictionFilters(row, { ...all, review: "resolved" }), true);
  assert.equal(matchesJurisdictionFilters(row, { ...all, review: "unreviewed" }), false);
});

test("treats a missing review record as unreviewed", () => {
  assert.equal(matchesJurisdictionFilters({ ...row, reviewStatus: null }, { ...all, review: "unreviewed" }), true);
});
