# TaxAP pending business decisions

This memo collects the questions that TaxAP cannot answer from A+ or Department of Revenue data alone. These are business decisions for Ana, Liv, and—where noted—Atlantic IT/privacy or the person who owns tax setup in A+.

The order is based on the apparent number of current ship-tos at risk or blocked. Counts are investigation snapshots, not permanent totals. An unknown count is shown as unknown rather than estimated.

## Confirmed no-tax policies — September 10, 2026

The user confirmed that the existing AK, HI, ND and WY assignments are deliberate no-tax treatment. This supersedes earlier questions below about whether those current zero-rate assignments are unbuilt. TaxAP excludes only the confirmed configured zero-rate codes (AK000, HI000, ND000, WY000 and Wyoming ZTEMP), labels them as business policy, and never manufactures official 0% jurisdiction matches. New/nonzero/missing/retired assignments remain unresolved. It does not settle future collection obligations, legal exemptions or a future change to Hawaii GET pass-on policy.

## Selected comparison scope — September 9, 2026

The user directed: "Just do sales tax for now" in response to the Iowa/Vermont sales-versus-use question. Implement sales-tax comparisons with explicit scope labels; do not apply local sales-only rates as use-tax conclusions. Vermont and Iowa are now wired for supported assigned jurisdictions; Iowa mixed-county and unidentified assignments remain unresolved. This decision does not authorize A+ changes or settle exemptions and unidentified assignments.

## District of Columbia — explain the zero-rate assignments and schedule the enacted change

1. **What was found:** The 2026-09-03 read-only aggregate refresh found 20 active D.C. ship-tos on `DC000` at 0% and one on Honduras no-tax code `HN000`. D.C. OTR confirms the general rate is 6% through September 30, 2026 and 7% beginning October 1, 2026. A+ has neither the current rate nor a scheduled next rate on these groups.
2. **Question to answer:** Are all 21 assignments tied to documented exempt/no-tax treatment, or are they incomplete/incorrect D.C. tax-body assignments? If ordinary taxable sales are present, who will maintain `DC000`, correct the cross-jurisdiction assignment, and schedule the October 1 change through the supported A+ workflow?
3. **Why it matters:** Every active D.C. ship-to in the snapshot is currently assigned to a 0% group, so TaxAP cannot treat any of them as a normal official-rate match.
4. **What the answer unlocks:** Verified exemptions can remain documented exceptions. Any ordinary taxable assignments can be corrected in A+, after which TaxAP can compare the single citywide rate without address matching.

## Mississippi — verify cross-jurisdiction assignments and city-local coverage

1. **What was found:** Of 271 active Mississippi ship-tos, 268 use `MS000` at the correct 7% statewide base. Three use unrelated Dominican Republic, Honduras, or Missouri tax bodies. Mississippi DOR also imposes general-retail local levies in Jackson (1%) and Tupelo (0.25%), but no active Mississippi-specific city code appeared.
2. **Question to answer:** Are the three cross-jurisdiction assignments intentional? Do any current ship-tos lie inside Jackson or Tupelo, and if so, where is the local levy represented in A+?
3. **Why it matters:** A 7% match is correct outside the two cities but could understate ordinary taxable deliveries inside Jackson or Tupelo. The audit intentionally did not expose address rows, so the affected count is unknown.
4. **What the answer unlocks:** Confirmed exceptions and an approved city-boundary check allow TaxAP to distinguish exact statewide matches from any missing 8% Jackson or 7.25% Tupelo assignments.

## Idaho — resolve undefined assignments and choose a resort-city evidence scope

