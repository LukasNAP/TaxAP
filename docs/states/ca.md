# CA — findings

Status: **A+ tax-body configuration comparison built and wired (2026-08-28); address-assignment validation remains a future boundary-matching task.** `server/ca-aplus.mjs` compares a configured CA tax body only when its own A+ description explicitly identifies exactly one CDTFA county or one unique CDTFA city. It never uses a ship-to address, ZIP, mailing city, or inferred county. A live aggregate-only run on 2026-08-28 compared 1,327 ship-tos, found 46 confirmed current-rate differences affecting 446 ship-tos, and left zero comparable rows unmatched. `CA000`/`CA001`/`CA003` missing definitions (236 ship-tos), `CA1034E` equipment category (1), and 11 cross-state assignments are reported as visible exclusions. The old boundary requirement still matters: this comparison validates the configured rate for the tax body currently assigned; it cannot determine whether an individual ship-to belongs on a different city or unincorporated-county tax body.

Live A+ (`XATXBD` assignments via `readStateDetail("CA")`) checked 2026-08-26: 1,574 active ship-tos, 1,012 active customer assignments, 150 distinct tax-body values in use. Cross-checked against CDTFA's current statewide rate file (541 rows: 58 counties + 483 cities) fetched the same day via `scripts/fetch-official-rates.mjs CA`.

## Address matching

**Needed — for two independent reasons, neither of which is the classic GA within-ZIP-boundary case, but both point the same direction.**

This is now specifically a **follow-on assignment-validation** need, not a blocker to the configuration comparison above. The configured `TBTXNAM`/description itself has an explicit `Co`/`Co.`/`C` county marker or a city marker/bare city name, so the monitoring app can safely compare that tax body's configured rate to the matching official jurisdiction total. It still must not claim that every ship-to currently using the tax body lies in that jurisdiction without a real address-boundary source.

1. **City vs. unincorporated-county ambiguity under the same place name.** At least six real examples exist where the *same* city name in `TBTXNAM` maps to **two different A+ codes at two different rates** — one for the incorporated city, one for the surrounding unincorporated county — and nothing in a ship-to's ZIP or mailing city name distinguishes which applies:

   | Place | County code (unincorporated) | City code (incorporated) |
   |---|---|---|
   | Sacramento | `CA1195` 7.75% | `CA1199` 8.75% |
   | San Bernardino | `CA1203` 7.75% | `CA1207` 8.75% |
   | Riverside | `CA1178` 7.75% | `CA1191` 8.75% |
   | San Luis Obispo | `CA1225` 7.25% | `CA1232` 8.75% |
   | Santa Cruz | `CA1253`/`CA1254` 9%/9.25% | (Santa Cruz city itself has no dedicated A+ code) |
   | Los Angeles | `CA1070` 10.25% (see mismatch below) | ~20 separate LA-area city codes (see below) |

   This is the same structural shape SC needed address matching for (clean unincorporated-vs-incorporated split), except CA's boundaries are well documented as *not* ZIP-aligned — CDTFA itself publishes a parcel/address-point lookup tool specifically because mailing ZIP and city name routinely span both an incorporated city and adjoining unincorporated county land. A ship-to's raw address (not just its ZIP or city text) would be needed to pick the right one reliably.

