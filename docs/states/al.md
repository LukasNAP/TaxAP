# Alabama — findings

Status: **official source connected 2026-09-03; A+ comparison remains intentionally withheld.** `server/al-rates.mjs` now validates the current monthly `taxrates_current.csv` inventory and the separate 4% state general-rate page. A+'s `XATXBD` setup is real but coarse and has one large, unresolved data-quality question that must be answered before any comparison is trustworthy.

## Connected official inventory

The September 2026 current-only file contains 12,872 active category rows. TaxAP filters explicitly to `TaxType=ST` and `Rate Type=GENER`, yielding 823 general sales-tax locality/county records. It preserves the official municipality-to-county cross-reference instead of collapsing cross-county cities, and expands the `PJ=Y` records into their separately published police-jurisdiction rates.

The normalized inventory has 1,081 records: 189 county-code rows, 634 corporate-limit rows, and 258 police-jurisdiction rows. The state 4% general rate is added to each local component. Where Alabama publishes a corresponding `SU/GENER` row, TaxAP exposes that combined sellers-use rate separately as `generalInterstateRate`; 231 rows have no exact sellers-use counterpart and remain `null` rather than being guessed.

## Address matching

**Needed — and for a three-way split, not two.** Live `TBTXNAM` data shows a genuine three-tier structure per jurisdiction: unincorporated county ("...Uninc"), full in-city/"Corporate Limits" ("...CL" suffix, e.g. `AL7749` "Alabama Mobile CL"), and "Police Jurisdiction" (PJ, e.g. `AL7157` "Alabama Russell Co PJ" — a reduced rate for the zone just outside a city's limits, per state-rollout.md's own PJ note). All three can apply within what one ZIP code would treat as a single area — a flat code-to-rate table can't resolve this without knowing exactly where a ship-to sits.

A+'s catalog is also far coarser than reality: only ~124 real (non-retired, non-equipment) AL codes exist, against Alabama DOR's own ~366 locality rows. Real catalog gaps exist — e.g. no plain "Jefferson County Uninc" code at all, despite Jefferson being Alabama's most populous county. Many real Alabama municipalities/zones simply have no dedicated A+ code today; a naive code-only join would silently misclassify or drop ship-tos in those gaps.

## Rate comparability

**Unclear — a promising lead, not a confirmed mapping.** `TBCRATE` is a real sum of components (`TBCBSRT + TBCLRT1-4`). Spot-checked against the live AL DOR CSV for two counties:
- Baldwin: A+ `TBCRATE`=7 = state `TBCBSRT` 4 + local `TBCLRT1` 3; DOR's "GEN" rate-type row for Baldwin Co is 3.0% local-only.
- Mobile Co: A+ `TBCRATE`=5.5 = 4 + 1.5; DOR GEN row = 1.5% local-only.

Both lined up exactly once the state's 4% is added to the DOR CSV's local-only figure — **the DOR CSV's "Rate" column is local-only, not a combined total**, the opposite direction from Ohio's surcharge problem. The CSV also carries multiple Rate Type categories per locality (GEN, AUTO, FRM/farm, MFG) with materially different rates (Baldwin's AUTO rate is 1.25% vs. its GEN rate of 3.0%) — any adapter must filter to "GEN" specifically or silently compare the wrong category.

This was not validated beyond two counties (Jefferson/Birmingham didn't line up in a spot check, likely because Jefferson has no standalone A+ uninc code), and the comparison used a lossy markdown summarization of the CSV, not a real byte-level parse. Treat as a lead, not a confirmed mapping, until someone does an actual row-by-row parse+join across all ~124 A+ codes and the full DOR file.

## The blocking finding: AL000

**`AL000` is the single most heavily-used AL tax body in real `ADDR` data today** — 101 of roughly ~500 total AL ship-to rows use it, more than the next several codes combined. `AL000` is itself a "DO NOT USE" retired placeholder with `TBCRATE=0` in `XATXBD`. That means well over 100 real Alabama ship-tos currently carry a code that resolves to zero real tax-rate data.

**This must be understood before any AL comparison logic is built** — is it a genuine data-quality gap, a default fallback for un-set-up ship-tos, or something else CSR-side? Left unresolved, it will either wrongly exclude the largest single bucket of real AL ship-tos, or (if not filtered) wrongly report all of them as correctly at 0%.

Real-world usage otherwise concentrates heavily: after AL000, the next-heaviest codes are `AL9137` Birmingham/Jefferson (67), `AL9145` Huntsville (36), `AL9454` Montgomery (30), `AL7058` Birmingham(Shelby) (28), `AL9455` Florence (23), `AL9149` Mobile (23) — most of the ~124 other codes have single-digit usage.

## Exclusions found

- Standard `DO NOT USE` filter is **not sufficient alone**: a second placeholder, `TBTXBOD='AL 7161'` (note the embedded space — distinct from the real `AL7161`), has `TBTXNAM` = `'DO NO USE'` (typo, missing "T"). This silently passes a `NOT LIKE '%DO NOT USE%'` filter. Needs an explicit code-based exclusion. Worth grep-checking other states' pulls for the same typo.
- No wrong-state contamination found in `TBTXNAM` — every name says Alabama/ALABAMA or names a real AL city (unlike SC's `SC3622`).
- One separate anomaly: a ship-to on tax body `AL9137` (Birmingham) has `ADDR.SASHST='LA'` — a single-row ship-to mis-tag, not a tax-body naming problem.

## E-suffix equipment-tax variants confirmed, but the naming rule isn't uniform

About 19 of the 146 raw rows are E-suffixed equipment-tax variants (confirms the pattern first seen in CA). The numbering convention is **not always "same code + E"**: the city of Talladega follows it (`AL9387` base / `AL9387E` equip), but Talladega **county's** uninc equipment variant is a different code entirely (`AL7861E`, not derived from `AL7161`). An adapter that derives an equipment sibling by string-appending "E" to a known base code will silently miss or misassign this one.

## Step 3 — boundary/rate-detail source

The DOR provides an interactive address lookup, but no reviewed bulk address/ZIP boundary file has been identified for the PJ/city-limit matching Step 1 shows is needed. This is a separate open blocker from `AL000`; it does not prevent the official inventory from being connected, but it does prevent automatic address/A+ comparison.

## Do instead

- Resolve what `AL000` actually means (ask Ana/Liv or whoever owns AL billing) before building anything — it's the single biggest bucket of real AL ship-tos.
- Keep filtering to `TaxType=ST` and `Rate Type=GENER` specifically in the DOR CSV; never trust `TBCLRT1`/`TBCLRT2` positionally.
- Don't derive equipment-variant codes by string-appending "E" — confirm each pairing explicitly.
- Find a real AL address/boundary source before attempting the three-way (uninc/CL/PJ) matching Step 1 requires.
