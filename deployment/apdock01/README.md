# TaxAP on apdock01

This deployment keeps TaxAP's read-only connector private inside a Docker network. Only the Nginx proxy publishes HTTPS on the host.

## Required before deployment

The certificate-based SQL path below is the original option. IT also supports dedicated SQL accounts; TaxAP now supports that alternative as described next. Neither option inherits the browser user's database access.

### Dedicated read-only SQL login

IT must supply a dedicated SQL login, approved server/database and TCP port, and SELECT access to the existing queries and linked-server path. SQL permissions enforce read-only access. For the verified SQL03/DWStage connection, set `TAXAP_SQL_QUERY_ROUTE=direct`: tax-body queries use SQL03's APLUS linked server directly. `linked` preserves the outer SQL03 hop for the original Azure entry point. Windows mode defaults to direct; other modes default to linked. Invalid route values fail rather than silently choosing a path.

Provision the password without a trailing newline in `/var/atlanticapps/taxap/secrets/sql-password`, readable only by the app container user (verify its numeric UID; it differs from the sign-in proxy user). Set `TAXAP_SQL_USER` and `TAXAP_SQL_PASSWORD_FILE` in the protected deployment `.env`; optionally set `TAXAP_SQL_PORT` (default 1433). Never put the password itself in environment variables or Git. SQL traffic always requires encryption. Certificate validation is enabled by default. Jeff approved trusting SQL03's self-signed certificate on September 15: set `TAXAP_SQL_TRUST_SERVER_CERTIFICATE=true` for that approved exception. This skips server certificate verification while preserving encryption; invalid boolean values fail configuration.

After explicit deployment authorization and credential provisioning:

```bash
docker compose -f deployment/apdock01/docker-compose.yml -f deployment/apdock01/docker-compose.sql-login.yml config --quiet
docker compose -f deployment/apdock01/docker-compose.yml -f deployment/apdock01/docker-compose.sql-login.yml up -d --build
```

Keep using both Compose files for future SQL-login deployments. This override selects `sql` authentication and mounts the password read-only for the application only. Existing certificate settings are unused in this mode; browser sign-in remains unchanged. Validate actual read-only queries, linked-server permissions and fresh comparison results before calling hosted data connected. Health metadata alone does not test SQL connectivity. This option is prepared locally and has not been deployed or tested against Atlantic SQL.

1. Atlantic IT approves an internal DNS name and provides read-only TLS certificate/key mount paths.
2. Create or obtain a non-interactive Microsoft Entra service principal with a certificate credential and the least Azure SQL/DWStage permissions required for TaxAP's existing SELECT-only queries. Store the combined PEM (public certificate and private key) only at `/var/atlanticapps/taxap/secrets/azure-sql-client-cert.pem`; Compose mounts it read-only at `/run/secrets/azure-sql-client-cert.pem`. Do not use a personal Azure CLI login, SQL password, or client secret.
3. The identity and Azure SQL firewall/private-link policy are validated in a supervised, read-only session.
4. Copy `.env.example` to `.env` on `apdock01`, fill only approved settings, and keep `.env` out of source control.

## Deploy after approval

```bash
cd /var/atlanticapps/taxap
docker compose -f deployment/apdock01/docker-compose.yml up -d --build
```

Verify the public web container and private connector health through the approved internal URL. Do not publish port 3001 or bypass the proxy.

## Entra user sign-in

The deployment now routes traffic through HTTPS Nginx → OAuth2 Proxy → internal Nginx router → TaxAP web/API. Only the HTTPS ingress is published. Both page requests and `/api/` require a valid session; the OAuth2 callback is handled by the proxy. This configuration is prepared in the repository, not yet deployed or tested with Atlantic's registration.

Register this exact **Web** redirect URI with Jeff:

```text
https://apdock01.atlanticpkg.com:5017/oauth2/callback
```

It is generated from `TAXAP_ALLOWED_ORIGIN` plus `/oauth2/callback`. Keep the origin HTTPS, without a trailing slash. If DNS or port changes, update both the Entra redirect URI and the deployment origin. Public Nginx rejects Host headers that do not match that origin.

### Settings to obtain from Jeff

| Setting | What to provide |
|---|---|
| `TAXAP_SIGNIN_TENANT_ID` | Atlantic tenant ID; use a single-tenant app registration. |
| `TAXAP_SIGNIN_CLIENT_ID` | Application/client ID of the **user sign-in** registration. |
| `TAXAP_SIGNIN_GROUP_ID` | Object ID of a dedicated security group containing Ana, Liv, Lukas and approved administrators. Enable its groups claim in ID tokens. |
| Sign-in client credential | Provision the client-secret **value**, with no trailing newline, in the protected host file named by `TAXAP_SIGNIN_CLIENT_SECRET_FILE`. Do not send it in ordinary messages or commit it. |

