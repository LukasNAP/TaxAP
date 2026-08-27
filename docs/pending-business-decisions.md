# TaxAP pending business decisions

This memo collects the questions that TaxAP cannot answer from A+ or Department of Revenue data alone. These are business decisions for Ana, Liv, and—where noted—Atlantic IT/privacy or the person who owns tax setup in A+.

The order is based on the apparent number of current ship-tos at risk or blocked. Counts are investigation snapshots, not permanent totals. An unknown count is shown as unknown rather than estimated.

## Standing defaults, confirmed by Lukas 2026-08-27 (apply without re-asking)

- **Confirmed live stale local tax-rate mismatches with no known Atlantic-specific exception should be flagged for correction, pending Ana/Liv sign-off** — not treated as an unresolved mystery each time. Applied below to all 10 states where this pattern was found.
- **Coverage-gap scope defaults to "Atlantic's current A+ footprint only," not full statewide district-level coverage** — confirmed for Missouri and Alabama, now the standing rule for every state with real-jurisdiction rows that A+ has no ship-to on at all (e.g. Iowa's 42 uncovered counties).
- **The recurring "DO-NOT-USE"-shaped / zero-rate / missing-definition placeholder tax bodies found across many states (AL000, MN000, IA000, ND000, NM000, IL000/ILOOO, TN000, OH000, WI000, ID000, WV000, WY000, AR000, CA000, RI000, DC000) are misinputs — data-entry errors, not an intentional business category (not "pending setup," not "exempt customer," not a documented fallback).** They do not need Ana/Liv to interpret their *meaning* — that question is closed. What's still open per state is the *mechanical* fix: correcting each ship-to's tax-body assignment in A+ is outside TaxAP's scope (TaxAP doesn't write to A+), but each placeholder should keep surfacing as a visible, named "misinput - needs correction in A+" exclusion count in TaxAP's findings, never silently dropped and never compared as if it were a real 0% jurisdiction.

## South Carolina — approve or reject external address matching

### Decision 1: May TaxAP send South Carolina ship-to addresses to the state geocoder? — **RESOLVED 2026-08-27: approved by Lukas**

1. **What was found:** South Carolina has different rates inside and outside city limits, so a ZIP code is not enough. The state Revenue and Fiscal Affairs Office offers a public address lookup that can locate an address within municipal and county boundaries. Using it would send active A+ street addresses—without customer names—to an external South Carolina government service. The service does not publish explicit automated-use terms, request limits, caching rules, or retention details.
2. **Question to answer:** ~~Does Atlantic IT/privacy approve this outbound address use?~~ **Answered: yes, outbound use approved.** Separately, should Atlantic obtain written permission from the state for batch lookup, caching, request frequency, and attribution before TaxAP uses the service? (Still open — not asked/answered as part of this approval.)
3. **Why it matters:** South Carolina has about 1,924 active ship-tos, making this one of TaxAP's largest state populations. Without address-level matching, TaxAP cannot reliably distinguish a city rate from the surrounding county rate.
4. **What the answer unlocks:** **Approved — the already-researched South Carolina matcher design can move into fixture-based development.** Still subject to Decision 2 below (how to handle the 13-row coverage gap) before the matcher is considered complete.

### Decision 2: How should unresolved South Carolina locations be handled? — **RESOLVED 2026-08-27: applying TaxAP's existing project-wide "never guess" rule, no new decision needed**

1. **What was found:** The official tax table contains 294 municipality/county combinations, while A+ has 281 ordinary municipality codes. Twenty-three multi-county combinations cannot be identified from the state map's city label alone. Charleston's map also appears to touch Dorchester County even though the tax table has no Charleston/Dorchester row. The state map contains a duplicate county identifier and one stale rate field, so TaxAP cannot trust those fields as shortcuts.
2. **Question to answer:** ~~Is the acceptable business rule to show any unresolved address as Needs review / unmatched, with no suggested rate, until its jurisdiction is confirmed?~~ **Already TaxAP's standing rule everywhere else (NC/GA/NJ/etc.) — apply it here too, no new sign-off needed.** The 13-row official-vs-A+ coverage gap is worth a quick look once the matcher is built (to see if it actually affects any real ship-to), but doesn't block starting the build.
3. **Why it matters:** A guessed county or city could produce a plausible but wrong rate.
4. **What the answer unlocks:** Engineering can finish the SC matcher (now approved, see Decision 1 above) with visible exception counts, the same pattern already used everywhere else in TaxAP.

## Louisiana — decide whether the statewide catch-all is intentional — **RESOLVED 2026-08-27: deliberate simplification, confirmed by Lukas**

1. **What was found:** A+ has only two Louisiana tax setups even though Louisiana has 64 parishes and hundreds of local taxing combinations. The statewide catch-all (`LA000`) is assigned to 346 of 353 Louisiana ship-tos—98%—at one flat 11% rate. Only five ship-tos use the Jefferson Parish-specific setup (`LA001`).
2. **Question to answer:** ~~Is Atlantic intentionally using one flat Louisiana rate as a business simplification, or is the lack of parish/domicile setup an unfinished tax configuration?~~ **Answered: deliberate simplification — keep the flat rate.**
3. **Why it matters:** This affects 346 current ship-tos. A perfect official-rate lookup would still compare nearly every address to the same A+ catch-all, so TaxAP would report widespread differences by design unless the intended policy is known first.
4. **What the answer unlocks:** **Confirmed intentional — TaxAP should document Louisiana as a deliberate exception and stop flagging `LA000` as a mismatch**, rather than pursuing parish-level rates or address matching.

## Minnesota — explain `MN000` and confirm the metro surcharge

### Decision 1: What does the `MN000` catch-all mean? — **RESOLVED 2026-08-27: misinput, standing default applied**

