# TaxAP: Claude startup context

Prepared September 15, 2026. This is a startup package, not a replacement for the shared `HANDOFF.md`. Refresh facts from the working tree and server before acting.

Delivery update: the user subsequently authorized committing and pushing all changes. This file and the SQL-login/routing changes are included in that delivery commit. The uncommitted-file list and 526fc4c local baseline below describe the pre-delivery snapshot; inspect Git for the new local HEAD. The host checkout still has copied runtime modifications beyond its 526fc4c baseline. A fresh full build and all 265 tests passed for delivery, with lint and TypeScript checks. Do not assume pushing updates the host checkout automatically.

## Give the harness this workspace

- Local project: `C:\Users\lukasn\Documents\ChatGPT\tax`
- Shell: PowerShell on Windows.
- Repository: https://github.com/LukasNAP/TaxAP
- Branch: `main`; last verified commit: `526fc4c`.
- Open the existing folder, not a fresh GitHub clone: substantial uncommitted changes are already deployed and would be missing from a clone.
- Allow project file reading/editing and normal local test commands. SSH access is available through the existing `apdock01` alias. Do not copy SSH keys, passwords, tokens or environment-file contents into the harness prompt.
- Network access is needed to inspect authoritative tax sources. Access to apdock01 is needed only for scoped hosted checks or separately authorized deployment.
- A+ skill: `C:\Users\lukasn\.agents\skills\aplus-erp\SKILL.md`. Read it before SQL/ERP work. If unavailable in the harness, report that rather than inventing schema details.

## Read first

1. `README.md`
2. `HANDOFF.md` (latest dated entries first; many historical sections are superseded)
3. `docs/roadmap-50-states.md`
4. `docs/state-rollout.md`
5. `docs/pending-business-decisions.md`
6. `deployment/apdock01/README.md`
7. Current Git status/diff and any applicable AGENTS.md or CLAUDE.md instructions.

Source code and recent verified facts take precedence over older handoff statements. Do not assume GitHub matches the deployed app.

## Purpose and boundaries

TaxAP is Atlantic Packaging's internal read-only sales/use tax monitoring application. It reads official tax publications and active A+ ship-to tax-body assignments, flags discrepancies for human review, and preserves aggregate evidence. It must not calculate customer tax or write to A+.

- Never guess a rate, jurisdiction, exemption or business tax treatment.
- Use government/authoritative primary sources for tax implementation.
- Preserve local and hosted uncommitted work. Do not reset, stash, discard, commit, push or deploy without an explicit request for that action. Prior deployment approvals were for completed deployments, not blanket permission.
- Explain proposed SQL, A+ field or ERP behavior changes before editing; consult aplus-erp first.
- Never print credentials, connection strings, tokens, private keys, customer names/addresses or invoices. Keep probes aggregate-only. Do not dump .env, Docker inspect environment, or raw authentication logs.
- Keep sign-in identity separate from SQL database identity.
- Verify meaningful changes using build, lint, TypeScript and appropriate tests. Update shared HANDOFF.md afterward.
- Record material outcomes in `C:\Users\lukasn\Documents\Obsidian Vault\Codex Logs\2026-09-15.md` or the current day's log, if available, without secrets.

## Coverage and business decisions

- Registry covers 50 states plus DC: 47 connected official-source adapters; DE/MT/NH/OR have no general sales tax.
- Rate comparison readers: 42 states plus DC. AK/HI/ND/WY have deliberate no-tax policy handling for the confirmed existing zero/temporary assignments.
- All 47 wired checks run in the shared batch, including NC and GA. Successful checks do not mean every assignment has a verified jurisdiction/rate.
- User selected sales tax only for IA/VT. Preserve ambiguity and unmatched/excluded reporting.
- Multistate review history, optimistic concurrency and SQLite backup support exist. Reviewer selection is still manual; Entra login does not establish authenticated review attribution.

## Current deployed application

- URL: https://apdock01.atlanticpkg.com:5017
- Callback: https://apdock01.atlanticpkg.com:5017/oauth2/callback
- Proposed friendly hostname taxap.atlanticpkg.com was never adopted.
- Host checkout: `/var/atlanticapps/taxap`.
- SSH: `ssh apdock01` uses the user's existing SSH configuration.
- Ingress: HTTPS Nginx -> OAuth2 Proxy v7.15.4 -> private Nginx router -> TaxAP app/API.
- Only HTTPS 5017 is published. Web/API internals remain private.
- User confirmed successful Entra login. TaxAP-Users restricts access; last known membership was Lukas only. Ana and Liv need membership if not added since.
- Temporary sign-in diagnostics were removed after successful login. Normal authentication/request logging is disabled in the proxy configuration.

### SQL connectivity now works

The September 15 deployment uses a dedicated SQL login to SQL03/DWStage, not the original certificate-based Entra workload proposal. Jeff supplied the SQL account; the user provisioned its password securely on the host.

