import assert from "node:assert/strict";
import test from "node:test";
import { createOfficialFetch } from "../server/official-fetch.mjs";
import { createStateEvidenceStore } from "../server/state-evidence.mjs";
import { markRetainedEvidence } from "../app/state-retention.ts";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("official fetch retries bounded transient failures and respects publisher delays", async () => {
  let calls = 0; const waits = [];
  const request = createOfficialFetch({ fetchImpl: async () => new Response("", { status: ++calls < 3 ? 503 : 200 }), sleep: async ms => waits.push(ms) });
  assert.equal((await request("https://example.gov")).status, 200);
  assert.equal(calls, 3); assert.deepEqual(waits, [250, 500]);
  calls = 0;
  const denied = createOfficialFetch({ fetchImpl: async () => { calls++; return new Response("", { status: 403 }); } });
  assert.equal((await denied("https://example.gov")).status, 403); assert.equal(calls, 1);
  const deferred = createOfficialFetch({ fetchImpl: async () => new Response("", { status: 429, headers: { "Retry-After": "60" } }), sleep: async () => assert.fail("must not retry early") });
  assert.equal((await deferred("https://example.gov")).status, 429);
});

test("network retry remains bounded and cancellation prevents further requests", async () => {
  let calls = 0;
  const request = createOfficialFetch({ fetchImpl: async () => { calls++; throw Object.assign(new Error("network"), { code: "ECONNRESET" }); }, sleep: async () => {} });
  await assert.rejects(request("https://example.gov"), /network/); assert.equal(calls, 3);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(request("https://example.gov", { signal: controller.signal })); assert.equal(calls, 3);
  calls = 0;
  const tls = createOfficialFetch({ fetchImpl: async () => { calls++; throw Object.assign(new Error("certificate"), { code: "DEPTH_ZERO_SELF_SIGNED_CERT" }); } });
  await assert.rejects(tls("https://example.gov"), /certificate/); assert.equal(calls, 1);
});

test("persisted evidence survives restart, excludes customer details, rejects corruption and older writes", t => {
  const dir = mkdtempSync(join(tmpdir(), "taxap-evidence-")); t.after(() => rmSync(dir, { recursive: true }));
  const store = createStateEvidenceStore(dir);
  const value = { stateCode: "FL", customerName: "synthetic private", findings: [{ taxBody: "FL001", officialRate: 7.5, customerName: "synthetic private", address: "synthetic private" }] };
  store.put("FL", value, "2026-10-02T12:00:00Z");
  const restarted = createStateEvidenceStore(dir); const record = restarted.get("FL");
  assert.equal(record.value.findings[0].officialRate, 7.5); assert.ok(!JSON.stringify(record).includes("synthetic private"));
  store.put("FL", {}, "2026-10-01T12:00:00Z"); assert.equal(restarted.get("FL").value.findings[0].officialRate, 7.5);
  record.value.findings[0].officialRate = 1; writeFileSync(join(dir, "FL.json"), JSON.stringify(record));
  assert.throws(() => restarted.get("FL"), /integrity/);
  assert.throws(() => store.get("../bad"), /Invalid/);
});

test("retained findings are unverified and repeated marking does not duplicate warnings", () => {
  const retained = [{ stateCode: "FL", validatedAt: "2026-10-02T12:00:00Z", sourceRetrievedAt: "2026-10-02T11:00:00Z" }];
  const finding = { stateCode: "FL", confidence: "confirmed", confidenceNote: null };
  const stale = markRetainedEvidence([finding], retained)[0];
  assert.equal(stale.confidence, "unverified"); assert.equal(stale.evidenceStatus, "stale"); assert.match(stale.confidenceNote, /approval is blocked/);
  assert.deepEqual(markRetainedEvidence([stale], retained), [stale]);
});

import { createStateAlertManager } from "../server/state-alerts.mjs";
test("Outlook alerts are disabled by default, deduplicated across restart and throttled on recovery", async t => {
  const dir = mkdtempSync(join(tmpdir(), "taxap-alerts-")); t.after(() => rmSync(dir, { recursive: true }));
  const filename = join(dir, "alerts.json"); let timestamp = Date.parse("2026-10-02T12:00:00Z"); const messages = [];
  const options = { filename, now: () => timestamp, send: async m => messages.push(m) };
  const batch = { failedStates: ["MO"], retainedStates: [] };
  assert.equal(await createStateAlertManager(options).publish(batch), "disabled"); assert.equal(messages.length, 0);
  const manager = createStateAlertManager({ ...options, enabled: true });
  await Promise.all([manager.publish(batch), manager.publish(batch)]); assert.equal(messages.length, 1);
  assert.match(messages[0].body, /Unavailable states: MO/);
  assert.equal(await createStateAlertManager({ ...options, enabled: true }).publish(batch), "unchanged");
  assert.equal(await manager.publish({ failedStates: [], retainedStates: [] }), "deferred");
  timestamp += 15 * 60 * 1000;
  assert.equal(await manager.publish({ failedStates: [], retainedStates: [] }), "accepted"); assert.equal(messages.length, 2); assert.match(messages[1].body, /Recovered states: MO/);
});
test("failed email attempts do not retry on each refresh", async t => {
  const dir = mkdtempSync(join(tmpdir(), "taxap-alert-failure-")); t.after(() => rmSync(dir, { recursive: true }));
  let calls = 0; const manager = createStateAlertManager({ filename: join(dir, "alerts.json"), enabled: true, send: async () => { calls++; throw new Error("synthetic failure"); } });
  const batch = { failedStates: ["UT"], retainedStates: [] };
  await assert.rejects(manager.publish(batch), /synthetic/);
  assert.equal(await manager.publish(batch), "deferred"); assert.equal(calls, 1);
});
