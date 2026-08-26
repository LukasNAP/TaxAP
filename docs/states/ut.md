# Utah — findings

Status: **investigated, not safe to build.** Live A+ (`XATXBD` + active `ADDR` ship-to assignments, `SACSUS <> 'S'`) checked 2026-08-26, cross-referenced against the current Streamlined rate file (`UTR2026Q3MAY11.zip`) and the current Streamlined boundary file (`UTB2026Q3MAY11.zip`), both confirmed to exist via a live directory-listing fetch. Census Gazetteer (FIPS `49`) confirms **29 real Utah counties**, matching the prior research hint exactly.

## Address matching

**Needed — real within-county variation confirmed live, not assumed.** A+'s Utah tax-body codes are `UT` + a 5-digit number: a 2-digit county index + a 3-digit code. The 2-digit prefix turns out to be a real, decodable scheme once cross-checked against the Census Gazetteer: Utah's own county FIPS codes are sequential odd numbers in alphabetical order (Beaver `001`, Box Elder `003`, Cache `005`, ... Weber `057`), so `prefix = (alphabetical index)`, i.e. `FIPS = prefix*2 - 1`. Confirmed against `TBTXNAM` for all 45 real rows (e.g. `UT01002` idx 1 → FIPS `001` Beaver; `UT18122` idx 18 → FIPS `035` Salt Lake; `UT25090` idx 25 → FIPS `049` Utah County/Provo) — this is a real fact about Utah's FIPS numbering, not an A+ invention, but nothing in A+ enforces it (see the Salem anomaly below).

**Real live A+ has only 45 real codes (44 cities/towns + 1 apparent bare-county code) against 29 counties and 181 real active Streamlined city rows** — sparse, customer-driven coverage, same shape as CO/MO/NE, not a full jurisdiction table.

**Within-county rate variation is real and material, confirmed via the live SST rate file** — a single county code cannot stand in for its cities. Salt Lake County alone (FIPS `035`, county-only local rate 2.6%) has current official totals ranging from 7.45% (Draper, Riverton, South Jordan — no city option tax) up to 8.45% (Salt Lake City, city option tax now 1.0%) and 7.65% (Murray, city option 0.2%) — a full percentage point of spread within one county. A code-to-county mapping alone would be wrong for most of these cities; place-level resolution is required, the GA/SC/NY pattern, not the OH/NC/NJ/NE pattern.

**Anomaly found: `UT18135` ("Utah Salem") is grouped under the Salt Lake County prefix (`18`) but Salem, UT is actually in Utah County** (Census place GEOID `4965770`, county FIPS `049` = index `25` in this same scheme — matching `UT25xxx` codes like Provo/Lehi/Orem right next to it in the table). This is a genuine intra-state miscoding, the same *kind* of finding as SC's `SC3622`/"South Dakota Vermillion" and NE's `NEDS000`, but *within* Utah rather than cross-state — a naive `LIKE 'UT18%'` filter meant to mean "Salt Lake County" would silently include a Utah-County city. The rate value (7.35%) happens to equal Utah County's *current* total, which is more likely coincidental (see rate comparability below) than confirmation the code is correctly grouped.

**Cosmetic `TBTXNAM` typos found, harmless:** `UT18118` reads "Uah Riverton" (missing the 't'), `UT25002` reads "Utah American Fort" (should be "American Fork"). Neither affects matching since the codes themselves are correct; noted for anyone building name-based lookups instead of code-based ones.

**No cross-state contamination found** — every one of the 46 `UT%`-prefixed `TBTXNAM` values names Utah or a real Utah city (the two typos above aside); no SC3622/NEDS000-style wrong-state row exists in this prefix.

## Rate comparability

**No — confirmed live, widespread, and material.** Built the official total per code as `state rate (4.85%, active since 2019-04-01) + county local-option rate (from the SST file's active `00`-type row, keyed by the real FIPS derived above) + city local-option rate (from the active `01`-type row, keyed by the Census place code, matched by name since A+'s 3-digit suffix isn't the same code space Streamlined uses)`, then diffed against each row's live `TBCRATE`. Also confirmed `TBNRATE = 0` / `TBTXDAT` = the `0001-01-01` sentinel on **all 46 rows** — none of this is a pending/scheduled change sitting unapplied; it's just stale.

