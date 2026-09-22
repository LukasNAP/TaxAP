# TaxAP project handoff

Last updated September 22, 2026. The latest dated updates supersede historical sections below. Keep this as the shared handoff for all coding assistants.

## Customer names and ship-to addresses added locally (September 22)

Delivery update: user authorized commit, push and deployment of this expansion. The implementation and earlier identifier-list deployment note are included in this delivery. Deployment verification is recorded after rollout; do not treat this authorization alone as proof of deployment.

User explicitly approved expanding the identifiers-only list to show customer names and ship-to addresses inside signed-in TaxAP. This supersedes the earlier numbers-only restriction for that UI/API purpose; customer details remain excluded from logs, chat output, Git data, and documentation. Used aplus-erp schema to confirm CUSMS.CMCSNM and ADDR.SASAD1/SASAD2/SASCTY/SASHST/SASZIP. Extended the existing parameterized SELECT and explicit response allowlist; joins, active filters, treatment scope and pagination are unchanged. No contact, phone, certificate, invoice or ship-to-name fields added. API retains no-store and generic error responses behind the existing hosted sign-in gate. Do not expose the connector port publicly.

Table now shows company, customer name, customer number, multiline ship-to address and ship-to number. Empty data has an unavailable label; no guessed address. Added horizontal scrolling/wrapping for the wider table using existing styles. Synthetic fixture verifies mapping/trim behavior and excluded fields. Build and all 275 tests passed; lint/TypeScript passed. Live local read verification printed only row count/shape booleans, no customer details. Browser acceptance and hosted deployment remain pending. No commit/push/deploy or A+ writes authorized/performed for this expansion. Preserve the earlier uncommitted deployment handoff note too.

## Finding ship-to identifier list implemented locally (September 22)

Deployment update: user explicitly authorized deployment of c991213. Verified target host page/connector files match the parent-commit baseline before copying; protected configuration/review backup at `/var/atlanticapps/taxap-backups/shiptos-*`, with SQLite integrity check and image tag `taxap-rollback:before-shipto-list`. Copied only the two app and two server files, verified SHA256 matches, validated Compose and built/replaced only taxap-app with the SQL-login override. Hosted identifier endpoint through the internal router returned 200, no-store, only approved fields, two 50-row pages with no overlap and consistent totals. Only aggregate outcomes were printed. Review integrity passed; public root 302 and anonymous new endpoint 401; all four containers running without restarts. Feature is now deployed; earlier pending-deployment notes below are historical. User-facing browser acceptance remains for Ana/the user. This deployment note is local/uncommitted; deployment did not authorize a new commit/push.

Delivery update: user authorized commit and push; the feature and its tests are included in this delivery commit on main. Deployment remains unauthorized and pending, so the hosted app does not yet include the list. The implementation-time no-commit statement below is historical.

Ana requested the individual ship-tos behind a finding count. User explicitly selected company/customer/ship-to numbers only. Consulted aplus-erp and explained the new SELECT before editing; no names, addresses, certificate numbers or invoice fields are selected or returned. Added an on-demand "View affected ship-tos" section to the finding and NC drawers, with 50-row pagination, loading/error/retry states and retrieval time. No export or persistent identifier storage added.

New `/api/aplus/finding-ship-tos` GET endpoint validates selection and pagination, uses parameterized SQL and matching company/customer joins with existing suspended-customer/ship-to exclusions. Rate-risk scope matches the existing treatment-aware count: SATXCD 0 for the tax body across states. Unfiltered/NC scope selects active assignments to that tax body in the finding state. It lists current assignments, not a claim that each individual location was rate-verified. Different current/finding totals display an explicit warning, including possible narrower jurisdiction scope. Company/customer/ship-to keys remain distinct; padded ship-to numbers are preserved. Responses are no-store, disallowed origins rejected, raw SQL errors suppressed; hosted route is covered by the existing all-API sign-in gate.

Files: `server/finding-ship-tos.mjs`, `app/finding-ship-tos.tsx`, `tests/finding-ship-tos.test.mjs`, and integration changes in page/connector. Full suite 275/275 passed; final production build, lint and TypeScript passed after fixing a UI apiBase reference. Live local Windows-auth SELECT checks returned only approved fields; two 50-row rate-risk pages had no duplicate keys and consistent total. Only aggregate test outcomes were printed. Browser interaction acceptance remains unperformed. No commit, push, deployment or A+ writes. User still needs to authorize deployment for Ana to see it on apdock01.

## Catch-all exemption-certificate audit built, deployed, and run (September 15)

Built a read-only, aggregate-only investigation (`server/catchall-exemption-audit.mjs`, endpoint `POST /api/aplus/catch-all-exemption-audit`) to add real evidence to the "is this catch-all tax-body code an intentional exemption or a missing-jurisdiction gap?" questions in `docs/pending-business-decisions.md`. It cross-references two A+ fields TaxAP had not previously read — `ADDR.SAEXNO` and `CUSMS.CMEXNO` (tax-exempt certificate numbers, confirmed via the aplus-erp schema reference) — against the 16 catch-all codes named in that memo (AL000, DC000, IA000, ID000, MN000, ND000, NE000, NV000, OK000, SD000, UT000, VT000, WA000, WA3500, WI000, WV000). It only counts certificate presence/absence per code; it does not decode `SAEXCC`/`SAEXDT`/`CMECED` expiration semantics (unconfirmed A+ date encoding for these specific fields) and exposes no certificate numbers, addresses, or customer identity — counts only.

Deployed to apdock01 the same way as the Louisiana fix: confirmed no unexpected host drift (line-ending-only difference from the last-deployed commit), backed up the pre-change file, tagged image `taxap-rollback:before-catchall-audit`, copied files via `scp` with MD5 verification, rebuilt/restarted only `taxap-app`, confirmed all four containers healthy.

Ran it live; results (active ship-tos / with certificate / without):

| State | Code | Active | With cert | Without cert |
|---|---|---|---|---|
| AL | AL000 | 8 | 8 | 0 |
| DC | DC000 | 21 | 11 | 10 |
| IA | IA000 | 55 | 44 | 11 |
| ID | ID000 | 12 | 11 | 1 |
| MN | MN000 | 106 | 66 | 40 |
| ND | ND000 | 33 | 6 | 27 |
| NE | NE000 | 21 | 16 | 5 |
| NV | NV000 | 8 | 5 | 3 |
| OK | OK000 | 2 | 1 | 1 |
| SD | SD000 | 9 | 7 | 2 |
| UT | UT000 | 37 | 29 | 8 |
| VT | VT000 | 9 | 8 | 1 |
| WA | WA000 | 30 | 25 | 5 |
| WA | WA3500 | 2 | 1 | 1 |
| WI | WI000 | 34 | 28 | 6 |
| WV | WV000 | 21 | 12 | 9 |

Notable: Alabama's `AL000` has a certificate on file for all 8 currently-active ship-tos — the strongest evidence in this set that a catch-all code is a deliberate exemption bucket. That active count (8) is much lower than the ~101 quoted in the pending-decisions memo from an earlier snapshot; that population difference is unreconciled and should be checked before trusting either number. North Dakota's `ND000` has the weakest evidence (6 of 33), which combined with North Dakota's mandatory (non-optional) sales tax leans toward "unbuilt setup" rather than policy - worth prioritizing. Minnesota's `MN000` is a genuine 66/40 split with no clean answer.

A populated certificate number is evidence toward "documented exemption," not proof of a currently valid one - none of this resolves the underlying business decisions, it only gives Ana/Liv real data to decide from. Findings recorded inline in `docs/pending-business-decisions.md` under each affected state, plus a summary note at the top of that file. Code committed and pushed as `f002e7b` (feature) and `009e04f` (docs); both validated with the full test suite (272/272), ESLint, and `tsc --noEmit` before deployment.

## Louisiana TLS fix deployed to apdock01; full shared batch now clean (September 15)

User authorized deploying the committed Louisiana fix (`604c1c0`/`a4d0056`) to the host. Confirmed the host's `server/la-rates.mjs` was byte-identical (MD5) to the pre-fix baseline before touching anything, so this was a clean, isolated application of the same change — no other host drift was at risk. Backed up the original file (`server/la-rates.mjs.before-la-tls-fix`) and tagged the running image `taxap-rollback:before-la-tls-fix` before rebuilding. Copied only the fixed file via `scp`, verified MD5 match, validated Compose config, then rebuilt/restarted only the `taxap-app` service with the existing SQL-login Compose overlay. All four containers (app, router, signin, proxy) came up clean with no restart loops; no other service, SQL setting, or A+ write path was touched.

Reran the full shared batch (`/api/official/findings`) from inside the container over loopback: **`failedStates` is now empty — all 47 wired states succeeded**, up from the prior 45/47 (LA and ID had failed). 328 aggregate findings returned, no customer/address data inspected. LA: 222 active ship-tos, 5 compared, 217 unchecked — consistent with the still-open LA000 statewide-catch-all business decision in `docs/pending-business-decisions.md`, not a fetch problem. ID: 98 active ship-tos, 58 compared, 40 unchecked — consistent with its documented undefined-`ID000`/resort-city scope gap, also a business decision, not a fetch problem. Neither state's remaining unchecked/uncompared counts are resolved by this fix; only the underlying official-source connectivity failure is.

The host checkout otherwise remains on its prior manually-deployed baseline (526fc4c plus its existing untracked SQL-login/sign-in modifications) — this deployment did not pull, reset, or otherwise sync the host to `main`; it applied only the one already-verified file.

## Louisiana official-source TLS fix committed and pushed (September 15)

