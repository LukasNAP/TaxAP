# TaxAP pending business decisions

This memo collects the questions that TaxAP cannot answer from A+ or Department of Revenue data alone. These are business decisions for Ana, Liv, and—where noted—Atlantic IT/privacy or the person who owns tax setup in A+.

The order is based on the apparent number of current ship-tos at risk or blocked. Counts are investigation snapshots, not permanent totals. An unknown count is shown as unknown rather than estimated.

## South Carolina — approve or reject external address matching

### Decision 1: May TaxAP send South Carolina ship-to addresses to the state geocoder?

1. **What was found:** South Carolina has different rates inside and outside city limits, so a ZIP code is not enough. The state Revenue and Fiscal Affairs Office offers a public address lookup that can locate an address within municipal and county boundaries. Using it would send active A+ street addresses—without customer names—to an external South Carolina government service. The service does not publish explicit automated-use terms, request limits, caching rules, or retention details.
2. **Question to answer:** Does Atlantic IT/privacy approve this outbound address use? Separately, should Atlantic obtain written permission from the state for batch lookup, caching, request frequency, and attribution before TaxAP uses the service?
3. **Why it matters:** South Carolina has about 1,924 active ship-tos, making this one of TaxAP's largest state populations. Without address-level matching, TaxAP cannot reliably distinguish a city rate from the surrounding county rate.
4. **What the answer unlocks:** Approval and written operating terms allow the already-researched South Carolina matcher design to move into fixture-based development. A “no” answer means TaxAP must leave South Carolina at official-rate monitoring only or find a different approved boundary source.

### Decision 2: How should unresolved South Carolina locations be handled?

1. **What was found:** The official tax table contains 294 municipality/county combinations, while A+ has 281 ordinary municipality codes. Twenty-three multi-county combinations cannot be identified from the state map's city label alone. Charleston's map also appears to touch Dorchester County even though the tax table has no Charleston/Dorchester row. The state map contains a duplicate county identifier and one stale rate field, so TaxAP cannot trust those fields as shortcuts.
2. **Question to answer:** Is the acceptable business rule to show any unresolved address as **Needs review / unmatched**, with no suggested rate, until its jurisdiction is confirmed? Should Ana and Liv review the 13-row official-versus-A+ coverage gap before South Carolina is considered complete?
3. **Why it matters:** A guessed county or city could produce a plausible but wrong rate. The impact is potentially any South Carolina ship-to near a municipal or county boundary; the exact affected ship-to count is not yet known.
4. **What the answer unlocks:** An explicit “never guess; show unmatched” decision lets engineering finish the matcher with visible exception counts. Review of the 13-row gap determines whether missing A+ jurisdictions must be added or can remain out of scope because Atlantic has no affected ship-tos.

## Louisiana — decide whether the statewide catch-all is intentional

1. **What was found:** A+ has only two Louisiana tax setups even though Louisiana has 64 parishes and hundreds of local taxing combinations. The statewide catch-all (`LA000`) is assigned to 346 of 353 Louisiana ship-tos—98%—at one flat 11% rate. Only five ship-tos use the Jefferson Parish-specific setup (`LA001`).
2. **Question to answer:** Is Atlantic intentionally using one flat Louisiana rate as a business simplification, or is the lack of parish/domicile setup an unfinished tax configuration? If it is unfinished, does Atlantic want jurisdiction-level coverage added for every Louisiana area where it ships?
3. **Why it matters:** This affects 346 current ship-tos. A perfect official-rate lookup would still compare nearly every address to the same A+ catch-all, so TaxAP would report widespread differences by design unless the intended policy is known first.
4. **What the answer unlocks:** If the flat rate is intentional, TaxAP can document Louisiana as a deliberate exception and avoid misleading alerts. If granular collection is required, work can proceed on an official domicile-rate source and address mapping, but A+ will also need a much larger jurisdiction setup maintained through its normal GUI process.

## Minnesota — explain `MN000` and confirm the metro surcharge

### Decision 1: What does the `MN000` catch-all mean?

1. **What was found:** `MN000` covers 113 of 387 active Minnesota ship-tos—29%. Those addresses are spread across dozens of cities that also have correctly coded ship-tos, so it does not look like one special geographic area.
2. **Question to answer:** Is `MN000` an intentional fallback for a known tax treatment, or is it an unfinished/missing jurisdiction assignment that should be corrected?
3. **Why it matters:** It is the largest known Minnesota bucket and affects 113 active ship-tos. Treating it as correct without an answer could hide missing setup; treating it as wrong without an answer could create 113 false alerts.
4. **What the answer unlocks:** TaxAP can either model `MN000` as a documented exception or flag its ship-tos for jurisdiction assignment and include them in normal official-rate comparisons.

### Decision 2: Is Atlantic missing the Twin Cities metro surcharge?

