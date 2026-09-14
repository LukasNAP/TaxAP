# TaxAP project handoff

Last updated September 14, 2026. This current summary and README supersede historical sections below.

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