Diagnosed the `UNABLE_TO_VERIFY_LEAF_SIGNATURE` failure fetching `https://remotesellersfiling.la.gov/lookup/lookup.aspx` down to its actual cause: direct `openssl s_client` inspection confirmed the server sends only its leaf certificate and omits its GoDaddy intermediate ("Go Daddy Secure Certificate Authority - G2") from the TLS handshake. That intermediate chains to "Go Daddy Root Certificate Authority - G2," already trusted by both Node's default and the OS's system CA stores, so this was a server-side chain gap rather than a missing root or a container/CA-store problem.

Fix (`server/la-rates.mjs` only): embedded that one publicly published intermediate certificate as a constant and added it to the existing `enableSystemCertificateAuthorities()` CA list alongside the default/system sets. This restores full chain validation rather than disabling it — a certificate that does not chain to this intermediate (or another trusted path) still fails. No SQL, A+, or other-state TLS handling was touched.

Verified against live sources (not fixtures): the Louisiana adapter now succeeds end-to-end — 64 parishes, 438 domicile rate rows (56 counties/155 cities/227 special), current as-of date 2026-09-01. Idaho's live official-source fetch was independently re-verified successful, confirming no regression there. Full validation passed: production build, all 265 tests, ESLint, `npx tsc --noEmit`, and `git diff --check`.

User authorized commit and push; delivered as commit `a4d0056` on `main` (`9aac563..a4d0056`, fast-forward). This does not update the apdock01 host checkout/deployment, which remains on its own manually-deployed state per the sections below.

The full comparison batch has not been rerun since this fix; the last known batch result (45/47 successful, ID/LA failed) is superseded for the LA/ID individual-source checks above but not yet re-confirmed at the batch level.

## Source-control delivery (September 15)

User authorized committing and pushing all outstanding changes, including SQL-login support, direct routing, driver isolation, tests, secrets build exclusions and Claude startup documentation. These are included in this delivery commit. Final production build and all 265 tests passed; lint and TypeScript checks passed. Earlier uncommitted-local-work descriptions are historical after this delivery. Host checkout still contains manually deployed runtime modifications beyond its 526fc4c Git baseline; this source-control operation does not pull, reset or redeploy the server.

## Latest source-failure diagnosis and Claude transition (September 15)

After the deployment batch reported ID/LA failures, isolated checks from the running application container showed Idaho's official rules, geography and full A+ comparison all succeeded on retry. The earlier Idaho failure appears transient, but its exact cause was not retained. Louisiana reproducibly fails fetching `https://remotesellersfiling.la.gov/lookup/lookup.aspx` with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; its revenue.louisiana.gov state-rate page returns 200. This is official-source HTTPS trust, separate from the successful SQL03 connection and its approved trustServerCertificate exception. No blanket HTTPS bypass has been added. No subsequent full-batch success is claimed.

User requested a Claude context package. `CLAUDE-START.md` provides harness setup and a dated operational snapshot; this HANDOFF remains the sole ongoing shared handoff. No commit or push authorized for this documentation task. Preserve uncommitted local changes and server-side deployment differences.

## Hosted SQL connection deployed (September 15, supersedes prior connectivity status)

User explicitly authorized deployment. Deployed the uncommitted SQL-login changes by copying selected source/config files to apdock01; Git remains at 526fc4c with host modifications. No commit/push/reset performed. Saved rollback image `taxap-rollback:before-sql`, deployment archive and SQLite backup under `/var/atlanticapps/taxap-backups/sql-*`. Preserve local and host uncommitted work.

Host uses SQL login against SQL03/DWStage, protected password mount, `TAXAP_SQL_QUERY_ROUTE=direct`, and Jeff-approved `TAXAP_SQL_TRUST_SERVER_CERTIFICATE=true`; encryption stays enabled. Direct routing removes the outer SQL03 OPENQUERY hop while preserving APLUSV8FAQ.XATXBD queries. Fixed a discovered node-mssql shared-driver problem: eager loading of msnodesqlv8 replaced Tedious request constructors and stalled SQL-login queries. Windows driver now loads only in Windows mode. A regression test verifies connector loading retains Tedious request handling.

Verified actual deployed connector responses at 2026-09-15T13:05Z: fresh tax-body query returned 100 standard NC rows; state coverage returned 51 jurisdictions; tax-treatment summary succeeded. This is evidence of functioning hosted database reads, superseding snapshot-only status for these verified paths. The all-state batch returned 200 with 45 successful checks, 328 findings, failedStates ID and LA. Those comparison failures remain unresolved; no claim of complete comparison coverage. Review database integrity passed. Public root returns 302 to sign-in and anonymous API 401; all four containers run without restarts. Temporary auth diagnostics removed now that user reported successful sign-in. Transient 502 during sign-in restart cleared on recheck.

Production build, 264 tests, lint and TypeScript passed after driver fix; added driver regression then passed with routing test separately (265 total defined tests). Both server builds succeeded. SQL-login override must be included in all future deployments. User should refresh the signed-in app to verify its presentation; no browser session was impersonated. Read-only SQL only; no A+ writes.

## Dedicated SQL login support prepared (September 14)

September 15: user authorized Jeff's certificate-trust option. Added explicit `TAXAP_SQL_TRUST_SERVER_CERTIFICATE` boolean (default false; invalid values rejected) to SQL-login mode, with encryption always enabled. Saved the opt-in in the protected host .env. A disposable app-image container on the application network successfully authenticated to SQL03/DWStage with the protected password and performed minimal SELECT checks on dbo.ADDR, dbo.CUSMS and APLUSV8FAQ.XATXBD via OPENQUERY(APLUS). No credentials/customer data were displayed and no writes were executed. This supersedes the earlier TLS blocker. Running app remains unchanged: SQL-login code is not deployed, and its direct SQL03 routing still needs implementation because non-Windows modes currently add an outer SQL03 linked-server hop. Complete that reviewed routing change and deployment before calling the hosted application connected. The proposed XATXBD DWStage sync is not required for the verified linked-server path and remains unconfirmed.

Jeff subsequently supplied a dedicated SQL login and reported grants for ADDR/CUSMS; XATXBD linked-server access still requires testing, and a possible DWStage sync is only proposed. User provisioned the SQL password on apdock01. Verified the file is nonempty, UID 1000, mode 0600, and host TCP connectivity to SQL03:1433 works. A disposable container using the current app image/network attempted an encrypted, certificate-validating connection to SQL03/DWStage with the protected password mount. It stopped at TLS with ESOCKET/self-signed certificate, before authentication or SELECT tests. No password or customer data was displayed. IT must provide an approved SQL server certificate/trust chain (and matching server name) before continuing; do not claim the credentials, table grants or linked-server query have been validated. No running app configuration or containers were changed and SQL-login code remains undeployed.

User confirmed successful browser sign-in, then requested hosted A+ configuration. Jeff clarified that IT generally uses SQL accounts or managed identities rather than certificate identities. The hosted container was checked: SQL server/database are set, but workload tenant/client/certificate settings are absent. No current hosted A+ connection has been validated.

After explaining the authentication-only change and consulting aplus-erp, added `sql` authentication via `server/sql-login.mjs`, using a protected password file, TLS encryption and server certificate validation. Existing Windows/Entra modes and all queries/routing remain unchanged. Connection failures do not expose raw driver errors. Added optional `docker-compose.sql-login.yml`, environment examples and deployment instructions. The password is mounted only in the application, whose UID differs from OAuth2 Proxy. IT must provision a dedicated login and confirm endpoint/permissions; direct SQL03 routing is not silently enabled by SQL authentication.

Production build, 263 tests, lint, TypeScript and diff checks passed. Synthetic Compose validation confirmed SQL mode/password-file mount and ingress-only publication (used `--no-env-resolution` because no local deployment .env exists). No real SQL-login connection, commit, push or deployment performed. Preserve all existing uncommitted changes. The earlier host-only diagnostic logging remains to be removed after successful-login follow-up; user success is reported, not independently exercised by the agent.

## Entra sign-in deployed (September 14)

Follow-up: real browser login still returns generic 403 after Jeff changed Entra settings. Exact cause is not yet established; do not claim a missing group claim is confirmed. Verified configured group ID matches Jeff's supplied ID. Temporarily enabled host-only authentication logging in `deployment/apdock01/oauth2-proxy.cfg` with a custom template that emits only status and fixed categories (`authorization-denied`, `csrf-mismatch`, `other-auth-event`), never the raw message, user identity, token or callback URL. Restarted only sign-in; root still returns 302 and anonymous API 401. Await fresh user login to classify denial. Preserve this extra host modification; remove temporary diagnostics after resolution. Local committed configuration still has authentication logging disabled.

The subsequent fresh attempts produced `AuthFailure authorization-denied` with no log-template errors. In v7.15.4 this callback branch follows successful code redemption and session/CSRF validation, but combines email-validator and provider-authorization results. It does not prove the group claim alone is missing: the email validator rejects an empty email even with wildcard email domains. Jeff should verify the ID token includes both a nonempty email claim and the allowed group Object ID (not only a group name or an access-token claim). No tokens were captured or displayed, and access restrictions remain intact.

After the user provisioned the client-secret file and authorized continuing, deployed commit 526fc4c to apdock01 with the local `.dockerignore` secrets-directory exclusion fix applied on the host before building. Both sign-in secret files were verified nonempty, mode 0600 and owned by UID 65532 without displaying contents. No commit or push was performed; `.dockerignore` and this handoff remain local changes, and the host also retains its `.dockerignore` change and untracked secrets directory.

Preserved old deployment configuration and the previous app image (`taxap-rollback:before-signin`), and created a protected, integrity-checked SQLite review backup under `/var/atlanticapps/taxap-backups/signin-*`. Compose configuration and the production image build succeeded. App, internal router, OAuth2 Proxy and HTTPS ingress are running without restarts; only ingress publishes host port 5017. Existing review volume and SQL settings were preserved.

