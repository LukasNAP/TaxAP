import assert from "node:assert/strict";
import test from "node:test";
import { validateXatxbdCsv } from "../app/aplus-import.ts";

function row(taxBody, overrides = {}) {
  const values = [
    taxBody,
    `North Carolina ${taxBody}`,
    taxBody,
    "",
    "",
    "",
    "4.750",
    "2.000",
    "0.000",
    "0.000",
    "0.000",
    "6.750",
    "0.000",
    "0.000",
    "0.000",
    "0.000",
    "0.000",
    "0.000",
    "0001-01-01",
  ];
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value;
  return values.join(",");
}

function validExport(extraRows = []) {
  return [
    ...Array.from({ length: 100 }, (_, index) => row(`NC${String(index + 1).padStart(3, "0")}`)),
    ...extraRows,
  ].join("\n");
}

test("accepts a complete headerless XATXBD export and separates special rows", () => {
  const result = validateXatxbdCsv(validExport([row("NCUSE", { 1: "DO NOT USE", 6: "0.000", 7: "0.000", 11: "0.000" })]), "Results.csv");
  assert.equal(result.errors.length, 0);
  assert.equal(result.standardRows.length, 100);
  assert.equal(result.specialRows.length, 1);
  assert.equal(result.scheduledRows.length, 0);
  assert.deepEqual(result.rateDistribution, [{ rate: 6.75, count: 100 }]);
});

test("blocks missing, duplicate, and arithmetically inconsistent county rows", () => {
  const rows = validExport().split("\n");
  rows[99] = row("NC099");
  rows[0] = row("NC001", { 11: "7.000" });
  const result = validateXatxbdCsv(rows.join("\n"), "bad.csv");
  assert.match(result.errors.join("\n"), /Duplicate standard tax bodies: NC099/);
  assert.match(result.errors.join("\n"), /Missing standard county tax bodies: NC100/);
  assert.match(result.errors.join("\n"), /current total does not equal its rate components/);
});

test("requires a valid effective date when a next rate is populated", () => {
  const rows = validExport().split("\n");
  rows[59] = row("NC060", { 12: "4.750", 13: "3.000", 14: "0.500", 17: "8.250", 18: "2026-02-30" });
  const invalid = validateXatxbdCsv(rows.join("\n"), "scheduled.csv");
  assert.match(invalid.errors.join("\n"), /must be a valid YYYY-MM-DD date/);

  rows[59] = row("NC060", { 12: "4.750", 13: "3.000", 14: "0.500", 17: "8.250", 18: "2026-07-01" });
  const valid = validateXatxbdCsv(rows.join("\n"), "scheduled.csv");
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.scheduledRows.length, 1);
});
