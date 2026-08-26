# TaxAP project handoff

Last updated: August 26, 2026 (South Carolina official-source adapter shipped; two multi-agent source-verification passes ran against all 42 non-connected states; New Jersey adapter shipped; AL/AZ/CO/LA/MO/NY/HI/NM investigated live against A+ and correctly declined to build — see docs/state-rollout.md; SC's Step 3 boundary source identified (SC RFA's public GIS services); GA's boundary reconciliation run live end to end for the first time)

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
- Test suite: 77 passing tests as of 2026-08-26 (grows most sessions — check `npm test` output rather than trusting this number for long).
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

South Carolina, added 2026-08-26 (`server/sc-rates.mjs`): official ST-575 rate table is parsed and validated (46/46 counties, 294 municipalities, 340 total rows) by shelling out to `pdftotext -table` (poppler-utils) rather than hand-rolling a PDF parser — **this is the one adapter with a runtime dependency on a system binary, not just npm packages; the connector's host needs poppler-utils installed or `/api/official/states/SC` returns 503.** A+ tax-body matching for SC is not yet built. Full findings: `references/states/sc.md` in the local `taxap-dev` Claude Code skill (see "Where deeper research findings live" below — this is outside the repo, Claude-only today).

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
- South Carolina (official source only, added 2026-08-26): ST-575 PDF parsed via `pdftotext -table`. No A+ jurisdiction matching yet — see the note above about the poppler-utils runtime dependency. **Step 3 (boundary source) now identified 2026-08-26**: SC RFA (a separate SC state agency) runs public, unauthenticated ArcGIS REST services (geocoder + municipal/county boundary polygons) at `gis.state.sc.us` that together form a real address-to-jurisdiction path — not built, architecturally different from GA's static-file pattern (needs two live dependent calls per address: geocode, then point-in-polygon). See `docs/states/sc.md`.
- New Jersey (added 2026-08-26): flat 6.625% statewide rate, cross-validated live against two independent NJ Division of Taxation pages (`server/nj-rates.mjs`). No local-option tax exists, so no address matching is ever needed. One open caveat, not modeled: NJ's Urban Enterprise Zone / Salem County reduced rate depends on Atlantic's own seller certification — see `NJ_UEZ_CAVEAT` in the adapter and `docs/states/nj.md`.

**Full research status for every other state (all 42 not connected) was independently verified against live sources on 2026-08-26** — this replaced a lot of earlier unverified guesswork with confirmed facts (real URLs re-fetched, not assumed). Read `docs/roadmap-50-states.md` in this repo before starting work on any new state; do not re-derive this from scratch or trust an older summary of it. Headline corrections from that pass, worth knowing before you go further:

- **Shipped since this was written (2026-08-26, same day, later session):** `server/sst-rates.mjs` gained ZIP-extraction support. AR and WY are wired in as genuine drop-in `GENERIC_SST_STATES`. IN, KY, MI, and RI are special-cased as flat/no-local-tax states (their own `expectedCountyCount: 0` validation, not forced through the per-county check). MD is hardcoded at a flat 6% (`server/md-rates.mjs`, no live fetch needed). DE, MT, NH, and OR are marked `no-general-sales-tax` end to end (registry, connector, dashboard) per Lukas's explicit decision to exclude them entirely. NJ is built (`server/nj-rates.mjs`, cross-validated live against two independent nj.gov pages) — recommended by a live investigation that found its A+ setup is the cleanest of any state checked (one tax body, exact rate match, no local tax at all). The 11 ZIP-blocked states (IA, KS, MN, ND, NE, NV, OK, SD, UT, VT, WA) and WV (place-level, not flat) are **still not wired in** — the adapter can now technically read their files, but nobody has done their live `XATXBD` Step 1/2 investigation yet.
- **AL, AZ, CO, LA, MO, NY, HI, NM were all investigated live against production A+ on 2026-08-26 and correctly declined to build** — each for a different, real, documented reason (see `docs/state-rollout.md`'s status table and each state's `docs/states/<code>.md`): AL has ~100 real ship-tos on a zeroed-out DO-NOT-USE placeholder that needs explaining first; AZ found 3 live rate discrepancies needing a human call; CO found Denver's home-rule rate is stale by 0.34pt; LA's A+ setup only has 2 codes for the entire state (barely tracks Louisiana's real jurisdiction fragmentation at all); MO's 92 codes don't map to any real jurisdiction-code system; NY found 2 confirmed live rate bugs (Suffolk County, Yonkers City); HI's rate is fully zeroed with no way to tell if that's a data gap or a legitimate policy choice (GET pass-on is optional there); NM's state rate is confirmed stale after a statutory rate-change trigger fired 7/1/2026. **None of these are ready to build without a human decision first** — don't let a future session re-attempt one without reading its file.
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
- Virginia locality lookup: `https://www.tax.virginia.gov/sales-tax-rate-and-locality-code-lookup` (confirmed real 2026-08-26; the workbook itself is ~3 years stale — re-confirm no newer regional-rate change before trusting it)
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

**Run end to end against live production for the first time on 2026-08-26** (previously deferred — see git history for context). Real results: `activeShipTos=2404, matched=2293, unmatched=92, ambiguous=19` — reconciles exactly (2293+92+19=2404), confirming the "no silent caps" invariant holds live, not just in fixtures. Match tiers all exercised live: address=997, zip9=63, zip5=1115, zip5FromZip9=118. 130 tax-body findings, 30 with a real rate difference (e.g. `GA027` Chattooga: official 9% vs A+ 7%; `GA006` Banks: official 7% vs A+ 9%, A+ *overcharging*). `excludedForNoAplusRate`=5, correctly excluded with a visible count.

**New finding from that live run**: 5 of the 130 tax-body records on real GA-ship-to addresses carry a non-Georgia tax body — `NC060`×4, `NC041`×3, `SC126`×2, `CA1163`, `PA000`. This reproduces the already-documented `CMTXBD`/`SASTXB` cross-context pattern (`docs/aplus-data-findings.md`) confirmed live for the first time. 3 of these 5 show a "rate difference," but that's comparing GA's boundary-resolved rate against a *different state's* A+ configuration — apples-to-oranges, not evidence GA's own rate is wrong. **Not yet built:** excluding or separately categorizing these 5 non-GA-prefixed tax bodies in the GA findings table.

Still not done / worth knowing for the next session:

- The boundary file is parsed fully into memory per refresh (~2.9s locally for the real 316 MB CSV) rather than via a persistent index; fine for a 6-hour-cached background refresh, but worth revisiting if refresh frequency increases.
- Address-level matching only decomposes `SASAD1`/`SASAD2`; it has not been checked against `SASAD3`/`SASAD4` overflow lines.
- No `docs/states/ga.md` file exists yet — GA's findings are split across this file and `docs/state-rollout.md`'s status table rather than consolidated the way NC/SC/etc. are.

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

- Official-rate adapters are connected for NC, GA, CA, TX, FL, PA, OH, TN, and (as of 2026-08-26) SC. IL and VA machine sources are confirmed real but not yet built into adapters; MD has no scrapable source and should just be hardcoded at a flat 6%. All other states' sources were verified 2026-08-26 — see `docs/roadmap-50-states.md` before assuming any state's status.
- The dashboard currently uses the validated August 18 aggregate fallback in offline mode. It must not describe that evidence as a current live check.
- Georgia address-boundary matching is implemented and reconciled by tax body, but has not been run end to end against live A+ (see "Not done" above); the rate-file table's own `totalGeneralRate` column still shows city/special components as `null` since a single component doesn't know which ship-tos it applies to without the boundary reconciliation.
- Georgia codes `05000` and `17780` are not present in the current Census place Gazetteer and therefore retain safe code-based fallback labels.
- A+ tax-body-to-official-jurisdiction mapping outside NC is validated for Georgia via the boundary reconciliation; CA, TX, and FL currently expose official inventory only and are not yet compared with A+.
- Review storage is local SQLite, not yet a shared hosted database.
- The Ana/Liv selector is temporary and not authenticated.
- Entra ID sign-in, shared review persistence, production connector hosting, Docker packaging, and Azure resources remain deferred.
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
- A+ Georgia active ship-tos = 2,401 as of 2026-08-18; **confirmed 2,404 live on 2026-08-26** (small, plausible ship-to churn, not a discrepancy)
- `/api/official/states/GA/boundary`: `totals.matched + totals.unmatched + totals.ambiguous = totals.activeShipTos` — **confirmed live on 2026-08-26**: 2293+92+19=2404, exactly. See the "Completed milestone" section above for full results and the new cross-state tax-body finding.

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