Require assignment to the Enterprise Application and assign the approved group. The proxy also checks the group claim. Its scopes are `openid profile email`; issuer validation remains enabled and there are no authentication-bypass routes. Users without the group claim are denied. If group overage applies, IT must explicitly validate the required Entra/Graph configuration before granting access; do not remove the group restriction as a workaround.

The sign-in client credential is separate from the certificate-based `AZURE_*` SQL workload identity. This work does not change the hosted SQL connection, its certificate requirement, or its permissions.

### Host provisioning

- Store the sign-in credential outside the checkout at the example path `/var/atlanticapps/taxap/secrets/signin-client-secret`.
- Provision a separate cookie encryption key at `.../secrets/signin-cookie-secret`: **32 raw random bytes**, not base64 text. Generate into the file without displaying the key, for example `openssl rand -out <protected-cookie-file> 32` under a restrictive umask. Do not overwrite an existing key during a routine restart.
- The container account must be able to read both files. Grant only the necessary read access; do not make credentials world-readable. Confirm the image's configured user when assigning file ownership. Compose mounts the files read-only as secrets. Secret contents do not belong in `.env`, Git, Docker build context, shell arguments, or logs.
- Populate the sign-in IDs, group and file paths in `deployment/apdock01/.env`. Blank required values prevent Compose configuration from resolving. The proxy must reach Microsoft discovery/token/JWKS endpoints over HTTPS.
- Keep the existing IT-approved HTTPS certificate mounts and database volume. Use an approved secret-rotation procedure; cookie-key rotation invalidates existing TaxAP sessions.

### Validation and release

With the real settings provisioned, run `docker compose -f deployment/apdock01/docker-compose.yml config --quiet`. Do not print expanded production configuration into shared logs. Deployment still requires explicit owner approval.

After deployment, verify:

1. Opening the HTTPS application redirects an unauthenticated user to the Atlantic tenant. The login request's redirect URI exactly matches the registered callback.
2. An assigned member of the approved group returns through `/oauth2/callback` and can open the application and API. An unassigned user, missing group claim and different tenant are denied.
3. An unauthenticated or expired-session `/api/reviews` request returns **401**, not review data or a login-page HTML response. Reload the application to sign in again after session expiry.
4. Invalid callback state, forged user headers and direct requests to private app/router/proxy ports do not grant access. Confirm only port 5017 (or the approved replacement) is exposed on the host.
5. Cookies are Secure, HTTP-only and SameSite=Lax. Callback request URLs and authorization codes are absent from access logs. No sign-in or access token is forwarded into TaxAP.
6. Review persistence and all-state refresh still work through the protected routes. A state comparison can take longer than 30 seconds; both proxy layers allow 180 seconds upstream.

`/oauth2/sign_out` clears the TaxAP session; it does not sign the user out of Microsoft 365. Reviewer selection inside TaxAP remains manual and explicitly labeled as such. Connecting review ownership to verified sign-in identity is a separate application change; this access gate does not establish authenticated audit attribution.

### Local verification without Entra

The opt-in integration harness uses the actual OAuth2 Proxy v7.15.4 executable and a synthetic issuer/token service. It preserves token issuer/signature verification but supplies local authorization, token and JWKS endpoints, so no Microsoft or A+ connection is used.

Set `TAXAP_TEST_OAUTH2_PROXY` to a verified binary and optionally `TAXAP_TEST_COMPOSE=1`, then run:

```text
node --test tests/signin-proxy.integration.mjs
```

The normal test suite also checks that the public ingress has no direct route to the application and no API authentication bypass. Local Windows Nginx syntax validation passed with synthetic TLS material and local service-name substitutions. Docker Desktop failed during startup on this workstation, so the actual Linux container stack and real Entra browser sign-in remain deployment acceptance checks.

References: [OAuth2 Proxy Entra provider](https://oauth2-proxy.github.io/oauth2-proxy/configuration/providers/ms_entra_id/) and [configuration options](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/).

## Shared read-only SQL pool

The connector reuses a pool with up to five connections per process. Existing queries and SQL permissions remain unchanged. Retired pools drain active reader leases before closing. Restart/recreate the app to apply setting or credential changes.

- `TAXAP_SQL_SHARED_POOL`: `true` by default; `false` restores one pool per reader.
- `TAXAP_SQL_POOL_MAX`: integer1-20, default5, for shared mode.
- `TAXAP_SQL_TIMING_LOG=true`: optional query timing logs with known table labels and row counts only, never SQL text or parameters. Batch timing counters are approximate when requests overlap; longest-query timing is process-lifetime.

Invalid sharing/max settings fail explicitly. Entra expiry replacement has synthetic lifecycle coverage; the hosted deployment uses the SQL-login path.