1. **What was found:** `MN000` covers 113 of 387 active Minnesota ship-tos—29%. Those addresses are spread across dozens of cities that also have correctly coded ship-tos, so it does not look like one special geographic area.
2. **Question to answer:** ~~Is `MN000` an intentional fallback for a known tax treatment, or is it an unfinished/missing jurisdiction assignment that should be corrected?~~ **Answered by standing default: misinput, not an intentional category.**
3. **Why it matters:** It is the largest known Minnesota bucket and affects 113 active ship-tos.
4. **What the answer unlocks:** TaxAP should surface `MN000`'s 113 ship-tos as a visible "misinput — needs correction in A+" exclusion, never compared as a real 0%/undefined jurisdiction and never silently dropped.

### Decision 2: Is Atlantic missing the Twin Cities metro surcharge?

1. **What was found:** Live investigation found a likely systemic undercharge of about one percentage point across all seven Twin Cities metro counties, consistent with a missing transit/housing surcharge. This still needs final confirmation against the primary state source before anyone calls it a billing error.
2. **Question to answer:** Once the state source confirms the surcharge, should Atlantic's normal taxable sales to all seven metro counties include it, or is there a documented product/customer exemption or other treatment that explains its absence?
3. **Why it matters:** The potential issue spans all seven metro counties and could affect a large share of Minnesota's 387 active ship-tos, not one isolated code.
4. **What the answer unlocks:** Primary-source confirmation plus the business treatment lets TaxAP implement the surcharge layer and identify affected A+ setups without labeling legitimate exceptions as undercharges.

## Iowa — explain `IA000` and set the coverage boundary — **RESOLVED 2026-08-27: both standing defaults applied**

### Decision 1: What does the `IA000` catch-all mean? — misinput, standing default

1. **What was found:** `IA000` is the single largest live Iowa bucket, covering 55 of 262 active ship-tos.
2. **Question to answer:** ~~Is `IA000` an intentional fallback with a known tax treatment, or does it represent ship-tos whose proper county was never configured?~~ **Answered by standing default: misinput, not intentional.**
3. **Why it matters:** Fifty-five active ship-tos cannot be safely judged until the code's purpose is known.
4. **What the answer unlocks:** TaxAP should surface `IA000`'s 55 ship-tos as a visible "misinput — needs correction in A+" exclusion.

### Decision 2: Should TaxAP cover counties where A+ has no tax setup today? — current-footprint-only, standing default

1. **What was found:** A+ has no tax-body row for 42 of Iowa's 99 real counties.
2. **Question to answer:** ~~Is TaxAP's job to monitor only jurisdictions already represented by an active A+ ship-to/tax body, or should it also identify and help establish missing coverage?~~ **Answered by standing default: current A+ footprint only.**
3. **Why it matters:** This is a 42-county scope gap.
4. **What the answer unlocks:** TaxAP compares Iowa's 57 already-configured counties only; the other 42 are out of scope, not a gap to fill.

## Alabama — explain the retired placeholder used by real ship-tos

### Decision 1: Is `AL000` an intentional fallback or a genuine setup gap? — **RESOLVED 2026-08-27: misinput, standing default applied**

1. **What was found:** `AL000` is labeled “DO NOT USE,” carries a 0% rate, and is nevertheless assigned to 101 of roughly 500 Alabama ship-tos. It is used more than any real Alabama jurisdiction code.
2. **Question to answer:** ~~Why are real ship-tos assigned to this retired placeholder?~~ **Answered by standing default: misinput, not an intentional business case.**
3. **Why it matters:** More than 100 current ship-tos sit in the largest Alabama bucket with no real rate information.
4. **What the answer unlocks:** TaxAP should surface `AL000`'s 101 ship-tos as a visible "misinput — needs correction in A+" exclusion, not compared as 0%.

### Decision 2: Which Alabama sale categories should TaxAP monitor? — **RESOLVED 2026-08-27: general sales rate only, confirmed by Lukas**

1. **What was found:** Alabama publishes materially different rates for general sales, motor vehicles, farm items, manufacturing, equipment, full city limits, unincorporated counties, and reduced-rate police jurisdictions. A+ also contains equipment-specific variants whose naming is not consistent.
2. **Question to answer:** ~~For Atlantic's normal sales/use-tax workflow, should TaxAP compare only the state's **general** rate category?~~ **Answered: yes, general sales rate only — equipment/machinery and police-jurisdiction rates are out of scope.**
3. **Why it matters:** A+ has about 124 usable Alabama codes versus roughly 366 official locality rows. Choosing the wrong sale category or ignoring the city/county/police-jurisdiction split would create confident but incorrect alerts across the state.
4. **What the answer unlocks:** **Confirmed scope — engineering should filter the official file to the general category only, keep `E`-suffixed equipment variants explicitly excluded from comparison, and not attempt police-jurisdiction rates.** Alabama's Decision 1 (what `AL000` means, 101/~500 ship-tos) is still open below.

## North Dakota — decide whether the state setup is effectively unbuilt — **RESOLVED 2026-08-27: urgent gap, confirmed by Lukas (ND's real statewide rate is 5%)**

1. **What was found:** Every active North Dakota ship-to uses `ND000`, which is hardcoded at 0%. North Dakota sales tax is not optional, so this is more serious than Hawaii's legally optional pass-on question and looks like an unbuilt state setup rather than a deliberate zero-tax policy.
2. **Question to answer:** ~~Is there any documented exemption or alternate billing mechanism that legitimately explains 0% for every North Dakota ship-to?~~ **Answered: no — `ND000` is a misinput (standing default), and North Dakota's real statewide rate is confirmed at 5%. Every active ND ship-to is being undercharged the full state rate today.**
3. **Why it matters:** The setup affects 100% of North Dakota ship-tos.
4. **What the answer unlocks:** **Confirmed urgent — flag to Ana/Liv as missing A+ configuration, not a routine stale-rate correction.** `ND000` should surface as a visible "misinput — needs correction in A+" exclusion; once real per-county codes exist, TaxAP can build a normal comparison against ND's 5% base plus any local option tax.

## New Jersey — confirm whether Atlantic qualifies for a reduced seller rate — **status 2026-08-27: Lukas not sure, needs to check with whoever owns UZ/Salem County certification**