Verified with HTTPS certificate validation: application root returns 302 to Microsoft's tenant authorization endpoint, callback is exactly `https://apdock01.atlanticpkg.com:5017/oauth2/callback`, PKCE is S256, anonymous and forged-identity API requests return 401, incorrect Host returns 421, and CSRF cookies have Secure/HttpOnly/SameSite=Lax flags. Direct invalid callback requests return 500 without granting access; use the application root to begin sign-in. Both deployed Nginx configurations pass syntax checks and the deployed review database passes integrity checks. Two local sign-in deployment tests and diff checks passed.

Actual user login is still pending: successful token exchange, app registration redirect matching, TaxAP-Users group claims and permitted-user access must be verified in the user's browser. Only Lukas is currently in the group. Hosted A+ remains snapshot/fallback pending separate SQL workload validation. The preflight and prepared-only sections below describe earlier stages, superseded by this section.

## Hosted sign-in deployment preflight (September 14)

### Resumed after Jeff supplied the access group

The user authorized proceeding. Configured the confirmed sign-in tenant/client IDs, TaxAP-Users group Object ID and secret-file paths in the protected host deployment environment, preserving a restricted backup of the original environment. Kept the existing canonical origin `https://apdock01.atlanticpkg.com:5017`. Pulled OAuth2 Proxy v7.15.4 and verified its image user is 65532; generated a 32-byte cookie key without displaying it, mode 0600 and owned by that container user. The client-secret file is still absent and must be provisioned securely on the host before startup. No containers were replaced and no source pull was performed; hosted checkout remains b54b7ed. Real Entra login and group-claim validation remain untested. Only Lukas currently belongs to TaxAP-Users.

Added root and nested secrets-directory exclusions to the local `.dockerignore` because the existing host secrets directory otherwise enters Docker's build context. This fix must accompany deployment before any build. It is uncommitted; preserve it along with this handoff. User sign-in deployment is now authorized; hosted SQL workload validation remains deferred and data remains snapshot/fallback.

The user authorized deploying the sign-in proxy. SSH access to apdock01 succeeded. The hosted checkout is still at b54b7ed; both existing TaxAP app and proxy containers were running. The deployment .env exists, but TAXAP_SIGNIN_TENANT_ID, TAXAP_SIGNIN_CLIENT_ID, TAXAP_SIGNIN_GROUP_ID and both sign-in secret-file settings/files are absent. The new Compose configuration cannot start without these required values. No pull, container replacement, configuration change or deployment was performed; existing host secrets and running services were preserved. Obtain the sign-in registration/group IDs and securely provision the client credential and cookie key before resuming. Jeff can register the callback URL before it is active.

## Entra sign-in proxy prepared (September 14)

- User authorized adding the sign-in proxy and callback route. Docker Compose now defines OAuth2 Proxy v7.15.4 and an internal router; only HTTPS Nginx is published. All application/API traffic passes through authentication. `/oauth2/callback` is handled by the proxy; the configured callback is `https://apdock01.atlanticpkg.com:5017/oauth2/callback`.
- Single-tenant issuer validation, mandatory access-group setting, PKCE, secure HTTP-only cookies and 401 responses for anonymous API calls are configured. Host-header checks and stripped forwarding/identity headers prevent public routing around the gate. Callback access logging and token forwarding are disabled; upstream timeouts accommodate the all-state batch.
- User sign-in IDs/credential and cookie encryption key remain to be supplied securely. No real credentials were created or exposed. Missing required Compose settings stop configuration resolution. Hosted SQL's certificate-based workload identity is unchanged and still separate.
- This configuration is not deployed. Actual Atlantic Entra login, Linux-container startup, network reachability and group claims remain acceptance gates. Authenticated audit attribution is not implemented; existing reviewer selection remains manual.
- Verification: production build and all 262 application tests passed; two opt-in integration tests passed against OAuth2 Proxy v7.15.4 and Compose configuration. Covered anonymous API rejection, forged identity headers, invalid callback state, wrong tenant/group rejection, approved session access and sign-out cookie clearing. Lint, TypeScript, Nginx syntax validation and diff checks passed. User authorized committing and pushing all changes; no deployment authorized or performed.
- Local Docker Desktop startup failed in its inference manager, producing the user's screenshot. No reset or Docker repair was performed. Validation continued using the official checksum-verified OAuth2 Proxy Windows binary, synthetic OIDC credentials and Windows Nginx syntax checks. See deployment/apdock01/README.md for Jeff's settings and release checks.

## Unified comparison batch (September 14)

- NC and GA now participate in `/api/official/findings` with the other wired readers. The response includes their existing `nc` county/future-change and `ga` boundary payloads alongside the generic findings and shared `stateChecks`/`failedStates` lists. The UI adapts each payload once; no duplicate findings are introduced.
- Replaced three dashboard comparison refresh callbacks/timers with one. Assignment inventory and tax-treatment context refresh alongside the batch. On-demand state detail endpoints remain available; SQL, ERP field interpretation and rate/boundary matching rules are unchanged.
- Removed separate NC/GA ready/completed labels. Coverage uses one batch timestamp, consistent state-success counts and a single failed-state list. NC/GA failures omit their refreshed inbox findings without discarding other states; a whole-batch failure retains earlier results with an explicit warning.
- NC coverage counts use current aggregate assignments and validated county rates. GA verified comparison counts exclude unresolved addresses, missing rates and inconsistent jurisdiction groups. Neither reader success nor a zero discrepancy count implies full assignment coverage.
- Local endpoint verification after restarting the preview: HTTP 200, all 47 wired states succeeded, zero failed states, and NC/GA each appeared exactly once with their required payloads.
- Production build, all 260 tests, ESLint and TypeScript checks passed. New tests cover all 47 wired entries exactly once and NC/GA/other-state failure isolation. The user authorized commit and push on September 14; this delivery commit includes the unified batch changes. No deployment or A+ writes performed.

## State wiring completed within the confirmed business scope

- Official-source registry: all 50 states plus D.C., with 47 connected adapters and four no-general-sales-tax classifications (DE, MT, NH, OR).
- A+ handling: 43 jurisdictions have rate-comparison readers (42 states plus D.C.); AK, HI, ND and WY have explicit deliberate no-tax policies. Together with DE/MT/NH/OR, all 51 registry entries are accounted for. This is not a claim that every assignment or physical jurisdiction is matched.
- User confirmed on September 10 that the existing AK/HI/ND/WY assignments are deliberate no-tax treatment. Only AK000, HI000, ND000, WY000 and Wyoming ZTEMP qualify, with configured definitions and zero rates. New/nonzero/missing/retired codes remain unresolved. Policies are not official 0% matches.
- User chose sales tax only for the Iowa/Vermont scope decision. VT/IA/ID/LA readers and shared inbox/drawer preserve explicit sales-tax labels.
- Commit 62bf5a4 contains the earlier 18-jurisdiction expansion and was pushed to main at the user's request. The user authorized commit and push on September 10. The VT/IA/ID/LA readers, four no-tax policies, stakeholder-readiness work and associated tests/docs are included in this delivery commit. Deployment remains deferred; verify Git history and remote tracking for delivery status.

## Latest implementation and verification

- Vermont: official municipality map plus effective-dated sales-tax list/SST validation. 256 areas, 36 active local-sales areas. Aggregate: 48 assignments, 28 compared, 11 groups, two differences, 20 unmatched. Future Peru and rescinded Montgomery rates are handled explicitly.
- Iowa: current DOR LOST workbook, state-rate guide and Census county inventory. 1,136 records across 99 counties. Compare county labels only when every city/unincorporated area has one rate; exact cities preserve multi-county conflicts. Aggregate: 270 assignments, 102 compared, 29 groups, no differences, 167 unmatched, one cross-state.
- Idaho: Tax Commission GIS has 200 city records (198 names) and 44 counties. All geometry parts for 23 resort cities are intersected with public counties; 14 counties remain unresolved. Aggregate: 98 assignments, 58 compared, 13 groups, no differences, 39 unmatched, one cross-state. No customer geometry is sent.
- Louisiana: retains all 64 parish contexts. Parish labels require uniform rates across all domicile rows; unique exact city/district names are supported. Aggregate: 220 assignments, one St. Bernard assignment compared with no difference, 217 unmatched, two cross-state. Most Louisiana assignments still lack a usable domicile.
- No-tax policy connector checks: AK 8, HI 26, ND 33, WY 22; all 89 classified as deliberate no-tax, zero compared and zero unresolved in this snapshot.
- Independent inventory audit: 51 registry entries = 43 comparison jurisdictions + four deliberate no-tax policies + four no-general-sales-tax states; no missing backend/UI wiring or duplicate classification.
- Production build, ESLint and 250 tests passed. Tests include official-source validity, ambiguity, effective dates, all parts of resort-city geometry, connector policy registration and changed-policy inputs. Existing read-only aggregate SQL was used without changes. No A+ writes occurred.

## Stakeholder-readiness application work (September 10)

- Added multistate review forms, source links, saved statuses and event history. Review history includes open and closed records. Rate-pair changes create separate review keys, including NC; old records remain preserved. Remaining differences stay visible after a human decision.
- Added optimistic concurrency protection for UI saves. A conflicting save refreshes review history and returns HTTP 409. Manual reviewer selection remains explicitly unauthenticated.
- Dashboard and review views expose failed/incomplete checks, batch/GA timestamps and unchecked/excluded counts per other-batch state. Counts derive from actual numeric matches rather than legacy comparable-row totals. Deliberate no-tax counts remain separate. Refresh now includes every findings path and review history. GA/batch requests have bounded client waits.
- Removed automatic database seeding; preserved and labeled existing imported Mecklenburg history and the documented aggregate historical evidence. Earlier wording calling it fictional was incorrect.
- Added a consistent SQLite backup utility with integrity checks, refusal to overwrite, and a tested restore/reopen path. See docs/stakeholder-pilot.md for acceptance scenarios, backup/restore guidance and rollout gates.
- Fixed two existing standalone type-check issues (TypeScript extension imports and the preview worker asset-binding type); runtime hosting behavior is unchanged.
- Final independent verification: production build and all 256 tests passed; ESLint, `npx tsc --noEmit`, and `git diff --check` passed. Added tests cover changed-rate review identity, multistate reopen/backup recovery, concurrent saves including HTTP 409, honest coverage counts and preservation of legacy imported history. No browser or stakeholder acceptance session was performed.
- No A+ SQL, field interpretation, rate-matching behavior or hosted Entra configuration changed in this readiness work. The user subsequently authorized committing and pushing this work together with the preserved state wiring. No deployment was performed.