1. **What was found:** Idaho confirms a 6% statewide sales/use rate but directs taxpayers to 23 resort cities for local-option rates and product scopes. Of 98 active Idaho ship-tos, 85 use configured Idaho groups at 6%, 12 use undefined `ID000`, and one uses Minnesota code `MN430`.
2. **Question to answer:** What does `ID000` mean, and is `MN430` intentional? Should TaxAP obtain and maintain city-specific evidence for all 23 resort cities, or only those containing active Atlantic ship-tos?
3. **Why it matters:** The 6% state-rate match is not a complete total inside a resort city when its local tax applies to general merchandise. The state does not offer one authoritative rate table TaxAP can automate.
4. **What the answer unlocks:** Confirmed assignment handling and a defined city scope allow targeted boundary/evidence work without claiming statewide local completeness or maintaining irrelevant cities.

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

1. **What was found:** The 2026-09-02 aggregate refresh found `MN000` covering 106 of 387 active Minnesota ship-tos—27%. Those addresses are spread across dozens of cities that also have correctly coded ship-tos, so it does not look like one special geographic area.
2. **Question to answer:** Is `MN000` an intentional fallback for a known tax treatment, or is it an unfinished/missing jurisdiction assignment that should be corrected?
3. **Why it matters:** It is the largest known Minnesota bucket and affects 106 active ship-tos. Treating it as correct without an answer could hide missing setup; treating it as wrong without an answer could create 106 false alerts.
4. **What the answer unlocks:** TaxAP can either model `MN000` as a documented exception or flag its ship-tos for jurisdiction assignment and include them in normal official-rate comparisons.

### Decision 2: Is Atlantic missing the Twin Cities metro surcharge?

1. **What was found:** Live investigation found a likely systemic undercharge of about one percentage point across all seven Twin Cities metro counties, consistent with a missing transit/housing surcharge. This still needs final confirmation against the primary state source before anyone calls it a billing error.
2. **Question to answer:** Once the state source confirms the surcharge, should Atlantic's normal taxable sales to all seven metro counties include it, or is there a documented product/customer exemption or other treatment that explains its absence?
3. **Why it matters:** The potential issue spans all seven metro counties and could affect a large share of Minnesota's 387 active ship-tos, not one isolated code.
4. **What the answer unlocks:** Primary-source confirmation plus the business treatment lets TaxAP implement the surcharge layer and identify affected A+ setups without labeling legitimate exceptions as undercharges.

## Virginia — resolve Pittsylvania County and the retired Bedford City code

### Decision 1: Why is Pittsylvania County one point below the official rate?

1. **What was found:** The 2026-09-02 read-only aggregate refresh found `VA071` at 5.30% for seven active ship-tos. Virginia Tax's current workbook lists Pittsylvania County at 6.30%.
2. **Question to answer:** Is there a documented Atlantic-specific treatment that explains the 5.30% rate, or should the A+ setup be corrected to 6.30% through the supported GUI workflow?
3. **Why it matters:** This is a confirmed one-percentage-point difference on an actively used code. TaxAP must not suppress it, but it also must not change A+ automatically.
4. **What the answer unlocks:** A documented exception or completed A+ correction lets TaxAP safely include Pittsylvania County in Virginia's automatic comparison.

### Decision 2: What current locality should replace `VA240` Bedford City?

1. **What was found:** `VA240` is labelled `Virginia Bedford (city)` at 5.30% and is assigned to one active ship-to. Bedford is no longer an independent city and is absent from Virginia Tax's current 95-county/38-city workbook.
2. **Question to answer:** What is the ship-to's current legal county or independent-city jurisdiction, and should its A+ assignment be changed or retained as a documented legacy exception?
3. **Why it matters:** Matching a retired jurisdiction name to Bedford County by guess could assign the wrong legal destination even if the rate happens to be the same today.
4. **What the answer unlocks:** A confirmed locality allows the legacy code to be mapped, retired, or explicitly excluded with an auditable reason.