1. **What was found:** New Jersey's normal 6.625% statewide rate matches A+ for 599 of 600 active New Jersey ship-tos; the remaining ship-to is visibly categorized as taxed in Georgia. New Jersey also has a real 3.3125% reduced-rate program for qualifying in-person retail sales by certified Urban Enterprise Zone or certain Salem County sellers. A+ has no code for that program.
2. **Question to answer:** Does Atlantic hold a qualifying UZ-2 or Salem County seller certification at any location, and does Atlantic make sales that qualify for the reduced rate?
3. **Why it matters:** If the answer is no, New Jersey's existing flat-rate comparison is complete. If yes, some otherwise legitimate 3.3125% transactions could be wrongly flagged—or the reduced treatment may be missing from A+ entirely. The number of qualifying sales is currently unknown.
4. **What the answer unlocks:** A “no” answer closes the caveat with no engineering change. A “yes” answer allows TaxAP and the A+ tax owner to design a seller-certification exception without applying the reduced rate to ordinary ship-to sales.

## New York — act on two confirmed live rate differences

### Decision 1: Suffolk County — **RESOLVED 2026-08-27: no known exception, flag for correction**

1. **What was found:** Suffolk County's A+ rate is 8.625%, while the current official rate is 8.75% (`NY4711`). This is a confirmed live difference in one of New York's most populous counties.
2. **Question to answer:** ~~Is there a documented Atlantic-specific treatment that explains the lower rate?~~ **Answered by standing default: no known exception — flag for A+ correction, pending Ana/Liv sign-off.**
3. **Why it matters:** A real customer could be charged 0.125 percentage points too little right now.
4. **What the answer unlocks:** TaxAP can report Suffolk as a confirmed correction item rather than an unexplained discrepancy.

### Decision 2: Yonkers City — **RESOLVED 2026-08-27: no known exception, flag for correction**

1. **What was found:** Yonkers is configured at 8.375% in A+, the ordinary Westchester County rate, while the current official Yonkers rate is 8.875% (`NY6511`). The configuration appears to omit Yonkers' entire 0.5-point city increment.
2. **Question to answer:** ~~Is there a documented reason Atlantic sales to Yonkers should use only the county rate?~~ **Answered by standing default: no known exception — flag for A+ correction, pending Ana/Liv sign-off.**
3. **Why it matters:** A real customer could be charged 0.5 percentage points too little right now.
4. **What the answer unlocks:** TaxAP can classify Yonkers as a confirmed correction and proceed with a defensible New York adapter (Decision 3 below, on Sherrill/Fulton/Ogdensburg code-numbering, is still open).

### Decision 3: What should happen to New York codes with no clean official counterpart? — **partially RESOLVED 2026-08-27 by direct data investigation: low priority**

1. **What was found:** A+ contains Sherrill City (`NY3014`) at 9% and Fulton City (`NY3551`) at 8%, but neither has a separate row in the current official summary. Conversely, the official summary lists Ogdensburg City while A+ has no dedicated Ogdensburg code. Several other A+ code numbers do not match the state's current reporting numbers even though their names and rates do match.
2. **Question to answer:** ~~Are Sherrill and Fulton codes still intentionally used?~~ **Answered by direct query: both `NY3014` and `NY3551` currently have zero active ship-tos.** They're dormant/orphaned, not causing any live pricing impact — downgraded from a live-risk question to a data-hygiene note. Still open: should TaxAP match New York by jurisdiction name rather than expect A+ and state code numbers to agree (a general methodology question, not specific to these two codes)? Should Ogdensburg share its county code?
3. **Why it matters:** With zero active ship-tos on the two ambiguous codes, no real customer is currently affected — this is no longer a blocker for building New York, just a note for whoever eventually assigns a New York ship-to to Sherrill or Fulton City in the future.
4. **What the answer unlocks:** New York's build can proceed without resolving this first; revisit only if/when a ship-to actually gets assigned to `NY3014` or `NY3551`.

## New Mexico — address a statewide stale base and a 0% catch-all

### Decision 1: Should all 18 real New Mexico codes be updated for the July 1, 2026 change? — **RESOLVED 2026-08-27: no known exception, flag for correction**

1. **What was found:** A statutory trigger raised New Mexico's state Gross Receipts Tax base from 4.875% to 5.125% effective July 1, 2026. A+ has not picked up that increase on any of its 18 real New Mexico codes. Roswell was already 0.375 points off even under the old base.
2. **Question to answer:** ~~Is there any documented Atlantic-specific timing or treatment that explains retaining the old base after July 1?~~ **Answered by standing default: no known exception — flag all 18 codes and Roswell's separate discrepancy for A+ correction, pending Ana/Liv sign-off.**
3. **Why it matters:** The stale base affects the entire configured state, not one locality.
4. **What the answer unlocks:** TaxAP can surface the statewide effective-date change and Roswell exception as confirmed correction items.

### Decision 2: What does `NM000` mean? — **RESOLVED 2026-08-27: misinput, standing default applied**

1. **What was found:** `NM000` carries 0% and is assigned to 26 of 88 active New Mexico ship-tos. There is no legitimate general 0% jurisdiction anywhere in New Mexico, and—unlike Hawaii—there is no legal choice to opt out of the tax entirely.
2. **Question to answer:** ~~Is `NM000` tied to documented exempt customers, or is it an unfinished fallback assignment?~~ **Answered by standing default: misinput, not a documented exemption.**
3. **Why it matters:** Nearly 30% of active New Mexico ship-tos are in this zero-rate bucket.
4. **What the answer unlocks:** TaxAP should surface `NM000`'s 26 ship-tos as a visible "misinput — needs correction in A+" exclusion.

### Decision 3: Does Atlantic need both sides of Rio Rancho represented? — **investigated 2026-08-27, inconclusive — low priority**

1. **What was found:** Rio Rancho crosses Sandoval and Bernalillo counties, which have different official rates, but A+ has only the Sandoval-side code (`NM29524`, 2 active ship-tos).
2. **Question to answer:** Does Atlantic currently have—or expect—ship-tos in the Bernalillo County portion of Rio Rancho? **Checked: both of `NM29524`'s 2 ship-tos carry ZIP 87124, which spans both the Sandoval and Bernalillo sides of the Rio Rancho city line (ZIP boundaries don't align with county lines here, the same caveat NY's Pub 718 documents explicitly) — city/ZIP-level aggregate data cannot resolve which side these 2 specific ship-tos are actually on.**
3. **Why it matters:** Only 2 ship-tos are affected — the lowest-impact open item in this entire memo.
4. **What the answer unlocks:** Given the tiny blast radius, recommend deferring this one rather than investing in address-level resolution — revisit only if New Mexico's ship-to count in this area grows.

