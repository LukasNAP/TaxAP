# TaxAP

TaxAP is Atlantic Packaging's internal, read-only sales and use tax monitoring application. It compares authoritative state tax-rate publications with the tax bodies assigned to active A+ ship-to records, surfaces discrepancies for human review, and preserves aggregate evidence. It does **not** calculate customer tax or update A+.

## Current status

Status as of September 8, 2026:

- The application UI and Docker deployment are working.
- The official-source registry covers all 50 states plus the District of Columbia: 47 entries have connected source adapters, while Delaware, Montana, New Hampshire, and Oregon are intentionally excluded because they have no general sales tax.
- Automatic A+ comparison logic is currently wired for 38 states plus D.C.: Alabama, Arizona, Arkansas, California, Colorado, Connecticut, Florida, Georgia, Illinois, Indiana, Kansas, Kentucky, Maine, Maryland, Massachusetts, Michigan, Minnesota, Mississippi, Missouri, Nebraska, Nevada, New Jersey, New Mexico, New York, North Carolina, Ohio, Oklahoma, Pennsylvania, Rhode Island, South Carolina, South Dakota, Tennessee, Texas, Utah, Virginia, Washington, West Virginia, Wisconsin, and the District of Columbia. These compare supported assigned tax bodies; they do not certify every ship-to's physical jurisdiction or business tax treatment.
- Other connected official sources can be viewed and refreshed, but they do not yet produce automatic A+ discrepancy findings.
- The local Windows application can read A+ through the existing `SQL03` to `APLUS` linked-server path using the signed-in Windows account.
- The deployment on `apdock01` serves the application over HTTPS, but its A+ connector remains on the validated fallback snapshot until a non-interactive Microsoft Entra identity receives read-only SQL access.
- The legacy owner-only Sites preview is also snapshot-only and cannot contact A+ or provide shared review storage.

An HTTP 200 response from the proxy proves that the interface is available; it does **not** prove that the hosted A+ connector is live. Check the connector status and refresh result in the application.

## What the application does

- Shows newly published rates, upcoming effective dates, source coverage, affected A+ ship-tos, and review history.
- Keeps four stages distinct: government publication, Atlantic relevance, A+ comparison, and human review.
- Filters official jurisdictions to locations relevant to active A+ ship-tos whenever a supported comparison adapter is available.
- Displays human-readable county or jurisdiction names instead of raw tax-body codes where a validated mapping exists.
- Preserves source URL, retrieval time, effective period, and a SHA-256 evidence fingerprint.
- Flags mismatches, unavailable sources, and ambiguous jurisdiction matches without guessing.
- Stores local review decisions and audit events separately from A+.
- Supports an administrator CSV import as a temporary, session-only fallback.
- Never writes tax rates or assignments back to A+.

## Coverage model

TaxAP tracks two different kinds of coverage:

1. **Official-source coverage** means TaxAP can retrieve and validate a state's authoritative rate publication.
2. **A+ comparison coverage** means TaxAP can also map that state's A+ tax bodies or ship-tos to the official jurisdictions and produce findings.

These counts should not be treated as interchangeable. A state may have a connected official source while its address-to-jurisdiction or A+ mapping is still unfinished.

Detailed status and unresolved mapping work are documented in [`docs/roadmap-50-states.md`](docs/roadmap-50-states.md), [`docs/state-rollout.md`](docs/state-rollout.md), and the individual files under [`docs/states/`](docs/states/).

## Architecture

```text
Browser
  |
  +-- TaxAP web application
        |
        +-- official state source adapters
        +-- review/audit store
        +-- private A+ connector (port 3001)
              |
              +-- SQL03 / DWStage
                    |
                    +-- APLUS linked server / APLUSV8FAQ
```

The connector returns only aggregate coverage, tax-body definitions, and rates. Customer names, street addresses, invoice numbers, Microsoft tokens, and database credentials are not sent to browser code or committed to the repository.

## Run locally with live A+ data

Local live access uses Windows Authentication and the same `SQL03` connection available through SQL Server tools. Copy `.env.example` to `.env.local` and use:

```env
TAXAP_SQL_AUTHENTICATION=windows
TAXAP_SQL_SERVER=SQL03
TAXAP_SQL_DATABASE=DWStage
TAXAP_SQL_LINKED_SERVER=SQL03
TAXAP_APLUS_LINKED_SERVER=APLUS
TAXAP_APLUS_LIBRARY=APLUSV8FAQ
TAXAP_CONNECTOR_HOST=127.0.0.1
TAXAP_CONNECTOR_PORT=3001
TAXAP_ALLOWED_ORIGIN=http://localhost:3000
```

Do not add a password to this file. Start both the web application and connector from a PowerShell terminal running as the Windows user that already has database access:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Confirm that the header reports a live A+ connection and that **Refresh now** succeeds. If it falls back to a dated snapshot, inspect the connector output in the same terminal rather than treating the UI as live.

### Offline interface mode

For interface work that must not contact A+, start only the web application:

```powershell
$env:NEXT_PUBLIC_TAXAP_OFFLINE_MODE = "true"
npm run dev:web
```

Offline mode disables live refresh and uses the bundled validated snapshot.

## Deploy on apdock01

The deployment files are under [`deployment/apdock01/`](deployment/apdock01/). Docker runs the web application and private connector together; Nginx is the only published service and exposes HTTPS on port 5017. The connector's port 3001 must remain private.

On `apdock01`:

