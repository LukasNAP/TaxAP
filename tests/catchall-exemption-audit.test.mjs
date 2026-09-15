import assert from "node:assert/strict";
import test from "node:test";
import {
  CATCH_ALL_AUDIT_ENTRIES,
  buildCatchAllExemptionAuditQuery,
  summarizeCatchAllExemptionAudit,
  readCatchAllExemptionAudit,
} from "../server/catchall-exemption-audit.mjs";

test("builds a read-only, aggregate-only query scoped to the known catch-all codes", () => {
  const query = buildCatchAllExemptionAuditQuery();
  assert.match(query, /c\.CMCONO = a\.SACONO/);
  assert.match(query, /c\.CMCSNO = a\.SACSNO/);
  assert.match(query, /a\.SACSUS/);
  assert.doesNotMatch(query, /a\.SASUSP/);
  assert.match(query, /c\.CMSUSP/);
  assert.match(query, /a\.SAEXNO/);
  assert.match(query, /c\.CMEXNO/);
  assert.match(query, /'AL000'/);
  assert.match(query, /'WA3500'/);
  assert.match(query, /GROUP BY/);
  assert.doesNotMatch(query, /SASAD1|SASAD2|SASCTY|SASZIP|SAEXDT|SAEXCC|CMECED/);
  assert.doesNotMatch(query, /\b(?:INSERT|UPDATE|DELETE|MERGE|EXEC|TRUNCATE|DROP|ALTER|CREATE)\b/i);
});

test("rejects an empty or oversized code list instead of running an unbounded query", () => {
  assert.throws(() => buildCatchAllExemptionAuditQuery([]), /at least one tax-body code/);
  assert.throws(
    () => buildCatchAllExemptionAuditQuery(Array.from({ length: 201 }, (_, i) => ({ stateCode: "XX", taxBody: `C${i}` }))),
    /outside the supported range/,
  );
});

test("escapes a hostile tax-body code as a literal instead of breaking out of the query", () => {
  const query = buildCatchAllExemptionAuditQuery([{ stateCode: "XX", taxBody: "X';DROP--" }]);
  assert.match(query, /X'{2};DROP--/);
  assert.doesNotMatch(query, /'X';DROP--'/);
});

test("summarizes live rows without exposing any certificate number or identity", () => {
  const recordset = [
    { StateCode: "AL", TaxBody: "AL000", ActiveShipTos: 101, ActiveCustomers: 80, WithExemptCertificateNumber: 12 },
    { StateCode: "MN", TaxBody: "MN000", ActiveShipTos: 106, ActiveCustomers: 90, WithExemptCertificateNumber: 106 },
  ];
  const summary = summarizeCatchAllExemptionAudit(recordset, [
    { stateCode: "AL", taxBody: "AL000" },
    { stateCode: "MN", taxBody: "MN000" },
    { stateCode: "ND", taxBody: "ND000" },
  ]);
  assert.deepEqual(summary, [
    { stateCode: "AL", taxBody: "AL000", activeShipTos: 101, activeCustomers: 80, withExemptCertificateNumber: 12, withoutExemptCertificateNumber: 89 },
    { stateCode: "MN", taxBody: "MN000", activeShipTos: 106, activeCustomers: 90, withExemptCertificateNumber: 106, withoutExemptCertificateNumber: 0 },
    { stateCode: "ND", taxBody: "ND000", activeShipTos: 0, activeCustomers: 0, withExemptCertificateNumber: 0, withoutExemptCertificateNumber: 0 },
  ]);
});

test("keeps every configured catch-all entry represented even without a matching live row", () => {
  const summary = summarizeCatchAllExemptionAudit([], CATCH_ALL_AUDIT_ENTRIES);
  assert.equal(summary.length, CATCH_ALL_AUDIT_ENTRIES.length);
  assert.ok(summary.every((row) => row.activeShipTos === 0));
});

test("opens and always closes the pool, and never leaks a raw SQL error message", async () => {
  let closed = false;
  const pool = {
    request: () => ({ query: async () => ({ recordset: [{ StateCode: "AL", TaxBody: "AL000", ActiveShipTos: 5, ActiveCustomers: 4, WithExemptCertificateNumber: 1 }] }) }),
    close: async () => { closed = true; },
  };
  const result = await readCatchAllExemptionAudit({ openPool: async () => pool, entries: [{ stateCode: "AL", taxBody: "AL000" }] });
  assert.ok(closed);
  assert.equal(result.states.length, 1);
  assert.equal(result.states[0].withExemptCertificateNumber, 1);
  assert.match(result.note, /does not by itself confirm/);
});

test("closes the pool even when the query fails", async () => {
  let closed = false;
  const pool = {
    request: () => ({ query: async () => { throw new Error("boom"); } }),
    close: async () => { closed = true; },
  };
  await assert.rejects(
    readCatchAllExemptionAudit({ openPool: async () => pool, entries: [{ stateCode: "AL", taxBody: "AL000" }] }),
    /boom/,
  );
  assert.ok(closed);
});
