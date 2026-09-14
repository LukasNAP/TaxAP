import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the public ingress has no route that bypasses sign-in", async () => {
  const front = await readFile(new URL("../deployment/apdock01/nginx/taxap-proxy.conf", import.meta.url), "utf8");
  const upstreams = [...front.matchAll(/proxy_pass\s+([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(upstreams, ["http://taxap-signin:4180"]);
  assert.doesNotMatch(front.replace(/^\s*#.*$/gm, ""), /taxap-app|location\s+\/api/);
  assert.match(front, /if \(\$request_origin != "\$\{TAXAP_ALLOWED_ORIGIN\}"\) \{ return 421; \}/);
  assert.match(front, /proxy_set_header X-Auth-Request-Redirect "";/);
  assert.match(front, /access_log off;/);
});

test("the sign-in configuration does not bypass API authentication or forward access tokens", async () => {
  const config = await readFile(new URL("../deployment/apdock01/oauth2-proxy.cfg", import.meta.url), "utf8");
  assert.doesNotMatch(config, /^\s*(skip_auth_routes|skip_auth_regex|insecure_oidc_skip_issuer_verification)\s*=/m);
  for (const setting of ["skip_jwt_bearer_tokens", "skip_auth_preflight", "pass_access_token", "pass_authorization_header", "pass_user_headers", "request_logging"]) {
    assert.match(config, new RegExp(`^${setting} = false$`, "m"));
  }
  assert.match(config, /^cookie_secure = true$/m);
  assert.match(config, /^cookie_httponly = true$/m);
});