## Local New York runtime fix (September 10)

The local preview lacked `pdftotext` and a configured Python PDF fallback, causing NY to fail the findings batch. Set `TAXAP_PYTHON_PATH` in ignored `.env.local` to the available bundled Python with pdfplumber, preserving other settings. Direct read-only verification succeeded: 671 active NY assignments, 667 in candidate groups, two differences. After restart, the full findings endpoint returned no failed states. Its stricter coverage summary confirms 591 actual numeric comparisons and 80 unchecked/excluded NY assignments; 667 is not a completed-comparison count. No parser, rate, SQL or ERP behavior changed. Docker already includes poppler-utils; this local fix does not validate hosted connectivity. README and .env.example document setup without committing a machine-specific path.

## Application work still open

State wiring is complete under the user's confirmed policy; application acceptance and complete assignment matching are not. Improve unmatched coverage and complete stakeholder acceptance. Multistate review controls and explicit source-failure/coverage reporting are now implemented. Do not infer exemptions, tax liability or delivery boundaries. Preserve official evidence and keep discrepancies for human review only.

Hosted Docker A+ data remains snapshot/fallback until workload identity, certificate, SQL permissions and network access are validated end to end. Hosted Entra setup remains deferred. User authentication is separate. See docs/comparison-rollout.md and state notes for detailed scopes and sources.

## Historical notes (through September 4; verify against current code)

**This is the single shared handoff doc for this project, regardless of which AI coding assistant you're using (Claude Code or ChatGPT/Codex).** Update it at the end of every session — whichever assistant you used — so the next session (with either tool) starts from the same accurate picture. Don't keep a separate per-assistant copy; this file replaces the earlier split between `CLAUDE-HANDOFF.md` (Claude-side) and `HANDOFF.md` (ChatGPT-side).

## Objective

TaxAP is an Atlantic Packaging internal application for monitoring sales and use tax rates assigned to customer ship-to addresses in Infor Distribution A+.

The intended workflow is:

1. Read active ship-to tax-body assignments and configured rates from A+.
2. Read current and announced rates from official state tax authorities or an authoritative machine-readable source.
3. Compare the official jurisdiction rate with the A+ tax-body rate.
4. Flag differences for Ana or Liv to review.
5. Record review decisions and audit history in TaxAP.
6. Keep A+ maintenance manual through the supported A+ GUI unless a separately approved automation phase is added later.

Do not treat this application as a tax calculation engine yet. It is currently a read-only monitoring and evidence tool.

## User decisions and constraints

- Ana and Liv will be the primary users.
- Microsoft Entra ID sign-in will be added later using their Microsoft 365 work accounts.
- The owner-only private preview is hosted through Sites. Shared access, Entra ID authentication, production connectivity, and Azure resources remain deferred. Source control is the private `LukasNAP/TaxAP` GitHub repository.
- TaxAP must never guess an official rate when a source is unavailable, incomplete, ambiguous, or fails validation.
- TaxAP must not write to A+ in the current phase.
- Customer names, addresses, invoice details, credentials, and tokens must not be sent to the browser.
- Review decisions belong to TaxAP, not A+.
- Do not commit, push, deploy, reset, stash, or discard existing work unless Lukas explicitly asks.
- The dashboard redesign and nationwide-source milestone are committed on `main`.

## Current verified state

- Local app preview: `http://localhost:3000`
- Owner-only hosted preview (OpenAI Sites): `https://taxap-atlantic.atlantic-pac-7667.chatgpt.site` — access is owner-only for Lukas; hosting metadata lives in `.openai/hosting.json`.
- The hosted preview is offline-only, using the validated built-in aggregate snapshot: it cannot contact A+, DWStage, SQL03, or APLUS; cannot call live `/api/aplus/*` routes; cannot persist shared Ana/Liv review decisions; and cannot authenticate Ana/Liv through Microsoft Entra ID. Do not describe hosted-preview data as a current live check.
- Local preview was started with `NEXT_PUBLIC_TAXAP_OFFLINE_MODE=true` and `npm run dev:web` for production-safe UI work.
- The read-only connector is intentionally not started outside an explicitly approved, supervised live-validation step (see "User decisions and constraints" above).
- Production build passes.
- ESLint passes.
- `git diff --check` passes; Git may emit expected LF-to-CRLF warnings on Windows.
- Test suite: 130 passing tests as of 2026-09-04 (grows most sessions — check `npm test` output rather than trusting this number for long).
- Work through 2026-08-26 is committed and pushed to the private GitHub repository (`LukasNAP/TaxAP`, `main`). No deployment, A+ write, or external account change has been performed.

Live results verified on August 18, 2026 (still the most recent live A+ check as of 2026-08-26 — re-verify before trusting these numbers if much time has passed):

- 51 state/DC codes have active A+ ship-to coverage.
- North Carolina: 5,516 active ship-tos and 100 validated official county rates.
- Georgia: 2,401 active ship-tos and 170 validated official rate records.
- Georgia official records contain one state rate, 159 county components, six city components, and four special-jurisdiction components.
- Georgia state rate: 4%.
- North Carolina A+ versus NCDOR: zero current differences.
- Recent verified NC case: Mecklenburg changed from 7.25% to 8.25% effective July 1, 2026; A+ now matches. Re-confirmed live again on 2026-08-25 with the same result.
- Retired definitions such as `DO NOT USE`, `INACTIVE`, `OBSOLETE`, `NCUSE`, and `NC060XXX` are suppressed.

### Tax-treatment monitoring context (added 2026-08-27)

- The dashboard now loads an aggregate-only A+ tax-treatment summary through `GET/POST /api/aplus/tax-treatment`. The connector groups active ship-tos by `ADDR.SATXCD`, never returns customer, ship-to, address, order, or invoice rows, and remains read-only.
- Confirmed treatment handling: `0` (always taxable) is included in rate-comparison impact; `3` (never taxed) is treated as intentional exempt activity and excluded from rate-risk impact; `J` is mixed and requires line-level review, so TaxAP makes no header-level rate conclusion.
- `ZTEMP` is surfaced as a visible configuration exception rather than an automatic rate mismatch. The alert shows only aggregate assignment counts and its configured A+ rate. It needs owner confirmation before any follow-up; TaxAP does not modify A+.

South Carolina, added 2026-08-26 (`server/sc-rates.mjs`): official ST-575 rate table is parsed and validated (46/46 counties, 294 municipalities, 340 total rows) by shelling out to `pdftotext -table` (poppler-utils) rather than hand-rolling a PDF parser — **this is the one adapter with a runtime dependency on a system binary, not just npm packages; the connector's host needs poppler-utils installed or `/api/official/states/SC` returns 503.** A+ tax-body matching for SC is not yet built. Full findings: `references/states/sc.md` in the local `taxap-dev` Claude Code skill (see "Where deeper research findings live" below — this is outside the repo, Claude-only today).

Illinois, added 2026-08-31 (`server/il-rates.mjs`): the IDOR fixed-width county/municipality file is live-validated and exposes 1,343 jurisdiction-wide standard-merchandise rates across all 102 counties. The 200 address-override locations are excluded rather than guessed, because IDOR requires its separate address-level source for them. An aggregate-only A+ inventory found 895 active ship-tos across 161 tax-body groups; its mostly location-ID-shaped codes need a strict, fixture-tested matcher before any rate comparison. See `docs/states/il.md`.

Iowa, added 2026-08-31 (`server/sst-rates.mjs`): the latest published SST file validates 99 real county components, 1,013 city components, and 101 special components against Iowa's 6% state rate; the non-county `199` source row is never counted as a 100th county. Aggregate A+ inventory found 268 active ship-tos across 53 tax-body groups, but internal `IAxxx` codes do not map deterministically to FIPS/city identifiers. No comparison is built; see `docs/states/ia.md`.

Kansas, added 2026-08-31 (`server/sst-rates.mjs`): the current Kansas SST file validates a 6.5% state component plus 105 county, 628 city, and 1,412 special-jurisdiction components. Alphanumeric special IDs (for example `11KAN`) are preserved as opaque special components rather than rejected or misclassified. Aggregate A+ inventory found 267 active ship-tos across 57 tax-body groups, but the A+ IDs do not deterministically map to the official county, place, or special IDs. No comparison is built; see `docs/states/ks.md`.

Minnesota, added 2026-09-02 (`server/sst-rates.mjs`): the current Minnesota SST file validates the 6.875% state component plus 62 active county, 63 city, and 11 special-jurisdiction components. Only counties with an active local component appear; TaxAP does not model all 87 counties as taxable local rows. Aggregate A+ inventory found 387 active ship-tos across 55 tax-body groups; `MN000` accounts for 106 ship-tos and has no configured definition, while four assignments use cross-state tax bodies. No comparison is built because Minnesota's layered local taxes require a validated address/boundary mapping; see `docs/states/mn.md`.

North Dakota, added 2026-09-02 (`server/sst-rates.mjs`): the current SST file validates North Dakota's 5% state component, all 53 county components, and 352 city components. The source resolver was hardened to match the actual state-prefixed filename, preventing `ND` from accidentally selecting Wyoming through path text. Aggregate A+ inventory found 32 active ship-tos, all on `ND000` at 0%; this is treated as an unresolved statewide setup decision, not a normal rate match. Local maximum-tax/refund caps also remain outside the percentage-only model; see `docs/states/nd.md`.

