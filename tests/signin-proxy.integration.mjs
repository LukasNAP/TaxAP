// Opt-in integration test against the actual OAuth2 Proxy binary; no Entra or A+ access.
// TAXAP_TEST_OAUTH2_PROXY must point to a checksum-verified v7.15.4 binary.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes, sign, createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

test("sign-in requires a valid session and an approved group before proxying application/API requests", { skip: !process.env.TAXAP_TEST_OAUTH2_PROXY, timeout: 45000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "taxap-auth-test-"));
  const client = "22222222-2222-2222-2222-222222222222";
  const tenant = "11111111-1111-1111-1111-111111111111";
  const authIssuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
  const group = "33333333-3333-3333-3333-333333333333";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", use: "sig", alg: "RS256" };
  const grants = new Map();
  let issuer;
  let upstreamRequests = 0;
  const provider = createServer(async (request, response) => {
    const url = new URL(request.url, issuer);
    response.setHeader("Content-Type", "application/json");
    if (url.pathname.endsWith("/.well-known/openid-configuration")) return response.end(JSON.stringify({
      issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/keys`,
      response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"],
      code_challenge_methods_supported: ["S256"],
    }));
    if (url.pathname.endsWith("/keys")) return response.end(JSON.stringify({ keys: [jwk] }));
    if (url.pathname.endsWith("/token")) {
      let body = "";
      for await (const chunk of request) body += chunk;
      const form = new URLSearchParams(body);
      const grant = grants.get(form.get("code"));
      if (!grant || createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url") !== grant.challenge) {
        response.statusCode = 400; return response.end('{}');
      }
      const now = Math.floor(Date.now() / 1000);
      const claims = { iss: grant.issuer ?? authIssuer, aud: client, sub: "test-user", oid: "test-user", tid: tenant,
        email: "reviewer@example.test", email_verified: true, preferred_username: "reviewer@example.test",
        iat: now, nbf: now - 30, exp: now + 3600, nonce: grant.nonce, groups: grant.groups };
      const content = [Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key" })).toString("base64url"), Buffer.from(JSON.stringify(claims)).toString("base64url")].join(".");
      const token = `${content}.${sign("RSA-SHA256", Buffer.from(content), privateKey).toString("base64url")}`;
      return response.end(JSON.stringify({ access_token: "synthetic-access", token_type: "Bearer", expires_in: 3600, id_token: token, refresh_token: "synthetic-refresh" }));
    }
    if (url.pathname.startsWith("/upstream") || url.pathname === "/api/reviews") { upstreamRequests++; return response.end('{"protected":true}'); }
    response.statusCode = 404; response.end('{}');
  });
  let proxy;
  try {
    await new Promise((done) => provider.listen(0, "127.0.0.1", done));
    issuer = `http://127.0.0.1:${provider.address().port}/${tenant}/v2.0`;
    const reservation = createServer();
    await new Promise((done) => reservation.listen(0, "127.0.0.1", done));
    const port = reservation.address().port;
    await new Promise((done) => reservation.close(done));
    await writeFile(join(directory, "client"), "synthetic-client-secret");
    await writeFile(join(directory, "cookie"), randomBytes(32));
    proxy = spawn(process.env.TAXAP_TEST_OAUTH2_PROXY, ["--config", resolve("deployment/apdock01/oauth2-proxy.cfg")], {
      windowsHide: true,
      env: { ...process.env, OAUTH2_PROXY_OIDC_ISSUER_URL: authIssuer,
        OAUTH2_PROXY_SKIP_OIDC_DISCOVERY: "true", OAUTH2_PROXY_LOGIN_URL: `${issuer}/authorize`,
        OAUTH2_PROXY_REDEEM_URL: `${issuer}/token`, OAUTH2_PROXY_OIDC_JWKS_URL: `${issuer}/keys`, OAUTH2_PROXY_CLIENT_ID: client,
        OAUTH2_PROXY_ALLOWED_GROUPS: group, OAUTH2_PROXY_REDIRECT_URL: "https://apdock01.atlanticpkg.com:5017/oauth2/callback",
        OAUTH2_PROXY_HTTP_ADDRESS: `127.0.0.1:${port}`, OAUTH2_PROXY_UPSTREAMS: `http://127.0.0.1:${provider.address().port}/`,
        OAUTH2_PROXY_CLIENT_SECRET_FILE: join(directory, "client"), OAUTH2_PROXY_COOKIE_SECRET_FILE: join(directory, "cookie"),
      }, stdio: ["ignore", "ignore", "pipe"],
    });
    let startupError = "";
    proxy.stderr.on("data", (chunk) => { if (startupError.length < 4000) startupError += chunk; });
    const get = (path, headers = {}) => fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual", headers: { Host: "apdock01.atlanticpkg.com:5017", "X-Forwarded-Proto": "https", ...headers } });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (proxy.exitCode !== null) throw new Error(`Proxy startup failed: ${startupError}`);
      try { if ((await get("/ping")).status === 200) { ready = true; break; } } catch { /* still starting */ }
      await delay(100);
    }
    assert.ok(ready, "Proxy must start with the production configuration and synthetic registration");
    for (const path of ["/api", "/api/reviews", "/api/official/findings"]) assert.equal((await get(path)).status, 401);
    assert.equal((await get("/api/reviews", { "X-Forwarded-User": "Ana", "X-Auth-Request-Email": "reviewer@example.test", Authorization: "Bearer synthetic" })).status, 401);
    assert.ok((await get("/oauth2/callback?code=invalid&state=invalid")).status >= 400);
    assert.equal(upstreamRequests, 0, "Anonymous/API/callback failures must never reach the application");
    const login = async (groups, tokenIssuer = authIssuer) => {
      const start = await get("/");
      assert.equal(start.status, 302);
      const authorize = new URL(start.headers.get("location"));
      assert.equal(authorize.searchParams.get("redirect_uri"), "https://apdock01.atlanticpkg.com:5017/oauth2/callback");
      assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
      const code = randomBytes(12).toString("hex");
      grants.set(code, { nonce: authorize.searchParams.get("nonce"), challenge: authorize.searchParams.get("code_challenge"), groups, issuer: tokenIssuer });
      const cookie = start.headers.getSetCookie().map((item) => item.split(";")[0]).join("; ");
      return get(`/oauth2/callback?${new URLSearchParams({ code, state: authorize.searchParams.get("state") })}`, { Cookie: cookie });
    };
    const denied = await login(["unapproved-group"]);
    assert.equal(denied.status, 403);
    assert.equal(upstreamRequests, 0);
    const wrongTenant = await login([group], "https://login.microsoftonline.com/other-tenant/v2.0");
    assert.ok(wrongTenant.status >= 400);
    assert.equal(upstreamRequests, 0);
    const accepted = await login([group]);
    assert.equal(accepted.status, 302);
    const cookies = accepted.headers.getSetCookie();
    assert.ok(cookies.some((cookie) => cookie.startsWith("__Host-taxap_sso=") && /Secure/i.test(cookie) && /HttpOnly/i.test(cookie)), "Authenticated cookie must be secure and HTTP-only");
    const sessionCookie = cookies.map((item) => item.split(";")[0]).join("; ");
    assert.equal((await get("/api/reviews", { Cookie: sessionCookie })).status, 200);
    assert.equal(upstreamRequests, 1);
    const signedOut = await get("/oauth2/sign_out", { Cookie: sessionCookie });
    assert.ok(signedOut.headers.getSetCookie().some((cookie) => cookie.startsWith("__Host-taxap_sso=;") && /Max-Age=0/i.test(cookie)), "Sign-out clears the application cookie");
  } finally {
    if (proxy && proxy.exitCode === null) { proxy.kill(); await new Promise((done) => proxy.once("exit", done)); }
    provider.closeAllConnections();
    await new Promise((done) => provider.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});


test("Compose requires sign-in settings and publishes only authenticated ingress", { skip: !process.env.TAXAP_TEST_COMPOSE }, () => {
  const env = { ...process.env,
    TAXAP_SIGNIN_TENANT_ID: "11111111-1111-1111-1111-111111111111",
    TAXAP_SIGNIN_CLIENT_ID: "22222222-2222-2222-2222-222222222222",
    TAXAP_SIGNIN_GROUP_ID: "33333333-3333-3333-3333-333333333333",
    TAXAP_ALLOWED_ORIGIN: "https://apdock01.atlanticpkg.com:5017",
    TAXAP_SIGNIN_CLIENT_SECRET_FILE: "/tmp/test-client", TAXAP_SIGNIN_COOKIE_SECRET_FILE: "/tmp/test-cookie",
    TAXAP_TLS_CERT_PATH: "/tmp/test-cert", TAXAP_TLS_KEY_PATH: "/tmp/test-key",
  };
  const args = ["compose", "--env-file", "deployment/apdock01/.env.example", "-f", "deployment/apdock01/docker-compose.yml", "config", "--no-env-resolution", "--format", "json"];
  const result = spawnSync("docker", args, { env, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, "Compose should resolve with the supplied synthetic settings");
  const config = JSON.parse(result.stdout);
  assert.deepEqual(Object.entries(config.services).filter(([, service]) => service.ports?.length).map(([name]) => name), ["taxap-proxy"]);
  assert.equal(config.services["taxap-signin"].environment.OAUTH2_PROXY_REDIRECT_URL, "https://apdock01.atlanticpkg.com:5017/oauth2/callback");
  for (const name of ["TAXAP_SIGNIN_TENANT_ID", "TAXAP_SIGNIN_CLIENT_ID", "TAXAP_SIGNIN_GROUP_ID", "TAXAP_ALLOWED_ORIGIN", "TAXAP_SIGNIN_CLIENT_SECRET_FILE", "TAXAP_SIGNIN_COOKIE_SECRET_FILE"]) {
    const missing = spawnSync("docker", args, { env: { ...env, [name]: "" }, encoding: "utf8", windowsHide: true });
    assert.notEqual(missing.status, 0, `Missing ${name} must prevent startup configuration`);
  }
});
