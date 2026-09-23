import assert from "node:assert/strict";
import test from "node:test";
import { STATE_NAME_BY_CODE } from "../app/tax-body-policy.ts";
import { summarizeStateCoverageRows } from "../server/aplus-connector.mjs";

const row = (StateCode, ActiveShipTos, ActiveCustomers = 1, TaxBodyCount = 1) => ({ StateCode, ActiveShipTos, ActiveCustomers, TaxBodyCount });

test("clean state codes become summaries and everything else is counted as excluded", () => {
  const result = summarizeStateCoverageRows([
    row("NC", 500), row("GA", 200), row("DC", 21),
    row("NORTH CAROLINA", 7), row("SOUTH  CAROLINA", 2), row("", 4), row(null, 1),
    row("CHARLOTTE", 3), row("ONTARIO", 5),
  ]);
  assert.deepEqual(result.states.map((s) => s.stateCode), ["NC", "GA", "DC"]);
  assert.equal(result.excludedShipTos, 22);
  assert.equal(result.excludedBreakdown.blank, 5);
  assert.equal(result.excludedBreakdown.fullStateName, 9);
  assert.equal(result.excludedBreakdown.other, 8);
  assert.equal(result.excludedBreakdown.distinctValues, 4);
  assert.deepEqual(result.excludedBreakdown.topValues[0], { value: "North Carolina", activeShipTos: 7, likelyState: "NC" });
  assert.equal(result.excludedBreakdown.topValues.length, 2);
  assert.ok(!JSON.stringify(result).includes("CHARLOTTE"));
  assert.ok(!JSON.stringify(result).includes("ONTARIO"));
});

test("spelled-out state names are hints only and never added to that state's totals", () => {
  const result = summarizeStateCoverageRows([row("NC", 10), row("NORTH CAROLINA", 5)]);
  assert.equal(result.states.find((s) => s.stateCode === "NC").activeShipTos, 10);
  assert.equal(result.excludedShipTos, 5);
});

test("hidden unknown values still contribute to complete counts", () => {
  const rows = Array.from({ length: 20 }, (_, i) => row(`JUNK${String(i).padStart(2, "0")}`, 20 - i));
  const result = summarizeStateCoverageRows(rows);
  assert.equal(result.excludedBreakdown.topValues.length, 0);
  assert.equal(result.excludedBreakdown.distinctValues, 20);
  assert.equal(result.excludedShipTos, rows.reduce((sum, r) => sum + r.ActiveShipTos, 0));
  assert.equal(result.excludedBreakdown.other, result.excludedShipTos);
});

test("unknown raw values never appear in the returned payload", () => {
  const raw = "PRIVATE CUSTOMER ADDRESS " + "X".repeat(80);
  const result = summarizeStateCoverageRows([row(raw, 3)]);
  assert.deepEqual(result.excludedBreakdown.topValues, []);
  assert.equal(result.excludedBreakdown.other, 3);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
});

test("full-name variants aggregate as one canonical hint without altering state coverage", () => {
  const result = summarizeStateCoverageRows([row("North Carolina", 2), row("NORTH  CAROLINA", 3)]);
  assert.deepEqual(result.states, []);
  assert.deepEqual(result.excludedBreakdown.topValues, [{ value: "North Carolina", activeShipTos: 5, likelyState: "NC" }]);
  assert.equal(result.excludedBreakdown.fullStateName, 5);
});

test("recognized hint list is capped without truncating aggregate counts", () => {
  const names = [...STATE_NAME_BY_CODE.values()].slice(0, 20);
  const result = summarizeStateCoverageRows(names.map((name, i) => row(name, i + 1)));
  assert.equal(result.excludedBreakdown.topValues.length, 15);
  assert.equal(result.excludedBreakdown.fullStateName, 210);
  assert.equal(result.excludedShipTos, 210);
  assert.equal(result.excludedBreakdown.distinctValues, 20);
});