1. **What was found:** Live investigation found a likely systemic undercharge of about one percentage point across all seven Twin Cities metro counties, consistent with a missing transit/housing surcharge. This still needs final confirmation against the primary state source before anyone calls it a billing error.
2. **Question to answer:** Once the state source confirms the surcharge, should Atlantic's normal taxable sales to all seven metro counties include it, or is there a documented product/customer exemption or other treatment that explains its absence?
3. **Why it matters:** The potential issue spans all seven metro counties and could affect a large share of Minnesota's 387 active ship-tos, not one isolated code.
4. **What the answer unlocks:** Primary-source confirmation plus the business treatment lets TaxAP implement the surcharge layer and identify affected A+ setups without labeling legitimate exceptions as undercharges.

## Iowa — explain `IA000` and set the coverage boundary

### Decision 1: What does the `IA000` catch-all mean?

1. **What was found:** `IA000` is the single largest live Iowa bucket, covering 55 of 262 active ship-tos.
2. **Question to answer:** Is `IA000` an intentional fallback with a known tax treatment, or does it represent ship-tos whose proper county was never configured?
3. **Why it matters:** Fifty-five active ship-tos cannot be safely judged until the code's purpose is known. Excluding them would silently hide the largest Iowa bucket; treating them as normal could hide missing assignments.
4. **What the answer unlocks:** TaxAP can either document and separately report the fallback or route those ship-tos into county-level review and comparison.

### Decision 2: Should TaxAP cover counties where A+ has no tax setup today?

1. **What was found:** A+ has no tax-body row for 42 of Iowa's 99 real counties.
2. **Question to answer:** Is TaxAP's job to monitor only jurisdictions already represented by an active A+ ship-to/tax body, or should it also identify and help establish missing coverage for every Iowa county where Atlantic may do business?
3. **Why it matters:** This is a 42-county scope gap. It may represent places where Atlantic has no customers, or it may expose missing setup; the investigation does not establish which.
4. **What the answer unlocks:** A “current A+ footprint only” decision defines a finite comparison. An “all business areas” decision triggers a coverage audit and, where needed, manual A+ setup before TaxAP can call Iowa complete.

## Alabama — explain the retired placeholder used by real ship-tos

### Decision 1: Is `AL000` an intentional fallback or a genuine setup gap?

1. **What was found:** `AL000` is labeled “DO NOT USE,” carries a 0% rate, and is nevertheless assigned to 101 of roughly 500 Alabama ship-tos. It is used more than any real Alabama jurisdiction code.
2. **Question to answer:** Why are real ship-tos assigned to this retired placeholder? Is it an intentional fallback for a known business case, or an unfinished/incorrect tax assignment that needs review?
3. **Why it matters:** More than 100 current ship-tos sit in the largest Alabama bucket with no real rate information. Silently excluding it would hide the largest problem; comparing it as 0% would falsely imply Alabama tax is zero.
4. **What the answer unlocks:** TaxAP can either model the bucket as an explicitly approved exception or flag its ship-tos for proper jurisdiction assignment before Alabama rate comparison is enabled.

### Decision 2: Which Alabama sale categories should TaxAP monitor?

1. **What was found:** Alabama publishes materially different rates for general sales, motor vehicles, farm items, manufacturing, equipment, full city limits, unincorporated counties, and reduced-rate police jurisdictions. A+ also contains equipment-specific variants whose naming is not consistent.
2. **Question to answer:** For Atlantic's normal sales/use-tax workflow, should TaxAP compare only the state's **general** rate category? Are equipment/machinery transactions and police-jurisdiction rates part of Ana and Liv's monitoring scope, and who can identify which sales qualify?
3. **Why it matters:** A+ has about 124 usable Alabama codes versus roughly 366 official locality rows. Choosing the wrong sale category or ignoring the city/county/police-jurisdiction split would create confident but incorrect alerts across the state.
4. **What the answer unlocks:** A confirmed scope lets engineering filter the official file correctly, keep equipment variants separate, and pursue the appropriate address-boundary source instead of mixing unlike tax categories.

## North Dakota — decide whether the state setup is effectively unbuilt

1. **What was found:** Every active North Dakota ship-to uses `ND000`, which is hardcoded at 0%. North Dakota sales tax is not optional, so this is more serious than Hawaii's legally optional pass-on question and looks like an unbuilt state setup rather than a deliberate zero-tax policy.
2. **Question to answer:** Is there any documented exemption or alternate billing mechanism that legitimately explains 0% for every North Dakota ship-to? If not, should North Dakota be treated as an urgent missing A+ configuration?
3. **Why it matters:** The setup affects 100% of North Dakota ship-tos. The exact ship-to count was not included in this memo's source material, so it must be measured before remediation, but the blast radius is the entire state population.
4. **What the answer unlocks:** A documented alternate mechanism would let TaxAP model the state honestly. Otherwise, engineering can surface a statewide setup alert and the tax owner can establish real jurisdiction/rate assignments through the A+ GUI.

