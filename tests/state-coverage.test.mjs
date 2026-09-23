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

import { buildExcludedTaxBodyQuery, classifyTaxBodyCode, summarizeExcludedTaxBodies, readStateSummaries } from "../server/aplus-connector.mjs";

const tbRow = (StateCode, TaxBody, ActiveShipTos) => ({ StateCode, TaxBody, ActiveShipTos });

test("excluded tax-body query only targets unclean state values and keeps active filters", () => {
  const query = buildExcludedTaxBodyQuery();
  assert.match(query, /NOT IN \('AL', /);
  assert.match(query, /'DC'/);
  assert.match(query, /SACSUS/);
  assert.match(query, /CMSUSP/);
  assert.doesNotMatch(query, /\b(INSERT|UPDATE|DELETE|MERGE|EXEC|ALTER|TRUNCATE|DROP)\b/i);
});

test("tax-body codes classify by prefix without treating placeholders or foreign codes as states", () => {
  assert.deepEqual(classifyTaxBodyCode("NC060"), { kind: "usState", stateCode: "NC" });
  assert.deepEqual(classifyTaxBodyCode("kshollja"), { kind: "usState", stateCode: "KS" });
  assert.deepEqual(classifyTaxBodyCode("CN000"), { kind: "otherCode", stateCode: null });
  assert.deepEqual(classifyTaxBodyCode("HN000"), { kind: "otherCode", stateCode: null });
  assert.deepEqual(classifyTaxBodyCode("ZTEMP"), { kind: "placeholder", stateCode: null });
  assert.deepEqual(classifyTaxBodyCode("  "), { kind: "none", stateCode: null });
  assert.deepEqual(classifyTaxBodyCode(null), { kind: "none", stateCode: null });
  assert.deepEqual(classifyTaxBodyCode("12345"), { kind: "otherCode", stateCode: null });
});

test("excluded ship-tos are cross-tabulated by state value and tax body, with no raw values returned", () => {
  const result = summarizeExcludedTaxBodies([
    tbRow("", "NC060", 40), tbRow(null, "GA121", 10), tbRow("", null, 5),
    tbRow("NORTH CAROLINA", "NC092", 3),
    tbRow("ONTARIO", "CN000", 20), tbRow("PRIVATE CUSTOMER TEXT", "NC001", 2), tbRow("HONDURAS", "HN000", 4), tbRow("13", "ZTEMP", 1),
    tbRow("NC", "NC060", 999),
  ]);
  assert.equal(result.total, 85);
  assert.deepEqual(result.byStateValue.blank, { usState: 50, otherCode: 0, placeholder: 0, none: 5 });
  assert.deepEqual(result.byStateValue.fullStateName, { usState: 3, otherCode: 0, placeholder: 0, none: 0 });
  assert.deepEqual(result.byStateValue.other, { usState: 2, otherCode: 24, placeholder: 1, none: 0 });
  assert.deepEqual(result.usStateTaxBodies, [{ stateCode: "NC", activeShipTos: 45 }, { stateCode: "GA", activeShipTos: 10 }]);
  const payload = JSON.stringify(result);
  for (const raw of ["PRIVATE", "ONTARIO", "HONDURAS", "NC060", "CN000"]) assert.ok(!payload.includes(raw), raw);
});

function fakeConnection(coverage, excluded) {
  let closed = false;
  let reads = 0;
  return {
    connect: async () => ({
      request: () => ({ query: async () => {
        const value = reads++ === 0 ? coverage : excluded;
        if (value instanceof Error) throw value;
        return { recordset: value };
      } }),
      close: async () => { closed = true; },
    }),
    isClosed: () => closed,
  };
}

test("equal totals with differing categories are marked inconsistent", async () => {
  const connection = fakeConnection([row("", 5)], [tbRow("ONTARIO", "CN000", 5)]);
  const result = await readStateSummaries(connection);
  assert.equal(result.excludedBreakdown.byTaxBody.inconsistent, true);
  assert.equal(connection.isClosed(), true);
});

test("matching categories reconcile without an inconsistency warning", async () => {
  const connection = fakeConnection([row("", 5)], [tbRow("", "NC001", 5)]);
  const result = await readStateSummaries(connection);
  assert.equal(result.excludedBreakdown.byTaxBody.inconsistent, undefined);
  assert.equal(connection.isClosed(), true);
});

test("optional breakdown failure preserves coverage and never logs raw errors", async (t) => {
  const messages = [];
  t.mock.method(console, "error", value => messages.push(value));
  const connection = fakeConnection([row("", 5)], new Error("PRIVATE CONNECTION DETAILS"));
  const result = await readStateSummaries(connection);
  assert.equal(result.excludedShipTos, 5);
  assert.equal(result.excludedBreakdown.byTaxBody, null);
  assert.ok(!JSON.stringify(messages).includes("PRIVATE"));
  assert.equal(connection.isClosed(), true);
});

test("primary coverage failure rejects and closes the connection", async () => {
  const connection = fakeConnection(new Error("Coverage unavailable"), []);
  await assert.rejects(readStateSummaries(connection), /Coverage unavailable/);
  assert.equal(connection.isClosed(), true);
});