Nebraska, added 2026-09-02 (`server/sst-rates.mjs`): the current SST file validates Nebraska's 5.5% state component, 270 active city components, five special components, and the one active county component (Dakota County). Aggregate A+ inventory found 115 active ship-tos across 23 groups; `NE000` has no configured definition and covers 21. No comparison is built because Dakota County's tax excludes municipalities imposing their own local tax and the special layers need explicit reconciliation; see `docs/states/ne.md`.

Nevada, added 2026-09-02 (`server/sst-rates.mjs`): the current SST file uses a Nevada-specific combined-total convention—a 0% source state row plus all 17 county/equivalent totals and nine special-jurisdiction totals. TaxAP validates that convention, exposes Nevada's independently verified 6.85% minimum statewide rate, and never adds that base to an already-combined county total. Aggregate A+ inventory found 273 active ship-tos across 14 groups; 11 configured Nevada county codes align by label/rate, `NV000` is undefined for eight ship-tos, and three assignments use out-of-state tax bodies. No number-only comparison is built because A+ uses internal ordinal identifiers rather than county FIPS; see `docs/states/nv.md`.

Oklahoma, added 2026-09-02 (`server/sst-rates.mjs`): the current SST file validates Oklahoma's 4.5% state component, all 77 county components, 798 municipality rows, and 744 special/combined local identifiers. Explicit active zero-rate municipality rows are preserved. Aggregate A+ inventory found 272 active ship-tos across 61 groups; `OK000` is undefined for two. No comparison is built because Oklahoma totals depend on overlapping delivery-location layers and A+ COPO-like identifiers do not directly equal SST/Census identifiers; see `docs/states/ok.md`.

South Dakota, added 2026-09-02 (`server/sst-rates.mjs`): the current SST file validates South Dakota's 4.2% state rate, all 66 zero-component county rows, 254 municipality components, and six tribal/special type-49 records. The special rows remain visible without additive totals because the 4.2% special-jurisdiction tax replaces ordinary state reporting. Aggregate A+ inventory found 42 active ship-tos across 13 configured groups; `SD000` is 0% for nine, while a separate no-local code correctly carries 4.2%. No comparison is built pending municipality and tribal-boundary reconciliation; see `docs/states/sd.md`.

Utah, added 2026-09-02 (`server/sst-rates.mjs`): the current SST file validates Utah's 4.85% general state component, all 29 county components, and 181 city components; the separate 3% food rate remains source evidence rather than being applied to general merchandise. Aggregate A+ inventory found 221 active ship-tos across 45 groups; `UT000` is undefined for 37. No comparison is built because Utah requires buyer-receipt ZIP+4/boundary sourcing and A+ location codes do not directly equal SST/Census identifiers; see `docs/states/ut.md`.

Vermont, added 2026-09-02 (`server/sst-rates.mjs`): the current SST file validates Vermont's 6% state rate plus 36 municipality local-option components at 1% each. The shared adapter now uses an explicit `flatStatewideRate` invariant, so Vermont's zero county rows can never be mistaken for “no local tax.” Aggregate A+ inventory found 47 active ship-tos across 17 groups; `VT000` is undefined for nine, and a county-labelled 7% group needs business mapping because Vermont's local option is municipal. No comparison is built pending destination and sales-versus-use reconciliation; see `docs/states/vt.md`.

Washington, added 2026-09-02 (`server/sst-rates.mjs`): the current SST file validates Washington's 6.5% state component, all 39 real county rows, 277 city rows, 1,153 special/location-code rows, and five non-Census county-type identifiers reclassified as special rather than inventing counties. Aggregate A+ inventory found 469 active ship-tos across 62 groups; `WA000` and `WA3500` are undefined for 32 combined. Configured A+ four-digit codes visibly align with sampled SST `L####` location identifiers, but no comparison is claimed until every active mapping and delivery address is reconciled; see `docs/states/wa.md`.

Wisconsin, added 2026-09-02 (`server/sst-rates.mjs`): the current SST file validates Wisconsin's 5% state component, all 72 county components, and 1,851 municipality rows including explicit zeros. Aggregate A+ inventory found 425 active ship-tos across 51 groups; `WI000` is undefined for 42 and one assignment uses an NC tax body. The active 5.9% Milwaukee County group covers 47 ship-tos, but no 7.9% City of Milwaukee group appeared; address reconciliation is required before concluding those are correct. Premier-resort and local-exposition taxes are outside the SST file; see `docs/states/wi.md`.

West Virginia, added 2026-09-02 (`server/sst-rates.mjs`): the current SST file validates West Virginia's 6% state component plus 101 active municipality components at 1%; zero county rows are explicitly treated as a municipal model, not a flat state. Aggregate A+ inventory found 112 active ship-tos across 30 groups; `WV000` is undefined for 21, `WV0100` is a legitimate 6% no-local group for 23, and `WV961` is labelled “Missouri Lewisburg” for one. No comparison is built pending municipality boundary mapping and exception review; see `docs/states/wv.md`.

Virginia, added 2026-09-02 (`server/va-rates.mjs`): the current Virginia Tax workbook is downloaded and validated as 95 counties plus 38 independent cities, all keyed by official FIPS and reconciled across the 4.3% state, regional, mandatory 1% local, and additional-local components. The official server reports the workbook was updated 2026-01-09, resolving the old 2023 freshness concern. A read-only aggregate A+ audit found 830 active Virginia ship-tos across 107 groups: 106 VA-prefixed groups cover 829 and one `NC092` assignment covers one. Of the VA groups, 104 matched current names/rates after reviewed normalization; `VA071` Pittsylvania County is 5.30% in A+ versus 6.30% officially for seven ship-tos, and retired `VA240` Bedford City is used by one. Official inventory is connected; automatic A+ comparison remains pending those decisions. See `docs/states/va.md`.

Connecticut, added 2026-09-02 (`server/ct-rates.mjs`): the current DRS page is fetched and validated for both the 6.35% general retail rate and its explicit no-additional-local-sales-tax rule. The aggregate A+ audit found 181 active ship-tos and 75 customer assignments, all on the single `CT000` group at 6.35%. This is an exact general-rate match and requires no address boundary layer; special product/service rates remain outside the general comparison. See `docs/states/ct.md`.

Maine, added 2026-09-02 (`server/me-rates.mjs`): the current MRS rate table is fetched and anchored to its January 1, 2026 column, validating matching 5.5% general sales and use-tax rates. The aggregate A+ audit found 76 active ship-tos and 31 customer assignments, all on `ME000` at 5.50%. This is an exact general-rate match; special categories remain outside the comparison. See `docs/states/me.md`.

Massachusetts, added 2026-09-03 (`server/ma-rates.mjs`): the current DOR guide (updated 2026-05-07) is fetched and validated for matching 6.25% sales and use-tax rates on tangible personal property. The aggregate A+ audit found 344 active ship-tos and 123 customer assignments: `MA000` matches 6.25% for 343, while one uses Nevada code `NV002` and remains visibly cross-state/excluded. Category-specific local options remain outside the general comparison. See `docs/states/ma.md`.

District of Columbia, added 2026-09-03 (`server/dc-rates.mjs`): the live OTR notice is fetched and validates the full enacted schedule—6% through 2026-09-30, then 7% beginning 2026-10-01. The future change is visible in the generic official-source panel and the adapter rolls forward automatically. A read-only aggregate A+ audit found 21 active D.C. ship-tos: 20 on `DC000` at 0% and one on Honduras no-tax code `HN000`; no 7% future rate is scheduled. This is documented for tax-owner review, not changed automatically. See `docs/states/dc.md`.

Mississippi, added 2026-09-03 (`server/ms-rates.mjs`): three live DOR pages validate the 7% general tangible-property rate, Jackson's additional 1% general-retail levy, and Tupelo's additional 0.25% levy. The aggregate A+ audit found 271 active ship-tos: 268 use `MS000` at the correct 7% statewide base and three use unrelated country/Missouri codes. No active Mississippi-specific Jackson/Tupelo code appeared, so city-boundary completeness remains open rather than being guessed. See `docs/states/ms.md`.

Idaho, added 2026-09-03 (`server/id-rates.mjs`): current Tax Commission pages validate matching 6% state sales/use rates and an official inventory of 23 resort cities with separately administered local-option taxes. Because Idaho directs taxpayers to each city rather than publishing central local rates, TaxAP exposes that limitation and never guesses local totals. The aggregate A+ audit found 98 active ship-tos: 85 use configured Idaho groups at 6%, 12 use undefined `ID000`, and one uses Minnesota code `MN430`. See `docs/states/id.md`.

Hawaii, added 2026-09-03 (`server/hi-rates.mjs`): three live DOTAX pages validate the seller-side GET model, 4% base, four 0.5% county surcharges through 2030, Kalawao's exemption, and the optional 4.712% maximum visible pass-on. The aggregate A+ audit found 26 active ship-tos and 11 customer assignments, all on `HI000` at 0%. Because customer pass-on is optional, TaxAP exposes the official policy evidence but intentionally does not call 0% a mismatch until Atlantic confirms its practice. See `docs/states/hi.md`.

Arizona, added 2026-09-03 (`server/az-rates.mjs`): the adapter discovers ADOR's newest all-classifications CSV and validates active retail business-code-017 rows. The September 1 file exposes 15 counties, 93 cities, and 38 tribal/special regions; city rows remain components requiring a county join. The current A+ audit found 336 ship-tos across 37 groups, including 47 on `AZ000` at 0% and two on `ZTEMP`. Four current discrepancies are documented—Douglas, Casa Grande, Taylor, and Kingman after its September 1 increase. No automatic comparison or A+ change was made. See `docs/states/az.md`.