## Colorado — resolve Denver and define the expected level of precision

### Decision 1: Denver's current rate differs — **RESOLVED 2026-08-27: no known exception, flag for correction**

1. **What was found:** Denver is 8.81% in A+ (`CO004`) versus 9.15% in Colorado's current official file—a 0.34-point difference caused by the city portion. Denver is Atlantic's largest Colorado market.
2. **Question to answer:** ~~Is there a documented self-collected/home-rule treatment or timing difference that explains 8.81%?~~ **Answered by standing default: no known exception — flag for A+ correction, pending Ana/Liv sign-off.**
3. **Why it matters:** This is Atlantic's largest Colorado market and could affect current invoices.
4. **What the answer unlocks:** TaxAP can report Denver as a confirmed correction item. Decision 2 below (full address-level precision for other multi-rate CO cities) is still open.

### Decision 2: Should TaxAP verify Colorado addresses down to county and special district? — **RESOLVED 2026-08-27: monitor assigned code only, confirmed by Lukas**

1. **What was found:** One Colorado city can have several correct rates depending on county, transit district, cultural district, or other local boundary. Aurora alone has five official variants, while A+ has one Aurora code. Colorado Springs, Monument, Parker, Timnath, and Broomfield also have multiple variants. One code labeled Canon City (`CO140206`) is priced like unincorporated Fremont County, so the label may describe a mailing city rather than the legal tax jurisdiction.
2. **Question to answer:** ~~Does Atlantic expect TaxAP to verify the full address-level district rate, or only monitor the rate on the A+ code already assigned?~~ **Answered: monitor the assigned code only — no full address/district-level Colorado matcher.** Canon City's specific labeling question is still open, but low priority given the narrower scope now confirmed.
3. **Why it matters:** A+ has only 57 sparse Colorado codes; a full boundary matcher would have been a large build for a state with limited coverage today.
4. **What the answer unlocks:** TaxAP compares each Colorado code against its closest official rate and flags ambiguous multi-rate cities (Aurora, Colorado Springs, etc.) rather than building real district-level matching.

## Arizona — resolve three rate differences and confirm the sales category

### Decision 1: Douglas, Casa Grande, and Taylor — **RESOLVED 2026-08-27: no known exception, flag for correction**

1. **What was found:** Three live A+ setups do not match Arizona's current retail table: Douglas (`AZ101`) reflects an old Cochise County rate; Casa Grande (`AZ017`) appears to omit the 1.1% Pinal County portion; and Taylor (`AZ4052`) appears to omit the town's entire 3% city portion.
2. **Question to answer:** ~~Does Atlantic have a documented exemption or Arizona-specific treatment for any of these three?~~ **Answered by standing default: no known exception — flag all three for A+ correction, pending Ana/Liv sign-off.**
3. **Why it matters:** Taylor could be under by 3 points, Casa Grande by 1.1 points, and Douglas is using a county rate that changed July 1, 2026.
4. **What the answer unlocks:** TaxAP can surface all three as confirmed correction items. Decision 3 below (AZ203/AZ3518 custom-grouping codes) is still open.

### Decision 2: Is Arizona's retail category the right default for Atlantic? — **RESOLVED 2026-08-27: yes, confirmed by Lukas**

1. **What was found:** The comparison used Arizona business code `017` (“Retail”), which matched the tested jurisdictions, but nobody has confirmed that this classification fits Atlantic's product mix. Arizona also has credit, tiered-rate, and other non-jurisdiction tax bodies that should not be mixed into a general-rate comparison.
2. **Question to answer:** ~~Should Ana/Liv treat `017` Retail as Atlantic's default Arizona category?~~ **Answered: yes, 017 Retail is the confirmed default.**
3. **Why it matters:** Using the wrong business category could make otherwise correct A+ rates look wrong across all Arizona ship-tos. The state has 35 plausible jurisdiction codes, most of which have not yet been individually verified.
4. **What the answer unlocks:** **Confirmed — engineering can build Arizona's comparison against business code 017 specifically.** Decisions 1 (Douglas/Casa Grande/Taylor stale rates) and 3 (custom-grouping codes) below are still open.

### Decision 3: How should Arizona places without an official counterpart be treated? — **`AZ203` RESOLVED 2026-08-27: confirmed live stale rate, not a custom grouping; `AZ3518` still open**

1. **What was found:** A+ has a Maricopa/Pinal hybrid (`AZ203`) and a Green Valley code (`AZ3518`) that have no direct row in the official table.
2. **Question to answer:** ~~Are these intentional custom groupings for known ship-tos?~~ **Answered for `AZ203`: it's not a custom grouping at all — it's the City of Maricopa, AZ, which straddles Maricopa and Pinal counties. Lukas confirmed the real current combined rate: Arizona state 5.6% + Pinal County 1.1% + City of Maricopa 2.5% (increased from 2.0% on 2025-10-01) = 9.2% total. A+'s `AZ203` is configured at only 6.7% (5.6% + 1.1%) — the entire 2.5% City of Maricopa portion is missing, confirmed live on 41 active ship-tos.** `AZ3518` (Green Valley) is still unaddressed.
3. **Why it matters:** 41 ship-tos are confirmed undercharged by 2.5 points today — the largest single confirmed gap found in Arizona, bigger than Douglas/Casa Grande/Taylor combined by ship-to count.
4. **What the answer unlocks:** `AZ203` joins Arizona's other three confirmed stale-rate findings (Douglas, Casa Grande, Taylor) — flag for A+ correction, pending Ana/Liv sign-off. `AZ3518` (Green Valley) still needs its own answer before Arizona's comparison is complete.

## Hawaii — **RESOLVED 2026-08-27: excluded entirely, per Lukas's explicit decision**

