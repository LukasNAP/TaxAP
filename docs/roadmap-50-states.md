# Roadmap: all 50 states + DC in the dashboard

Last updated: August 26, 2026 — SC's official-source adapter shipped (`server/sc-rates.mjs`), and two multi-agent source-verification passes ran (web research only, zero load on production A+; every claimed URL/file was independently re-fetched and confirmed, not assumed): one for the 19 previously-unresearched states, one re-verifying the 23 states this doc had already claimed a source for (20 "SST-reusable" + IL/VA/MD). **All 51 jurisdictions have now had their official source independently verified at least once** — none are still "not yet researched," though most still need the live `XATXBD` investigation (Step 1/2) and many need real adapter code, not just a config entry. See both "Layer 1" sections below for full results.

## Where we actually stand

Getting all 51 jurisdictions into the "Needs attention" dashboard is not one task — it's three separable layers, and today's coverage is uneven across all three:

| Layer | What it means | Current coverage |
|---|---|---|
| **1. Official source** | A validated, machine-readable feed of that state's current rates | 9 connected. Of the other 42: 14 real sources newly found in the 19-state pass (5 machine-readable, 8 not, 1 special-case AK), 4 confirmed to genuinely have no source (no general sales tax), DC's known source is temporarily 403ing; of the 23 previously-claimed SST/bespoke states, only 2 (AR, WY) are actually drop-in ready, 5 need special-casing, 11 are blocked on missing ZIP-extract support in the adapter, 1 (NJ) has no current source at all, and the 3 bespoke states (IL/VA/MD) are confirmed but each has its own caveat |
| **2. A+ jurisdiction matching** | Mapping A+'s `XATXBD` tax-body codes to the *same* jurisdictions the official source uses | Only NC (trivial 1:1) and GA (address/ZIP boundary matching) actually do this |
| **3. Dashboard integration** | Feeding a state's comparison into the shared "Needs attention" / "Upcoming" tiles | Only NC feeds it today — **GA's live reconciliation already finds real discrepancies and still isn't wired in** |

That last point matters: layer 3 isn't "trivially" behind layer 2. We proved today that Georgia's matching engine works end-to-end against production data (18 confirmed rate discrepancies, 228 unmatched ship-tos, 59 tax bodies with inconsistent jurisdiction assignment) — none of it visible on the dashboard, because the UI only reads NC's result shape.

## Layer 1: official-source status, all 51 (per `official-source-registry.mjs`)

**Connected (16):** NC, GA, CA, TX, FL, PA, OH, TN, SC (official source only, `server/sc-rates.mjs`; A+ matching not built), AR, WY (genuine drop-in SST states), IN, KY, MI, RI (flat/no-local-tax SST states, special-cased), MD (hardcoded flat 6%, no local tax), NJ (cross-validated live against nj.gov, no local tax) — all shipped 2026-08-26.