New York, added 2026-09-03 (`server/ny-rates.mjs`): the adapter resolves the current Publication 718 PDF from NY DTF's landing page and validates all 77 rate-bearing entries—57 county-area rows, 19 city rows, and the 4% state-only row—while preserving official reporting codes and combined rates. It uses `pdftotext -layout` in deployment and supports an explicitly configured pdfplumber fallback for local Windows verification. ZIP-based jurisdiction derivation is not attempted. A+ comparison remains withheld because Suffolk and Yonkers have confirmed rate differences and several names/codes need reviewed aliases. See `docs/states/ny.md`.

Alaska, added 2026-09-03 (`server/ak-rates.mjs`): the adapter dynamically resolves ARSSTC's current non-ZIP XLSX and validates the workbook's own no-state-tax statement, as-of date, schema, 56 unique filing destinations, and borough/city/total arithmetic. The September 1 workbook exposes 10 borough-area and 46 city/taxing-area rows plus an explicit 0% state row, including current layered and seasonal totals. Coverage is deliberately labeled partial because ARSSTC includes participating remote-seller jurisdictions, not every Alaska municipality. The attempted aggregate A+ audit failed with an Entra token login error, so no A+ count or comparison is claimed. See `docs/states/ak.md`.

Alabama, Colorado, Louisiana, and New Mexico were connected during the September 3–4 nationwide-source pass; their adapters dynamically resolve and validate the current official state files or filing tables without forcing unsafe A+ matches. See `docs/states/al.md`, `docs/states/co.md`, `docs/states/la.md`, and `docs/states/nm.md` for exact source counts and remaining boundary decisions.

Missouri, added 2026-09-04 (`server/mo-rates.mjs`): the adapter dynamically selects the current quarterly DOR XLSX and validates its single worksheet, filing-code schema, 4.225% state component, unique codes, and all six published rate fields. The July–September 2026 workbook exposes 2,550 unique city/county/special-district combinations: 109 county-base, 1,538 city/county without a special suffix, and 903 special-suffix records. `/api/official/states/MO` is connected. A+ matching remains withheld because the historical 92-code catalog uses unrelated internal identifiers and Missouri requires address-specific district selection. See `docs/states/mo.md`.

## Architecture

```text
Browser on localhost:3000
  |
  | aggregate JSON only
  v
Local Node connector on 127.0.0.1:3001
  |-- Microsoft Entra ID / DefaultAzureCredential
  |-- Azure SQL DWStage
  |     |-- dbo.ADDR
  |     |-- dbo.CUSMS
  |     `-- linked SQL03 -> APLUS -> APLUSV8FAQ.XATXBD
  |-- state-specific official-source adapters (including AK, AL, AZ, CA, CO, CT, DC, FL, HI, ID, IL, LA, MA, MD, ME, MO, MS, NC, NJ, NM, NY, PA, SC, TX, VA)
  |-- Streamlined Sales Tax rate-file adapters (GA plus the connected SST states)
  |-- Census Gazetteer jurisdiction names
  `-- local SQLite review database under .data/
```

### A+ connection path

- Azure SQL database: `DWStage`
- Ship-to view: `dbo.ADDR`
- Customer view: `dbo.CUSMS`
- Tax-body master path: linked server `SQL03` -> linked server `APLUS` -> `APLUSV8FAQ.XATXBD`
- Ship-to tax body: `ADDR.SASTXB`
- State: `ADDR.SASHST`
- City: `ADDR.SASCTY`
- ZIP: `ADDR.SASZIP`
- Company-aware customer join: `CUSMS.CMCONO = ADDR.SACONO` and `CUSMS.CMCSNO = ADDR.SACSNO`
- Active filters use `ADDR.SACSUS <> 'S'` and `CUSMS.CMSUSP <> 'S'`. Never restore `SASUSP`: live data confirms that older field is 100% blank/dead.
- The browser receives aggregate counts and tax-body definitions, not customer-level records.

Consult the local `aplus-erp` skill before changing SQL or assuming A+ field semantics.

## Important files

| File | Purpose |
| --- | --- |
| `app/page.tsx` | Dashboard-first TaxAP interface, rate-change inbox, attention/upcoming/jurisdiction/history/source views, state drawers, and review workflow |
| `app/globals.css` | Atlantic-branded responsive styling |
| `app/brand-tokens.css` | Atlantic colors and typography tokens |
| `app/tax-data.ts` | Validated built-in fallback snapshot and Mecklenburg evidence |
| `app/jurisdiction-filters.ts` | Pure multi-dimensional jurisdiction filtering used by the dashboard and tests |
| `app/aplus-import.ts` | Strict 19-column XATXBD CSV parser and administrator fallback import |
| `app/tax-body-policy.ts` | Retired/inactive A+ tax-body suppression |
| `app/review-workflow.tsx` | Ana/Liv review controls and audit-history components |
| `server/aplus-connector.mjs` | Read-only API server, A+ queries, official-source endpoints, Georgia boundary reconciliation, and review endpoints |
| `server/ncdor-rates.mjs` | Validated North Carolina DOR current/future rate adapter |
| `server/sst-rates.mjs` | Streamlined Sales Tax parser and connected Georgia rate adapter |
| `server/ca-rates.mjs` | Validated California effective-dated HTML rate adapter |
| `server/tx-rates.mjs` | Validated Texas quarterly text plus published-total adapter |
| `server/fl-rates.mjs` | Validated Florida 67-county workbook adapter |
| `server/va-rates.mjs` | Validated Virginia 95-county/38-independent-city workbook adapter |
| `server/ct-rates.mjs` | Validated Connecticut flat 6.35% general-rate/no-local-tax adapter |
| `server/me-rates.mjs` | Validated Maine 2026 flat 5.5% general sales/use-tax adapter |
| `server/ma-rates.mjs` | Validated Massachusetts flat 6.25% tangible-property sales/use-tax adapter |
| `server/dc-rates.mjs` | Validated D.C. current 6% / scheduled 7% citywide general-rate adapter |
| `server/ms-rates.mjs` | Validated Mississippi 7% general rate plus Jackson/Tupelo general-retail local levies |
| `server/id-rates.mjs` | Validated Idaho 6% state sales/use rate plus the official 23-city decentralized-local-tax inventory |
| `server/hi-rates.mjs` | Validated Hawaii seller-side GET policy, county surcharges, Kalawao exemption, and optional pass-on ceiling |
| `server/az-rates.mjs` | Validated Arizona monthly retail TPT county/city/tribal inventory with city components kept unresolved |
| `server/al-rates.mjs` | Validated Alabama monthly general sales/locality and police-jurisdiction adapter |
| `server/co-rates.mjs` | Validated Colorado half-year layered jurisdiction-code workbook adapter |
| `server/la-rates.mjs` | Validated Louisiana current-filing parish/domicile lookup adapter |
| `server/mo-rates.mjs` | Validated Missouri quarterly filing-code workbook adapter |
| `server/nm-rates.mjs` | Validated New Mexico RGIS GRT district archive adapter |
| `server/il-rates.mjs` | Validated Illinois IDOR fixed-width jurisdiction-rate adapter; address-override locations intentionally excluded |
| `server/pa-rates.mjs` | Validated Pennsylvania official-rule plus Census county adapter |
| `server/nj-aplus.mjs` | Aggregate-only `NJ000` versus official-rate reconciliation with visible cross-state/unclassified counts |
| `server/ga-boundary.mjs` | Georgia boundary-archive discovery/parsing, address normalization, address/ZIP+4/ZIP-5 matching, and tax-body reconciliation |
| `server/zip-utils.mjs` | Minimal dependency-free ZIP reader (stored + deflate) used to extract the Streamlined boundary archive |
| `server/official-source-registry.mjs` | All-state/DC adapter and research status registry |
| `server/review-store.mjs` | Local SQLite cases and append-only audit events |
| `tests/` | A+ query, import, official-source, NCDOR, Georgia boundary, jurisdiction-filter, review-store, policy, build, and rendered-interface tests |
| `.env.example` | Non-secret connector configuration names |
| `README.md` | Current scope, data flow, safety rules, and verified results |

## Official-source strategy

There is no single reliable DOR API for every state.

TaxAP uses an adapter model:

- `connected`: the source is retrieved, structurally validated, normalized, cached, and displayed.
- `machine-readable-source`: Streamlined rate/boundary files have been identified, but the state adapter is not yet validated and connected.
- `official-document-source`: an official publication is identified, but a reliable parser or locality model is still pending.
- `research-needed`: the state requires a state-specific DOR source and parser.

Connected adapters:

- North Carolina: official NCDOR county tables and effective-date tables.
- Georgia, Ohio, and Tennessee: current Streamlined Sales Tax rate files with state-specific county-count validation.
- California: current effective-dated CDTFA city and county table.
- Texas: quarterly Comptroller control file plus published combined city/local totals.
- Florida: current Department of Revenue 67-county workbook.
- Pennsylvania: official statewide/local add-on rules normalized across all 67 Census counties.
- South Carolina (official source only, added 2026-08-26): ST-575 PDF parsed via `pdftotext -table`. No A+ jurisdiction matching yet — see the note above about the poppler-utils runtime dependency. **Step 3 (boundary source) now identified 2026-08-26**: SC RFA (a separate SC state agency) runs public, unauthenticated ArcGIS REST services (geocoder + municipal/county boundary polygons) at `gis.state.sc.us` that together form a real address-to-jurisdiction path — not built, architecturally different from GA's static-file pattern (needs two live dependent calls per address: geocode, then point-in-polygon). See `docs/states/sc.md`.
- New Jersey (completed 2026-08-26): flat 6.625% statewide rate cross-validated against two NJ Division pages (`server/nj-rates.mjs`) and reconciled to A+ by `server/nj-aplus.mjs` through `/api/official/states/NJ/aplus`. Live result: 599 active ship-tos on `NJ000` at 6.625%, one `GA060` assignment separately counted/excluded, zero unclassified, 600 total. One open caveat remains: NJ's Urban Enterprise Zone / Salem County reduced rate depends on Atlantic's own seller certification — see `NJ_UEZ_CAVEAT` and `docs/states/nj.md`.