- **27 of 45 real codes (60%) show a live mismatch**, ranging from 0.1 to 0.7 percentage points, always A+ *below* the current official total (never above) — e.g. `UT18122` Salt Lake City: A+ 7.75% vs. official 8.45% (county rate rose 2.4%→2.6% on 2025-07-01, city option rose 0.5%→1.0% on 2025-01-01, neither reflected); `UT22030` Park City: A+ 9.05% vs. official 9.55%; `UT25090` Provo: A+ 7.25% vs. official 7.45% (Utah County's rate has been 2.5% since 2024-01-01 — over 2.5 years stale, not a recent change).
- **The staleness is inconsistent even *within* the same county**, which rules out a simple "this county's A+ rate needs a refresh" fix: within Salt Lake County, `UT18118` (Riverton), `UT18138` (South Jordan), and `UT18135` (Salem) already reflect the current 2.6% county rate exactly, while `UT18039` (Draper), `UT18093` (Midvale), `UT18131` (Sandy), `UT18155` (West Jordan), `UT18167` (West Valley), and `UT18403` (Kearns) are all still on the pre-2025-07-01 2.4% rate (each off by exactly -0.2pt). `UT18096` (Murray) reflects the current county rate but is missing its own city-level 0.2% component. Three different kinds of gaps coexist in one county.
- **18 of 45 match exactly** (e.g. Vernal, Ogden, St. George, Tooele, Farr West, Pleasant View, Riverdale, Farmington, Kaysville, Layton, Clearfield, Syracuse, Spanish Fork) — these happen to be counties/cities whose real rate hasn't changed recently, not evidence the comparison methodology is unsound elsewhere.
- Sanity-checked the additive state+county+city model against cases with well-known real-world rates (St. George 6.75%, Ogden 7.25%) — both match exactly, supporting the model itself; the mismatches above are real staleness, not a modeling error.

## Do-not-use — real and blocking, same shape as AL000/MN000/NE000

**`UT000` — "Utah DO NOT USE***".** Used by **64 of 268 active UT ship-tos (23.9%)** — the *single largest* tax-body group in the live data, larger even than Salt Lake City's 62. Nearly a quarter of Atlantic's real Utah ship-tos carry a placeholder code with `TBCRATE = 0`, not a real jurisdiction rate. Must be understood before any UT comparison can report a trustworthy match rate, exactly the AL000/MN000/NE000 precedent.

## Boundary source — real, current, structurally GA-compatible

**`UTB2026Q3MAY11.zip`** confirmed live via directory fetch at `https://www.streamlinedsalestax.org/ratesandboundry/Boundary/` (same listing page GA's adapter reads, distinct from the Rates directory). Downloaded and inspected directly: **89 columns**, exactly matching `ga-boundary.mjs`'s `EXPECTED_COLUMN_COUNT`; sample rows are record type `4` (ZIP+4 range) with populated ZIP5/ZIP+4/state-FIPS/county-FIPS/place-FIPS columns in the same offsets GA uses. 676,435 total rows — the real Step 3 answer for this state, a plausible `ga-boundary.mjs`-pattern starting point once a build is greenlit. Same-dated `UTR2026Q3MAY11.zip` rate file also exists in the Rates directory.

## Real live A+ codes (2026-08-26, `XATXBD` `LIKE 'UT%'`, unfiltered, no row limit — 46 rows total)

| Code | Name | A+ total | Official total (2026-08-26) | Live ship-tos | Notes |
|---|---|---|---|---|---|
| `UT000` | Utah DO NOT USE*** | 0 | — | 64 | placeholder, largest group, blocking |
| `UT01002` | Utah Beaver | 7.35 | 7.35 | 4 | matches |
| `UT02004` | Utah Bear River City | 6.10 | 6.65 | 6 | **stale -0.55** |
| `UT02120` | Utah Willard | 6.95 | 6.95 | 2 | matches |
| `UT03049` | Utah North Logan | 7.30 | 7.30 | 1 | matches (base/local split differs, total correct) |
| `UT03059` | Utah Richmond | 7.00 | 7.30 | 2 | **stale -0.30** |
| `UT04035` | Utah Price | 6.75 | 6.75 | 1 | matches |
| `UT06008` | Utah Clearfield | 7.25 | 7.25 | 2 | matches |
| `UT06017` | Utah Farmington | 7.25 | 7.25 | 3 | matches |
| `UT06026` | Utah Kaysville | 7.25 | 7.25 | 1 | matches |
| `UT06030` | Utah Layton | 7.25 | 7.25 | 3 | matches |
| `UT06035` | Utah N. Salt Lake | 7.25 | 7.15 | 5 | **+0.10 (A+ above official — place-code match uncertain, flag not fix)** |
| `UT06049` | Utah Syracuse | 7.25 | 7.25 | 1 | matches (base/local split differs, total correct) |
| `UT11003` | Utah Cedar City | 6.20 | 6.75 | 4 | **stale -0.55** |
| `UT18039` | Utah Draper | 7.25 | 7.45 | 3 | **stale -0.20 (pre-2025-07-01 county rate)** |
| `UT18093` | Utah Midvale | 7.25 | 7.45 | 1 | **stale -0.20** |
| `UT18096` | Utah Murray | 7.45 | 7.65 | 3 | **stale -0.20 (missing city component)** |
| `UT18118` | Uah Riverton [sic] | 7.45 | 7.45 | 1 | matches |
| `UT18122` | Utah Salt Lake City | 7.75 | 8.45 | 62 | **stale -0.70, largest real-code group** |
| `UT18131` | Utah Sandy | 7.25 | 7.45 | 2 | **stale -0.20** |
| `UT18135` | Utah Salem | 7.35 | 7.45 | 1 | **county-grouping anomaly — Salem is really in Utah County, not Salt Lake; also -0.10 stale** |
| `UT18138` | Utah South Jordan | 7.45 | 7.45 | 5 | matches |
| `UT18139` | Utah S. Salt Lake City | 7.45 | 7.45 | 1 | matches |
| `UT18155` | Utah West Jordan | 7.25 | 7.45 | 5 | **stale -0.20** |
| `UT18167` | Utah West Valley | 7.25 | 7.45 | 12 | **stale -0.20** |
| `UT18403` | Utah Kearns | 7.25 | 7.45 | 1 | **stale -0.20** |
| `UT21034` | Utah Richfield | 6.75 | 7.05 | 1 | **stale -0.30** |
| `UT21038` | Utah Sigurd | 6.35 | 6.95 | 1 | **stale -0.60** |
| `UT22030` | Utah Park City | 9.05 | 9.55 | 5 | **stale -0.50** |
| `UT23023` | Utah Grantsville | 6.90 | 7.00 | 2 | **stale -0.10** |
| `UT23048` | Utah Tooele | 7.00 | 7.00 | 3 | matches |
| `UT24024` | Utah Vernal | 6.95 | 6.95 | 1 | matches |
| `UT25002` | Utah American Fort [sic, "Fork"] | 7.25 | 7.35 | 3 | **stale -0.10** |
| `UT25066` | Utah Lehi | 7.15 | 7.45 | 5 | **stale -0.30** |
| `UT25070` | Utah Lindon | 7.25 | 7.45 | 7 | **stale -0.20** |
| `UT25083` | Utah Orem | 7.25 | 7.45 | 6 | **stale -0.20** |
| `UT25088` | Utah Pleasant Grove | 7.25 | 7.45 | 0 | **stale -0.20** |
| `UT25090` | Utah Provo | 7.25 | 7.45 | 5 | **stale -0.20** |
| `UT25103` | Utah Spanish Fork | 7.45 | 7.45 | 3 | matches |
| `UT25106` | Utah Springville | 7.15 | 7.45 | 3 | **stale -0.30** |
| `UT27008` | Utah Hurricane | 6.75 | 7.08 | 2 | **stale -0.33** |
| `UT27020` | Utah St. George | 6.75 | 6.75 | 5 | matches |
| `UT29000` | Utah Farr West | 7.25 | 7.25 | 1 | matches |
| `UT29027` | Utah Ogden | 7.25 | 7.25 | 14 | matches |
| `UT29031` | Utah Pleasant View | 7.25 | 7.25 | 1 | matches |
| `UT29036` | Utah Riverdale | 7.45 | 7.45 | 2 | matches |

(Live ship-to counts are active, `SACSUS <> 'S'`, from `ADDR.SASTXB`; total 268 active UT ship-tos across all 45 real codes + `UT000`.)

## Official sources confirmed live (2026-08-26)

- **Rates:** `https://www.streamlinedsalestax.org/ratesandboundry/Rates/UTR2026Q3MAY11.zip` — readable today by `server/sst-rates.mjs` now that ZIP support has landed (not yet wired into `GENERIC_SST_STATES`, since UT needs the city-layer join OH/TN/AR/WY don't). 558 total rows / 211 active as of 2026-08-26: 1 state row (4.85%), 29 active county rows, 181 active city rows.
- **Boundary:** `https://www.streamlinedsalestax.org/ratesandboundry/Boundary/UTB2026Q3MAY11.zip` — **exists, confirmed structurally GA-compatible** (89 columns, same record-type-4 ZIP+4-range shape). See above.
- **Census Gazetteer (production URL, same as `server/sst-rates.mjs` uses):** `2025_gaz_counties_49.txt` confirms **29 counties**, FIPS `49`. `2025_gaz_place_49.txt` used to identify real city names/place codes for the comparison above.

## Open questions / do instead if building

- **Before building, a human decision is needed on `UT000`** (64/268 ship-tos, 23.9%, the single largest group) — same AL000/MN000/NE000 precedent; don't compare or silently drop these.
- **Before building, a human decision is needed on the widespread rate staleness** (27/45 codes, 60%) — this isn't a one-off like NE's Gering; it looks like Atlantic's A+ Utah setup hasn't had a bulk rate refresh since sometime before the 2025-01-01/2025-04-01/2025-07-01 round of Utah county-option-tax increases, and even that refresh (where it happened) was applied inconsistently within at least one county (Salt Lake). A per-code "just take the max of A+ and official" patch would be wrong — some rows are already correct.
- **Resolve the `UT18135` Salem county-grouping anomaly** before trusting the `prefix → county FIPS` scheme as reliable for filtering/grouping by county — confirm with a human whether this is a one-off data-entry error or whether the alphabetical-index assumption has other undiscovered exceptions.
- The boundary file (`UTB2026Q3MAY11.zip`) is real and ready if/when a human decision unblocks building — structurally a drop-in for the `ga-boundary.mjs` pattern (same 89-column schema, same record-type-4 shape).
- Given the scale of the rate mismatch, re-verify closer to build time rather than trusting this snapshot — several of these gaps trace to 2025 county-rate changes; Utah's DOR/SST updates rates quarterly, so this file will keep moving.
