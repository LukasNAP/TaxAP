import assert from "node:assert/strict";
import test from "node:test";
import { queryLabel, sqlTimingStats, timedRequest } from "../server/aplus-connector.mjs";

test("query labels distinguish the linked-server path and name only known tables", () => {
  assert.deepEqual(queryLabel("SELECT * FROM OPENQUERY([SQL03], 'SELECT TBTXBOD FROM APLUSV8FAQ.XATXBD')"), { path: "linked-server", tables: "XATXBD" });
  assert.deepEqual(queryLabel("SELECT 1 FROM dbo.ADDR AS a LEFT JOIN dbo.CUSMS AS c ON 1 = 1"), { path: "dwstage", tables: "ADDR+CUSMS" });
  assert.deepEqual(queryLabel("SELECT 1"), { path: "dwstage", tables: "other" });
});

test("timed requests record duration, keep input chaining, and never log SQL text or parameters", async () => {
  const logged = [];
  const originalInfo = console.info;
  const originalFlag = process.env.TAXAP_SQL_TIMING_LOG;
  console.info = (line) => logged.push(line);
  process.env.TAXAP_SQL_TIMING_LOG = "true";
  try {
    const before = sqlTimingStats.queries;
    const raw = { input() { return this; }, async query() { return { recordset: [{ a: 1 }, { a: 2 }] }; } };
    const result = await timedRequest(raw, () => {}).input("taxBody", "x", "SECRET-PARAM").query("SELECT * FROM dbo.ADDR WHERE SASTXB = 'NC060'");
    assert.equal(result.recordset.length, 2);
    assert.equal(sqlTimingStats.queries, before + 1);
    const entry = JSON.parse(logged.at(-1));
    assert.equal(entry.event, "sql_query");
    assert.equal(entry.rows, 2);
    assert.equal(entry.tables, "ADDR");
    assert.ok(!logged.join("").includes("NC060"));
    assert.ok(!logged.join("").includes("SECRET-PARAM"));
  } finally {
    console.info = originalInfo;
    if (originalFlag === undefined) delete process.env.TAXAP_SQL_TIMING_LOG; else process.env.TAXAP_SQL_TIMING_LOG = originalFlag;
  }
});

test("connection-level errors retire the pool; query errors do not", async () => {
  let retired = 0;
  const failing = (code) => ({ async query() { const error = new Error("boom"); error.code = code; throw error; } });
  await assert.rejects(timedRequest(failing("ESOCKET"), () => { retired += 1; }).query("SELECT 1"));
  await assert.rejects(timedRequest(failing("EREQUEST"), () => { retired += 1; }).query("SELECT 1"));
  assert.equal(retired, 1);
});
