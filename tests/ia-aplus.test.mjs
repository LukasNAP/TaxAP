import assert from "node:assert/strict";
import test from "node:test";
import { parseIowaSalesRows, readIowaAplusComparison, readIowaSalesRates } from "../server/ia-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";
const now = new Date("2026-09-09T12:00:00Z");
const record = (county, name, local = true) => ({ A: county === "ADAIR" ? "1" : "2", B: county, C: name, D: local ? "YES" : "NO", E: name === "UNINCORPORATED" ? "YES" : "NO", F: local ? "0.01" : "0", G: name === "UNINCORPORATED" ? local ? "0.01" : "0" : "n/a", H: local ? "7%" : "6%", I: local ? "38534" : "1", J: "" });
const headers = ["County", "County", "City", "Jurisdiction has LOST", "Unincorporated Jurisdiction", "Jurisdiction LOST Rate", "Unincorporated LOST Rate", "Total Rate", "LOST From", "Sunset Date"];
const rows = [{ A: "Effective Jul 1, 2026" }, { A: "Any jurisdiction not listed falls under the unincorporated county" }, Object.fromEntries(headers.map((h, i) => [String.fromCharCode(65 + i), h])), record("ADAIR", "ALPHA"), record("ADAIR", "UNINCORPORATED"), record("ADAMS", "BETA"), record("ADAMS", "UNINCORPORATED", false)];
const parse = (r = rows, time = now) => parseIowaSalesRows(r, { now: time, expectedRows: 4, expectedCounties: 2 });

test("Iowa compares uniform counties and exact cities without guessing mixed counties or A+ code numbering", async () => {
  const descriptions = ["Iowa Adair Co.", "Iowa Adams County", "Iowa Beta", "Iowa Unknown", "Iowa", "Florida Osceola"];
  const taxBodies = descriptions.map((description, i) => ({ description, taxBody: i === 4 ? "IA000" : i === 5 ? "FL049" : `IA${100 + i}`, currentRate: 6, activeShipTos: 1 }));
  const result = await readIowaAplusComparison({ stateCode: "IA", activeShipTos: 6, taxBodies }, { readOfficial: async () => parse() });
  assert.equal(result.totals.comparedShipTos, 2);
  assert.equal(result.totals.unmatchedShipTos, 3);
  assert.equal(result.totals.crossStateShipTos, 1);
  assert.ok(directMappingFindingsFromReconciliation(result).every((r) => r.jurisdictionLabel.endsWith("(sales tax)")));
});

test("Iowa rejects wrong periods, missing counties, duplicates and contradictory tax columns", () => {
  assert.throws(() => parse(rows, new Date("2027-01-01")), /half-year/);
  for (const mutate of [
    (r) => { r[2].F = "Hotel tax"; },
    (r) => { r.pop(); },
    (r) => { r[4] = r[3]; },
    (r) => { r[3].F = ""; },
    (r) => { r[3].H = "6%"; },
    (r) => { r[3].I = "bad date"; },
    (r) => { r[3].J = "1"; },
    (r) => { r[4].E = "NO"; },
    (r) => { r[5].A = "1"; r[6].A = "1"; },
  ]) { const changed = structuredClone(rows); mutate(changed); assert.throws(() => parse(changed), /Iowa/); }
});

test("Iowa expired and future local rates remain unresolved and prevent county-wide matches", async () => {
  const changed = structuredClone(rows);
  changed[3].J = "46023"; // January 1, 2026, after the original begin date but before the comparison.
  changed[5].I = "46388"; // Future effective date.
  const source = parse(changed);
  assert.equal(source.rates[0].totalGeneralRate, null);
  assert.equal(source.rates[2].totalGeneralRate, null);
  const result = await readIowaAplusComparison({ stateCode: "IA", taxBodies: [{ taxBody: "IA001", description: "Iowa Adair County", currentRate: 7, activeShipTos: 1 }] }, { readOfficial: async () => source });
  assert.equal(result.findings[0].matched, false);
});

test("Iowa same-named cities with differing totals, missing definitions and source failures stay unresolved", async () => {
  const source = parse(); source.rates.push({ ...source.rates[0], county: "adams", totalGeneralRate: 6 });
  const result = await readIowaAplusComparison({ stateCode: "IA", taxBodies: [{ taxBody: "IA001", description: "Iowa Alpha", currentRate: 7, activeShipTos: 1 }, { taxBody: "IA002", description: "Iowa Beta", currentRate: null, activeShipTos: 1 }] }, { readOfficial: async () => source });
  assert.equal(result.findings.filter((r) => r.matched).length, 0);
  await assert.rejects(readIowaSalesRates({ readBase: async () => ({ stateRate: 6 }), fetchImpl: async () => ({ ok: false }) }), /unavailable/);
});