One additional Virginia ship-to uses North Carolina tax body `NC092`; confirm whether that is an approved cross-state exception before Virginia matching is declared complete.

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
3. **Why it matters:** The 2026-09-02 aggregate refresh found 32 active North Dakota ship-tos across nine customer assignments, and the setup affects all of them.
4. **What the answer unlocks:** A documented alternate mechanism would let TaxAP model the state honestly. Otherwise, engineering can surface a statewide setup alert and the tax owner can establish real jurisdiction/rate assignments through the A+ GUI.

## Nebraska — explain `NE000`

1. **What was found:** The 2026-09-02 aggregate refresh found 21 of 115 active Nebraska ship-tos assigned to `NE000`, which has no configured tax-body definition.
2. **Question to answer:** Is `NE000` an intentional fallback for exempt or specially handled sales, or does it represent ship-tos missing a Nebraska jurisdiction assignment?
3. **Why it matters:** Nebraska's official rates vary by city, one county, and special layers. Treating `NE000` as a normal statewide code would hide the location needed to determine the correct total.
4. **What the answer unlocks:** TaxAP can document an approved exception or route the 21 ship-tos for manual jurisdiction setup while comparing only validated configured codes.

## Nevada — explain `NV000`

1. **What was found:** The 2026-09-02 aggregate refresh found eight of 273 active Nevada ship-tos assigned to `NV000`, which has no configured tax-body definition. The remaining configured Nevada codes are county-labelled and use rates consistent with the current official county totals.
2. **Question to answer:** Is `NV000` an intentional fallback for exempt or specially handled sales, or does it represent Nevada ship-tos missing a county assignment?
3. **Why it matters:** Nevada's combined rate varies by county from 6.85% to 8.375%. A locationless fallback cannot be compared safely with the correct official total.
4. **What the answer unlocks:** TaxAP can preserve an approved exception or route the eight ship-tos for manual setup while an explicit reviewed county-name map compares the configured codes.

## Oklahoma — explain `OK000`

1. **What was found:** The 2026-09-02 aggregate refresh found two of 272 active Oklahoma ship-tos assigned to `OK000`, which has no configured tax-body definition. The remaining groups are labelled as Oklahoma city, county, or city/county combinations.
2. **Question to answer:** Is `OK000` an intentional fallback for exempt or specially handled sales, or does it represent ship-tos missing their Oklahoma delivery jurisdiction?
3. **Why it matters:** Oklahoma applies state, county, municipality, and sometimes special local layers at the delivery location. A locationless fallback cannot be compared safely with an official total.
4. **What the answer unlocks:** TaxAP can preserve an approved exception or route the two ship-tos for manual setup while a reviewed COPO/location crosswalk handles configured codes.

## South Dakota — explain the 0% statewide code

1. **What was found:** The 2026-09-02 aggregate refresh found nine of 42 active South Dakota ship-tos assigned to `SD000` at 0%. A separate configured code explicitly labelled “No Local Rt” correctly carries the 4.2% state rate.
2. **Question to answer:** Does `SD000` represent documented exempt sales or another billing mechanism, or are these nine ship-tos missing the appropriate statewide/municipality assignment?
3. **Why it matters:** South Dakota's 4.2% state sales/use tax ordinarily applies even where no municipal tax exists. Treating 0% as the no-local rate would hide the entire state component.
4. **What the answer unlocks:** TaxAP can preserve a verified exemption or route the nine ship-tos for manual setup while safely comparing explicit municipality and no-local-rate codes.

## Utah — explain `UT000`

1. **What was found:** The 2026-09-02 aggregate refresh found 37 of 221 active Utah ship-tos assigned to `UT000`, which has no configured tax-body definition. The remaining groups are municipality-labelled totals.
2. **Question to answer:** Is `UT000` an intentional fallback for exempt or specially handled sales, or does it represent ship-tos missing the Utah delivery-location code?
3. **Why it matters:** Utah's official combined rate depends on county, municipality, transportation, and other local layers at the buyer's receipt location. A locationless fallback cannot be compared safely.
4. **What the answer unlocks:** TaxAP can preserve an approved exception or route the 37 ship-tos for manual setup while a reviewed location-code/boundary matcher handles configured groups.