## New Jersey — confirm whether Atlantic qualifies for a reduced seller rate

1. **What was found:** New Jersey's normal 6.625% statewide rate matches A+ for 599 of 600 active New Jersey ship-tos; the remaining ship-to is visibly categorized as taxed in Georgia. New Jersey also has a real 3.3125% reduced-rate program for qualifying in-person retail sales by certified Urban Enterprise Zone or certain Salem County sellers. A+ has no code for that program.
2. **Question to answer:** Does Atlantic hold a qualifying UZ-2 or Salem County seller certification at any location, and does Atlantic make sales that qualify for the reduced rate?
3. **Why it matters:** If the answer is no, New Jersey's existing flat-rate comparison is complete. If yes, some otherwise legitimate 3.3125% transactions could be wrongly flagged—or the reduced treatment may be missing from A+ entirely. The number of qualifying sales is currently unknown.
4. **What the answer unlocks:** A “no” answer closes the caveat with no engineering change. A “yes” answer allows TaxAP and the A+ tax owner to design a seller-certification exception without applying the reduced rate to ordinary ship-to sales.

## New York — act on two confirmed live rate differences

### Decision 1: Suffolk County

1. **What was found:** Suffolk County's A+ rate is 8.625%, while the current official rate is 8.75% (`NY4711`). This is a confirmed live difference in one of New York's most populous counties.
2. **Question to answer:** Is there a documented Atlantic-specific treatment that explains the lower rate, or should the Suffolk tax setup be corrected in A+?
3. **Why it matters:** A real customer could be charged 0.125 percentage points too little right now. The exact active ship-to/customer count for this code was not measured in the documented investigation.
4. **What the answer unlocks:** A confirmed correction or exception lets TaxAP ship the Suffolk comparison with the right status and evidence rather than merely reporting an unexplained discrepancy.

### Decision 2: Yonkers City

1. **What was found:** Yonkers is configured at 8.375% in A+, the ordinary Westchester County rate, while the current official Yonkers rate is 8.875% (`NY6511`). The configuration appears to omit Yonkers' entire 0.5-point city increment.
2. **Question to answer:** Is there a documented reason Atlantic sales to Yonkers should use only the county rate, or should the Yonkers setup be corrected?
3. **Why it matters:** A real customer could be charged 0.5 percentage points too little right now. The exact active ship-to/customer count for this code was not measured.
4. **What the answer unlocks:** The answer lets TaxAP classify Yonkers as a confirmed correction or documented exception and proceed with a defensible New York adapter.

### Decision 3: What should happen to New York codes with no clean official counterpart?

1. **What was found:** A+ contains Sherrill City at 9% and Fulton City at 8%, but neither has a separate row in the current official summary. Conversely, the official summary lists Ogdensburg City while A+ has no dedicated Ogdensburg code. Several other A+ code numbers do not match the state's current reporting numbers even though their names and rates do match.
2. **Question to answer:** Are Sherrill and Fulton codes still intentionally used, and should Ogdensburg share its county code because the rate is currently identical? Should TaxAP match New York by jurisdiction name rather than expect A+ and state code numbers to agree?
3. **Why it matters:** The documented investigation did not measure active usage for these codes. A code-number-only comparison would silently misjoin legitimate jurisdictions even when the rates happen to agree.
4. **What the answer unlocks:** Business confirmation of intended code usage lets engineering finish a name-based mapping and keep any unresolved codes visible instead of silently omitting them.

## New Mexico — address a statewide stale base and a 0% catch-all

### Decision 1: Should all 18 real New Mexico codes be updated for the July 1, 2026 change?

1. **What was found:** A statutory trigger raised New Mexico's state Gross Receipts Tax base from 4.875% to 5.125% effective July 1, 2026. A+ has not picked up that increase on any of its 18 real New Mexico codes. Roswell was already 0.375 points off even under the old base.
2. **Question to answer:** Is there any documented Atlantic-specific timing or treatment that explains retaining the old base after July 1? If not, should all 18 real codes—and Roswell's separate discrepancy—be treated as current correction work?
3. **Why it matters:** The stale base affects the entire configured state, not one locality. New Mexico has 88 active ship-tos in the documented snapshot; exact distribution among the 18 real codes should be measured before changes are made.
4. **What the answer unlocks:** A confirmed correction decision lets TaxAP surface the statewide effective-date change and Roswell exception, while Ana/Liv can coordinate supported A+ GUI maintenance and post-change verification.

### Decision 2: What does `NM000` mean?

1. **What was found:** `NM000` carries 0% and is assigned to 26 of 88 active New Mexico ship-tos. There is no legitimate general 0% jurisdiction anywhere in New Mexico, and—unlike Hawaii—there is no legal choice to opt out of the tax entirely.
2. **Question to answer:** Is `NM000` tied to documented exempt customers or another verified billing mechanism, or is it an unfinished fallback assignment?
3. **Why it matters:** Nearly 30% of active New Mexico ship-tos are in this zero-rate bucket. Calling it correct would hide a potentially serious gap; calling it wrong without checking exemptions could create false alarms.
4. **What the answer unlocks:** TaxAP can separate verified exemptions from missing jurisdiction setup and show the 26 ship-tos as an explicit reviewed category rather than a silent omission.