**Full research status for every other state (all 42 not connected) was independently verified against live sources on 2026-08-26** — this replaced a lot of earlier unverified guesswork with confirmed facts (real URLs re-fetched, not assumed). Read `docs/roadmap-50-states.md` in this repo before starting work on any new state; do not re-derive this from scratch or trust an older summary of it. Headline corrections from that pass, worth knowing before you go further:

- **Shipped since this was written (2026-08-26, same day, later session):** `server/sst-rates.mjs` gained ZIP-extraction support. AR and WY are wired in as genuine drop-in `GENERIC_SST_STATES`. IN, KY, MI, and RI are special-cased as flat/no-local-tax states (their own `expectedCountyCount: 0` validation, not forced through the per-county check). MD is hardcoded at a flat 6% (`server/md-rates.mjs`, no live fetch needed). DE, MT, NH, and OR are marked `no-general-sales-tax` end to end (registry, connector, dashboard) per Lukas's explicit decision to exclude them entirely. NJ is built (`server/nj-rates.mjs`, cross-validated live against two independent nj.gov pages) — recommended by a live investigation that found its A+ setup is the cleanest of any state checked (one tax body, exact rate match, no local tax at all). The 11 ZIP-blocked states (IA, KS, MN, ND, NE, NV, OK, SD, UT, VT, WA) and WV (place-level, not flat) are **still not wired in** — the adapter can now technically read their files, but nobody has done their live `XATXBD` Step 1/2 investigation yet.
- **AL, AZ, CO, LA, MO, NY, HI, and NM were investigated live against production A+ on 2026-08-26 and each exposed a real state-specific complication.** All now have official evidence adapters that surface those limitations without guessing or forcing an unsafe A+ comparison. Read each state note before proceeding to A+ matching.
- Hawaii and New Mexico have a structural red flag: HI's tax is legally a General Excise Tax on business receipts, not a buyer-facing sales tax; NM taxes sellers via Gross Receipts Tax. Per Lukas's explicit decision, both are treated as functionally equivalent to a normal sales tax for comparison purposes — that framing question is resolved; what's still open for each is the live data problem described above.
- Delaware, Montana, New Hampshire, and Oregon genuinely have no general sales tax at all — confirmed, not a research gap. Per Lukas's decision they're excluded entirely from the dashboard (see `server/official-source-registry.mjs`'s `no-general-sales-tax` status), not shown as pending.
- Several official state tax-agency domains (azdor.gov, tax.colorado.gov, mass.gov, revenue.nh.gov, otr.cfo.dc.gov) block the automated `WebFetch` tool with a 403 even when the page is genuinely live — verify with a direct `curl` and a browser User-Agent before concluding a government source is dead.

Current source links:

- Georgia DOR: `https://dor.georgia.gov/sales-tax-rates-general`
- Streamlined rate/boundary documentation: `https://www.streamlinedsalestax.org/Shared-Pages/rate-and-boundary-files`
- Streamlined rate directory: `https://www.streamlinedsalestax.org/ratesandboundry/Rates/`
- Streamlined boundary directory: `https://www.streamlinedsalestax.org/ratesandboundry/Boundary/`
- Census 2025 Gazetteer page: `https://www.census.gov/geographies/reference-files/2025/geo/gazetter-file.html`
- Pennsylvania Department of Revenue: `https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax`
- Illinois machine-readable files: `https://tax.illinois.gov/research/taxrates/sales-tax-rate-machine-readable-files.html` (confirmed real 2026-08-26; files are fixed-width `.txt`, not CSV/XLSX — check IDOR's "Addendum Address Files" before building a separate boundary-matching layer)
- Virginia locality lookup: `https://www.tax.virginia.gov/sales-tax-rate-and-locality-code-lookup`; direct workbook `https://www.tax.virginia.gov/sites/default/files/inline-files/sales-tax-rates.xlsx` (revalidated 2026-09-02; server `Last-Modified` is 2026-01-09, all 133 localities connected)
- Maryland: no scrapable source exists (its FAQ page is a JS-rendered SPA); use the PDF rate chart instead: `https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/Tax_rate_chart.pdf` — confirms a flat 6% statewide rate with no local tax at all, so MD needs no ongoing scraping, just a hardcoded rate
- South Carolina ST-575: `https://dor.sc.gov/sites/dor/files/forms/ST575.pdf` (connected, see `server/sc-rates.mjs`)

## Completed milestone: Georgia address-boundary matching

Implemented this session. Summary of what shipped:

- `server/zip-utils.mjs`: a minimal, dependency-free ZIP reader (central directory + local header parsing, `zlib.inflateRawSync` for method 8, stored-mode passthrough for method 0). Verified against the real `GAB2026Q3MAY19.zip` archive (43 MB compressed, 316 MB / 2,081,787 rows uncompressed).
- `server/ga-boundary.mjs`: discovers the current `GAB*.zip` filename from the official Streamlined boundary directory (no hard-coded filename), downloads and extracts it, and validates its schema. The archive's real column count is **89**, not 54 — columns 1-32 carry data for Georgia (record type, effective dates, address range/street fields, city/ZIP, ZIP+4 range, ZIP-5 range, FIPS state/county/place/place-class, one special-district code); columns 33-89 are reserved and currently always blank. A file with a different total column count is rejected outright as a schema change; a per-row invalid-row rate above 0.5% also fails closed. Alpha/fractional PO-box address ranges (a documented, legitimate boundary format) are tracked separately as "unsupported" rather than counted as corruption.
- Address normalization (`parseShipToStreetLine`, `parseShipToSecondaryLine`) turns a freeform A+ `SASAD1`/`SASAD2` line into house number, predirectional, street name, suffix, postdirectional, and secondary designator/number, using the same USPS-style abbreviations the boundary file itself uses. An address that can't be parsed with confidence (no leading house number, e.g. `PO BOX 135`) is not guessed — it falls through to ZIP+4/ZIP-5 matching.
- `matchGeorgiaAddress` matches in the required priority order (address, then ZIP+4, then ZIP-5), filters every candidate row to its effective-date window, and reports `"ambiguous"` rather than picking a jurisdiction when more than one active row disagrees.
- `reconcileGeorgiaBoundary` aggregates matched/unmatched/ambiguous counts by A+ tax body (`SASTXB`) and compares each tax body's majority-resolved official rate (state + county + place + special components, from the already-connected `readOfficialGaRates` snapshot) against its configured `XATXBD` rate.
- `server/aplus-connector.mjs`: `buildGeorgiaAddressQuery()` (new, unit-tested query builder for `ADDR`/`CUSMS`, active-Georgia filter) and `readGeorgiaBoundaryReconciliation()` wire SQL + the boundary/rate adapters together. Ship-to address and customer rows are held only inside that function's scope and never serialized to the browser — only the aggregate reconciliation is returned. New endpoint: `POST /api/official/states/GA/boundary`.
- `app/page.tsx`: new `GeorgiaBoundaryPanel`, shown in the Georgia state drawer, displaying total/matched/unmatched/ambiguous counts, the address/ZIP+4/ZIP-5 tier breakdown, and a per-tax-body reconciliation table with a rate-difference flag.
- Tests added in `tests/ga-boundary.test.mjs` (11 tests): ZIP extraction round-trip, boundary-archive discovery, street-line parsing, ZIP normalization, address-level match, ZIP+4/ZIP-5 fallback, ambiguous match, effective-date exclusion, unsupported-address-range handling, schema/FIPS rejection, and tax-body reconciliation (matched + unmatched + ambiguous reconciling exactly to the active total).

**Run end to end against live production on 2026-08-26 and corrected later the same day.** The first run used `SASUSP`, which is a confirmed dead/blank field, and therefore included suspended ship-tos: `2404 = 2293 matched + 92 unmatched + 19 ambiguous`. After every active-state/address query was corrected to the real `SACSUS` flag, the verified result became `2391 = 2280 matched + 92 unmatched + 19 ambiguous`. The no-silent-caps invariant still holds exactly. There are now 125 comparable Georgia tax-body findings, 27 with a real rate difference, and 3 in-state groups visibly excluded for no configured A+ rate.

**Outside-jurisdiction handling is now built and live-verified.** The 5 rate-bearing non-GA tax bodies named by the original finding — `NC060`×4, `NC041`×3, `SC126`×2, `CA1163`, `PA000` — cover 11 ship-tos and are no longer compared against Georgia rates. Two additional zero-rate outside-jurisdiction groups (`DR000`×10 and `CN000`×1) are also kept visible. The API/UI therefore reports 7 outside-jurisdiction groups / 22 ship-tos in total, while identifying the exact 5 rate-bearing groups / 11 ship-tos that would otherwise create apples-to-oranges findings. No ship-to count is silently dropped.

**Follow-up maintenance on 2026-08-27 (offline only):** The dedicated Needs attention page and its navigation badge now use the same shared `inboxFindings` shape as the dashboard, filtered to confirmed `mismatch` rows. This keeps NC and GA findings in one cross-state review queue while leaving published future changes on their separate Upcoming page. A real Georgia output nondeterminism was root-caused without calling production: tied jurisdiction counts were sorted only by count, so JavaScript retained the A+ query's unspecified input order. The matcher now applies a stable jurisdiction-key tie-breaker; a cross-state tax body with conflicting GA boundary assignments reports `jurisdiction: null` rather than presenting either tied location as authoritative. Fixture coverage reverses the input order and verifies identical aggregate output.

**Historical Missouri and Colorado safe stop (2026-08-27):** the later September source pass connected both official inventories without claiming A+ matching. Missouri still lacks a validated mapping from its sparse, nonstandard A+ codes to DOR filing codes. Colorado still has genuinely multi-rate city/district variants, a Canon City jurisdiction ambiguity, and the unresolved Denver rate/business decision. Both require the documented Ana/Liv business decisions before TaxAP can safely match or compare rates.

Still not done / worth knowing for the next session:

- The boundary file is parsed fully into memory per refresh (~2.9s locally for the real 316 MB CSV) rather than via a persistent index; fine for a 6-hour-cached background refresh, but worth revisiting if refresh frequency increases.
- Address-level matching only decomposes `SASAD1`/`SASAD2`; it has not been checked against `SASAD3`/`SASAD4` overflow lines.
- No `docs/states/ga.md` file exists yet — GA's findings are split across this file and `docs/state-rollout.md`'s status table rather than consolidated the way NC/SC/etc. are.

## South Carolina matcher attempt — intentionally stopped

The public-source validation requested on 2026-08-26 was completed without querying SC production A+ rows or sending customer addresses to RFA. No matcher was shipped. Verified blockers are documented in full in `docs/states/sc.md`:

- Raw RFA county data really assigns FIPS `45077` to both Oconee and Pickens; the field cannot be treated as unique.
- RFA's county `TaxRate` disagrees with current ST-575 for Williamsburg (7% vs 8%); ST-575 must remain the only rate authority.
- All 46 county names and all 271 unique municipality names reconcile after conservative normalization, but 23 multi-county ST-575 pairs are absent from RFA's home-county attribute and require municipality plus county geometry.
- Charleston and North Charleston each use one multipart polygon intersecting Charleston, Berkeley, and Dorchester. ST-575 has no Charleston/Dorchester row, so that intersection needs a known-address/spatial-area decision before matching can be trusted.
- RFA publishes no explicit automated-use quota/license and asks users to confirm before acting on the data. Obtain approval for batch geocoding/caching and request rate.
- Sending active A+ street addresses to an external government geocoder is a new outbound customer-data flow; Atlantic IT/privacy approval is required first.
- This host still lacks `pdftotext`, so the live ST-575 adapter cannot run here even though its fixture tests pass.

## Rollout after Georgia

Prioritize adapters by current active A+ ship-to counts:

1. South Carolina: 1,924 — **official source connected 2026-08-26** (`server/sc-rates.mjs`); A+ matching (Step 1/2 against live `XATXBD`) still needed, findings so far in the taxap-dev skill's `references/states/sc.md`
2. Texas: 1,909
3. California: 1,576
4. Florida: 1,480
5. Pennsylvania: 1,060
6. Ohio: 940
7. Tennessee: 934
8. Illinois: 895
9. Virginia: 827
10. Maryland: 735

Do not assume the same source format across these states. Research and validate each authority independently. States with Streamlined files should reuse the generic rate/boundary framework **once it has ZIP-extraction support — most don't have a usable bare-.csv file today, see `docs/roadmap-50-states.md`**; other states need state-specific adapters.

## Known limitations

- All 51 jurisdictions are accounted for at the official-source layer as of 2026-09-04: 47 connected official-rate/policy adapters plus four states correctly marked as having no general sales tax. This does not mean every A+ tax body is matched; address-boundary and business-decision work remains per state. See `docs/roadmap-50-states.md` and the per-state notes.
- The dashboard currently uses the validated August 18 aggregate fallback in offline mode. It must not describe that evidence as a current live check.
- Georgia address-boundary matching is implemented and live-validated with the real `SACSUS` active filter. Outside-jurisdiction assignments are separately counted and excluded from GA rate comparisons. The rate-file table's own `totalGeneralRate` column still shows city/special components as `null` since a single component doesn't know which ship-tos it applies to without the boundary reconciliation.
- Georgia codes `05000` and `17780` are not present in the current Census place Gazetteer and therefore retain safe code-based fallback labels.
- A+ tax-body-to-official-jurisdiction mapping outside NC is validated for Georgia via the boundary reconciliation; CA, TX, and FL currently expose official inventory only and are not yet compared with A+.
- Review storage is local SQLite, not yet a shared hosted database.
- The Ana/Liv selector is temporary and not authenticated.
- Entra ID sign-in, shared review persistence, production connector hosting, Docker packaging, and Azure resources remain deferred.
- Automatic A+ updates are out of scope.
- Nationwide source monitoring is connected; nationwide A+ comparison still requires safe jurisdiction reconciliation and documented exception handling for each unmatched state.

## Local setup

Use Node.js 22.13 or newer. The current machine uses Node 24.

```powershell
npm install
Copy-Item .env.example .env.local
az login
npm run dev
```

Populate `.env.local` with the existing non-secret server/database identifiers. Never add credentials, tokens, passwords, or connection strings to the repository. Authentication uses `DefaultAzureCredential` and the signed-in Azure identity.

For production-safe interface work, start only the web application in explicit offline mode:

```powershell
$env:NEXT_PUBLIC_TAXAP_OFFLINE_MODE = "true"
npm run dev:web
```

Use `npm run dev` only during a separate, explicitly approved and supervised live read-only validation. Do not start duplicate web or connector processes if ports 3000 and 3001 are already in use.

## Validation

Run after material changes:

```powershell
npm test
npm run lint
git diff --check
```

The following live checks are intentionally deferred. Run them only during a separate, explicitly approved and supervised validation:

```powershell
$headers = @{ Origin = 'http://localhost:3000' }
Invoke-RestMethod -Headers $headers http://127.0.0.1:3001/health
Invoke-RestMethod -Headers $headers http://127.0.0.1:3001/api/official/sources
Invoke-RestMethod -Method Post -Headers $headers http://127.0.0.1:3001/api/official/states/GA
Invoke-RestMethod -Method Post -Headers $headers http://127.0.0.1:3001/api/aplus/states/GA
Invoke-RestMethod -Method Post -Headers $headers http://127.0.0.1:3001/api/official/states/GA/boundary
```

Expected current Georgia results:

- `stateRate = 4`
- `counts.counties = 159`
- `counts.cities = 6`
- `counts.specialJurisdictions = 4`
- `rates.length = 170`
- A+ Georgia active ship-tos = **2,391 live on 2026-08-26 using the real `SACSUS` ship-to active flag**. The earlier 2,404 result used dead `SASUSP` and included suspended rows; do not use it as the active count.
- `/api/official/states/GA/boundary`: `totals.matched + totals.unmatched + totals.ambiguous = totals.activeShipTos` — confirmed live with the corrected filter: 2280+92+19=2391, exactly. Outside-jurisdiction totals are 7 groups / 22 ship-tos overall, including 5 rate-bearing groups / 11 ship-tos excluded from apples-to-oranges GA comparisons.

## UI and branding rules

- Follow the Atlantic branding skill.
- Use the existing palette only: blue `#459ED8`, green `#B4D259`, navy `#0B233F`, black `#212121`, dark gray `#4A4A4B`, and light gray `#EBEBEB`.
- Preserve the approved Atlantic logo and its natural aspect ratio.
- Use Gotham with the existing Montserrat/system fallback chain.
- Keep attention states restrained and accessible.
- Preserve the read-only language wherever a control could be mistaken for an A+ write.
- Do not perform browser screenshots or visual QA unless Lukas asks.

## Where deeper research findings live

**As of 2026-08-26, this all lives in this repo, under `docs/` — moved out of the Claude-Code-only skill it used to sit in, specifically so both tools can read it:**

- `docs/roadmap-50-states.md` — the authoritative, most-recently-verified official-source status for all 51 jurisdictions.
- `docs/state-rollout.md` — the repeatable per-state A+-matching investigation procedure (Step 0–4), the reusable query template, and a running per-state status table.
- `docs/states/<code>.md` — full findings for each investigated state (NC and SC exist today; others noted in `state-rollout.md` as "summary only, no dedicated file yet" should be re-verified before trusting, not cited as-is).
- `docs/aplus-schema.md` and `docs/aplus-data-findings.md` — confirmed A+/DWStage column semantics and documented-vs-actual data divergences (e.g. `SASUSP` is dead, `SACSUS` is the real suspension flag, `SASHST` isn't a clean state code).

A Claude Code session also has the `taxap-dev` skill (`C:\Users\lukasn\.claude\skills\taxap-dev\SKILL.md`), which auto-loads for TaxAP work and now just points here plus carries the mode/identity safety checks that only matter when running the tool live — it deliberately doesn't duplicate the content above anymore, to avoid the two copies drifting apart the way the two handoff docs did.

## Documentation

After meaningful changes, append a concise project update to that day's dated log:

`C:\Users\lukasn\Documents\Obsidian Vault\Codex Logs\<YYYY-MM-DD>.md`

Record outcomes, important decisions, validation results, and useful links. Do not include secrets, credentials, raw logs, or routine low-value activity. **Also update this file (`HANDOFF.md`) itself before ending any session that changed the project's state** — whichever assistant you're using — so the next session starts accurate regardless of which tool picks it up next.

## Suggested continuation prompt

> Read `HANDOFF.md`, `README.md`, `docs/roadmap-50-states.md`, `server/ga-boundary.mjs`, `server/aplus-connector.mjs`, `app/page.tsx`, and the relevant tests. Work only from snapshots, fixtures, mocks, and automated tests. Do not contact A+, DWStage, SQL03, APLUS, production databases, or live `/api/aplus/*` routes. Do not start the connector, commit, push, deploy, or write to A+. Use the A+ ERP skill before changing SQL or ERP behavior. Continue the dashboard-first monitoring workflow by researching and fixture-testing the next official state source; do not claim a source is connected until its schema and jurisdiction mapping are validated. Keep customer-level address data off the browser, run the complete offline validation suite, report unknowns without guessing, and update `HANDOFF.md` before finishing.

September 9 draft validation: production build, ESLint and all 223 tests passed. Minnesota remains unregistered pending current-source validation.
