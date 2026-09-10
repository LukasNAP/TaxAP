import { backupReviewDatabase } from "../server/review-backup.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { comparisonHealth } from "../server/comparison-health.mjs";
import { findingDecisionKey, findingReviewEvidence } from "../app/finding-review.ts";
import { createReviewStore } from "../server/review-store.mjs";

const finding = {
  id: "IA-IA001", reviewFindingKey: "IA-IA001-current", stateCode: "IA",
  jurisdictionLabel: "Test jurisdiction (sales tax)", taxBody: "IA001",
  aplusRate: 6, officialRate: 7, rateDifference: 1, activeShipTos: 2,
  comparisonStatus: "mismatch", confidence: "confirmed", confidenceNote: null,
  effectiveDate: null, sourceUrl: "https://revenue.iowa.gov/",
};

test("changed rate evidence creates a fresh review without losing the previous decision", () => {
  const store = createReviewStore({ filename: ":memory:" });
  try {
    const first = store.saveDecision({ ...findingReviewEvidence(finding), status: "resolved", actor: "Ana", note: "Reviewed manually." });
    const changed = { ...finding, officialRate: 8 };
    assert.notEqual(findingDecisionKey(changed), first.findingKey);
    assert.equal(store.getCase(findingDecisionKey(changed)), null);
    assert.equal(store.getCase(first.findingKey).status, "resolved");
    assert.equal(first.jurisdiction, finding.jurisdictionLabel);
    assert.equal(first.sourceUrl, finding.sourceUrl);
  } finally { store.close(); }
});

test("multistate decisions survive closing and reopening review storage", () => {
  const directory = mkdtempSync(join(tmpdir(), "taxap-review-test-"));
  const filename = join(directory, "reviews.sqlite");
  let store = createReviewStore({ filename });
  try {
    assert.deepEqual(store.listCases(), []);
    for (const stateCode of ["IA", "VT", "LA", "GA"]) {
      const evidence = findingReviewEvidence({ ...finding, stateCode, reviewFindingKey: `${stateCode}-test-current` });
      store.saveDecision({ ...evidence, status: "in_review", actor: "Liv", note: "Source checked." });
      store.saveDecision({ ...evidence, status: "approved", actor: "Ana", note: "Ready for manual maintenance." });
    }
    const backupFile = join(directory, "verified-backup.sqlite");
    backupReviewDatabase(filename, backupFile);
    assert.throws(() => backupReviewDatabase(filename, backupFile), /already exists/);
    const restored = createReviewStore({ filename: backupFile });
    try { assert.deepEqual(restored.listCases(), store.listCases()); } finally { restored.close(); }
    store.close(); store = createReviewStore({ filename });
    assert.equal(store.listCases().length, 4);
    for (const record of store.listCases()) {
      assert.equal(record.status, "approved");
      assert.deepEqual(record.events.map((event) => event.actor), ["Ana", "Liv"]);
    }
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("coverage does not count unmatched or missing-rate assignments as compared", () => {
  assert.deepEqual(comparisonHealth({ stateCode: "LA", totals: { activeShipTos: 20, comparedShipTos: 20 }, findings: [
    { matched: true, aplusRate: 5, officialRate: 6, activeShipTos: 2 },
    { matched: true, aplusRate: null, officialRate: 6, activeShipTos: 3 },
    { matched: false, aplusRate: 5, officialRate: null, activeShipTos: 15 },
  ] }), { stateCode: "LA", activeShipTos: 20, comparedShipTos: 2, intentionalNoTaxShipTos: 0, uncheckedShipTos: 18 });
  assert.equal(comparisonHealth({ stateCode: "MD", aplusRate: null, officialRate: 6, totals: { activeShipTos: 10, comparedShipTos: 10 } }).uncheckedShipTos, 10);
});

test("deliberate no-tax assignments stay distinct from comparisons and unknown coverage", () => {
  const health = comparisonHealth({ stateCode: "AK", findings: [], totals: { activeShipTos: 8, intentionalNoTaxShipTos: 8 } });
  assert.equal(health.comparedShipTos, 0);
  assert.equal(health.intentionalNoTaxShipTos, 8);
  assert.equal(health.uncheckedShipTos, 0);
  assert.equal(comparisonHealth({ stateCode: "XX" }).uncheckedShipTos, null);
});

test("a stale reviewer cannot overwrite a newer decision", () => {
  const store = createReviewStore({ filename: ":memory:" });
  try {
    const decision = { ...findingReviewEvidence(finding), actor: "Liv", status: "in_review", note: "Checked.", expectedEventId: null };
    const first = store.saveDecision(decision);
    assert.throws(() => store.saveDecision({ ...decision, actor: "Ana" }), (error) => error.statusCode === 409);
    const next = store.saveDecision({ ...decision, actor: "Ana", expectedEventId: first.events[0].id });
    assert.equal(next.events.length, 2);
    assert.equal(next.events[0].actor, "Ana");
  } finally { store.close(); }
});

test("legacy imported history remains present with its notes and events", () => {
  const directory = mkdtempSync(join(tmpdir(), "taxap-legacy-review-test-"));
  const filename = join(directory, "reviews.sqlite");
  let store = createReviewStore({ filename });
  try {
    const original = store.saveDecision({ ...findingReviewEvidence(finding), findingKey: "NC060-2026-07-01", stateCode: "NC", taxBody: "NC060", status: "resolved", actor: "Ana", note: "Preserved historical note." });
    store.close();
    const database = new DatabaseSync(filename);
    database.prepare("UPDATE review_cases SET created_at = ? WHERE finding_key = ?").run("2026-08-17T17:00:00.000Z", original.findingKey);
    database.close();
    store = createReviewStore({ filename });
    const retained = store.getCase(original.findingKey);
    assert.equal(store.listCases().length, 1);
    assert.equal(retained.importedHistory, true);
    assert.equal(retained.latestNote, original.latestNote);
    assert.deepEqual(retained.events, original.events);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
