# TaxAP Claude Code handoff

Last updated: August 25, 2026 (dashboard-first redesign completed in offline production-safe mode)

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
- Authentication, hosting, repository publishing, and Azure resources are intentionally deferred.
- TaxAP must never guess an official rate when a source is unavailable, incomplete, ambiguous, or fails validation.
- TaxAP must not write to A+ in the current phase.
- Customer names, addresses, invoice details, credentials, and tokens must not be sent to the browser.
- Review decisions belong to TaxAP, not A+.
- Do not commit, push, deploy, reset, stash, or discard existing work unless Lukas explicitly asks.
- The worktree is intentionally dirty and contains the complete local MVP.

## Current verified state

- Local app preview: `http://localhost:3000`
- The preview was started with `NEXT_PUBLIC_TAXAP_OFFLINE_MODE=true` and `npm run dev:web`.
- The read-only connector was intentionally not started and no production database or live `/api/aplus/*` endpoint was contacted during the redesign.
- Production build passes.
- ESLint passes.
- `git diff --check` passes; Git may emit expected LF-to-CRLF warnings on Windows.
- Test suite: 42 passing tests, including dashboard filter coverage plus the existing A+, source, boundary, review, safety, build, and rendered-interface tests.
- No commit, push, deployment, A+ write, or external account change has been performed.

Live results verified on August 18, 2026:

- 51 state/DC codes have active A+ ship-to coverage.
- North Carolina: 5,516 active ship-tos and 100 validated official county rates.
- Georgia: 2,401 active ship-tos and 170 validated official rate records.
- Georgia official records contain one state rate, 159 county components, six city components, and four special-jurisdiction components.
- Georgia state rate: 4%.
- North Carolina A+ versus NCDOR: zero current differences.
- Recent verified NC case: Mecklenburg changed from 7.25% to 8.25% effective July 1, 2026; A+ now matches.
- Retired definitions such as `DO NOT USE`, `INACTIVE`, `OBSOLETE`, `NCUSE`, and `NC060XXX` are suppressed.

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
  |-- state-specific official-source adapters (NC, CA, TX, FL, PA)
  |-- Streamlined Sales Tax rate-file adapters (GA, OH, TN)
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
- Active filters preserve `ADDR.SASUSP <> 'S'` and `CUSMS.CMSUSP <> 'S'` semantics.
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
| `server/pa-rates.mjs` | Validated Pennsylvania official-rule plus Census county adapter |
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

Current source links:

- Georgia DOR: `https://dor.georgia.gov/sales-tax-rates-general`
- Streamlined rate/boundary documentation: `https://www.streamlinedsalestax.org/Shared-Pages/rate-and-boundary-files`
- Streamlined rate directory: `https://www.streamlinedsalestax.org/ratesandboundry/Rates/`
- Streamlined boundary directory: `https://www.streamlinedsalestax.org/ratesandboundry/Boundary/`
- Census 2025 Gazetteer page: `https://www.census.gov/geographies/reference-files/2025/geo/gazetter-file.html`
- Pennsylvania Department of Revenue: `https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax`
- Illinois machine-readable files: `https://tax.illinois.gov/research/taxrates/sales-tax-rate-machine-readable-files.html`
- Virginia locality lookup: `https://www.tax.virginia.gov/sales-tax-rate-and-locality-code-lookup`
- Maryland sales and use tax FAQ: `https://services.marylandcomptroller.gov/taxes/en/sales-and-use-tax-faqs?id=kb_article_view&sysparm_article=KB0010157`

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

Not done / worth knowing for the next session:

- `readGeorgiaBoundaryReconciliation()` itself is not unit-tested (same pattern as the other `openPool()`-dependent functions) — it needs a real Azure SQL connection, which this environment cannot reach locally, so it has not been exercised end to end this session.
- The boundary file is parsed fully into memory per refresh (~2.9s locally for the real 316 MB CSV) rather than via a persistent index; fine for a 6-hour-cached background refresh, but worth revisiting if refresh frequency increases.
- Address-level matching only decomposes `SASAD1`/`SASAD2`; it has not been checked against `SASAD3`/`SASAD4` overflow lines.

