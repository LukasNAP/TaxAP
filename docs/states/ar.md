# Arkansas — findings

## Current implementation — September 8, 2026

`server/ar-aplus.mjs` now reads DFA's linked current-quarter city/county PDF, checks its period and inventory, validates local component sums, and adds the SST-validated 6.5% state rate. The current table has 350 cities and all 75 counties; 18 city totals vary across counties and remain unresolved. Comparison requires the exact DFA code and matching name. County-only assignments require a county description. Unidentified, conflicting, retired and missing definitions remain unmatched. The reader is registered in the batch findings and state drawer.

Current local Windows-authenticated aggregate validation: 326 assignments, 223 compared across 50 groups, nine rate differences, 102 unmatched and one cross-state assignment. No SQL changes or customer/address output. Build, lint and all 212 tests passed. This establishes assigned-rate comparison, not physical delivery-jurisdiction validation or transaction tax treatment.

**Correction to the historical cap discussion below:** DFA's current FAQ says the general local single-transaction cap ended January 1, 2008, with specified vehicle, aircraft, watercraft and housing exceptions and business rebate provisions. The older statement that all merchandise has a $2,500 local cap is incorrect and must not guide implementation. TaxAP does not calculate those exceptions, rebates, or invoice liability.

Sources:
- [DFA quarterly local table directory](https://www.dfa.arkansas.gov/office/taxes/excise-tax-administration/sales-use-tax/sales-use-tax-rates/city-and-county-sales-use-tax-rates/)
- [DFA Q3 2026 table](https://www.dfa.arkansas.gov/wp-content/uploads/cityCountyTaxTable_Jul_Sep_2026.pdf)
- [DFA sales/use FAQ](https://www.dfa.arkansas.gov/office/taxes/excise-tax-administration/sales-use-tax/sales-and-use-tax-faqs/)

## Historical investigation (superseded where noted above)

Status: **Address matching not needed for the general case** — A+'s 66 real `AR%` codes each map directly to one named Arkansas city or county, combining state + county + city into a single `TBCRATE`, the same shape as NC/SC. **But rate comparability is a real, confirmed problem, not a clean pass**: 8 of the codes spot-checked against Arkansas's current Streamlined Sales Tax rate file show a live, material stale local-rate component (mostly the city half of the split, one the county half, one the state-rate slot itself), and a DO-NOT-USE-shaped placeholder (`AR000`) covers 46 of 324 active ship-tos (14.2%) — the largest single tax-body group in the state. Live A+ (`ADDR`/`CUSMS` active AR ship-to assignments via `readStateDetail`) and the current Streamlined rate file (`ARR2026Q3JUN02.csv`) both checked 2026-08-26.

## Address matching

**Not needed for the general case.** A+ has 69 total rows assigned to active AR ship-tos; 66 are real `AR%`-prefixed codes each naming one specific Arkansas city or county (e.g. `AR6501` "Arkansas Fort Smith", `AR6000` "Arkansas Pulaski Co."), plus the `AR000` placeholder (see below) and two non-Arkansas cross-context codes (`DR000`, `ZTEMP`, also below). Every real code's `TBCBSRT` (state) + `TBCLRT1`/`TBCLRT2` (two local slots) sums to `TBCRATE`, and — where the underlying county is known with confidence — that total is the sum of Arkansas's flat 6.5% state rate, the correct county component, and the correct city component. This is a direct code-to-jurisdiction mapping, not a GA-style within-ZIP split.

**Coverage is sparse, not comprehensive — a real, structural gap, not an error.** Arkansas's current SST rate file lists 75 counties (73 levying a nonzero local option tax) and 500 incorporated places (351 levying a nonzero local rate) — 424 real taxing jurisdictions total. A+ has only 66 real codes, ~15.6% of that universe. This is the same customer-driven "only cities we've actually shipped to" pattern already seen in AL/MN/NE/CO/MO/UT, not unique to AR. Ship-tos in the other ~85% of Arkansas's taxing jurisdictions have no dedicated A+ code to fall into — consistent with `AR000`'s ship-to volume (see below).

**One unresolved structural risk, not confirmed live in this pass:** a small number of real Arkansas incorporated cities are known to straddle two counties with different county-option rates (e.g. Springdale spans both Washington and Benton counties). A+ has exactly one code per city name (e.g. `AR7210` "Arkansas Springdale" is priced using Washington County's rate only). If Atlantic has a ship-to physically in the Benton-County sliver of Springdale, a flat single-code price would be off by the Washington/Benton county-rate difference. No live ship-to-level address data was checked to confirm whether this actually happens for AR's 324 ship-tos — flagged as an open question, not a confirmed finding, the same shape as SC's Charleston/Dorchester straddle risk.

## Rate comparability

**No — confirmed live, several material stale components, on top of a separate known federal/state-cap caveat that isn't even representable in the source file used here.**

Of the codes where the underlying county could be confirmed with confidence, 19 matched the official total exactly (Fort Smith, Bentonville, Rogers, Fayetteville, Springdale, Little Rock, North Little Rock, Jonesboro, Conway, Russellville, Beebe, DeQueen, and the county-only codes for Pulaski, Garland, Howard, Baxter, Little River, and Mississippi counties, plus Mabelvale which correctly prices at Little Rock's combined rate). **8 showed a real, live mismatch:**

| Code | Jurisdiction | A+ current total | Official total (state 6.5% + county + city) | Gap | Stale component | Ship-tos |
|---|---|---|---|---|---|---|
| `AR1802` | West Memphis (Crittenden Co.) | 10.25% | 10.5% | −0.25pt | County: A+ 1.5% vs. current 1.75% (eff. 2021-01-01) | 14 |
| `AR2804` | Paragould (Greene Co.) | 8.625% | 9.375% | −0.75pt | City: A+ 0.75% vs. current 1.5% (eff. 2024-07-01) | 4 |
| `AR6504` | Barling (Sebastian Co.) | 7.5% | 9.5% | −2.0pt | City: A+ 0% vs. current 2% (eff. 2025-04-01) — city tax missing entirely | 3 |
| `AR1403` | Magnolia (Columbia Co.) | 10.375% | 10.25% | **+0.125pt** | City: A+ 2.375% vs. current 2.25% (eff. 2025-07-01) — the one case where A+ is *above* official | 2 |
| `AR7209` | Prairie Grove (Washington Co.) | 10.25% | 10.5% | −0.25pt | Both local slots (2.75% city / 1.25% county) are correct — the *state*-rate slot itself (`TBCBSRT`) is 6.25% instead of Arkansas's real 6.5% | 2 |
| `AR1702` | Van Buren (Crawford Co.) | 9.25% | 10.25% | −1.0pt | City: A+ 1.5% vs. current 2.5% (eff. 2026-07-01 — ~2 months before this check) | 1 |
| `AR5202` | Stephens (Ouachita Co.) | 10% | 12% | −2.0pt | City: A+ 1% vs. current 3% (eff. 2025-07-01) | 1 |
| `AR7002` | El Dorado (Union Co.) | 9.75% | 10.25% | −0.5pt | City: A+ 1.25% vs. current 1.75% (eff. 2026-07-01 — ~2 months before this check) | 1 |

That's 8 of 27 spot-checked codes (~30%) showing a real gap, covering 28 of 324 active ship-tos (~8.6%). Most are a city-rate increase A+ hasn't picked up yet; `AR7209` is a different class of problem (the state-rate slot itself, not a local component); `AR1403` is the only one where A+ is stale on the high side. One additional low-volume code, `AR4200` ("Arkansas Delaware," 1 ship-to), could not be resolved with confidence — Logan County's component (2%) doesn't match either of its local slots — and is left **unresolved** rather than guessed, since Delaware, AR's county could not be confirmed with certainty in this pass.

**Separately, and unresolved by this investigation: Arkansas's known single-article $2,500 local-tax cap is not represented in the Streamlined rate file at all.** Arkansas law caps the *local* (county + city) portion of sales tax to the first $2,500 of a single item's sales price — a large single-item sale is taxed at the full state rate on the whole amount but at the local rate only on the first $2,500. The SST rate file used for every comparison above (and by every other state's adapter in this project) only carries one flat combined `totalGeneralRate`/`componentRate` per jurisdiction, with no cap logic. This means **every "official total" figure in the table above already overstates the true effective rate for any single line item over $2,500** — a real comparability gap independent of the 8 stale-component findings, and one no other state investigated so far has needed to model. This was given as known context for this investigation, not independently re-confirmed against a live Arkansas DFA citation in this pass — treat the cap's existence as established, but its precise interaction with a per-jurisdiction rate comparison as an open, unbuilt question.

## Do-not-use and cross-context findings

**`AR000` — DO-NOT-USE-shaped placeholder.** Used by **46 of 324 active AR ship-tos (14.2%)** — the single largest tax-body group in the state, larger than any real city code (Fort Smith, the largest real code, has only 21). `readStateDetail`'s definitions lookup returned no row for `AR000` at all (`definitionStatus: "missing"`, `description: null`, `currentRate: null`) — the same signature every other confirmed DO-NOT-USE code in this project shows, because the shared query already filters out any `TBTXNAM` containing "DO NOT USE"/"INACTIVE"/"OBSOLETE" before the rate/description gets joined. The ship-to count itself survives that filter (it comes from `ADDR`/`CUSMS`, not the filtered definitions join), which is how the placeholder's real usage becomes visible at all. Same shape and same order of magnitude as AL000 (20%), NE000 (18%), UT000 (23.9%) — **must be understood via a human decision before any AR comparison is built**, not silently dropped or compared as if it were a real 0% jurisdiction.

**Two non-Arkansas codes appear on active AR ship-tos, both generic/foreign placeholders rather than a genuine other-state tax body:** `DR000` ("DOMINICAN REPUBLIC," 1 ship-to) and `ZTEMP` ("TAX BODY TEMP USE," 1 ship-to). Neither is a real U.S. state's tax body reaching AR the way GA's live run found `NC060`/`SC126`/etc. — exclude both from any AR-specific rate finding, but they should still show up as a visible 2-ship-to exclusion count per the project's no-silent-caps rule.

**Two cosmetic `TBTXNAM` quirks checked and resolved — not real cross-state contamination:**
- `AR7302`, labeled **"Arizona Beebe,"** is confirmed to be real Beebe, White County, Arkansas — its rate (9.5% = 6.5% state + 1.75% White Co. + 1.25% Beebe city) matches the official total exactly. This is a typo ("Arizona" for "Arkansas"), the same cosmetic-naming-error shape as Nevada's "Esmaralda" for "Esmeralda" — confirmed by rate math, not just by assumption, so it does **not** need exclusion the way SC's genuinely-South-Dakota `SC3622` did.
- `AR6901`, labeled **"Mountain View 6901"** (missing the usual "Arkansas" prefix), is real Mountain View, Stone County, Arkansas — internally rate-consistent (10% = 6.5% + 2% + 1.5%), just an inconsistent naming convention versus the other 65 codes.

No row among the 69 returned for AR actually names a different U.S. state's jurisdiction — every `AR`-prefixed code checked against the official file resolves to a real Arkansas place.

## Open questions / do instead if building

- **Before building:** get a human decision on `AR000` (46/324 ship-tos, 14.2%) — what governs tax for these ship-tos in practice today, the same open question AL000/MN000/NE000/UT000 all still carry.
- **Before building:** decide how to handle the 8 confirmed live stale-component codes above (West Memphis, Paragould, Barling, Magnolia, Prairie Grove, Van Buren, Stephens, El Dorado) — these are real, current, sourced gaps (with exact effective dates), not something to silently smooth over.
- **Before building:** get a primary Arkansas DFA citation for the single-article $2,500 local-tax cap and decide how (or whether) to represent it — as currently scoped, comparing A+'s flat total against the SST file's flat total silently assumes no cap exists, which is not true for large single-item sales.
- `AR4200` ("Arkansas Delaware," 1 ship-to) is unresolved — its real county could not be confirmed with confidence in this pass; don't guess a county assignment for it.
- The Springdale-style same-city/different-county straddle risk is real in Arkansas's actual geography but unconfirmed against AR's live ship-to addresses in this pass — worth a follow-up check before treating single-code-per-city as risk-free, the same caution NV's dormant TID finding and SC's Charleston/Dorchester straddle already carry for their states.
- Use `SASTXB` (ship-to level), per the project's established NC/GA/NV precedent — not `CMTXBD` (customer level) — for any future AR comparison.
- Official source: `https://www.streamlinedsalestax.org/ratesandboundry/Rates/ARR2026Q3JUN02.csv` (75 counties, 500 cities, confirmed live 2026-08-26) via the existing `GENERIC_SST_STATES.AR` config in `server/sst-rates.mjs` — already a drop-in read today, no code change needed to keep pulling this file.