1. **What was found:** Every Hawaii ship-to uses one statewide code (`HI000`) at 0%. That covers 29 ship-tos and 9 customers. Hawaii has no buyer-facing sales tax at all — its General Excise Tax (GET) legally taxes the seller's gross receipts, and the "rate" a customer might see is a voluntary, uncapped-below-4.712% pass-on choice, not a statutory transaction tax.
2. **Question to answer:** ~~Does Atlantic intentionally choose not to pass Hawaii GET on to customers?~~ **Superseded: Hawaii doesn't have a sales tax, so this framing doesn't apply. Decided instead: exclude Hawaii from the comparison dashboard entirely, the same as DE/MT/NH/OR.**
3. **Why it matters:** Hawaii was previously the one state where TaxAP's normal per-address rate-comparison model didn't have a clean legal equivalent to compare against.
4. **What the answer unlocks:** **Done — `server/official-source-registry.mjs` and `app/page.tsx` now mark HI `no-general-sales-tax`, matching DE/MT/NH/OR's treatment.** No HI adapter should ever be built. Note this reverses the earlier (2026-08-25) decision to treat HI as "functionally equivalent to a normal sales tax" for comparison purposes — that earlier decision still stands for New Mexico (GRT), which is unaffected.

## Missouri — decide the intended monitoring scope before mapping sparse codes — **RESOLVED 2026-08-27: current footprint only, confirmed by Lukas**

1. **What was found:** A+ has 92 usable Missouri jurisdiction codes with inconsistent internal numbering, while Missouri's official system has thousands of overlapping city, county, and special-district combinations. The A+ list appears to be a sparse, customer-driven subset rather than statewide coverage. One additional code (`MO9999`) is a credit/adjustment code, not a place.
2. **Question to answer:** ~~Should TaxAP monitor only the Missouri codes currently assigned to Atlantic ship-tos, or is the business expectation complete district-level coverage for every Missouri destination?~~ **Answered: current footprint only.** `MO9999` (credits-only) is still unconfirmed as a sub-item, but low-stakes.
3. **Why it matters:** The exact active Missouri ship-to distribution has not yet been measured. A name-only or number-only join could confuse places with the same name or miss address-specific special districts, while a statewide build would be much larger than the current A+ setup.
4. **What the answer unlocks:** **Confirmed — engineering can proceed with a careful, code-by-code official-rate reconciliation against Missouri's existing 92 A+ codes only, no statewide address-matching build needed.** `MO9999` should still be visibly categorized (excluded as a credit code) rather than silently dropped or compared as a place.

## North Carolina — no unresolved Ana/Liv decision documented

North Carolina's 100 county codes match the current official rates, and known cross-state/legacy assignments are already displayed separately with exact counts. The remaining caution—periodically rechecking the alphabetical county-code convention—is an engineering/data-validation responsibility, not a pending business decision for Ana or Liv.

## 2026-08-26 (later session): 24 more states investigated — new decisions

The batch below comes from a second Layer 2 investigation pass that checked every one of TaxAP's remaining states against live A+ data (`docs/state-rollout.md`'s Step 1/Step 2 procedure). Combined with the batch above, **all 51 jurisdictions now have a completed Layer 2 investigation** except Delaware, Montana, New Hampshire, and Oregon, which are correctly excluded from comparison entirely (no general sales tax exists there). None of the states below are ready to build without the decision noted.

### Illinois — explain `IL000`/`ILOOO`, the largest placeholder share found in this rollout — **`IL000`/`ILOOO` RESOLVED 2026-08-27: misinput, standing default applied**

1. **What was found:** `IL000` and a typo variant `ILOOO` together cover 454 of 891 active Illinois ship-tos — 51%, more than half the state's book of business — with no XATXBD rate definition at all. Illinois also has a handful of cities (Aurora, Elgin) that straddle county lines and carry two different codes for the same city name.
2. **Question to answer:** ~~What governs tax today for the 454 ship-tos on `IL000`/`ILOOO`?~~ **Answered by standing default: misinput, not an intentional fallback.** The Aurora/Elgin address-dependent question is still open.
3. **Why it matters:** This is the largest placeholder-shaped bucket found in any state investigated in this project so far, both by percentage and by raw count — larger than Utah's prior high of 23.9%.
4. **What the answer unlocks:** TaxAP should surface `IL000`/`ILOOO`'s 454 ship-tos as a visible "misinput — needs correction in A+" exclusion. Illinois DOR's own "Addendum Address Files" should still be checked before building a custom Aurora/Elgin boundary matcher from scratch.

### Rhode Island and the District of Columbia — confirm whether tax is actually being collected — **RESOLVED 2026-08-27: urgent gap, confirmed by Lukas (RI's real statewide rate is 7%, DC's is 6%)**

1. **What was found:** Rhode Island's sole tax body (`RI000`) is configured at 0% against the state's real flat 7% rate, covering 100% of active RI ship-tos (40) and customers (22). DC's sole tax body (`DC000`) is configured at 0% against DC's real rate, covering 20 of 21 active DC ship-tos (95%). Neither state's tax is legally optional the way Hawaii's GET pass-on is — this is the same shape as North Dakota's finding, just newly confirmed in two more states.
2. **Question to answer:** ~~Is there a documented reason Atlantic charges $0 sales tax on every Rhode Island and DC ship-to today?~~ **Answered: no — `RI000`/`DC000` are misinputs (standing default), and both real rates are confirmed nonzero (RI 7%, DC 6% per Lukas — note this differs from this investigation's earlier finding of a legislated 6.5%→7.0% DC step; DC's official page is still 403ing as of 2026-08-26, so re-verify the exact current DC rate against a live source before building, rather than trusting either number blindly).**
3. **Why it matters:** Every current invoice to these 60 combined ship-tos may be undercharging tax with no dollar amount currently visible anywhere in A+.
4. **What the answer unlocks:** **Confirmed urgent — flag both to Ana/Liv as missing A+ configuration.** `RI000`/`DC000` should surface as visible "misinput — needs correction in A+" exclusions.