## Rollout after Georgia

Prioritize adapters by current active A+ ship-to counts:

1. South Carolina: 1,924
2. Texas: 1,909
3. California: 1,576
4. Florida: 1,480
5. Pennsylvania: 1,060
6. Ohio: 940
7. Tennessee: 934
8. Illinois: 895
9. Virginia: 827
10. Maryland: 735

Do not assume the same source format across these states. Research and validate each authority independently. States with Streamlined files should reuse the generic rate/boundary framework; other states need state-specific adapters.

## Known limitations

- Official-rate adapters are connected for NC, GA, CA, TX, FL, PA, OH, and TN. IL and VA machine sources are identified; SC and MD official documents are identified, but their validated parsers/locality models are intentionally still pending.
- The dashboard currently uses the validated August 18 aggregate fallback in offline mode. It must not describe that evidence as a current live check.
- Georgia address-boundary matching is implemented and reconciled by tax body, but has not been run end to end against live A+ (see "Not done" above); the rate-file table's own `totalGeneralRate` column still shows city/special components as `null` since a single component doesn't know which ship-tos it applies to without the boundary reconciliation.
- Georgia codes `05000` and `17780` are not present in the current Census place Gazetteer and therefore retain safe code-based fallback labels.
- A+ tax-body-to-official-jurisdiction mapping outside NC is validated for Georgia via the boundary reconciliation; CA, TX, and FL currently expose official inventory only and are not yet compared with A+.
- Review storage is local SQLite, not yet a shared hosted database.
- The Ana/Liv selector is temporary and not authenticated.
- Entra ID sign-in, Docker packaging, hosting, Azure resources, and repository publishing remain deferred.
- Automatic A+ updates are out of scope.
- Nationwide monitoring still requires a validated official-source adapter and jurisdiction reconciliation for each additional state.

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
- A+ Georgia active ship-tos = 2,401
- `/api/official/states/GA/boundary`: `totals.matched + totals.unmatched + totals.ambiguous = totals.activeShipTos`; not yet run against live A+ this session (see "Not done" note above) — verify on the next dev deploy.

## UI and branding rules

- Follow the Atlantic branding skill.
- Use the existing palette only: blue `#459ED8`, green `#B4D259`, navy `#0B233F`, black `#212121`, dark gray `#4A4A4B`, and light gray `#EBEBEB`.
- Preserve the approved Atlantic logo and its natural aspect ratio.
- Use Gotham with the existing Montserrat/system fallback chain.
- Keep attention states restrained and accessible.
- Preserve the read-only language wherever a control could be mistaken for an A+ write.
- Do not perform browser screenshots or visual QA unless Lukas asks.

## Documentation

After meaningful changes, append a concise project update to the current dated log, for this redesign:

`C:\Users\lukasn\Documents\Obsidian Vault\Codex Logs\2026-08-25.md`

Record outcomes, important decisions, validation results, and useful links. Do not include secrets, credentials, raw logs, or routine low-value activity.

## Suggested first Claude Code prompt

> Read `CLAUDE-HANDOFF.md`, `README.md`, `server/ga-boundary.mjs`, `server/aplus-connector.mjs`, `app/page.tsx`, and the relevant tests. Work only from snapshots, fixtures, mocks, and automated tests. Do not contact A+, DWStage, SQL03, APLUS, production databases, or live `/api/aplus/*` routes. Do not start the connector, commit, push, deploy, or write to A+. Use the A+ ERP skill before changing SQL or ERP behavior. Continue the dashboard-first monitoring workflow by researching and fixture-testing the next official state source; do not claim a source is connected until its schema and jurisdiction mapping are validated. Keep customer-level address data off the browser, run the complete offline validation suite, and report unknowns without guessing.
