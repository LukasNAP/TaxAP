# TaxAP project handoff

Last updated: August 27, 2026, later the same day (dashboard UI decluttered per Lukas's direct feedback that the home page "seemed like a lot" — removed the redundant dark "Protected workflow" 4-step banner in `ReadOnlyWorkflow` [it just restated the inbox card's own 01-04 step strip], removed the eyebrow tag + badge pill above the hero, and removed the "See what changed, what matters, and what needs review." headline + subtext entirely, leaving a visually-hidden `<h1>` for accessibility and just the "Open review queue" button. Also root-caused and fixed a real bug Lukas noticed: **the "Needs attention" count visibly changed on every page refresh.** Not random flakiness — confirmed via repeated direct calls that the underlying data is stable — the real cause is that `dashboardGaBoundary` and `dashboardOtherFindings` both start empty on every page load and take several seconds to populate live (GA's boundary match ~6s, the 17-state batch ~3-4s), so the count reads low/NC-only for the first few seconds then jumps to the real total, with no loading indicator to distinguish the two states. Fixed by tracking whether each has loaded at least once and showing "…"/"Loading…" instead of a partial number until both are in. **Two smaller, real, unrelated bugs were found (not fixed) while verifying this** — see "Known limitations" below: (1) Georgia's boundary matcher's cross-state jurisdiction assignment for at least one code (`NC060`) is non-deterministic — its `fipsCounty` flips between two values across identical back-to-back requests, though this doesn't reach any currently-displayed count; (2) the dedicated "Needs attention" full-page view (`activeView === "attention"`) and its nav sidebar badge still only show `openFindings` (NC's own mismatches) — they were never updated when GA and the other 17 wired states were added to the home dashboard's inbox card, so they under-report relative to what the home page now shows correctly.)

Last updated: August 27, 2026 (worked through nearly every pending business decision from the prior session with Lukas directly - ~30 of 34 resolved, see `docs/pending-business-decisions.md`: three standing defaults now apply project-wide - placeholder tax bodies are misinputs, coverage gaps default to current-A+-footprint-only, confirmed stale rates with no known exception get flagged for correction; HI and AK excluded from the dashboard entirely, same as DE/MT/NH/OR; several findings resolved by direct follow-up investigation rather than a business call - VA's Richmond miscoding, MS's Jackson/Tupelo exposure, PA's Allegheny exposure, WV961's real identity, AZ's AZ203/Maricopa gap, NY's Sherrill/Fulton dormancy. Then built and wired FL/PA/OH's real A+ matching via a new `server/direct-mapping-aplus.mjs` reconciler (for "many codes, each mapped directly to a jurisdiction" states, following `server/flat-state-aplus.mjs`'s earlier precedent), found and fixed a real bug along the way - FL's code number is NOT a reliable alphabetical county index, unlike an earlier claim - and found/solved Ohio's transit-authority surcharge crosswalk, which also surfaced 4 new confirmed stale rates (FL's Marion, OH's Portage/Tuscarawas/Brown) the original investigation's spot-checks had missed. Same day, later: **also built and wired VA, NY, AZ, and AL** through the same reconciler - 18 states now built and wired total, 46 confirmed findings live in the shared inbox - and found/fixed a real generic bug (`Number(null) === 0` was silently coercing an unresolved official rate into a false "0% mismatch") plus a new honest limitation (29 of AL's 106 codes are correctly reported unmatched, not guessed, because A+ reuses a different county's own locality-code number for several multi-county Alabama cities). MO and CO were investigated but deliberately not built this pass (MO's non-standard sparse code numbering, CO's already-known ambiguous multi-rate cities each need their own dedicated pass); AR and TX remain deferred - see below)

Earlier the same day (South Carolina official-source adapter shipped; two multi-agent source-verification passes ran against all 42 non-connected states; New Jersey, Nevada, and Nebraska adapters shipped, and New Jersey's A+ reconciliation was then wired and live-validated; AL/AZ/CO/LA/MO/NY/HI/NM and then IA/KS/MN/ND/OK/SD/UT/VT/WA investigated live against A+ - 2 (NV, NE) cleared to build, 17 correctly declined - see docs/state-rollout.md; SC's Step 3 boundary source identified (SC RFA's public GIS services), and a Step 3 matcher attempt against it was stopped safely with verified blockers documented rather than force-built; Georgia's outside-jurisdiction assignments separated from its own findings and live-validated with the correct `SACSUS` active filter, and its boundary reconciliation run live end to end for the first time; a real gap found in `parseSstRateCsv` - alphanumeric special-district jurisdiction codes crashed it - fixed while wiring Nebraska)

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
- Test suite: 128 passing tests as of 2026-08-27 (grows most sessions — check `npm test` output rather than trusting this number for long).
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
- New Jersey (completed 2026-08-26): flat 6.625% statewide rate, cross-validated live against two independent NJ Division of Taxation pages (`server/nj-rates.mjs`), and reconciled to A+ by `server/nj-aplus.mjs` through `/api/official/states/NJ/aplus`. No local-option tax exists, so no address matching is ever needed. Live result: 599 active ship-tos on `NJ000` at 6.625%, one `GA060` assignment separately counted/excluded, zero unclassified, 600 total. One open caveat remains: NJ's Urban Enterprise Zone / Salem County reduced rate depends on Atlantic's own seller certification — see `NJ_UEZ_CAVEAT` in the adapter and `docs/states/nj.md`.
- Nevada (added 2026-08-26): genuine drop-in `GENERIC_SST_STATES` entry, all 17 counties/Carson City verified live. `stateRate` reads as 0 by design (Nevada's SST encoding has no separate state line-item). A dormant Tourism Improvement District wrinkle exists (address-range overrides in Reno/Sparks/Las Vegas) with zero rate impact today — see `docs/states/nv.md`.
- Nebraska (added 2026-08-26): live-verified, but **the original "config-only drop-in" recommendation was wrong on two counts** — real active county count is 1 (only Dakota), not 93, and the live file's alphanumeric `GL80x` special-district codes crashed `parseSstRateCsv`'s old numeric-only regex (fixed, see below). `cityRateIsFullLocal` opt-in flag added since NE's real local variation is entirely city-level with no county component to stack. Found a confirmed stale rate (Gering: A+ 7.0% vs. official 7.5% since 2022) and a blocking placeholder (`NE000`, 21/114 ship-tos) — see `docs/states/ne.md`.
- **`parseSstRateCsv`'s jurisdiction-code validation was widened from numeric-only to alphanumeric** (2026-08-26, while wiring Nebraska) — Kansas's type-79 codes (`11KAN`, `AEATC`) and Washington's location codes (`L####`) hit the identical crash independently; this fix should unblock the parsing (not the harder matching-strategy) side of both when they're attempted.
- Georgia's dashboard now separates out-of-state tax-body assignments (e.g. `NC060`, `SC126`) from GA's own findings instead of counting them as GA mismatches — see `server/ga-boundary.mjs` and `app/tax-body-policy.ts`.
- South Carolina's RFA ArcGIS address-matching attempt (Step 3) was stopped safely with its blockers documented rather than force-built — see `docs/states/sc.md`.
- **Maryland, Indiana, Kentucky, Michigan, Maine, Connecticut, Massachusetts, and Mississippi (built and wired 2026-08-26, later session)**: all eight confirmed live to be a single flat statewide A+ tax body with no local-option variation, matching the official rate exactly with no blocking finding. Rather than eight near-duplicate reconcilers, one generic `server/flat-state-aplus.mjs` (structurally identical to `server/nj-aplus.mjs`, generalized) handles all eight through `/api/official/states/<code>/aplus`; `app/page.tsx`'s NJ-only panel was likewise generalized to `FlatStateAplusPanel`, driven by a `FLAT_STATE_APLUS_STATES` set (NJ + these 8). MD reused its existing hardcoded adapter; IN/KY/MI reuse the generic SST adapter's flat-state path; ME/CT/MA/MS got brand-new live-fetch adapters (`server/me-rates.mjs`, `ct-rates.mjs`, `ma-rates.mjs`, `ms-rates.mjs`) since none had an official source connected before today. Massachusetts' page bot-blocks a browser User-Agent even though it's live — the adapter fetches with `curl/8.0` instead (documented in the adapter, not a hidden workaround). Mississippi's real TLS cert (legitimate GlobalSign, confirmed via `openssl s_client`) failed Node's default CA bundle — fixed by adding `--use-system-ca` to `npm run dev:connector` in `package.json`, not by weakening TLS verification. Mississippi's real Jackson (+1%) / Tupelo (+0.25%) city levies are a documented, unmodeled caveat (`MS_CITY_LEVY_CAVEAT`), the same pattern as `NJ_UEZ_CAVEAT`. **Deliberately excludes Rhode Island**, despite RI being a genuine drop-in `GENERIC_SST_STATES` entry: RI's sole tax body is confirmed live at 0% against RI's real flat 7% rate (see `docs/pending-business-decisions.md`) — an open human decision, not a "wire it" case. Live-verified 2026-08-26: all 8 report `comparisonStatus: "matched"`.
- Two small, reusable read-only scripts added for future Layer 2 investigations instead of hand-rolled OPENQUERY SQL: `scripts/investigate-state.mjs <CODE>` (wraps `readStateDetail`) and `scripts/fetch-official-rates.mjs <CODE>` (wraps whichever official adapter is wired for that state). A third, `scripts/inspect-tax-body-geography.mjs <TAX_BODY>`, prints a tax body's aggregate city+ZIP breakdown (never full addresses) for follow-up questions like "is this code's ship-to volume really in the county it claims."
- **Florida, Pennsylvania, and Ohio (built and wired 2026-08-27)**: `server/direct-mapping-aplus.mjs` is the second generic reconciler (after `server/flat-state-aplus.mjs`) - for states with many A+ codes that each map directly to one real jurisdiction, no address matching needed. `server/fl-aplus.mjs` matches by real county name parsed from `TBTXNAM`, NOT the FL### code number - an earlier claim that the number is a reliable alphabetical index into Florida's 67 counties was found wrong live (FL055 is really St. Johns, FL058 is really Sarasota). `server/pa-aplus.mjs` compares PA000 against the flat statewide base and PA001 against Philadelphia by name. `server/oh-aplus.mjs` solved Ohio's real ~16-county transit-authority surcharge crosswalk (special jurisdictionCode `<A+'s own OH### county number>000`) and folds it into the comparison before diffing - a naive county-row-only diff would have false-flagged 10 correctly-configured counties (Cuyahoga, Franklin, Hamilton, etc.) as stale. Building the real reconcilers (not just trusting the earlier investigation's manual spot-checks) surfaced 4 new confirmed stale rates: FL's Marion County and OH's Portage/Tuscarawas/Brown counties - see `docs/pending-business-decisions.md`'s 2026-08-27 addendum.
- **Virginia, New York, Arizona, and Alabama (built and wired 2026-08-27, same day)**: four more states through the same `server/direct-mapping-aplus.mjs` reconciler, each with brand-new adapter pairs (`server/va-rates.mjs`/`va-aplus.mjs`, `ny-rates.mjs`/`ny-aplus.mjs`, `az-rates.mjs`/`az-aplus.mjs`, `al-rates.mjs`/`al-aplus.mjs`) plus two new shared utility modules factored out along the way: `server/xlsx-utils.mjs` (dependency-free .xlsx reader, used by VA) and `server/pdf-utils.mjs` (`pdftotext -table` wrapper, used by NY, factored from SC's existing approach). Confirmed VA's Richmond miscoding and a new Pittsylvania County stale rate; NY's Suffolk/Yonkers stale rates; AZ's Douglas/Casa Grande/Taylor/`AZ203`-Maricopa stale rates plus two new ones (Gilbert, Surprise); and 26 confirmed AL stale rates. **Found and fixed a real generic bug in the shared reconciler**: `Number(null) === 0` was silently coercing an official rate that failed to resolve (e.g. a county missing from AZ's static crosswalk) into a false "0% mismatch" instead of "unavailable" - fixed to require an explicit non-null official rate before calling anything matched, verified no silent regression on FL/PA/OH/VA/NY's already-shipped results. **AL has a known, documented, honest limitation**: its numeric tax-body suffix is usually ADOR's own real locality code, but for several multi-county cities (Birmingham, Hoover, Decatur, Dothan, Huntsville, Madison City) A+ reuses a *different* county's own locality-code number for the city row instead - a name-cross-check safety net catches this and reports "unmatched" rather than guessing, so 29 of AL's 106 codes are correctly unmatched, not a bug to fix later. See `docs/pending-business-decisions.md`'s 2026-08-27 "VA/NY/AZ/AL built and wired" addendum for full detail. MO and CO were investigated but deliberately NOT built this pass - no official-source adapter exists for either yet, and each has enough real complexity (MO's non-standard sparse code numbering; CO's already-known ambiguous multi-rate cities) to warrant its own dedicated build rather than a rushed one.
- **Dashboard inbox generalized for real (2026-08-27)**: a new batch endpoint (`/api/official/findings`, `readAllWiredStateFindings()` in `server/aplus-connector.mjs`) fetches every wired state's comparison in parallel on dashboard load and feeds `app/dashboard-findings.ts`'s shared `JurisdictionFinding` shape via two new converters (`flatStateFindingsFromReconciliation`, `directMappingFindingsFromReconciliation`). Previously only NC and GA fed "Needs attention" without a drawer being opened first - all 18 built states do now (46 confirmed findings live). A single state's failure never fails the batch (Promise.allSettled, reported as `failedStates`).

**Full research status for every other state (all 42 not connected) was independently verified against live sources on 2026-08-26** — this replaced a lot of earlier unverified guesswork with confirmed facts (real URLs re-fetched, not assumed). Read `docs/roadmap-50-states.md` in this repo before starting work on any new state; do not re-derive this from scratch or trust an older summary of it. Headline corrections from that pass, worth knowing before you go further:

- **Shipped since this was written (2026-08-26, same day, later session):** `server/sst-rates.mjs` gained ZIP-extraction support. AR and WY are wired in as genuine drop-in `GENERIC_SST_STATES`. IN, KY, MI, and RI are special-cased as flat/no-local-tax states (their own `expectedCountyCount: 0` validation, not forced through the per-county check). MD is hardcoded at a flat 6% (`server/md-rates.mjs`, no live fetch needed). DE, MT, NH, and OR are marked `no-general-sales-tax` end to end (registry, connector, dashboard) per Lukas's explicit decision to exclude them entirely. NJ is built (`server/nj-rates.mjs`, cross-validated live against two independent nj.gov pages) — recommended by a live investigation that found its A+ setup is the cleanest of any state checked (one tax body, exact rate match, no local tax at all). The 11 ZIP-blocked states (IA, KS, MN, ND, NE, NV, OK, SD, UT, VT, WA) and WV (place-level, not flat) are **still not wired in** — the adapter can now technically read their files, but nobody has done their live `XATXBD` Step 1/2 investigation yet.
- **AL, AZ, CO, LA, MO, NY, HI, NM were all investigated live against production A+ on 2026-08-26 and correctly declined to build at the time** — each for a different, real, documented reason (see `docs/state-rollout.md`'s status table and each state's `docs/states/<code>.md`): AL has ~100 real ship-tos on a zeroed-out DO-NOT-USE placeholder that needed explaining first; AZ found 3 stale rates needing a human call (Douglas/Cochise, Casa Grande, Taylor); CO found Denver's home-rule rate is stale by 0.34pt; LA's A+ setup only has 2 codes for the entire state (barely tracks Louisiana's real jurisdiction fragmentation at all); MO's 92 codes don't map to any real jurisdiction-code system; NY found 2 confirmed stale rates (Suffolk County, Yonkers City — a live customer could be paying the wrong rate right now); HI's rate is fully zeroed with no way to tell if that's a data gap or a legitimate policy choice (GET pass-on is optional there); NM's state rate is confirmed stale after a statutory rate-change trigger fired 7/1/2026. **These aren't code bugs — they're exactly the stale-rate findings TaxAP exists to surface, once an adapter and A+ matching exist to catch them.** **Update 2026-08-27: AL, AZ, and NY have since been built and wired** (see the VA/NY/AZ/AL bullet above) once their blocking decisions were resolved with Lukas. LA remains a deliberate simplification (not a blocker). CO and MO are still not built — see above for why. HI (and AK) are excluded from the dashboard entirely, not pending. NM's build status is unchanged — still not connected.
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

**Run end to end against live production on 2026-08-26 and corrected later the same day.** The first run used `SASUSP`, which is a confirmed dead/blank field, and therefore included suspended ship-tos: `2404 = 2293 matched + 92 unmatched + 19 ambiguous`. After every active-state/address query was corrected to the real `SACSUS` flag, the verified result became `2391 = 2280 matched + 92 unmatched + 19 ambiguous`. The no-silent-caps invariant still holds exactly. There are now 125 comparable Georgia tax-body findings, 27 with a real rate difference, and 3 in-state groups visibly excluded for no configured A+ rate.

**Outside-jurisdiction handling is now built and live-verified.** The 5 rate-bearing non-GA tax bodies named by the original finding — `NC060`×4, `NC041`×3, `SC126`×2, `CA1163`, `PA000` — cover 11 ship-tos and are no longer compared against Georgia rates. Two additional zero-rate outside-jurisdiction groups (`DR000`×10 and `CN000`×1) are also kept visible. The API/UI therefore reports 7 outside-jurisdiction groups / 22 ship-tos in total, while identifying the exact 5 rate-bearing groups / 11 ship-tos that would otherwise create apples-to-oranges findings. No ship-to count is silently dropped.

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

- Official-rate adapters are connected and A+-matched (built and wired) for 18 states as of 2026-08-27: NC, GA, NJ, MD, IN, KY, MI, ME, CT, MA, MS, FL, PA, OH, VA, NY, AZ, AL. IL machine source is confirmed real but not yet built into an adapter. All other states' sources were verified 2026-08-26 — see `docs/roadmap-50-states.md` before assuming any state's status; this line is a stale carryover from an earlier session and undercounts what's actually connected today.
- The dashboard currently uses the validated August 18 aggregate fallback in offline mode. It must not describe that evidence as a current live check.
- Georgia address-boundary matching is implemented and live-validated with the real `SACSUS` active filter. Outside-jurisdiction assignments are separately counted and excluded from GA rate comparisons. The rate-file table's own `totalGeneralRate` column still shows city/special components as `null` since a single component doesn't know which ship-tos it applies to without the boundary reconciliation.
- Georgia codes `05000` and `17780` are not present in the current Census place Gazetteer and therefore retain safe code-based fallback labels.
- **Georgia's cross-state assignment jurisdiction lookup is non-deterministic for at least one code (found 2026-08-27, not fixed)**: `crossStateAssignments.taxBodies[].jurisdiction.fipsCounty` for `NC060` ("North Carolina Mecklenbur") flipped between `"067"` and `"135"` across identical, back-to-back `/api/official/states/GA/boundary` calls in the same running process. Confirmed real via direct repeated calls (not a one-off network blip) — everything else in the response, including all real `taxBodyFindings` rate comparisons, was byte-identical across the same runs. Doesn't currently affect any displayed count (`crossStateAssignments` isn't counted in the dashboard's "Needs attention" total), but it's a real reproducibility bug in whatever resolves a cross-state code's display-only jurisdiction, worth root-causing before it's trusted for anything else.
- **The dedicated "Needs attention" page and its nav sidebar badge are stale relative to the home dashboard (found 2026-08-27, not fixed)**: `activeView === "attention"` and the nav's `nav-count` badge both still read `openFindings.length` (NC-only). They were never updated when GA's boundary findings and the other 17 wired states' batch were added to the home dashboard's inbox card (`inboxFindings`/`needsAttentionCount`), so today they under-report — e.g. if the home page shows "73 differences," the "Needs attention" page and nav badge still only show NC's share of that. The home dashboard is the accurate one; the dedicated page needs the same `inboxFindings`-based rewrite.
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