### California — resolve the LA-County templated rate and explain `CA000` — **RESOLVED 2026-08-27: `CA000` is a misinput; LA/Sonoma/Santa Clara clusters covered by the "no known exception, flag for correction" default extended to this same fact pattern**

1. **What was found:** `CA000` (no XATXBD definition at all, not a labeled DO-NOT-USE row) covers 233 of 1,574 active California ship-tos (14.8%), the largest raw-count placeholder bucket found in this project. Separately, roughly 21 Los Angeles-area tax-body codes (~305 ship-tos, ~19% of CA's book) all share one templated local-rate add-on that overcharges the unincorporated-county code by 0.5 point while undercharging nearly every LA city code by 0.25–1.0 point — one shared root cause, not 21 unrelated stale rates. Smaller but similarly systemic stale clusters exist in Sonoma and Santa Clara counties.
2. **Question to answer:** ~~What governs the 233 `CA000` ship-tos today? Is there a known reason Atlantic applies one flat local add-on across LA-area codes?~~ **Answered: `CA000` is a misinput (standing default). The LA/Sonoma/Santa Clara stale-rate clusters weren't in the original 10-state batch asked about directly, but match the identical "confirmed live stale rate, no known exception" pattern — flagged for correction under the same standing default, subject to Ana/Liv confirming no CA-specific exception exists before the actual A+ fix.**
3. **Why it matters:** Combined, these findings touch roughly 538 of California's 1,574 active ship-tos (~34%) — by far the largest-scale rate-accuracy question found in any state so far.
4. **What the answer unlocks:** `CA000` should surface as a visible "misinput — needs correction in A+" exclusion. The LA-area rates can be fixed as one coordinated update (one shared root cause) rather than 21 separate tickets, along with the Sonoma/Santa Clara clusters. California will still need real address-level matching (city name alone doesn't distinguish incorporated-city from unincorporated-county land) before a full comparison can ship — that's a technical follow-on, not a business decision.

### Tennessee — explain `TN000` and correct seven confirmed stale rates — **RESOLVED 2026-08-27: both standing defaults applied**

1. **What was found:** `TN000` has no rate definition at all and covers 183 of 929 active Tennessee ship-tos (19.7%) — the largest single tax-body bucket in the state, bigger than Nashville. Separately, seven real, currently-configured codes are confirmed stale against the current official rate (Nashville/Davidson Co. +0.50pt on 66 ship-tos; a McMinn County cluster of three cities −0.75pt, stale since 2020; Mount Juliet −0.50pt since 2020; Tipton County +0.50pt; Spring Hill −0.50pt since 2020; Kingsport +0.25pt; Mountain City −0.50pt since just 2025-01-01), covering 85 ship-tos combined.
2. **Question to answer:** ~~What governs tax for the 183 `TN000` ship-tos? Is there a documented reason for any of the seven stale codes?~~ **Answered: `TN000` is a misinput (standing default); the seven stale codes have no known exception — flag for A+ correction, pending Ana/Liv sign-off.**
3. **Why it matters:** Nearly a fifth of Tennessee's active book sits on an undefined placeholder, and Nashville — Tennessee's largest market — is a confirmed live 0.5-point undercharge today.
4. **What the answer unlocks:** `TN000` should surface as a visible "misinput — needs correction in A+" exclusion; the seven stale codes are confirmed correction items. Tennessee will still need real address-level matching (rates genuinely vary within a county, e.g. Memphis vs. bare Shelby County) before that comparison can be complete — that's a technical follow-on, not a business decision.

### Texas — decide how to handle same-city, different-county ambiguity, and correct one confirmed stale rate — **Midland RESOLVED 2026-08-27: no known exception, flag for correction**

1. **What was found:** A confirmed stale rate exists on Midland (`TX1421`, 9 ship-tos): A+ shows 8.0% against an official 8.25%/7.5% split that matches neither. Separately, roughly 63% of Texas's active ship-to volume — including its six highest-volume cities (Dallas, Houston, Fort Worth, San Antonio, Austin, El Paso) — sits on a bare city-name code that structurally collides with two or more county-qualified rows in the Comptroller's own published rate table, because the same city name can straddle counties with different totals. Every such case checked happens to agree today, but that is not guaranteed to stay true.
2. **Question to answer:** ~~Is there a documented reason for Midland's rate?~~ **Answered by standing default: no known exception — flag for A+ correction.** ~~Does Atlantic want Texas addresses matched down to the county level now?~~ **Answered 2026-08-27: no — monitor the currently-assigned codes, revisit only if a real mismatch shows up later.**
3. **Why it matters:** Midland is a confirmed, current, real gap. The broader same-city/different-county ambiguity affects the majority of Texas's 1,907 active ship-tos, but isn't producing a wrong number today.
4. **What the answer unlocks:** The Midland correction proceeds as a confirmed correction item. Texas ships as a code-level comparison now — no address/county-level matching build needed unless a future divergence is found.

### Florida — correct four confirmed stale county rates — **RESOLVED 2026-08-27: no known exception, flag for correction**

1. **What was found:** Four of Florida's 67 county codes are confirmed stale against the Florida DOR's current snapshot: Collier (A+ 7.0% vs. official 6.0% — A+ is *too high*), Flagler (7.5% vs. 7.0%), Hamilton (7.0% vs. 8.0% — A+ is *too low*), and Palm Beach (7.0% vs. 6.5%, on 83 active ship-tos, Florida's third-largest concentration). Separately, 41/1,479 (2.8%) active FL ship-tos carry a non-Florida tax body (mostly non-US "no tax" codes like DR000/MX000/HN000).
2. **Question to answer:** ~~Is there a documented reason for any of these four differences?~~ **Answered by standing default: no known exception — flag all four for A+ correction, pending Ana/Liv sign-off.** The 41 cross-context ship-tos follow the project's existing convention (GA/NV/MA/others) — excluded from Florida's own findings with a visible count, not compared as if Florida-priced.
3. **Why it matters:** Palm Beach alone affects 83 active ship-tos; Collier's direction (A+ charging *more* than the current official rate) is the opposite risk from the usual stale-and-undercharging pattern seen elsewhere.
4. **What the answer unlocks:** TaxAP can ship Florida's comparison with the right status; Florida's underlying code-to-county mapping itself needs no address matching, so this was the only blocker for that state.

### Pennsylvania — correct Philadelphia and decide on the missing Allegheny code — **Philadelphia RESOLVED 2026-08-27: already scheduled, no action needed beyond monitoring**

1. **What was found:** Philadelphia (`PA001`, 49 active ship-tos) is configured at 6% in A+ against the current official 8% total — and A+'s own data shows a scheduled correction to 8% effective 2026-10-01, confirming the gap is real and already known internally. Separately, no A+ tax body exists at all for Allegheny County (official rate 7%); any ship-to actually in Allegheny today would silently fall onto the generic `PA000` 6% catch-all with no way to detect the mismatch.
2. **Question to answer:** ~~Is the Philadelphia correction already scheduled to land on time, or does it need attention now?~~ **Philadelphia already has a scheduled A+ correction (`TBNRATE` shows 8% effective 2026-10-01) — no new action needed, just verify it actually lands on that date.** ~~Does Atlantic have any ship-tos in Allegheny County?~~ **Answered by aggregate city/ZIP investigation: yes — at least 64 active ship-tos on `PA000` carry a real Allegheny County city (Pittsburgh, Mt. Lebanon, Monroeville, Homestead, West Mifflin, Carnegie, Bridgeville, Coraopolis, Moon Township, Sewickley, and others), all currently taxed at PA000's flat 6% instead of Allegheny's real 7%.**
3. **Why it matters:** Philadelphia is a confirmed, currently-live 2-point undercharge on 49 ship-tos until the scheduled correction lands. Allegheny's gap is confirmed real and sizable — 64+ ship-tos undercharged 1 point today, not a hypothetical.
4. **What the answer unlocks:** Philadelphia just needs a post-2026-10-01 verification pass. **Allegheny needs a dedicated A+ tax-body code created and those 64+ ship-tos reassigned to it — flag for A+ correction, pending Ana/Liv sign-off, same as this memo's other confirmed gaps.**

### Ohio — explain `OH000` and correct one confirmed stale county rate — **RESOLVED 2026-08-27: both standing defaults applied**

1. **What was found:** `OH000` has an implausible 0% rate (not DO-NOT-USE-tagged, so not automatically excluded) and covers 65 of 936 active Ohio ship-tos (~6.9%). Separately, Knox County (`OH042`) is confirmed stale: A+ 6.75% vs. official 7.25% since 2023-10-01. (Ohio's ~16 counties with a transit-authority surcharge were separately confirmed to already be correctly included in A+'s rate — not a comparability problem, a real methodology validation.)
2. **Question to answer:** ~~What governs tax for the 65 `OH000` ship-tos? Is there a documented reason Knox County wasn't updated in 2023?~~ **Answered: `OH000` is a misinput (standing default); Knox County has no known exception — flag for A+ correction.**
3. **Why it matters:** Knox has been stale for nearly 3 years; `OH000` at a literal 0% general sales tax rate has no plausible legitimate reading.
4. **What the answer unlocks:** `OH000` should surface as a visible "misinput — needs correction in A+" exclusion; Knox County is a confirmed correction item. Ohio, otherwise the cleanest large state investigated (77 codes map 1:1 to real counties, no address matching needed), can now ship a comparison.

### Arkansas — explain `AR000` and correct eight confirmed stale local components — **RESOLVED 2026-08-27: both standing defaults applied; $2,500 cap still open**

1. **What was found:** `AR000` covers 46 of 324 active Arkansas ship-tos (14.2%), the largest tax-body group in the state. Separately, eight real codes show a confirmed live stale local-rate component (West Memphis, Paragould, Barling, Magnolia, Prairie Grove, Van Buren, Stephens, El Dorado — see `docs/states/ar.md` for exact gaps and effective dates), covering 28 ship-tos. A separate, unrelated caveat: Arkansas's real single-article $2,500 local-tax cap has no representation in the source file used for this or any future Arkansas comparison, so even a fully corrected flat-rate comparison would overstate true tax on large single-item sales.
2. **Question to answer:** ~~What governs tax for the `AR000` ship-tos? Should the eight stale codes be corrected?~~ **Answered: `AR000` is a misinput (standing default); the eight stale codes have no known exception — flag for A+ correction.** Still open: does Atlantic want the $2,500 cap modeled, and does anyone have a primary Arkansas DFA citation for its exact mechanics?
3. **Why it matters:** `AR000` is Arkansas's largest single bucket; the eight stale codes are confirmed and dated, several years old in some cases.
4. **What the answer unlocks:** `AR000` should surface as a visible "misinput — needs correction in A+" exclusion; the eight stale codes are confirmed correction items (address matching is otherwise not needed — A+ codes map cleanly to named cities/counties). The $2,500 cap question can be deferred separately since it affects only large single-item sales.

### West Virginia, Wisconsin, Idaho — explain three more placeholder buckets — **`WV000`/`WI000`/`ID000` RESOLVED 2026-08-27: misinput, standing default applied**

1. **What was found:** `WV000` covers 21 of 112 active West Virginia ship-tos (18.75%). `WI000` covers 42 of 424 active Wisconsin ship-tos (9.9%). `ID000` covers 12 of 95 active Idaho ship-tos (12.6%). All three follow the same shape as AL000/MN000/ND000/NE000/UT000/WA000 already flagged elsewhere in this memo. Separately, one live West Virginia code (`WV961`) is labeled "Missouri Lewisburg" — a wrong-state-named description on a real, active code, not yet confirmed as a harmless typo or genuine contamination.
2. **Question to answer:** ~~What governs tax for each of these three placeholder buckets?~~ **Answered by standing default: all three are misinputs.** ~~Is `WV961`'s description a cosmetic error or a real miscoded jurisdiction?~~ **Answered by direct query: cosmetic error, confirmed. `WV961`'s one active ship-to carries ZIP 24901 — the real Lewisburg, West Virginia (Greenbrier County), not Missouri. Safe to treat as a real WV municipal code with a mislabeled description, the same shape as Arkansas's "Arizona Beebe."**
3. **Why it matters:** Each placeholder affects a meaningful minority of that state's active ship-tos; `WV961` is now confirmed harmless (correctly priced, just mislabeled).
4. **What the answer unlocks:** `WV000`/`WI000`/`ID000` should each surface as a visible "misinput — needs correction in A+" exclusion. `WV961` can be folded into WV's normal findings as a real Lewisburg row (correct the description, not the rate). Idaho has a second, structural caveat independent of `ID000`: its Tax Commission does not centrally publish the ~23 resort-city local rates at all, so full Idaho coverage may not be achievable regardless of A+'s own setup.

### Virginia — confirm the Richmond city/county assignment — **RESOLVED 2026-08-27 by direct data investigation: confirmed miscoding**

1. **What was found:** A+ has two Richmond codes — `VA076` "Virginia Richmond" (59 active ship-tos, priced at the county rate, 5.3%) and `VA216` "Virginia Richmond (city)" (7 ship-tos, priced at the city rate, 6.0%).
2. **Question to answer:** ~~Are the 59 ship-tos on `VA076` actually in Richmond County, or are some/all of them miscoded City of Richmond addresses?~~ **Answered by aggregate city/ZIP investigation: of `VA076`'s 59 ship-tos, 57 carry City-of-Richmond ZIP codes (232xx — e.g. 23220-23237), not Richmond County. Only 2 (ZIP 22572, Warsaw) are genuinely in real Richmond County, whose county seat is Warsaw. One additional outlier (1 ship-to, Manassas VA, 20109) is unrelated to either Richmond and not investigated further here.**
3. **Why it matters:** 57 of 59 ship-tos on `VA076` are confirmed miscoded — real City of Richmond addresses being undercharged 0.7 points (5.3% vs. the correct 6.0%) on every invoice today.
4. **What the answer unlocks:** **No further data investigation needed — this is a confirmed live miscoding, not an open question.** Flag for A+ correction (reassign these 57 ship-tos from `VA076` to `VA216`), pending Ana/Liv sign-off, same as the other "no known exception" stale-rate items in this memo. Virginia is otherwise close to ready (106 of 133 real localities already map cleanly).

### Wyoming and Alaska — decide the actual scope of coverage — **RESOLVED 2026-08-27: Wyoming is an urgent gap; Alaska is excluded entirely, same as Hawaii**

1. **What was found:** 100% of Wyoming's 22 active ship-tos sit on non-jurisdiction placeholder codes (`WY000` "WYOMING NO TAX" and `ZTEMP`, both 0%) with no real per-county code in use at all, despite Wyoming having 23 real counties with official rates of 4–7%. Alaska has a single code (`AK000`, "Alaska no tax," 0%) covering all 8 active AK ship-tos — honestly named, unlike Wyoming's, but Alaska does have real local-only sales tax in 100+ home-rule boroughs/cities that A+ tracks none of.
2. **Question to answer:** ~~Is Wyoming's 0% intentional (a no-nexus or exemption policy) or an unbuilt setup?~~ **Answered: `WY000`/`ZTEMP` are misinputs (standing default) — Wyoming's real per-county rates (4-7%) are not being charged on any of its 22 active ship-tos.** ~~Does Atlantic want Alaska's real local tax tracked at all?~~ **Answered 2026-08-27: no — exclude Alaska from the comparison dashboard entirely, the same treatment as Hawaii.**
3. **Why it matters:** Wyoming is undercharging 100% of its active ship-tos today.
4. **What the answer unlocks:** **Wyoming confirmed as an urgent gap for Ana/Liv, same as ND/RI/DC** — flag `WY000`/`ZTEMP` as a visible "misinput — needs correction in A+" exclusion, then build real per-county codes. **Alaska is done — `server/official-source-registry.mjs` and `app/page.tsx` now mark AK `no-general-sales-tax`, no adapter will ever be built.**

### Mississippi — decide whether Jackson and Tupelo's city levies are in scope — **partially RESOLVED 2026-08-27 by direct data investigation: yes, real exposure confirmed**

1. **What was found:** Mississippi's sole A+ tax body (`MS000`, flat 7%) correctly matches the state's lack of a general local-option sales tax and covers 267 of 270 active ship-tos. Separately, Mississippi's DOR publishes two narrow, named-city special levies not modeled anywhere in A+: Jackson (+1%) and Tupelo (+0.25%), each on its own standalone page rather than in the main rate table.
2. **Question to answer:** ~~Does Atlantic have ship-tos inside Jackson or Tupelo city limits?~~ **Answered by aggregate city/ZIP investigation: yes — confirmed 11 active ship-tos in Jackson (ZIPs 39204, 39206, 39209, 39211, 39213, 39218) and 12 in Tupelo (ZIPs 38801, 38804), all currently taxed at the flat 7% `MS000` rate with no city levy applied.** Still open: does Ana/Liv want these two narrow levies tracked once Mississippi's already-built adapter (`server/ms-rates.mjs`) is extended to parse them?
3. **Why it matters:** 23 ship-tos combined are confirmed to be currently undercharged (Jackson should be 8%, Tupelo 7.25%) — this is real, not hypothetical exposure.
4. **What the answer unlocks:** A "yes" answer means `server/ms-rates.mjs` needs a Jackson/Tupelo carve-out (fetch and parse those two standalone DOR pages, already identified) and A+ needs dedicated codes for these 23 ship-tos. A "no" answer means Mississippi's existing flat 7% comparison can be trusted as-is despite the known gap.

## How Ana and Liv should use this memo

Work through the questions one state at a time and record the answer, who confirmed it, the date, and any supporting A+ screen or policy reference. A short answer such as “intentional fallback,” “missing setup,” “approved exemption,” “not in scope,” or “needs correction” is enough when it includes the reason and owner.

These questions do **not** ask Ana or Liv to build the integrations. Each answer unblocks a specific piece of engineering that is already researched, designed, or partly implemented: TaxAP can then finish the appropriate comparison, keep a documented exception, request a targeted A+ GUI correction, or explicitly leave an area unmatched instead of guessing.