### Decision 3: Does Atlantic need both sides of Rio Rancho represented?

1. **What was found:** Rio Rancho crosses Sandoval and Bernalillo counties, which have different official rates, but A+ has only the Sandoval-side code.
2. **Question to answer:** Does Atlantic currently have—or expect—ship-tos in the Bernalillo County portion of Rio Rancho, and should that portion receive its own A+ setup?
3. **Why it matters:** The affected count is not yet known. If such addresses exist, one city name would otherwise point to the wrong county rate.
4. **What the answer unlocks:** The answer determines whether New Mexico can remain a direct jurisdiction mapping or needs a specific Rio Rancho county-boundary exception.

## Colorado — resolve Denver and define the expected level of precision

### Decision 1: Denver's current rate differs

1. **What was found:** Denver is 8.81% in A+ (`CO004`) versus 9.15% in Colorado's current official file—a 0.34-point difference caused by the city portion. Denver is Atlantic's largest Colorado market.
2. **Question to answer:** Is there a documented self-collected/home-rule treatment or timing difference that explains 8.81%, or should Denver be corrected to the current official 9.15% total?
3. **Why it matters:** The exact active ship-to count was not measured in the documented investigation, but this is Atlantic's largest Colorado market and could affect current invoices.
4. **What the answer unlocks:** A confirmed explanation or correction lets TaxAP report Denver accurately and determines whether other self-collected Colorado cities need the same focused audit.

### Decision 2: Should TaxAP verify Colorado addresses down to county and special district?

1. **What was found:** One Colorado city can have several correct rates depending on county, transit district, cultural district, or other local boundary. Aurora alone has five official variants, while A+ has one Aurora code. Colorado Springs, Monument, Parker, Timnath, and Broomfield also have multiple variants. One code labeled Canon City (`CO140206`) is priced like unincorporated Fremont County, so the label may describe a mailing city rather than the legal tax jurisdiction.
2. **Question to answer:** Does Atlantic expect TaxAP to verify the full address-level district rate, or only monitor the rate on the A+ code already assigned? Is the Canon City code intentionally for an address outside city limits, or is it mislabeled/mispriced?
3. **Why it matters:** A+ has only 57 sparse Colorado codes, and the exact ship-to count in multi-rate areas was not measured. A city-name-only comparison can be confidently wrong even when both source values look valid.
4. **What the answer unlocks:** A full-address decision permits design of a Colorado boundary/district matcher. A narrower monitoring decision limits TaxAP to clearly comparable codes and labels the rest ambiguous. Clarifying Canon City determines whether that code is an exception or a correction.

## Arizona — resolve three rate differences and confirm the sales category

### Decision 1: Douglas, Casa Grande, and Taylor

1. **What was found:** Three live A+ setups do not match Arizona's current retail table: Douglas (`AZ101`) reflects an old Cochise County rate; Casa Grande (`AZ017`) appears to omit the 1.1% Pinal County portion; and Taylor (`AZ4052`) appears to omit the town's entire 3% city portion.
2. **Question to answer:** Does Atlantic have a documented exemption or Arizona-specific treatment for any of these three, or should they be corrected as stale/incomplete setups?
3. **Why it matters:** Taylor could be under by 3 points, Casa Grande by 1.1 points, and Douglas is using a county rate that changed July 1, 2026. Active ship-to/customer counts for the three codes were not measured, so usage must be checked before remediation.
4. **What the answer unlocks:** Confirmed corrections or exceptions let TaxAP safely surface the three findings and proceed with an Arizona comparison instead of treating every mismatch as unexplained.

### Decision 2: Is Arizona's retail category the right default for Atlantic?

1. **What was found:** The comparison used Arizona business code `017` (“Retail”), which matched the tested jurisdictions, but nobody has confirmed that this classification fits Atlantic's product mix. Arizona also has credit, tiered-rate, and other non-jurisdiction tax bodies that should not be mixed into a general-rate comparison.
2. **Question to answer:** Should Ana/Liv treat `017` Retail as Atlantic's default Arizona category? Which product or customer situations require a different category?
3. **Why it matters:** Using the wrong business category could make otherwise correct A+ rates look wrong across all Arizona ship-tos. The state has 35 plausible jurisdiction codes, most of which have not yet been individually verified.
4. **What the answer unlocks:** A confirmed classification lets engineering parse and compare the correct official rows while keeping special categories separate.

### Decision 3: How should Arizona places without an official counterpart be treated?

