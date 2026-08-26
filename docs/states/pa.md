# PA — findings

Status: **Official source connected already (`server/pa-rates.mjs`, `readOfficialPaRates`, wired at `/api/official/states/PA`) — no address matching needed, but a real, currently-live stale rate confirmed on Philadelphia (`PA001`, A+ 6% vs. official 8%, 49 active ship-tos), plus a structural coverage gap: Allegheny County (official 7%) has no dedicated A+ tax body at all.** A+-matching (Step 1/2) investigation run live 2026-08-26 against `XATXBD` + active `ADDR`/`CUSMS` ship-to assignments, cross-checked against the live official snapshot (PA DOR page + Census Gazetteer county list, FIPS `42`).

## Address matching

**Not needed — Pennsylvania taxes at the county level only, with no home-rule city or special-district sales tax anywhere in the state.** The official snapshot (`node scripts/fetch-official-rates.mjs PA`) lists all 67 real PA counties (matches the Census Gazetteer count for FIPS `42` exactly): 65 sit at the flat 6% state rate with `componentRate: 0`, and exactly two carry a local add-on — Philadelphia County (`componentRate: 2`, total `8%`) and Allegheny County (`componentRate: 1`, total `7%`). Philadelphia County is coterminous with the City of Philadelphia (no split), and Allegheny is an ordinary county — neither has the GA/CO/WA-style problem of a jurisdiction fracturing within a single ZIP or city. A code-to-jurisdiction mapping is structurally sufficient for PA; the open issue is that A+'s code list doesn't fully cover the two real jurisdictions that vary (see below), not that address-level matching is required to interpret it.

Live A+ (`XATXBD`, `TBTXBOD LIKE 'PA%'`) has only **2 real PA codes**, both clean and human-readable in `TBTXNAM`:

| Code | Description | Active ship-tos | Current rate | Scheduled change |
|---|---|---|---|---|
| `PA000` | "Pennsylvania" (statewide catch-all) | 999 | 6% | none (`TBNRATE=0`) |
| `PA001` | "Pennsylvania Philadelphia" | 49 | 6% | **`TBNRATE=8`, effective 2026-10-01** |

**No `PA-Allegheny` code exists anywhere in the live data.** Given PA's real structure is exactly "statewide rate + 2 named county exceptions," A+ should need at most 3 codes (base + Philadelphia + Allegheny) to have full coverage — it has 2. Any ship-to physically inside Allegheny County would, by elimination, have to be sitting on `PA000` (6%) today, a real 1-point understatement, or on some other miscoded body — but this can't be confirmed without address-level data, which this investigation didn't pull (out of scope per the read-only tax-body-level query). Flagging as an open question below rather than asserting it as a live discrepancy.

## Rate comparability

**No — a real, currently-live, material stale rate found on `PA001` (Philadelphia).** A+'s current total for `PA001` is `6%` (`baseRate=6`, all four `localRates=0`) against the PA DOR/Census-sourced official snapshot's Philadelphia County total of `8%` (`componentRate=2` on top of the `6%` state rate) — a 2-percentage-point gap, live today, affecting 49 active ship-tos. This is not a future/pending difference being caught early: A+ itself already carries a scheduled correction (`TBNRATE=8`, `nextEffectiveDate=2026-10-01`, about five weeks from the 2026-08-26 retrieval date), meaning A+'s own data confirms the 6% figure is understated *right now* and is due to self-correct only on 2026-10-01. Until then, `PA001`'s 49 active ship-tos are configured at a stale rate.

`PA000` (999 ship-tos, the large majority) matches cleanly: A+'s `6%` equals the official `6%` total shared by all 65 non-Philadelphia/non-Allegheny PA counties, and carries no scheduled change (`TBNRATE=0`). This is correct as long as none of the `PA000`-tagged ship-tos are actually located in Allegheny County (see the coverage gap above) — unverified either way.

**Allegheny County (official 7%) is a second, distinct comparability gap** — not a stale-rate mismatch in the NY/UT/VT sense (there's no A+ row carrying the wrong number), but a coverage gap (there's no A+ row for it at all). Whether this is masked exposure or a non-issue (e.g., Atlantic simply has no ship-tos physically in Allegheny County) can't be determined from tax-body-level data alone.