**Investigated live against production A+ on 2026-08-26, correctly declined to build (8):** AL, AZ, CO, LA, MO, NY, HI, NM — each has a real, state-specific blocker (a zeroed placeholder used by ~100 real ship-tos, live rate discrepancies needing a human call, a stale home-rule rate, a coverage gap where A+ barely tracks the state's real jurisdictions, a code system with no discoverable convention, a state rate that's gone stale after a statutory trigger, or a data value that's ambiguous between "gap" and "legitimate policy choice"). None are ready to build without a human decision — see `docs/state-rollout.md`'s status table and each state's `docs/states/<code>.md` before attempting any of them again.

**All 23 remaining SST/bespoke states were independently re-verified against live data on 2026-08-26 (see the full breakdown below) — the previous "20 SST states, mostly per-state validation, not new parsing logic" framing turned out to be substantially wrong and is now corrected.**

## Layer 1: the 23 claimed-SST/bespoke states — verification results (2026-08-26)

Same methodology as the 19-state pass: one agent per state independently re-verifies (doesn't just trust) the claimed source, a second agent re-fetches every claimed URL/file. All 23 returned a result (0 failures, 22 confirmed + 1 correctly found "no usable file"). **The headline finding: only 2 of the 20 claimed-SST states are actually a drop-in extension of the existing `GENERIC_SST_STATES` pattern (`server/sst-rates.mjs`) the way OH/TN are.** Everything else needs either a real code change (the adapter has no ZIP-extraction support today) or state-specific special-casing (several supposedly-simple states turn out to have zero or one rate row, not one per county) before they can be wired in.

### Drop-in ready — bare CSV, matches the OH/TN shape exactly (2)

| State | FIPS | Real county count | Notes |
|---|---|---|---|
| AR | 05 | 75 | Clean county+city local-option system; one open item — Arkansas's known single-article $2,500 local-tax cap isn't in the SST file and hasn't been confirmed against a DOR source yet |
| WY | 56 | 23 | Clean county-option system; 2 unmapped `jurisdictionType "69"` rows (likely Wind River Reservation/tribal jurisdiction) fall into the generic "special" bucket today — worth confirming what they mean before including them in a comparison |

### Bare CSV, but needs special-casing — flat/no-local-tax states with 0 or 1 rate row, not one per county (5)

The existing `expectedCountyCount` check in `server/sst-rates.mjs` (`counts.counties === config.expectedCountyCount`) will throw or misvalidate for every one of these — they are NOT drop-in `GENERIC_SST_STATES` entries despite having a plain `.csv`:

| State | Real file content | Structural fact |
|---|---|---|
| IN | 2 rows, both state-level | Flat 7% statewide, **zero** county/city rows — no local option tax at all |
| KY | 1 row, state-level | Flat 6% statewide, no local tax |
| MI | 1 row, state-level | Flat 6% statewide, no local tax |
| RI | 1 row, state-level | Flat 7% statewide — RI's 5 Census "counties" have no taxing authority at all |
| WV | 0 county rows, 110 city rows | No county sales tax; all local tax is municipal (1% typical) — needs place-level validation, not a county count |

### Bare CSV, real local complexity — needs GA-style matching, not a flat total (1)

| State | Notes |
|---|---|
| WI | Clean 72-county base, but ~1,199 city rows encode Premier Resort Area surtaxes (0.5–1.25% in specific tourist towns like Wisconsin Dells) that a flat state+county total would silently miss. Structurally closer to GA (mostly right, but needs a boundary-status caveat) than to OH (no city rows to worry about). |

### Real file exists, but it's a ZIP — the adapter has no unzip step today (11)

**This is the single biggest correction to the old roadmap framing.** `findLatestSstCsv()` only matches `.csv` hrefs; every one of these will throw `"No current <STATE> SST CSV rate file was listed"` until zip-extract support is added to `server/sst-rates.mjs` — regardless of how simple or complex that state's underlying local-tax structure turns out to be:

| State | FIPS | Real county count | Once unzipped, still needs... |
|---|---|---|---|
| IA | 19 | 99 | City/place-level Local Option Sales Tax (LOST) — not county-uniform |
| KS | 20 | 105 | Heavy special-district overlay (3,835 of 4,697 rows are non-county/city types 63/79) — real address matching needed; type "79" isn't in the code's `JURISDICTION_TYPES` map and its meaning is unconfirmed |
| MN | 27 | 87 | City + special-district local-option layering on top of county |
| ND | 38 | 53 | 352 active home-rule city rows; several ND cities/counties also impose a per-invoice tax *cap* the CSV doesn't encode at all — a percentage-only model will overstate tax on large invoices there |
| NE | 31 | 93 | Local variation is driven by city-level option tax, not county — most "county" rows will just equal the state rate |
| NV | 32 | 17 (16 counties + Carson City) | Otherwise clean county-only model — closest of the 11 to a simple case once unzip support exists |
| OK | 40 | 77 | City + special-district layering; also a column-mapping gotcha — the CSV's jurisdiction-code column only has 4 distinct values (it's a type code, not a per-county ID — the real per-jurisdiction code is in a different column) |
| SD | 46 | 66 | **Every county row is 0%** — all local tax is municipal (254 active city rows) and non-uniform; needs full place-level matching, closer to GA's build than OH's |
| UT | 49 | 29 | City/special-district layering (mass transit, resort-community, rural-hospital taxes) varies within a county |
| VT | 50 | 14 | Real variation is at the town/place level, not county — closer to GA's build path |
| WA | 53 | 39 | ~400+ granular "location codes" driven by overlapping special districts (Sound Transit RTA, PTBAs, TBDs) that cut across county lines |

### No usable rate file at all — contradicts the "reusable" framing entirely (1)

| State | Finding |
|---|---|
| NJ | The only NJ file in the SST directory is `NJR2018Q1OCT16.zip` — **8+ years stale**, not a current quarterly file like every other state above. NJ has apparently stopped publishing through SST. NJ has no local-option sales tax at all (single flat statewide rate), so the fix is likely the same as CT/ME/MA/MS: pull the flat rate directly from NJ's own Division of Taxation rather than depending on SST, and separately confirm how to handle Urban Enterprise Zone (UEZ) reduced rates for qualifying ship-tos. |

### Bespoke (non-SST) states (3)

| State | Source | Format | Notes |
|---|---|---|---|
| IL | `tax.illinois.gov` machine-readable files hub | Fixed-width/delimited `.txt` (not CSV/XLSX as assumed) | Real, current (files dated through 08/01/2026), confirmed genuinely official. IDOR separately publishes "Addendum Address Files" alongside the rate files — worth checking whether these already give address/boundary-level detail before building a separate matching layer from scratch, per the taxap-dev skill's Step 3. Multiple stackable local layers (county, home-rule municipal incl. Chicago, special districts) — real address matching likely needed. |
| VA | `tax.virginia.gov` sales-tax-rate-and-locality-code-lookup | XLSX, confirmed real and well-formed | **Freshness flag:** the workbook's own metadata shows last-modified 2023-07-14 — plausible (lines up with VA's last known regional-rate change) but 3 years old with no visible "last updated" on the page. Re-confirm no newer VA regional overlay exists before trusting this file. Rate varies by locality (state + mandatory local 1% + regional overlays 0–1%), so address/locality matching is needed, not a flat rate. |
| MD | Comptroller of Maryland | PDF rate chart (the claimed FAQ page is a JS-rendered SPA — its content isn't fetchable by any scraper) | Flat 6% statewide, **no local sales tax at all** (Maryland preempts local general sales tax). Recommend the same treatment as CT/ME/MA/MS: hardcode 6%, no ongoing scraping needed, no address matching ever required. |

## Layer 1: the 19 previously-unresearched states — source-discovery results (2026-08-26)

Ran as a multi-agent workflow: one agent per state does web research only (**zero load on production A+/DWStage**), then a second, independent agent actually re-fetches every claimed URL to catch a hallucinated or dead link before it gets written down as fact. All 19 states returned a result (0 failures). These are **source-discovery findings only** — none of these states have had their real `XATXBD` data checked yet (Step 1/2 of `references/state-rollout.md` in the taxap-dev skill), so none are ready to build against without that follow-up.

### Confirmed real, machine-readable sources (5) — best next candidates to build

| State | Source | Format | Notes |
|---|---|---|---|
| AL | ADOR `taxrates_current.csv` (revenue.alabama.gov) | CSV | ~366 local jurisdictions; has a "police jurisdiction" wrinkle (a reduced rate zone just outside city limits) — same *concept* as Alabama's `E`-suffix/PJ pattern already known from `taxap-dev`'s cross-state notes, not yet checked against real A+ codes |
| AZ | AZDOR TPT rate table CSV (azdor.gov) | CSV | Arizona's tax is legally a Transaction Privilege Tax (TPT), not a sales tax — rated per (jurisdiction, business-classification) pair, not one rate per address; county rows already bake in the state rate, city rows don't — a naive per-address lookup would need to know which rows stack |
| CO | Combined DR 1002 + DR 0800 spreadsheet (tax.colorado.gov) | XLSX | ~70+ home-rule cities self-collect and set their own rate independently of the state — the state's own file flags these but a mismatch there may be "the city hasn't reported to the state," not an A+ error; treat self-collected-city mismatches as ambiguous, not a hard error |
| LA | Domicile Rate Listing (remotesellers.louisiana.gov) | XLSX | Most fragmented local system found in this pass — 64 parishes plus hundreds of sub-jurisdictions/districts, no single uniform parish rate |
| MO | Quarterly rate tables (dor.mo.gov) | XLSX | Rates keyed to Missouri's own DOR jurisdiction codes (not FIPS/ZIP) — address-to-jurisdiction-code mapping is a separate problem from the rate table itself; files are quarterly and re-issue mid-quarter sometimes, don't assume exactly 4 files/year |

### Real sources found, but not machine-readable (8) — need a parser or manual/periodic capture

| State | Source | Format | Notes |
|---|---|---|---|
| CT | portal.ct.gov DRS page | HTML text | Flat 6.35% statewide, **zero local variation** — no address matching ever needed here; simplest possible adapter (a handful of category exceptions) |
| ID | tax.idaho.gov guide | HTML text | Flat 6% state rate confirmed, but Idaho's own Tax Commission does **not publish** the ~23 resort-city local rates anywhere centrally — it tells taxpayers to contact each city directly. No official machine-readable path exists for those local rates today. |
| ME | maine.gov rates page | HTML table | Flat 5.5% statewide, no local variation |
| MA | mass.gov tax rates page | HTML (bot-blocked; confirmed via Wayback snapshot + search-index corroboration, not a raw fetch) | Flat 6.25% statewide, no local variation |
| MS | dor.ms.gov rates page | HTML text | State-level category rates only; two narrow named-city special levies (Jackson 1%, Tupelo 0.25%) live on separate standalone pages, not in one table |
| NM | tax.newmexico.gov GIS map/data-download | GIS map (HTML/JS) + separate shapefile/geodatabase download + semiannual PDF | **Structural flag:** New Mexico taxes sellers via Gross Receipts Tax (GRT), not a real buyer-facing sales tax — legal incidence differs from every other state here. Confirm with a human before treating NM like NC/GA in code. |
| NY | Publication 718 (tax.ny.gov) | PDF | `pdftotext -table` (SC's approach) confirmed to work cleanly (2026-08-26) — single page, 3-column table, cross-validated against `-layout`. **But the A+-matching investigation (`docs/states/ny.md`) found two confirmed, currently-live rate mismatches (Suffolk, Yonkers) — needs a human decision before building, not just a parser.** |
| HI | DOTAX county surcharge table (files.hawaii.gov) | PDF (small, 4 rows) | **Structural flag, stronger than NM's:** Hawaii's DOTAX states outright "Hawaii does not have a sales tax" — the General Excise Tax (GET) taxes business gross receipts, and the "rate" a customer sees is a voluntary capped pass-on amount, not a statutory transaction tax. NC/GA-style per-address rate comparison may not have a valid HI equivalent at all — needs a human product decision, not an engineering one, before any HI adapter work starts. |

### Special case: Alaska — no state tax, local-only, partial coverage

AK has **no state-level sales tax at all**. Local sales tax is entirely home-rule (100+ boroughs/cities each set their own rate). The Alaska Remote Seller Sales Tax Commission (ARSSTC, an intergovernmental body, not a state agency) publishes a genuinely machine-readable, verified-live XLSX — but it covers **only its member jurisdictions**, not literally every Alaska taxing municipality. A separate, more complete state-adjacent source ("Alaska Taxable," an annual report from the Dept. of Commerce) was referenced in search results but its live URL could not be verified in this pass (commerce.alaska.gov 403'd every fetch attempt) — needs a human to check it directly in a browser before relying on it.

### Confirmed: genuinely no source exists (4) — correct finding, not a research gap

DE, MT, NH, and OR were all confirmed (via each state's own DOR/equivalent) to impose **no general state or local sales/use tax at all** — these are 4 of the 5 well-known "NOMAD" states (AK is the 5th, but AK does have local-only tax, see above). **No adapter should be built for these four** — there is no rate to compare against. Each does have narrow, unrelated excise taxes (MT's local resort tax in ~10 designated areas, NH's Meals & Rentals Tax, etc.) that are out of scope for a general sales-tax comparison tool. Open product question for Ana/Liv, not an engineering one: how should a DE/MT/NH/OR ship-to be surfaced on the dashboard — excluded entirely, or explicitly labeled "not applicable" rather than compared against a 0% rate? Don't guess at this; ask.

### Flagged: DC's known source is currently broken (1)

DC has a real, single-jurisdiction (no counties, no home-rule cities) sales tax — currently 6.0%, legislated to step to 6.5% (10/1/2025) and 7.0% (10/1/2026). The known official page (`otr.cfo.dc.gov/page/dc-tax-rates`) was confirmed legitimate via a July 2026 Wayback snapshot (200 OK, contained a real rate table) but returned a live "Access denied" 403 as of 2026-08-26 — this looks like a recent, possibly transient site change rather than a permanently dead link. **Re-check this URL before building a DC adapter**; don't build against the Wayback snapshot as if it were live.

**Universal caveat from this pass, worth remembering for future state research:** several official state tax-agency domains (azdor.gov, tax.colorado.gov, mass.gov, revenue.nh.gov, otr.cfo.dc.gov) block the automated `WebFetch` tool with a 403 even when the page is genuinely live — a direct `curl` with a standard browser User-Agent got through in every case tested. A 403 from `WebFetch` alone is not sufficient evidence a government source is dead; confirm with a direct fetch before concluding a source doesn't exist.

## Layer 2: A+ jurisdiction matching — the part with no shortcut

Every state may need a *different* matching strategy, and we won't know which until we look at that state's actual `XATXBD` tax-body naming for A+:

- **NC-style (cheap):** tax-body code encodes the county directly, 1:1 with the official source. Zero ambiguity.
- **GA-style (expensive):** tax-body codes don't correspond cleanly to jurisdictions; matching requires reading actual ship-to addresses and running them through an address→ZIP+4→ZIP-5 boundary-file cascade. This is real engineering per state, and even GA's version has open gaps today (9.5% of ship-tos unmatched, ~44% of tax bodies with inconsistent jurisdiction grouping).

Before committing to a build order for layer 1, it's worth spot-checking a handful of the 8 connected states' tax-body naming conventions to find out which pattern (NC-style or GA-style) each needs — that answer changes the actual cost of "adding" a state far more than the source adapter does.

## Layer 3: dashboard integration

The dashboard's rate-change inbox currently only understands NC's result shape. Generalizing it to accept any state's findings (a shared `{jurisdiction, officialRate, aplusRate, difference, shipTos, confidence}` shape) is a one-time investment that unblocks GA immediately and every future state after it — this is likely the highest-leverage single piece of work available right now, since it's needed regardless of how many more states get added.

## Suggested phase order

1. **Generalize the dashboard inbox** to accept any state's comparison output (unblocks GA today, no new data work).
2. **Fix Georgia's known gaps** — investigate the 228 unmatched ship-tos and 59 `jurisdictionAssignmentConsistent: false` tax bodies before treating its 33 raw rate differences as final. (18 of 33 are already trustworthy as-is.)
3. **Determine matching strategy (NC-style vs GA-style) for the 7 connected-but-unmatched states** (CA, TX, FL, PA, OH, TN, SC) — this is discovery, not yet build. SC's own Step 1 already ran (2026-08-25): needs address matching, clean unincorporated-county vs. incorporated-municipality split (`references/states/sc.md` in the taxap-dev skill).
4. **Build matching + wire in whichever of those 7 turn out NC-style** (cheap wins first).
5. **Add ZIP-extraction support to `server/sst-rates.mjs`** — a real code change, not a config addition. 11 of the 20 claimed-SST states (IA, KS, MN, ND, NE, NV, OK, SD, UT, VT, WA) publish their current rate file as a `.zip`, which `findLatestSstCsv()` cannot find today (it only matches `.csv` hrefs). This blocks all 11 regardless of how simple their underlying local-tax structure turns out to be — do this before anything else in this phase.
5a. **Wire in AR and WY** — the only 2 of the 20 that are genuinely drop-in `GENERIC_SST_STATES` entries today, no code change needed beyond the config (FIPS + expected county count, both confirmed 2026-08-26).
5b. **Special-case the 5 flat/no-local-tax states with the wrong row shape** (IN, KY, MI, RI, WV) — each has a real, current, correct SST file, but 0 or 1 rows instead of one-per-county, so the existing county-count validation will throw. Needs its own "flat statewide rate" or "no county tax" code path, not a `GENERIC_SST_STATES` entry.
5c. **Treat WI as GA-shaped, not OH-shaped** — real county base is clean, but ~1,199 city rows encode Premier Resort Area surtaxes that a flat total would miss.
5d. **After 5's zip support lands, most of the 11 unzipped states still need GA-style address/place matching, not a flat county total** — only NV looks close to a simple county-only case; IA/KS/ND/NE/OK/SD/UT/VT/WA all have real city, special-district, or place-level variation confirmed in the 2026-08-26 pass.
5e. **Find NJ a real, current source** — its only SST file is 8+ years stale (2018); NJ appears to have stopped publishing through SST entirely. Pull its flat state rate directly from NJ's own Division of Taxation instead, and separately resolve Urban Enterprise Zone reduced-rate handling.
6. **Build IL and VA's bespoke adapters** (sources confirmed real 2026-08-26). VA's file is 3 years stale — reconfirm no newer regional-rate change exists before trusting it. IL's rate files are fixed-width `.txt`, not CSV/XLSX — check whether IL's own "Addendum Address Files" already solve the address-matching problem before building one from scratch.
7. **Build adapters for the 5 newly-confirmed machine-readable states** (AL, AZ, CO, LA, MO — see the 2026-08-26 source-discovery results above) — each still needs its own Step 1/2 live `XATXBD` investigation first, per the taxap-dev skill's rule that no state's matching strategy can be assumed from another's.
8. **NY's PDF parsing is solved (confirmed 2026-08-26, `pdftotext -table` reused cleanly from SC) but building is blocked on a human decision, not tooling** — the A+-matching investigation found two confirmed, currently-live rate mismatches (Suffolk County, Yonkers City) against the current Publication 718; see `docs/states/ny.md`. Hardcode MD in the meantime: it has no scrapable source at all (its FAQ page is a JS-rendered SPA) and no local tax to track — just hardcode the flat 6% rate, same treatment as CT/ME/MA/MS.
9. **Get a product decision from Ana/Liv on the 6 structurally-different-or-nonexistent states** before writing any adapter code for them: DE/MT/NH/OR (confirmed no general sales tax — how should their ship-tos be surfaced?), HI (GET, not a real sales tax — may not fit the comparison model at all), NM (GRT, seller-side legal incidence — likely fine to treat as functionally equivalent, but confirm). AK needs a scoping decision too (ARSSTC covers most but not all local jurisdictions).
10. **Re-check DC's official rate page** (currently 403ing as of 2026-08-26; was live in July 2026) before building its adapter — likely fine, single flat citywide rate, no address matching ever needed.
11. **Research the remaining 21 SST/IL/VA/MD states' sources with the same verified-fetch methodology** used for the 19 above (Step 0/3), since none of those 22 have had their claimed sources independently re-verified yet — only assumed correct from an earlier, unlogged pass.
12. **Matching work (layer 2) runs in parallel with 5–9** for every state as its source lands, since it's independent of which source format is used.

## What this is not

This is a plan, not a commitment to a timeline — per the handoff doc's own rule, nothing here should be read as claiming a source is validated, a rate is current, or a state is "done" until it's actually been captured and tested the way NC and GA were. **Finding and verifying a state's official source (what both 2026-08-26 passes did, for all 42 non-connected states) is not the same as that state being ready** — every one of them still needs its own live `XATXBD` investigation (Step 1/2 in `references/state-rollout.md`) before any matching or comparison code gets written, exactly as SC's Step 1 was done separately from finding ST-575. None of the 42 are ready to show any number, confirmed or not, until that work happens — and for the 16 claimed-SST states blocked on missing ZIP support or wrong row shape, the adapter itself isn't ready yet either, independent of the A+ side.