1. **What was found:** A+ has a Maricopa/Pinal hybrid (`AZ203`) and a Green Valley code (`AZ3518`) that have no direct row in the official table.
2. **Question to answer:** Are these intentional custom groupings for known ship-tos? Should TaxAP leave them as visible exceptions requiring address review rather than force them onto a nearby official row?
3. **Why it matters:** The affected ship-to count was not measured. A forced name match would silently compare the wrong jurisdiction.
4. **What the answer unlocks:** Confirmation allows TaxAP to classify these codes as approved custom exceptions or route them to address-level review.

## Hawaii — decide whether Atlantic passes GET on to customers

1. **What was found:** Every Hawaii ship-to uses one statewide code (`HI000`) at 0%. That covers 29 ship-tos and 9 customers. Hawaii's maximum General Excise Tax pass-on rate is currently 4.7120%, but businesses are legally allowed to pass on any amount from zero up to that cap; they are not required to charge customers the tax.
2. **Question to answer:** Does Atlantic intentionally choose not to pass Hawaii GET on to customers? If Atlantic does pass it on, where is that charge recorded—through the normal A+ tax setup, a manual invoice line, or another mechanism?
3. **Why it matters:** The same data supports two opposite conclusions: 0% could be correct company policy or a complete missing setup. TaxAP would be confidently wrong if it assumed either answer.
4. **What the answer unlocks:** If 0% is intentional, TaxAP can model Hawaii as a voluntary ceiling rather than a required-rate mismatch. If Atlantic intends to pass GET on, engineering can monitor the correct mechanism; if that is the normal tax code, Hawaii becomes a simple statewide comparison.

## Missouri — decide the intended monitoring scope before mapping sparse codes

1. **What was found:** A+ has 92 usable Missouri jurisdiction codes with inconsistent internal numbering, while Missouri's official system has thousands of overlapping city, county, and special-district combinations. The A+ list appears to be a sparse, customer-driven subset rather than statewide coverage. One additional code (`MO9999`) is a credit/adjustment code, not a place.
2. **Question to answer:** Should TaxAP monitor only the Missouri codes currently assigned to Atlantic ship-tos, or is the business expectation complete district-level coverage for every Missouri destination? Is `MO9999` confirmed as credits-only and therefore outside Ana/Liv's general rate review?
3. **Why it matters:** The exact active Missouri ship-to distribution has not yet been measured. A name-only or number-only join could confuse places with the same name or miss address-specific special districts, while a statewide build would be much larger than the current A+ setup.
4. **What the answer unlocks:** A current-footprint scope permits a careful, code-by-code official-rate reconciliation. A complete-coverage decision requires address-level district matching and a broader A+ setup audit. Confirming `MO9999` allows it to be visibly categorized rather than silently dropped.

## North Carolina — no unresolved Ana/Liv decision documented

North Carolina's 100 county codes match the current official rates, and known cross-state/legacy assignments are already displayed separately with exact counts. The remaining caution—periodically rechecking the alphabetical county-code convention—is an engineering/data-validation responsibility, not a pending business decision for Ana or Liv.

## 2026-08-26 (later session): 24 more states investigated — new decisions

The batch below comes from a second Layer 2 investigation pass that checked every one of TaxAP's remaining states against live A+ data (`docs/state-rollout.md`'s Step 1/Step 2 procedure). Combined with the batch above, **all 51 jurisdictions now have a completed Layer 2 investigation** except Delaware, Montana, New Hampshire, and Oregon, which are correctly excluded from comparison entirely (no general sales tax exists there). None of the states below are ready to build without the decision noted.

### Illinois — explain `IL000`/`ILOOO`, the largest placeholder share found in this rollout

1. **What was found:** `IL000` and a typo variant `ILOOO` together cover 454 of 891 active Illinois ship-tos — 51%, more than half the state's book of business — with no XATXBD rate definition at all. Illinois also has a handful of cities (Aurora, Elgin) that straddle county lines and carry two different codes for the same city name.
2. **Question to answer:** What governs tax today for the 454 ship-tos on `IL000`/`ILOOO`? Is this an intentional fallback, or an unfinished jurisdiction assignment?
3. **Why it matters:** This is the largest placeholder-shaped bucket found in any state investigated in this project so far, both by percentage and by raw count — larger than Utah's prior high of 23.9%.
4. **What the answer unlocks:** TaxAP can either document the bucket as an approved exception or route those 454 ship-tos into jurisdiction assignment before an Illinois comparison is built. Separately, Illinois DOR's own "Addendum Address Files" should be checked before building a custom Aurora/Elgin boundary matcher from scratch.

### Rhode Island and the District of Columbia — confirm whether tax is actually being collected

