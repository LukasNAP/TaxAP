import { readFile } from "node:fs/promises";

// SQL permissions must enforce read-only access; an application name is not a permission boundary.
export async function openSqlLoginPool(ConnectionPool, env = process.env) {
  for (const name of ["TAXAP_SQL_SERVER", "TAXAP_SQL_DATABASE", "TAXAP_SQL_USER", "TAXAP_SQL_PASSWORD_FILE"]) {
    if (!env[name]?.trim()) throw new Error(`Missing required setting: ${name}`);
  }
  let password;
  try { password = await readFile(env.TAXAP_SQL_PASSWORD_FILE, "utf8"); }
  catch { throw new Error("Cannot read the SQL password file."); }
  if (!password || /[\r\n\0]/.test(password)) throw new Error("SQL password file must contain a nonempty value without newlines or null bytes.");
  const port = Number(env.TAXAP_SQL_PORT || 1433);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("TAXAP_SQL_PORT must be an integer from 1 to 65535.");
  const trustSetting = String(env.TAXAP_SQL_TRUST_SERVER_CERTIFICATE || "false").trim().toLowerCase();
  if (!["true", "false"].includes(trustSetting)) throw new Error("TAXAP_SQL_TRUST_SERVER_CERTIFICATE must be true or false.");
  const pool = new ConnectionPool({
    server: env.TAXAP_SQL_SERVER,
    database: env.TAXAP_SQL_DATABASE,
    user: env.TAXAP_SQL_USER,
    password,
    port,
    options: { encrypt: true, trustServerCertificate: trustSetting === "true", appName: "TaxAP read-only connector" },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5_000 },
    connectionTimeout: 20_000,
    requestTimeout: 60_000,
  });
  try { await pool.connect(); }
  catch {
    try { await pool.close(); } catch { /* Keep driver details out of the API response. */ }
    throw new Error("SQL login connection failed. Verify the account, network access and trusted server certificate with IT.");
  }
  return pool;
}