**PA DOR also currently publishes a "Local sales tax sourcing change" notice** naming both Philadelphia and Allegheny County collection responsibilities specifically (surfaced by `fetch-official-rates.mjs`'s own `notices` field, sourced live from `pa.gov`). The tool's own read is that this is a workflow/sourcing-responsibility notice, not a rate change — but given it names exactly the two counties this investigation already flagged, it should be read in full by a human before any PA build work, not assumed immaterial.

## Do-not-use and cross-context findings

**No DO-NOT-USE-shaped placeholder found among PA's own codes.** Both `PA000` and `PA001` are legitimately named, real, actively-used codes (not `DO NOT USE`/`INACTIVE`/`OBSOLETE`-pattern rows) — unlike AL000/MN000/ND000/NE000/UT000/WA000, `PA000` here plays NJ000/HI000's role (the real statewide base code), not a placeholder's. **This can't be treated as fully conclusive, though**: `readStateDetail`'s top-level `activeShipTos` total (1059) is computed as the literal sum of the visible tax-body rows returned, not from an independent count — so this number is tautologically incapable of revealing a retired/excluded code's share the way an independent ship-to total could. There is no positive evidence of a hidden excluded placeholder (1059 is a plausible total for a state of PA's size in Atlantic's book of business, and no state-summary-level total was checked against it), but this is an explicit open question, not a ruled-out one — flagging per Step 5 rather than asserting a number this investigation can't see.

**6 of 1059 active PA ship-tos (0.6%) carry a non-Pennsylvania tax body** — the same `SASTXB` cross-context pattern already documented for GA (`NC060`/`NC041`/`SC126`/`CA1163`/`PA000`) and NV (`DR000`/`NCPRST`), just running in the opposite direction here (PA-located ship-tos carrying other states' codes, rather than another state's ship-tos carrying `PA000`): `NC024` (×1, "North Carolina Columbus"), `NC060` (×1, "North Carolina Mecklenbur"), `SC174` (×1, "SC 01026 Horry Co"), `WA4231` (×1, "WASHINGTON SNOHOMISH CO"), `DR000` (×1, "DOMINICAN REPUBLIC"), and `TN000` (×1). These must be excluded from any PA-specific findings table with a visible count, not compared as if PA-priced — same treatment GA's live run already applies to its own cross-context outliers.

**`TN000` (1 ship-to) has no matching definition row in `XATXBD` at all** (`definitionStatus: "missing"`, all rate fields `null`) — distinct from a DO-NOT-USE placeholder (its code doesn't match the retired-code pattern), it's simply a tax body with no configured rate anywhere in the live table. Low volume (1 ship-to) but worth noting as its own small data-quality oddity, separate from the cross-context finding above.

## Real live A+ codes (2026-08-26, `XATXBD` `TBTXBOD LIKE 'PA%'` via `readStateDetail`, retired-tax-body exclusion already applied — 8 rows total, 2 of which are real PA jurisdictions)

| Code | Description | Active ship-tos | Current rate | Official comparison |
|---|---|---|---|---|
| `PA000` | Pennsylvania | 999 | 6% | Matches official 6% for 65/67 counties (assuming no ship-to is actually in Allegheny) |
| `PA001` | Pennsylvania Philadelphia | 49 | 6% | **Stale — official Philadelphia County total is 8%; A+ has a scheduled fix to 8% effective 2026-10-01** |
| `DR000` | Dominican Republic | 6 | 0% | Non-PA cross-context, exclude from PA findings |
| `NC024` | North Carolina Columbus | 1 | 6.75% | Non-PA cross-context, exclude from PA findings |
| `NC060` | North Carolina Mecklenbur | 1 | 8.25% | Non-PA cross-context, exclude from PA findings |
| `SC174` | SC 01026 Horry Co | 1 | 8% | Non-PA cross-context, exclude from PA findings |
| `TN000` | (no definition row) | 1 | unavailable | Non-PA cross-context; also missing its own rate definition |
| `WA4231` | Washington Snohomish Co | 1 | 9.1% | Non-PA cross-context, exclude from PA findings |

No real Allegheny County code exists in this list at all (see coverage gap above). No cross-state contamination was found *within* the two real PA codes' own `TBTXNAM` values (both correctly say "Pennsylvania").

## Official sources confirmed live (2026-08-26)

- **Rates:** PA Department of Revenue sales/use/hotel-occupancy tax page (`https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax`), already wired via `server/pa-rates.mjs` (`readOfficialPaRates`) and exposed at `/api/official/states/PA`. Returns 67 county rows, state rate `6%`, only Philadelphia (`8%`) and Allegheny (`7%`) above the floor.
- **County list cross-check:** Census Gazetteer `2025_gaz_counties_42.txt` (FIPS `42`) — confirms 67 counties, matching the DOR snapshot's row count exactly.
- **Notice surfaced by the adapter itself:** a PA DOR "Local sales tax sourcing change" notice naming Philadelphia/Allegheny collection responsibilities — read before building, not yet reviewed in full by a human.

## Open questions / do instead if building

- **Human decision needed:** confirm whether the `PA001` (Philadelphia) 6%→8% gap is a genuine stale rate needing an immediate correction, or whether the scheduled `2026-10-01` change is itself the planned fix and no earlier action is wanted — either way this is a real, currently-live discrepancy on 49 active ship-tos and belongs in `docs/pending-business-decisions.md`.
- **Human decision needed:** determine whether any ship-to is physically located in Allegheny County. If so, it is very likely sitting on `PA000` (6%) today rather than a correct 7% Allegheny rate, since no Allegheny-specific A+ code exists at all — this needs either an address-level check or a business call on whether that exposure is real before treating `PA000`'s clean 65/67 match as full coverage.
- **Before building:** read PA DOR's "Local sales tax sourcing change" notice (URL above) in full — it specifically names Philadelphia and Allegheny, the same two counties already flagged here, and could affect how a future PA comparison should be scoped even though it reads as a sourcing/collection-responsibility notice rather than a rate change.
- **Before building:** exclude the 6 non-PA cross-context ship-tos (`DR000`, `NC024`, `NC060`, `SC174`, `TN000`, `WA4231`) from any PA-specific findings table with a visible count, the same way GA's live run excludes its own cross-context outliers. Separately resolve `TN000`'s missing rate definition (unrelated to the cross-context exclusion itself).
- **Not fully ruled out:** a possible hidden DO-NOT-USE-style PA placeholder excluded upstream of what `readStateDetail` can show (its top-level ship-to total is computed from the visible rows themselves, not independently) — no positive evidence found, but this is a genuine blind spot of the tool as used here, not a confirmed "none exists."
- If building the A+↔official comparison for PA: adapt `server/ncdor-rates.mjs`'s pattern (direct code-to-jurisdiction mapping, no boundary file needed) rather than `ga-boundary.mjs`'s — PA does not need address/ZIP-level matching.
