import assert from "node:assert/strict";
import test from "node:test";
import { readAllWiredStateFindings } from "../server/aplus-connector.mjs";

function fixtures(overrides = {}) {
  return {
    readNc: async () => ({
      aplusSnapshot: { standardRows: [{ taxBody: "NC001", currentRate: 7 }] },
      officialSnapshot: { rates: [{ taxBody: "NC001", officialRate: 7.25 }] },
      stateDetail: { activeShipTos: 5, taxBodies: [{ taxBody: "NC001", activeShipTos: 3 }, { taxBody: "NC999", activeShipTos: 2 }] },
    }),
    readGa: async () => ({ totals: { activeShipTos: 10 }, taxBodyFindings: [
      { taxBody: "GA001", activeShipTos: 8, matchedShipTos: 6, officialRate: 8, aplusRate: 7, jurisdictionAssignmentConsistent: true },
      { taxBody: "GA002", activeShipTos: 2, matchedShipTos: 2, officialRate: 8, aplusRate: 7, jurisdictionAssignmentConsistent: false },
    ] }),
    readNj: async () => ({ stateCode: "NJ", totals: { activeShipTos: 0, comparedShipTos: 0 } }),
    readFlat: async (stateCode) => ({ stateCode, totals: { activeShipTos: 0, comparedShipTos: 0 } }),
    readDirect: async (stateCode) => ({ stateCode, findings: [], totals: { activeShipTos: 0 } }),
    ...overrides,
  };
}

test("all wired states including NC and GA appear exactly once in the shared batch", async () => {
  const batch = await readAllWiredStateFindings(fixtures());
  assert.deepEqual(batch.failedStates, []);
  assert.equal(batch.stateChecks.length, 47);
  assert.equal(new Set(batch.stateChecks.map((state) => state.stateCode)).size, 47);
  assert.ok(batch.nc.officialSnapshot);
  assert.ok(batch.ga.taxBodyFindings);
  assert.equal(batch.stateChecks.find((state) => state.stateCode === "NC").uncheckedShipTos, 2);
  assert.equal(batch.stateChecks.find((state) => state.stateCode === "GA").comparedShipTos, 6);
  assert.equal(batch.stateChecks.find((state) => state.stateCode === "GA").uncheckedShipTos, 4);
});

for (const stateCode of ["NC", "GA"]) {
  test(`${stateCode} failure is isolated and named without failing other states`, async () => {
    const batch = await readAllWiredStateFindings(fixtures({
      [stateCode === "NC" ? "readNc" : "readGa"]: async () => { throw new Error("Official source unavailable"); },
    }));
    assert.deepEqual(batch.failedStates, [stateCode]);
    assert.equal(batch.stateChecks.length, 46);
    assert.equal(batch[stateCode.toLowerCase()], null);
    assert.ok(batch[stateCode === "NC" ? "ga" : "nc"]);
  });
}

test("other-state failures preserve both NC and GA batch payloads", async () => {
  const base = fixtures();
  const batch = await readAllWiredStateFindings({ ...base, readDirect: async (code) => {
    if (code === "NY") throw new Error("PDF unavailable");
    return base.readDirect(code);
  } });
  assert.deepEqual(batch.failedStates, ["NY"]);
  assert.ok(batch.nc);
  assert.ok(batch.ga);
  assert.equal(batch.stateChecks.length, 46);
});

import { createStateEvidenceStore } from "../server/state-evidence.mjs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("batch restart retains findings without counting stale states as successful", async t => {
  const dir = mkdtempSync(join(tmpdir(), "taxap-batch-")); t.after(() => rmSync(dir, { recursive: true }));
  const base = fixtures();
  base.readDirect = async stateCode => ({ stateCode, totals: { activeShipTos: 2 }, findings: [{ taxBody: `${stateCode}001`, jurisdictionLabel: "Synthetic", activeShipTos: 2, officialRate: 7.5, aplusRate: 7, rateDifference: 0.5, matched: true, hasDifference: true }] });
  await readAllWiredStateFindings({ ...base, evidenceStore: createStateEvidenceStore(dir) });
  const failing = { ...base, readNc: async () => { throw new Error("unavailable"); }, readGa: async () => { throw new Error("unavailable"); }, readDirect: async code => { if (code === "FL") throw new Error("unavailable"); return base.readDirect(code); }, evidenceStore: createStateEvidenceStore(dir) };
  const stale = await readAllWiredStateFindings(failing);
  assert.equal(stale.stateChecks.length, 44); assert.deepEqual(stale.failedStates, ["FL", "GA", "NC"]);
  assert.equal(stale.retainedStates.length, 3); assert.ok(stale.nc.officialSnapshot); assert.ok(stale.ga.taxBodyFindings);
  assert.equal(stale.findings.find(f => f.stateCode === "FL").confidence, "unverified");
  const recovered = await readAllWiredStateFindings({ ...base, evidenceStore: createStateEvidenceStore(dir) });
  assert.equal(recovered.stateChecks.length, 47); assert.deepEqual(recovered.retainedStates, []);
  writeFileSync(join(dir, "FL.json"), "broken");
  const corrupt = await readAllWiredStateFindings(failing);
  assert.ok(corrupt.evidenceWarnings.includes("FL")); assert.ok(!corrupt.retainedStates.some(s => s.stateCode === "FL"));
});