## Vermont — explain `VT000` and the county-labelled 7% code

1. **What was found:** The 2026-09-02 aggregate refresh found nine of 47 active Vermont ship-tos assigned to undefined `VT000`. A separate group labelled “Orleans Co.” carries 7%, although Vermont local-option sales tax is imposed by municipalities rather than counties.
2. **Question to answer:** Is `VT000` an intentional exemption/fallback, and what municipality or approved treatment is the Orleans County-labelled code intended to represent?
3. **Why it matters:** Vermont's ordinary rate is 6%, with an extra 1% only at qualifying destinations. A locationless fallback or county-wide 7% assumption could misclassify both local-option and non-local-option sales.
4. **What the answer unlocks:** TaxAP can preserve verified exceptions and build an explicit municipality mapping without treating a county label as authoritative.

## Washington — explain the two undefined location codes

1. **What was found:** The 2026-09-02 aggregate refresh found 30 of 469 active Washington ship-tos on undefined `WA000` and two more on undefined `WA3500`. Other configured groups use recognizable Washington DOR location-code conventions.
2. **Question to answer:** Are `WA000` and `WA3500` intentional exemption/fallback assignments, or are these 32 ship-tos missing valid Washington destination location codes?
3. **Why it matters:** Washington retail sales tax is destination-based, and local rates vary by exact receipt location. Undefined location codes cannot be compared safely with the official rate.
4. **What the answer unlocks:** TaxAP can preserve verified exceptions or route the 32 ship-tos for manual setup while an exact DOR/SST location-code matcher handles configured groups.

## Wisconsin — explain `WI000` and City of Milwaukee treatment

1. **What was found:** The 2026-09-02 aggregate refresh found 42 of 425 active Wisconsin ship-tos on undefined `WI000`. The only active Milwaukee-labelled group is Milwaukee County at 5.9% for 47 ship-tos; no City of Milwaukee 7.9% group appeared.
2. **Question to answer:** Is `WI000` an intentional exemption/fallback? Do any of the 47 Milwaukee County assignments deliver inside the City of Milwaukee, and if so, where is the city's additional 2% represented?
3. **Why it matters:** Wisconsin DOR identifies 7.9% as the general City of Milwaukee total versus 5.9% elsewhere in Milwaukee County. A county-only assignment could understate tax for city destinations.
4. **What the answer unlocks:** TaxAP can preserve verified exceptions, distinguish city from county destinations, and determine whether a dedicated A+ city setup or another documented mechanism is required.

## West Virginia — explain `WV000` and `WV961`

1. **What was found:** The 2026-09-02 aggregate refresh found 21 of 112 active West Virginia ship-tos on undefined `WV000`. One additional ship-to uses `WV961`, whose description says “Missouri Lewisburg.” A separate 6% no-local group already exists and covers 23 ship-tos.
2. **Question to answer:** Is `WV000` an intentional exemption/fallback? Is `WV961` a mislabeled West Virginia municipality, a Missouri assignment with the wrong prefix, or another approved exception?
3. **Why it matters:** West Virginia municipalities add 1% only inside their boundaries, while legitimate no-local destinations remain 6%. Undefined or conflicting-state codes cannot establish the correct treatment.
4. **What the answer unlocks:** TaxAP can preserve verified exceptions, route incorrect setup for manual correction, and compare the remaining municipality/no-local groups using an explicit map.

## New Jersey — confirm whether Atlantic qualifies for a reduced seller rate

