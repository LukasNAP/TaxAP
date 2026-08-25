import assert from "node:assert/strict";
import test from "node:test";
import { describesOtherJurisdiction, isRetiredTaxBody } from "../app/tax-body-policy.ts";

test("excludes known and explicitly retired A+ tax bodies", () => {
  assert.equal(isRetiredTaxBody({ taxBody: "NCUSE", description: "North Carolina" }), true);
  assert.equal(isRetiredTaxBody({ taxBody: "NC060XXX", description: "Legacy Mecklenburg" }), true);
  assert.equal(isRetiredTaxBody({ taxBody: "XX001", description: "DO NOT USE" }), true);
  assert.equal(isRetiredTaxBody({ taxBody: "XX002", description: "Inactive county rate" }), true);
  assert.equal(isRetiredTaxBody({ taxBody: "XX003", description: "OBSOLETE - replaced" }), true);
  assert.equal(isRetiredTaxBody({ taxBody: "XX004", description: "don't use" }), true);
  assert.equal(isRetiredTaxBody({ taxBody: "XX005", description: "dont use" }), true);
  assert.equal(isRetiredTaxBody({ taxBody: "XX006", description: "DO-NOT-USE" }), true);
  assert.equal(isRetiredTaxBody({ taxBody: "SCDNU", description: "Legacy code" }), true);
  assert.equal(isRetiredTaxBody({ taxBody: "GA099XXX", description: "Old code" }), true);
});

test("keeps legitimate configured tax bodies", () => {
  assert.equal(isRetiredTaxBody({ taxBody: "NC060", description: "North Carolina Mecklenburg" }), false);
  assert.equal(isRetiredTaxBody({ taxBody: "NC101", description: "1% North Carolina Use Tax" }), false);
  assert.equal(isRetiredTaxBody({ taxBody: "KY093", description: "Oldham County" }), false);
});

test("flags tax bodies whose description names a different state or country", () => {
  assert.equal(describesOtherJurisdiction({ description: "North Carolina Guilford" }, "GA"), true);
  assert.equal(describesOtherJurisdiction({ description: "North Carolina Mecklenburg" }, "GA"), true);
  assert.equal(describesOtherJurisdiction({ description: "Dominican Republic" }, "GA"), true);
  assert.equal(describesOtherJurisdiction({ description: "Puerto Rico" }, "GA"), true);
});

test("does not flag legitimate same-state or ambiguous single-word descriptions", () => {
  assert.equal(describesOtherJurisdiction({ description: "North Carolina Mecklenburg" }, "NC"), false);
  assert.equal(describesOtherJurisdiction({ description: "Fulton County" }, "GA"), false);
  assert.equal(describesOtherJurisdiction({ description: "Washington County" }, "GA"), false);
  assert.equal(describesOtherJurisdiction({ description: "1% Georgia state rate" }, "GA"), false);
  assert.equal(describesOtherJurisdiction({ description: null }, "GA"), false);
});
