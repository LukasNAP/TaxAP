import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStateCoverageQuery,
  buildStateTaxBodyQuery,
  buildTaxTreatmentSummaryQuery,
  buildTaxBodyDefinitionsQuery,
  buildTaxBodyQuery,
  createConnectorServer,
  validateStateCode,
} from "../server/aplus-connector.mjs";

test("builds the fixed read-only linked-server query for the XATXBD fields", () => {
  const query = buildTaxBodyQuery();
  assert.match(query, /^SELECT \* FROM OPENQUERY\(\[SQL03\]/);
  assert.match(query, /OPENQUERY\(APLUS/);
  assert.match(query, /APLUSV8FAQ\.XATXBD/);
  assert.match(query, /TBTXBOD AS TaxBody/);
  assert.match(query, /TBTXDAT AS NextEffectiveDate/);
  assert.match(query, /WHERE TBTXBOD LIKE/);
  assert.match(query, /TBTXBOD NOT IN \('{4}NCUSE'{4}, '{4}NC060XXX'{4}\)/);
  assert.match(query, /TBTXNAM\) NOT LIKE '{4}%DO NOT USE%'{4}/);
  assert.doesNotMatch(query, /ADDR|CUSMS|HSHED/);
});

test("rejects unsafe linked-server and library identifiers", () => {
  assert.throws(() => buildTaxBodyQuery({ linkedServer: "SQL03]; DROP TABLE X;--" }), /unsupported characters/);
  assert.throws(() => buildTaxBodyQuery({ library: "APLUSV8FAQ.XATXBD" }), /unsupported characters/);
});

test("builds a direct SQL03 A+ query for local Windows Authentication", () => {
  const query = buildTaxBodyQuery({ linkedServer: null });
  assert.match(query, /^SELECT \* FROM OPENQUERY\(APLUS/);
  assert.doesNotMatch(query, /OPENQUERY\(\[SQL03\]/);
  assert.match(query, /APLUSV8FAQ\.XATXBD/);
});

test("accepts only official U.S. state codes for state drill-down", () => {
  assert.equal(validateStateCode(" nc "), "NC");
  assert.equal(validateStateCode("dc"), "DC");
  assert.throws(() => validateStateCode("DR"), /valid U\.S\. state code/);
  assert.throws(() => validateStateCode("ON"), /valid U\.S\. state code/);
  assert.throws(() => validateStateCode("NC' OR 1=1--"), /valid U\.S\. state code/);
});

test("state queries preserve company joins, active filters, and parameterization", () => {
  const summaryQuery = buildStateCoverageQuery();
  const detailQuery = buildStateTaxBodyQuery();
  for (const query of [summaryQuery, detailQuery]) {
    assert.match(query, /c\.CMCONO = a\.SACONO/);
    assert.match(query, /c\.CMCSNO = a\.SACSNO/);
    assert.match(query, /a\.SACSUS/);
    assert.doesNotMatch(query, /a\.SASUSP/);
    assert.match(query, /c\.CMSUSP/);
  }
  assert.match(detailQuery, /= @state/);
  assert.doesNotMatch(detailQuery, /NC'|DROP TABLE/);
});

test("tax treatment summary remains aggregate-only and read-only", () => {
  const query = buildTaxTreatmentSummaryQuery();
  assert.match(query, /a\.SATXCD/);
  assert.match(query, /LTRIM\(RTRIM\(a\.SASTXB\)\) = 'ZTEMP'/);
  assert.match(query, /'all' AS Scope/);
  assert.match(query, /'ZTEMP' AS Scope/);
  assert.match(query, /'tax-body' AS Scope/);
  assert.match(query, /NULLIF\(LTRIM\(RTRIM\(a\.SASTXB\)\), ''\) AS TaxBody/);
  assert.match(query, /COUNT\(DISTINCT CONCAT\(a\.SACONO, '\\|', a\.SACSNO\)\)/);
  assert.match(query, /a\.SACSUS/);
  assert.match(query, /c\.CMSUSP/);
  assert.doesNotMatch(query, /SASHNM|SASAD1|SASAD2|SASCTY|SASZIP|OA[A-Z]/);
  assert.doesNotMatch(query, /\b(?:INSERT|UPDATE|DELETE|MERGE|EXEC|TRUNCATE|DROP|ALTER|CREATE)\b/i);
});

test("builds a read-only definition lookup for exact assigned tax bodies", () => {
  const query = buildTaxBodyDefinitionsQuery(["NC060", "NC6.75%", "O'HARE"]);
  assert.match(query, /APLUSV8FAQ\.XATXBD/);
  assert.match(query, /TBTXBOD IN/);
  assert.match(query, /TBTXBOD NOT IN/);
  assert.match(query, /NC6\.75%/);
  assert.match(query, /O'{8}HARE/);
  assert.doesNotMatch(query, /LIKE 'NC%'/);
});

test("exposes a health check without touching A+", async () => {
  const server = createConnectorServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/health`, { headers: { Origin: "http://localhost:3000" } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ready", configured: false, authentication: "Microsoft Entra ID" });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("exposes the nationwide official-source registry without touching A+", async () => {
  const server = createConnectorServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/official/sources`, { headers: { Origin: "http://localhost:3000" } });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.sources.length, 51);
    assert.equal(payload.sources.find((source) => source.stateCode === "GA").status, "connected");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
