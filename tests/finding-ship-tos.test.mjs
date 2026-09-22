import test from "node:test";
import assert from "node:assert/strict";
import { findingShipTosQuery, validateShipToSelection, readFindingShipTos } from "../server/finding-ship-tos.mjs";
import { createConnectorServer } from "../server/aplus-connector.mjs";

test("ship-to query is scoped, parameterized, read-only and excludes names/addresses", () => {
  assert.match(findingShipTosQuery, /c.CMCONO = a.SACONO AND c.CMCSNO = a.SACSNO/);
  assert.match(findingShipTosQuery, /a.SASTXB\)\) = @taxBody/);
  assert.match(findingShipTosQuery, /@scope = 'rate-risk' AND LTRIM\(RTRIM\(a.SATXCD\)\) = '0'/);
  assert.match(findingShipTosQuery, /@scope = 'all' AND UPPER\(LTRIM\(RTRIM\(a.SASHST\)\)\) = @state/);
  assert.match(findingShipTosQuery, /a.SACSUS/);
  assert.match(findingShipTosQuery, /c.CMSUSP/);
  assert.match(findingShipTosQuery, /OFFSET @offset ROWS FETCH NEXT 50 ROWS ONLY/);
  assert.doesNotMatch(findingShipTosQuery, /SASHNM|CMCSNM|SASAD|SASZIP|\b(?:INSERT|UPDATE|DELETE|EXEC|MERGE)\b/i);
  for (const query of ['taxBody=x%27&state=NC', 'taxBody=NC060&state=NC&scope=unknown', 'taxBody=NC060&state=NC&page=-1']) assert.throws(() => validateShipToSelection(new URLSearchParams(query)));
});

test("identifier output is allowlisted and padded ship-to numbers survive", async () => {
  let closed = false;
  const inputs = {};
  const request = { input(k, t, v) { inputs[k] = v; return this; }, async query() { return { recordset: [{ total: 83, companyNumber: 1, customerNumber: 42, shipToNumber: "0000123", secret: "must not escape" }] }; } };
  const result = await readFindingShipTos({ taxBody: "NC060", state: "NC", scope: "rate-risk", page: 1 }, { openPool: async () => ({ request: () => request, close: async () => { closed = true; } }), sql: { VarChar: n => n, Int: "int" } });
  assert.equal(inputs.offset, 50);
  assert.equal(inputs.taxBody, "NC060");
  assert.deepEqual(result.rows, [{ companyNumber: "1", customerNumber: "42", shipToNumber: "0000123" }]);
  assert.equal(closed, true);
});

test("ship-to endpoint rejects invalid inputs/origins and does not expose errors", async () => {
  let calls = 0;
  const server = createConnectorServer({ readShipTos: async () => { calls++; throw new Error("private details"); } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/aplus/finding-ship-tos`;
  try {
    assert.equal((await fetch(base)).status, 400);
    assert.equal((await fetch(`${base}?taxBody=NC060&state=XX`)).status, 400);
    assert.equal((await fetch(`${base}?taxBody=NC060&state=NC`, { headers: { Origin: "https://untrusted.invalid" } })).status, 403);
    assert.equal(calls, 0);
    const response = await fetch(`${base}?taxBody=NC060&state=NC`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await response.text(), /private details/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