1. **What was found:** New Jersey's normal 6.625% statewide rate matches A+ for 599 of 600 active New Jersey ship-tos; the remaining ship-to is visibly categorized as taxed in Georgia. New Jersey also has a real 3.3125% reduced-rate program for qualifying in-person retail sales by certified Urban Enterprise Zone or certain Salem County sellers. A+ has no code for that program.
2. **Question to answer:** Does Atlantic hold a qualifying UZ-2 or Salem County seller certification at any location, and does Atlantic make sales that qualify for the reduced rate?
3. **Why it matters:** If the answer is no, New Jersey's existing flat-rate comparison is complete. If yes, some otherwise legitimate 3.3125% transactions could be wrongly flagged—or the reduced treatment may be missing from A+ entirely. The number of qualifying sales is currently unknown.
4. **What the answer unlocks:** A “no” answer closes the caveat with no engineering change. A “yes” answer allows TaxAP and the A+ tax owner to design a seller-certification exception without applying the reduced rate to ordinary ship-to sales.

## Alaska — confirm remote-seller coverage scope

### Decision 1: Does ARSSTC membership cover Atlantic's Alaska obligations?

1. **What was found:** Alaska has no state sales tax. TaxAP now connects the current ARSSTC workbook, which contains 56 participating remote-seller destination rows as of 2026-09-01, including layered city/borough and seasonal totals. ARSSTC does not cover every Alaska municipality.
2. **Question to answer:** Are all Atlantic sales into Alaska governed through ARSSTC member jurisdictions, or must TaxAP also monitor nonmember municipalities directly?
3. **Why it matters:** Treating a nonmember location as 0% because it is absent from the ARSSTC workbook could understate tax; treating every municipality as an ARSSTC destination would overstate the source's legal coverage.
4. **What the answer unlocks:** A yes answer allows the current member workbook plus approved address boundaries to define scope. A no answer identifies the need for a maintained nonmember municipal source before automatic comparison.

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
4. **What the answer unlocks:** The official New York adapter is now connected. The answer lets TaxAP classify Yonkers as a confirmed correction or documented exception and proceed with a defensible automatic A+ comparison.

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

1. **What was found:** `NM000` carries 0% and was assigned to 26 of 88 active New Mexico ship-tos in the saved audit. The current official GIS file does contain four specifically named Isleta Pueblo class-1 location codes at 0%, but `NM000` is not one of those codes and provides no evidence that its ship-tos belong to those districts.
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

### Decision 4: Should Kingman's September 1 rate change be applied in A+?

1. **What was found:** ADOR's September 2026 file and rate-change notice show Kingman's retail city rate increased from 2.5% to 3%. With Mohave County's 5.6% combined state/county row, the current total is 8.6%; A+ `AZ650` remains 8.1% for one active ship-to.
2. **Question to answer:** Is there any documented treatment that preserves the old Kingman rate, or should the A+ code be updated through the supported workflow?
3. **Why it matters:** This is a current, effective-dated half-point difference, not a historical or inferred discrepancy.
4. **What the answer unlocks:** A confirmed exception or correction lets TaxAP classify Kingman alongside the three previously documented Arizona cases.

## Hawaii — decide whether Atlantic passes GET on to customers

1. **What was found:** The 2026-09-03 refresh found every Hawaii ship-to uses one statewide code (`HI000`) at 0%: 26 ship-tos and 11 customer assignments. Hawaii's maximum General Excise Tax pass-on rate is currently 4.7120%, but businesses are legally allowed to pass on any amount from zero up to that cap; they are not required to charge customers the tax. The official policy/rate adapter is connected, but automatic mismatch logic is intentionally disabled.
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

## How Ana and Liv should use this memo

Work through the questions one state at a time and record the answer, who confirmed it, the date, and any supporting A+ screen or policy reference. A short answer such as “intentional fallback,” “missing setup,” “approved exemption,” “not in scope,” or “needs correction” is enough when it includes the reason and owner.

These questions do **not** ask Ana or Liv to build the integrations. Each answer unblocks a specific piece of engineering that is already researched, designed, or partly implemented: TaxAP can then finish the appropriate comparison, keep a documented exception, request a targeted A+ GUI correction, or explicitly leave an area unmatched instead of guessing.