```bash
cd /var/atlanticapps/taxap
git -c core.sshCommand='ssh -i /home/lukasn/.ssh/id_ed25519_taxap -o IdentitiesOnly=yes' pull --ff-only
docker compose -f deployment/apdock01/docker-compose.yml up -d --build
docker compose -f deployment/apdock01/docker-compose.yml ps
curl -kI https://localhost:5017
```

The Docker image includes the ODBC runtime required by `msnodesqlv8` and the PDF tooling used by official-source adapters. TLS certificate and key paths are supplied through the deployment `.env` and mounted read-only.

### Hosted A+ prerequisite

Windows Authentication works for the local process under the user's Windows identity; it does not transfer into a Linux container. The hosted connector therefore needs all of the following:

1. An IT-approved, non-interactive Entra application/service principal with a certificate credential.
2. Read-only permission to the required `DWStage` queries and the existing `SQL03` to `APLUS` linked-server path.
3. Network access from `apdock01` to the SQL endpoint.
4. The combined client certificate and private key mounted at the path expected by the Compose deployment.
5. Tenant ID, client ID, and certificate path configured in `deployment/apdock01/.env` without committing secrets.

Until those checks pass, the hosted application is suitable for interface review but must identify its A+ data as fallback or snapshot data.

### User access control is separate

The Entra identity above authenticates the backend workload to SQL. It does not sign Ana into TaxAP. Before broad internal distribution, put the approved OAuth2 proxy or equivalent single-tenant access control in front of TaxAP and restrict it to the intended users. This can be completed after the workload connection, but it remains a production-readiness item.

See [`deployment/apdock01/README.md`](deployment/apdock01/README.md) for the host-specific checklist.

## Review storage

Local review decisions, notes, ownership, and audit events are stored in SQLite under `.data/`. The Docker deployment uses the `taxap-review-data` named volume so those records survive container replacement. This is independent of A+ and does not write review decisions into the ERP.

## Administrator CSV fallback

- Accepts `.csv` files up to 2 MB in the verified 19-column `XATXBD` export order, with or without a header.
- Validates required tax bodies, numeric ranges, duplicates, current and future components, and effective dates.
- Applies data only to the current browser session.
- Does not upload the file, persist the imported data, or write to A+.

## Relevant A+ data

The read path uses these warehouse fields:

| Purpose | Table and field |
| --- | --- |
| Company, customer, and ship-to | `ADDR.SACONO`, `ADDR.SACSNO`, `ADDR.SASHP#` |
| Ship-to address | `ADDR.SASAD1`-`ADDR.SASAD4`, `ADDR.SASCTY`, `ADDR.SASHST`, `ADDR.SASZIP` |
| Tax body and taxable code | `ADDR.SASTXB`, `ADDR.SATXCD` |
| Geographic/possible Vertex values | `ADDR.SAGEOC`, `ADDR.SAVTSH` |
| Current tax body and description | `XATXBD.TBTXBOD`, `XATXBD.TBTXNAM` |
| Current base/local/total rates | `XATXBD.TBCBSRT`, `XATXBD.TBCLRT1`-`TBCLRT4`, `XATXBD.TBCRATE` |
| Next rates and effective date | `XATXBD.TBNBSRT`, `XATXBD.TBNLRT1`-`TBNLRT4`, `XATXBD.TBNRATE`, `XATXBD.TBTXDAT` |

The known maintenance path is **Accounts Receivable -> File Maintenance -> Tax Body**. The approved maintenance procedure and any vendor-supported integration still need documentation, so TaxAP remains read-only.

## Safety rules

- Never infer a rate solely from a five-digit ZIP when a more precise official boundary source is available.
- Preserve original source URLs, retrieval timestamps, effective dates, and hashes as audit evidence.
- Never silently replace a prior effective-dated rate.
- Never write directly to A+ from the monitoring job.
- Treat source failure or ambiguous jurisdiction matching as a review condition, not permission to guess.
- Keep customer-level records and all credentials out of source control.
- Only flag discrepancies for approval until a supported A+ write workflow is separately designed and approved.

## Testing

```powershell
npm run lint
npm test
```

`npm test` performs a production build and runs the adapter, connector, mapping, review-store, filtering, and rendered-interface test suites.

## Remaining work

1. Complete and validate the hosted Entra workload identity, certificate mount, SQL permissions, and network path.
2. Add production user access control for Ana and other approved users.
3. Finish A+ comparison mappings for connected official-source states that do not yet create findings.
4. Validate address-boundary matching for states where ZIP or name matching is insufficient.
5. Confirm the temporary/special tax-body rules and the business meaning of A+ taxable codes `0`, `3`, and `J`.
6. Confirm notification cadence, reviewer workflow, backup/retention for review data, and operational ownership.
7. Perform user acceptance testing before treating the hosted deployment as production-ready.

## Project references

- [`HANDOFF.md`](HANDOFF.md) - current handoff and operating notes
- [`docs/aplus-schema.md`](docs/aplus-schema.md) - verified A+ schema notes
- [`docs/aplus-data-findings.md`](docs/aplus-data-findings.md) - aggregate A+ findings
- [`docs/pending-business-decisions.md`](docs/pending-business-decisions.md) - unresolved business decisions
- [`docs/roadmap-50-states.md`](docs/roadmap-50-states.md) - nationwide source rollout
- [`docs/state-rollout.md`](docs/state-rollout.md) - implementation process and state status
