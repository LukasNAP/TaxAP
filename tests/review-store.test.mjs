import assert from "node:assert/strict";
import test from "node:test";
import { createConnectorServer } from "../server/aplus-connector.mjs";
import { createReviewStore } from "../server/review-store.mjs";

const decision = {
  findingKey: "NC041-2026-07-01",
  stateCode: "NC",
  jurisdiction: "Guilford County",
  taxBody: "NC041",
  findingType: "mismatch",
  aplusRate: 6.75,
  officialRate: 7,
  effectiveDate: "2026-07-01",
  sourceUrl: "https://www.ncdor.gov/taxes-forms/sales-and-use-tax/sales-and-use-tax-rates",
  status: "in_review",
  actor: "Liv",
  note: "Official source checked.",
};

test("persists review status and an append-only event history", () => {
  const store = createReviewStore({ filename: ":memory:" });
  try {
    assert.equal(store.listCases().length, 0);
    const started = store.saveDecision(decision);
    assert.equal(started.status, "in_review");
    assert.equal(started.assignedTo, "Liv");
    assert.equal(started.events.length, 1);

    const approved = store.saveDecision({ ...decision, status: "approved", actor: "Ana", note: "Approved for manual maintenance in A+." });
    assert.equal(approved.status, "approved");
    assert.equal(approved.events.length, 2);
    assert.deepEqual(approved.events.map((event) => event.toStatus), ["approved", "in_review"]);
    const dismissed = store.saveDecision({ ...decision, status: "not_applicable", actor: "Liv", note: "Official publication does not apply to this tax body." });
    assert.equal(dismissed.status, "not_applicable");
    assert.ok(dismissed.resolvedAt);
    assert.throws(() => store.saveDecision({ ...decision, status: "resolved", note: "" }), /Add a note/);
    assert.throws(() => store.saveDecision({ ...decision, actor: "Someone else" }), /Ana or Liv/);
  } finally {
    store.close();
  }
});

test("serves review history without querying A+", async () => {
  const store = createReviewStore({ filename: ":memory:" });
  const server = createConnectorServer({ reviews: store });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    const base = `http://127.0.0.1:${address.port}`;
    const headers = { Origin: "http://localhost:3000", "Content-Type": "application/json" };
    const savedResponse = await fetch(`${base}/api/reviews`, { method: "POST", headers, body: JSON.stringify(decision) });
    assert.equal(savedResponse.status, 200);
    assert.equal((await savedResponse.json()).case.status, "in_review");

    const staleResponse = await fetch(`${base}/api/reviews`, { method: "POST", headers, body: JSON.stringify({ ...decision, expectedEventId: null }) });
    assert.equal(staleResponse.status, 409);
    assert.match((await staleResponse.json()).error, /Another review decision/);

    const listResponse = await fetch(`${base}/api/reviews`, { headers });
    assert.equal(listResponse.status, 200);
    const payload = await listResponse.json();
    assert.equal(payload.cases.length, 1);
    assert.equal(payload.cases.find((item) => item.findingKey === decision.findingKey).events.length, 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
  }
});