2. **Sparse coverage.** A+'s 143 real, configured CA-prefixed codes (excluding the 3 undefined placeholder-shaped codes and the equipment-tax variant, see below) break down to roughly 37 county-level codes (of California's 58 real counties) and ~106 city-level codes (of California's 483 real incorporated cities) — **about 26% of the state's 541 real primary jurisdictions**, customer-driven the way CO/MO/UT's code sets are, not a comprehensive one-code-per-jurisdiction scheme the way NC's or NV's is.

**E-suffixed equipment-tax variant confirmed live, exactly the recurring pattern flagged going in:** `CA1034` ("California Fresno Co.", general sales, 7.975%) sits alongside `CA1034E` ("California FresnoCo EQUIP", 4.413%) — same jurisdiction, a materially different (much lower) rate, presumably a separate equipment/machinery tax category rather than a competing rate for the same sale. Only this one E-suffixed pair currently has an active ship-to; `readStateDetail` (and the underlying live query) only surfaces codes with at least one active ship-to, so this cannot rule out other E-suffixed CA codes existing with zero current ship-to traffic — that's an inherent limit of this investigation's read-only, ship-to-driven view, not evidence there are no others.

No wrong-state contamination found — every `CA%` row's description says "California" or "Calif" and names a real California place; the only non-California descriptions in the live pull (`MX000` "Mexico no tax", `CN000` "CANADA", `NV002` "Nevada-Clark Cty") are correctly labeled for what they are, not mislabeled CA rows (see cross-context section below).

## Rate comparability

**No — confirmed live, material, and systemic, not isolated.** Of the 143 real, configured, active CA-prefixed tax-body codes, **97 match CDTFA's current rate exactly and 46 (32.2%) do not** — covering 446 of the 1,326 ship-tos sitting on a comparable code (33.6%). 44 of the 46 mismatches are A+ **below** the current official rate (stale/undercharging by 0.25–1.25 points); only 2 (`CA1070` Los Angeles County and `CA1224` Tracy) are A+ **above** official.

**The single largest cluster is a Los Angeles-County-wide templated local rate.** `CA1070` ("Los Angeles Co", A+'s largest real code at 202 ship-tos) and roughly 20 separate LA-area *city* codes (`CA1079` Carson, `CA1104` Pasadena, `CA1110` Santa Monica, `CA1106` Pomona, `CA1084` Culver City, `CA1097` Long Beach, `CA1078` Burbank, `CA1081` Compton, `CA1086` Glendale, `CA1100` Montebello, `CA1116` Vernon, `CA1095` Lancaster, `CA1102` Palmdale, `CA1089` Hawthorne, `CA1092` Irwindale, `CA1118` Whittier, `CA1072` Arcadia, `CA1085` Gardena, `CA1107` San Fernando, `CA1114` South Gate, `CA1080` City of Commerce) all carry the *identical* local add-on (`[0.75, 2.25]` = 3.00%), producing a flat `10.25%` total for every one of them. But CDTFA's current per-jurisdiction rate is different for every single one — unincorporated LA County is actually 9.75% (A+'s LA-county code is 0.5pt **too high**), while every one of the LA-area *city* rates is actually higher than 10.25% (10.5% for most, up to 11.25% for Lancaster/Palmdale) — meaning A+ is simultaneously overcharging the county code and undercharging essentially every LA city code by using one templated number instead of each jurisdiction's real current rate. **This single cluster touches ~305 of CA's 1,574 active ship-tos (~19%).**

**Two smaller but equally systemic county-level clusters exist**, both stale across every code in the cluster: **Sonoma County** (`CA1272` county 8.5% vs. official 9.25%; `CA1277` Santa Rosa 9.25% vs. 10%; `CA1275` Petaluma 9.5% vs. 10.25%; `CA1279` Sonoma city 9% vs. 10.25%) and **Santa Clara County** (`CA1248` county 9.125% vs. official 9.75%; `CA1252` San Jose 9.375% vs. 10%; `CA1251` Milpitas 9.375% vs. 10%; `CA1250` Los Gatos 9.25% vs. 9.875%).

A handful of standalone county codes show a full 1-point gap on their own: `CA1058` Kern Co. (A+ 7.25% vs. official 8.25%), `CA1011` Butte Co. (7.25% vs. 8.25%), `CA1047` Humboldt Co (7.75% vs. 8.75%), `CA1144` Monterey Co. unincorporated (7.75% vs. 8.75%). The single largest point-gap found anywhere is `CA1266` Benicia (A+ 8.375% vs. official 9.625%, 1.25 points).

The `CA1034`/`CA1034E` equipment-tax pair was excluded from this comparison entirely (CDTFA's general sales/use rate table has no equipment-category row to compare it against — comparing it as if it were a general-sales code would be an apples-to-oranges mistake, the same shape Step 2 warns about for Ohio's transit surcharge).

## Do-not-use and cross-context findings

**`CA000` — 233 of 1,574 active ship-tos (14.8%), the single largest CA tax-body bucket, and NOT the usual DO-NOT-USE shape.** `readStateDetail` did not exclude it (its retired-tax-body filter only fires on a hardcoded code list or on a fetched `TBTXNAM` containing "DO NOT USE"/"OBSOLETE"/etc.) — instead it comes back with `definitionStatus: "missing"` and `description: null`, meaning no matching row was found in `XATXBD` for `CA000` at all through the vetted read-only path. This project's standing rule is no raw SQL against A+, so from here it is not possible to tell whether `CA000` truly has zero row in `XATXBD`, or has a row this project's query can't join for some other reason. **This needs a human decision (or an authorized follow-up query) before any CA comparison is built** — it is the largest single blocking finding in this investigation, bigger by raw ship-to count than AL000 (101) or MN000 (113), though not by percentage share. Two much smaller codes show the identical "missing definition" shape: `CA003` (2 ship-tos) and `CA001` (1 ship-to) — same pattern, negligible volume, but confirms it's systemic rather than a one-off.

**11 of 1,574 active CA ship-tos (0.7%) carry a non-California tax body**: `MX000` "Mexico no tax" (9 ship-tos), `CN000` "CANADA" (1), `NV002` "Nevada-Clark Cty" (1). These are the already-documented `SASTXB` cross-context pattern (a ship-to recorded under `SASHST = 'CA'` can still carry a tax body for wherever it's actually delivered) — plausibly legitimate border/cross-shipment destinations, not a labeling defect (unlike SC's SC3622). Must be excluded from any CA-specific rate comparison with a visible count, the same way GA's NC060/SC126/CA1163/PA000 outliers and NV's DR000/NCPRST outliers are excluded from their own states' findings.

## Official source confirmed live (2026-08-26)

- **Rates:** CDTFA (`https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm`, machine-readable file at `https://cdtfa.ca.gov/taxes-and-fees/rates.aspx`) — 541 current rows (58 counties + 483 cities), `asOfDate` 2026-08-26, statewide base `7.25%`.

## Remaining follow-on work

- `CA000`/`CA001`/`CA003` are now visible **misinput** exclusions under the standing project decision. They are not silently dropped and are not compared as 0%.
- Treat the LA-County-wide templated-rate cluster (~305 ship-tos) as a coordinated A+ correction rather than 21 unrelated tickets. The current comparison surfaces each affected code so Ana/Liv can review it, but the likely operational fix should be planned as one change set.
- The city-vs-unincorporated-county pairs (Sacramento, San Bernardino, Riverside, San Luis Obispo, Santa Cruz, and the whole LA cluster) still require a verified California address-boundary source before TaxAP can validate or recommend **ship-to reassignments**. ZIP or mailing-city text must not be used as a substitute.
- Exclude `MX000`/`CN000`/`NV002` (11 ship-tos) from CA findings with a visible count, same as GA's and NV's cross-context outliers.
- Exclude `CA1034E` (and any other E-suffixed CA codes that turn up once ship-to volume changes) from general-sales rate comparison — it's a different tax category, not a competing rate for the same jurisdiction.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level) — not independently re-verified for CA in this pass, but consistent with every other state investigated so far; check before building.
- Step 3 (boundary source) not yet attempted for CA — no Streamlined or CDTFA address-point boundary file has been fetched in this investigation; that's the next step if address-level matching is pursued.