- `TAXAP_SQL_AUTHENTICATION=sql`
- `TAXAP_SQL_SERVER=SQL03`
- `TAXAP_SQL_DATABASE=DWStage`
- `TAXAP_SQL_QUERY_ROUTE=direct` queries SQL03's APLUS linked server without an extra outer SQL03 hop.
- `TAXAP_SQL_TRUST_SERVER_CERTIFICATE=true` is Jeff's explicitly approved SQL03 self-signed certificate exception. SQL encryption remains enabled. It is not a global HTTPS exception.
- Password host file: `/var/atlanticapps/taxap/secrets/sql-password`, mode 0600, UID 1000. Container path: `/run/secrets/taxap-sql-password`.
- Existing sign-in secrets are separate and belong to UID 65532. Do not replace them with SQL credentials.
- SQL requires SELECT on DWStage.dbo.ADDR, DWStage.dbo.CUSMS and APLUSV8FAQ.XATXBD through OPENQUERY(APLUS). All three read paths were verified. The proposed XATXBD DWStage sync is unconfirmed and not required by the current code.
- Fresh deployed connector reads at 2026-09-15T13:05Z returned 100 standard NC tax bodies, 51 jurisdiction summaries and tax-treatment data. Hosted connectivity is no longer merely inferred from health/HTTP 200.
- Full batch returned 45 successful checks and 328 findings, with ID/LA failed. Later isolated ID retry succeeded. No subsequent complete batch was verified.

### Deployment commands (reference, not authorization)

Always include both files for this SQL-login deployment:

```bash
cd /var/atlanticapps/taxap
docker compose -f deployment/apdock01/docker-compose.yml -f deployment/apdock01/docker-compose.sql-login.yml config --quiet
docker compose -f deployment/apdock01/docker-compose.yml -f deployment/apdock01/docker-compose.sql-login.yml up -d --build
```

Do not print expanded production Compose configuration. Preserve the review volume. Use protected backups before changes. The host and local checkout have intentional differences; review before copying or pulling.

## Important implementation details

- `server/sql-login.mjs`: password-file SQL authentication, strict boolean certificate option, encryption, safe connection errors.
- `server/aplus-connector.mjs`: explicit direct/linked routing and lazy Windows driver import.
- node-mssql drivers share global request constructors. Eager import of `mssql/msnodesqlv8.js` replaced Tedious requests and stalled SQL-login queries. Fixed by importing Windows driver only inside Windows mode. Preserve this fix.
- `.dockerignore` excludes root/nested secrets directories. Without this fix the host's secrets directory could enter Docker's build context.
- Do not introduce SQL write probes to test read-only permissions.

## Outstanding issue: Louisiana official HTTPS

Reproduced from the running container:

- `https://remotesellersfiling.la.gov/lookup/lookup.aspx` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- Louisiana's revenue.louisiana.gov state-rate page responds 200.
- `server/la-rates.mjs` already combines default and system CAs. Determine whether the remote source omits an intermediate or the container needs an approved trust chain; do not assume the cause beyond the verified chain-validation error.
- Do not apply SQL's trustServerCertificate setting to official HTTPS, disable TLS verification globally, or substitute guessed rates.
- Idaho rules/geography and full comparison passed in an isolated retry. Earlier failure appears transient; exact reason was not retained.

Recommended next application task: diagnose/fix Louisiana's source certificate chain, rerun the shared batch, and verify Idaho remains successful. Begin with assessment and wait for the user's task selection before editing or deploying.

## Git and verification snapshot

Local uncommitted files before this context-package task:

```text
 M .dockerignore
 M .env.example
 M HANDOFF.md
 M README.md
 M deployment/apdock01/.env.example
 M deployment/apdock01/README.md
 M server/aplus-connector.mjs
?? deployment/apdock01/docker-compose.sql-login.yml
?? server/sql-login.mjs
?? tests/sql-login.test.mjs
?? tests/sql-routing.test.mjs
```

This startup file is also new. Selected runtime files were copied to apdock01 and built without committing/pushing, so the deployed app contains changes beyond commit 526fc4c. Host secrets remain untracked; never use broad git add on the server.

- Last full production build and 264 tests passed after driver fix; lint and TypeScript passed.
- A further driver regression was then added and passed with the direct-routing test separately: 265 defined tests, but not a claimed full 265-test run.
- Deployed review SQLite integrity passed. Public root 302 and anonymous API 401 verified. All four containers were running without restarts.
- Backups: `/var/atlanticapps/taxap-backups/signin-*` and `/var/atlanticapps/taxap-backups/sql-*`, containing protected deployment archives and review database backups. Rollback image tags include `taxap-rollback:before-signin` and `taxap-rollback:before-sql`.

## Paste-ready first message

> Continue TaxAP in C:\Users\lukasn\Documents\ChatGPT\tax on Windows/PowerShell. Read CLAUDE-START.md and its required documents first, then inspect Git status and diff. The local main checkout is at 526fc4c with intentional uncommitted SQL-login/routing fixes already deployed on apdock01; preserve them. Entra user sign-in works, and hosted SQL03/DWStage/A+ reads were verified. Louisiana's official lookup fails HTTPS chain verification; Idaho passed a later isolated retry. Keep A+ read-only, never expose credentials or customer data, and consult the aplus-erp skill before SQL/ERP changes. Use HANDOFF.md as the shared ongoing handoff. Start with a concise assessment and recommended next task. Do not change, commit, push or deploy anything until I select the next task.