1. **What was found:** Rhode Island's sole tax body (`RI000`) is configured at 0% against the state's real flat 7% rate, covering 100% of active RI ship-tos (40) and customers (22). DC's sole tax body (`DC000`) is configured at 0% against DC's real, legislated (not optional) rate of roughly 6.5% today, stepping to 7.0% on 10/1/2026, covering 20 of 21 active DC ship-tos (95%). Neither state's tax is legally optional the way Hawaii's GET pass-on is — this is the same shape as the already-flagged North Dakota finding, just newly confirmed in two more states.
2. **Question to answer:** Is there a documented reason Atlantic charges $0 sales tax on every Rhode Island and DC ship-to today, or is this simply an unbuilt/never-configured setup in both states?
3. **Why it matters:** If unintentional, every current invoice to these 60 combined ship-tos may be undercharging tax with no dollar amount currently visible anywhere in A+.
4. **What the answer unlocks:** A confirmed answer lets engineering either document RI/DC as a known, approved zero-rate treatment or flag both as urgent missing configuration, the same fork already offered for North Dakota.

### California — resolve the LA-County templated rate and explain `CA000`

1. **What was found:** `CA000` (no XATXBD definition at all, not a labeled DO-NOT-USE row) covers 233 of 1,574 active California ship-tos (14.8%), the largest raw-count placeholder bucket found in this project. Separately, roughly 21 Los Angeles-area tax-body codes (~305 ship-tos, ~19% of CA's book) all share one templated local-rate add-on that overcharges the unincorporated-county code by 0.5 point while undercharging nearly every LA city code by 0.25–1.0 point — one shared root cause, not 21 unrelated stale rates. Smaller but similarly systemic stale clusters exist in Sonoma and Santa Clara counties.
2. **Question to answer:** What governs the 233 `CA000` ship-tos today? And is there a known reason Atlantic applies one flat local add-on across all Los Angeles-area codes instead of each jurisdiction's real current rate?
3. **Why it matters:** Combined, these two findings touch roughly 538 of California's 1,574 active ship-tos (~34%) — by far the largest-scale rate-accuracy question found in any state so far.
4. **What the answer unlocks:** A confirmed correction plan lets TaxAP fix the LA-area rates as one coordinated update rather than 21 separate tickets, and either close or escalate the `CA000` gap. California will also need real address-level matching (city name alone doesn't distinguish incorporated-city from unincorporated-county land) before a full comparison can ship — that is a separate, purely technical follow-on once these business questions are answered.

### Tennessee — explain `TN000` and correct seven confirmed stale rates

1. **What was found:** `TN000` has no rate definition at all and covers 183 of 929 active Tennessee ship-tos (19.7%) — the largest single tax-body bucket in the state, bigger than Nashville. Separately, seven real, currently-configured codes are confirmed stale against the current official rate (Nashville/Davidson Co. +0.50pt on 66 ship-tos; a McMinn County cluster of three cities −0.75pt, stale since 2020; Mount Juliet −0.50pt since 2020; Tipton County +0.50pt; Spring Hill −0.50pt since 2020; Kingsport +0.25pt; Mountain City −0.50pt since just 2025-01-01), covering 85 ship-tos combined.
2. **Question to answer:** What governs tax for the 183 `TN000` ship-tos? Is there a documented reason for any of the seven stale codes, or should they be corrected?
3. **Why it matters:** Nearly a fifth of Tennessee's active book sits on an undefined placeholder, and Nashville — Tennessee's largest market — is a confirmed live 0.5-point undercharge today.
4. **What the answer unlocks:** A confirmed correction plan lets TaxAP ship a Tennessee comparison; Tennessee will also need real address-level matching (rates genuinely vary within a county, e.g. Memphis vs. bare Shelby County) before that comparison can be complete.

### Texas — decide how to handle same-city, different-county ambiguity, and correct one confirmed stale rate

1. **What was found:** A confirmed stale rate exists on Midland (`TX1421`, 9 ship-tos): A+ shows 8.0% against an official 8.25%/7.5% split that matches neither. Separately, roughly 63% of Texas's active ship-to volume — including its six highest-volume cities (Dallas, Houston, Fort Worth, San Antonio, Austin, El Paso) — sits on a bare city-name code that structurally collides with two or more county-qualified rows in the Comptroller's own published rate table, because the same city name can straddle counties with different totals. Every such case checked happens to agree today, but that is not guaranteed to stay true.
2. **Question to answer:** Is there a documented reason for Midland's rate, or should it be corrected? Separately, does Atlantic want Texas addresses matched down to the county level now, before any of these currently-agreeing splits diverges, or is monitoring the currently-assigned code sufficient?
3. **Why it matters:** Midland is a confirmed, current, real gap. The broader address-matching question affects the majority of Texas's 1,907 active ship-tos, even though it isn't producing a wrong number today.
4. **What the answer unlocks:** A Midland correction is independent of the larger address-matching question and can proceed on its own. The broader answer determines whether Texas ships as a code-level comparison now or waits for real address/county matching.

### Florida — correct four confirmed stale county rates

1. **What was found:** Four of Florida's 67 county codes are confirmed stale against the Florida DOR's current snapshot: Collier (A+ 7.0% vs. official 6.0% — A+ is *too high*), Flagler (7.5% vs. 7.0%), Hamilton (7.0% vs. 8.0% — A+ is *too low*), and Palm Beach (7.0% vs. 6.5%, on 83 active ship-tos, Florida's third-largest concentration).
2. **Question to answer:** Is there a documented reason for any of these four differences, or should they be corrected in A+?
3. **Why it matters:** Palm Beach alone affects 83 active ship-tos; Collier's direction (A+ charging *more* than the current official rate) is the opposite risk from the usual stale-and-undercharging pattern seen elsewhere.
4. **What the answer unlocks:** A confirmed correction lets TaxAP ship Florida's comparison with the right status; Florida's underlying code-to-county mapping itself needs no address matching, so this is the only blocker for that state.

### Pennsylvania — correct Philadelphia and decide on the missing Allegheny code

1. **What was found:** Philadelphia (`PA001`, 49 active ship-tos) is configured at 6% in A+ against the current official 8% total — and A+'s own data shows a scheduled correction to 8% effective 2026-10-01, confirming the gap is real and already known internally. Separately, no A+ tax body exists at all for Allegheny County (official rate 7%); any ship-to actually in Allegheny today would silently fall onto the generic `PA000` 6% catch-all with no way to detect the mismatch.
2. **Question to answer:** Is the Philadelphia correction already scheduled to land on time, or does it need attention now? Does Atlantic have any ship-tos in Allegheny County, and if so, should a dedicated code be created?
3. **Why it matters:** Philadelphia is a confirmed, currently-live 2-point undercharge on 49 ship-tos. The Allegheny gap has unknown ship-to exposure since no code exists to reveal it.
4. **What the answer unlocks:** Confirming the Philadelphia timeline lets TaxAP treat it as "correction in progress" rather than "unaddressed." Confirming Allegheny exposure (zero vs. nonzero) determines whether a new code is actually needed.

### Ohio — explain `OH000` and correct one confirmed stale county rate

1. **What was found:** `OH000` has an implausible 0% rate (not DO-NOT-USE-tagged, so not automatically excluded) and covers 65 of 936 active Ohio ship-tos (~6.9%). Separately, Knox County (`OH042`) is confirmed stale: A+ 6.75% vs. official 7.25% since 2023-10-01. (Ohio's ~16 counties with a transit-authority surcharge were separately confirmed to already be correctly included in A+'s rate — not a comparability problem, a real methodology validation.)
2. **Question to answer:** What governs tax for the 65 `OH000` ship-tos? Is there a documented reason Knox County wasn't updated in 2023?
3. **Why it matters:** Knox has been stale for nearly 3 years; `OH000` at a literal 0% general sales tax rate has no plausible legitimate reading the way NV000's small share might.
4. **What the answer unlocks:** A confirmed correction lets Ohio, otherwise the cleanest large state investigated (77 codes map 1:1 to real counties, no address matching needed), ship a comparison with only these two items resolved first.

### Arkansas — explain `AR000` and correct eight confirmed stale local components

1. **What was found:** `AR000` covers 46 of 324 active Arkansas ship-tos (14.2%), the largest tax-body group in the state. Separately, eight real codes show a confirmed live stale local-rate component (West Memphis, Paragould, Barling, Magnolia, Prairie Grove, Van Buren, Stephens, El Dorado — see `docs/states/ar.md` for exact gaps and effective dates), covering 28 ship-tos. A separate, unrelated caveat: Arkansas's real single-article $2,500 local-tax cap has no representation in the source file used for this or any future Arkansas comparison, so even a fully corrected flat-rate comparison would overstate true tax on large single-item sales.
2. **Question to answer:** What governs tax for the `AR000` ship-tos? Should the eight stale codes be corrected? Does Atlantic want the $2,500 cap modeled, and if so, does anyone have a primary Arkansas DFA citation for its exact mechanics?
3. **Why it matters:** `AR000` is Arkansas's largest single bucket; the eight stale codes are confirmed and dated, several years old in some cases.
4. **What the answer unlocks:** A confirmed correction plan lets Arkansas ship a comparison (address matching is otherwise not needed — A+ codes map cleanly to named cities/counties); the $2,500 cap question can be deferred separately since it affects only large single-item sales.

### West Virginia, Wisconsin, Idaho — explain three more placeholder buckets

1. **What was found:** `WV000` covers 21 of 112 active West Virginia ship-tos (18.75%). `WI000` covers 42 of 424 active Wisconsin ship-tos (9.9%). `ID000` covers 12 of 95 active Idaho ship-tos (12.6%). All three follow the same shape as AL000/MN000/ND000/NE000/UT000/WA000 already flagged elsewhere in this memo. Separately, one live West Virginia code (`WV961`) is labeled "Missouri Lewisburg" — a wrong-state-named description on a real, active code, not yet confirmed as a harmless typo or genuine contamination.
2. **Question to answer:** What governs tax for each of these three placeholder buckets? Is `WV961`'s description a cosmetic error (like Arkansas's "Arizona Beebe") or does it point to a real miscoded jurisdiction?
3. **Why it matters:** Each affects a meaningful minority of that state's active ship-tos; `WV961` specifically could mean a ship-to is silently priced using the wrong state's rate.
4. **What the answer unlocks:** Confirmed answers let each state's placeholder be modeled as a documented exception or routed to jurisdiction assignment. Idaho has a second, structural caveat independent of `ID000`: its Tax Commission does not centrally publish the ~23 resort-city local rates at all, so full Idaho coverage may not be achievable regardless of A+'s own setup.

### Virginia — confirm the Richmond city/county assignment

1. **What was found:** A+ has two Richmond codes — `VA076` "Virginia Richmond" (59 active ship-tos, priced at the county rate, 5.3%) and `VA216` "Virginia Richmond (city)" (7 ship-tos, priced at the city rate, 6.0%). The volume is skewed heavily toward the lower-rate county code, which is numerically surprising since the City of Richmond (the state capital) would normally be expected to carry more ship-tos than rural Richmond County.
2. **Question to answer:** Are the 59 ship-tos on `VA076` actually in Richmond County, or are some/all of them miscoded City of Richmond addresses being undercharged 0.7 points?
3. **Why it matters:** If even a portion of the 59 are miscoded, this is a live, currently-undetected undercharge on real invoices in Virginia's capital.
4. **What the answer unlocks:** Confirming actual ship-to addresses for this cluster resolves the question directly; short of that, Ana/Liv may want to flag the 59 for manual review before Virginia's comparison (otherwise close to ready — 106 of 133 real localities already map cleanly) is trusted.

### Wyoming and Alaska — decide the actual scope of coverage

1. **What was found:** 100% of Wyoming's 22 active ship-tos sit on non-jurisdiction placeholder codes (`WY000` "WYOMING NO TAX" and `ZTEMP`, both 0%) with no real per-county code in use at all, despite Wyoming having 23 real counties with official rates of 4–7%. Alaska has a single code (`AK000`, "Alaska no tax," 0%) covering all 8 active AK ship-tos — honestly named, unlike Wyoming's, but Alaska does have real local-only sales tax in 100+ home-rule boroughs/cities that A+ tracks none of.
2. **Question to answer:** Is Wyoming's 0% intentional (a no-nexus or exemption policy) or an unbuilt setup? Does Atlantic want Alaska's real local tax tracked at all, given that even the best available public source (ARSSTC) only covers its member jurisdictions, not every Alaska taxing municipality?
3. **Why it matters:** Both states currently show a flat $0 sales tax on every active ship-to; for Wyoming that is likely wrong (real tax exists in 23 counties), while Alaska is closer to Hawaii's category (a real product-scope question, not simply an error) since Alaska has no *state* tax and only partial-coverage local tax.
4. **What the answer unlocks:** A Wyoming decision either builds a real per-county mapping or documents the 0% as intentional. An Alaska decision determines whether TaxAP pursues a necessarily-incomplete local-tax comparison there or excludes Alaska from local-tax monitoring the way DE/MT/NH/OR are excluded from general-tax monitoring.

### Mississippi — decide whether Jackson and Tupelo's city levies are in scope

1. **What was found:** Mississippi's sole A+ tax body (`MS000`, flat 7%) correctly matches the state's lack of a general local-option sales tax and covers 267 of 270 active ship-tos. Separately, Mississippi's DOR publishes two narrow, named-city special levies not modeled anywhere in A+: Jackson (+1%) and Tupelo (+0.25%), each on its own standalone page rather than in the main rate table.
2. **Question to answer:** Does Atlantic have ship-tos inside Jackson or Tupelo city limits, and if so, does Ana/Liv want those two narrow levies tracked once Mississippi gets an official-source adapter?
3. **Why it matters:** The affected ship-to count for these two cities specifically is not yet known from this aggregate-only investigation.
4. **What the answer unlocks:** A "yes" answer means Mississippi's eventual adapter needs a Jackson/Tupelo carve-out; a "no" (or "not in scope") answer means Mississippi can ship as a simple flat 7% comparison once a source is connected.

## How Ana and Liv should use this memo

Work through the questions one state at a time and record the answer, who confirmed it, the date, and any supporting A+ screen or policy reference. A short answer such as “intentional fallback,” “missing setup,” “approved exemption,” “not in scope,” or “needs correction” is enough when it includes the reason and owner.

These questions do **not** ask Ana or Liv to build the integrations. Each answer unblocks a specific piece of engineering that is already researched, designed, or partly implemented: TaxAP can then finish the appropriate comparison, keep a documented exception, request a targeted A+ GUI correction, or explicitly leave an area unmatched instead of guessing.
