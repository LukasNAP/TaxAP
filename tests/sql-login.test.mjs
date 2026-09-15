import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSqlLoginPool } from "../server/sql-login.mjs";

test("SQL login preserves password bytes, validates TLS, and hides driver errors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "taxap-sql-test-"));
  const file = join(dir, "password");
  const env = { TAXAP_SQL_SERVER: "example.invalid", TAXAP_SQL_DATABASE: "test", TAXAP_SQL_USER: "test", TAXAP_SQL_PASSWORD_FILE: file };
  let config;
  let closed = false;
  class Pool {
    constructor(value) { config = value; }
    async connect() {}
    async close() { closed = true; }
  }
  try {
    await writeFile(file, " synthetic-test-value ");
    assert.ok(await openSqlLoginPool(Pool, env) instanceof Pool);
    assert.equal(config.password, " synthetic-test-value ");
    assert.equal(config.options.encrypt, true);
    assert.equal(config.options.trustServerCertificate, false);
    assert.equal(config.authentication, undefined);
    await openSqlLoginPool(Pool, { ...env, TAXAP_SQL_TRUST_SERVER_CERTIFICATE: "true" });
    assert.equal(config.options.trustServerCertificate, true);
    assert.equal(config.options.encrypt, true);
    await assert.rejects(openSqlLoginPool(Pool, { ...env, TAXAP_SQL_TRUST_SERVER_CERTIFICATE: "yes" }), /must be true or false/);
    class Failure extends Pool { async connect() { throw new Error("private-driver-details"); } }
    await assert.rejects(openSqlLoginPool(Failure, env), error => error.message.startsWith("SQL login connection failed.") && !error.message.includes("private-driver-details"));
    assert.equal(closed, true);
    for (const value of ["", "value\n", "value\r\n", "value\0"]) {
      await writeFile(file, value);
      await assert.rejects(openSqlLoginPool(Pool, env), /SQL password file must contain/);
    }
    await writeFile(file, "synthetic-test-value");
    await assert.rejects(openSqlLoginPool(Pool, { ...env, TAXAP_SQL_PORT: "0" }), /TAXAP_SQL_PORT/);
    await assert.rejects(openSqlLoginPool(Pool, { ...env, TAXAP_SQL_USER: "" }), /Missing required setting/);
    await assert.rejects(openSqlLoginPool(Pool, { ...env, TAXAP_SQL_PASSWORD_FILE: join(dir, "absent") }), /^Error: Cannot read the SQL password file\.$/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
