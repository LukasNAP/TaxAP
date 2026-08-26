# Oklahoma (OK) — A+ matching investigation

**Status:** Investigated 2026-08-26. **Not safe to build** — a confirmed live stale-rate discrepancy plus real intra-city/county-line splitting and an entire uncaptured special-district layer.

## Real facts, confirmed live

- **FIPS: `40`. Counties: `77`** — confirmed via the 2025 Census Gazetteer county file (`2025_gaz_counties_40.txt`), 77 data rows, matching the earlier SST-research hint exactly.
- **Live `XATXBD` pull** (`TBTXBOD LIKE 'OK%'`, no `FETCH FIRST` limit): **71 rows total**. No pagination truncation (71 is not suspiciously round).
- **One `DO NOT USE` row**: `OK000` (`TBCBSRT`/all rates `0`). No other retired/inactive/obsolete rows and **no wrong-state contamination** — every one of the other 70 `TBTXNAM` values names Oklahoma or a real Oklahoma city/county by name (no SC3622-style surprise).
- **Live ship-to coverage**: 272 active OK ship-tos (`ADDR.SACSUS <> 'S'` and `CUSMS.CMSUSP <> 'S'`) spread across 61 of the 70 real tax bodies. `OK000` carries only 2 of 272 (0.7%) — a minor, not blocking, exclusion (nothing like AL000/MN000/NE000's scale).
- **Base rate**: `TBCBSRT` is `4.5` on every real row, matching Oklahoma's current statewide 4.5% state rate (confirmed against the SST rate file's single active state-type row, `40,45,40,0.045,...,20240829,...`).
- **Internal consistency**: `TBCBSRT + TBCLRT1 + TBCLRT2 + TBCLRT3 + TBCLRT4 == TBCRATE` on all 71 rows, no exceptions.
- A handful of tax-body codes are 6 digits instead of 4 (`OK261126` Chickasha, `OK360236` Blackwell, `OK370637` Kingfisher, `OK450845` Broken Bow) — a naming-convention wrinkle, not (so far) a data-quality problem; their rates check out fine.

## Step 1 — address/boundary matching needed?

**Yes**, for two independent reasons, both confirmed live:

1. **Real cities split across county lines get separate A+ codes with different totals, and the county line matters:** Oklahoma City has *two* A+ codes — `OK5521` "OKLAHOMA CITY(OKLAHOMA CO" (Oklahoma County side) and `OK0921` "OKLAHOMA CITY (CANADIAN C" (Canadian County side). A ship-to's assignment to one or the other isn't recoverable from the city name alone. (Also seen with `OK3304`/`OK3388`, both "East Duke", though those two total to the identical rate.)
2. **A whole layer of real Oklahoma jurisdictions has no A+ representation at all.** The current SST OK rate file (`OKR2026Q3MAY29.zip`) has, as of today, 77 active county rows, 798 active city rows, and **744 active type-`63` "special" rows** — real, currently-effective special sales-tax districts. A+'s entire OK setup is 70 codes, built only from customer-driven county/city combinations; none of them reference a special-district code. Whether that's because Atlantic's OK customers happen to fall outside every special district, or because A+ simply never captures this layer, is unconfirmed and can't be answered without per-address matching.

The confirmed-real Streamlined boundary file structurally supports GA-style matching: `OKB2026Q3JUN10.zip` (see below) uses the exact same 89-column layout as Georgia's file (`fipsState` at column 22, `fipsCounty` at 24, `fipsPlace` at 25, `specialCode` at 30; record types `A`/`4`/`Z`), and its `Z`-type rows are used *exclusively* for special-district ZIP ranges in OK (every sampled `Z` row carries a special code, none carry plain county/city). `server/ga-boundary.mjs`'s column offsets and record-type handling look directly reusable as a starting point for an `ok-boundary.mjs`, though this hasn't been attempted — see Open questions.

## Step 2 — is A+'s rate comparable to the official total?

**No — confirmed stale, live, material.** Cross-referencing A+'s two-component rows against the SST rate file's full (not just active) history for the same jurisdictions:

| A+ code | A+ total | Confirmed match? |
|---|---|---|
| `OK5521` Oklahoma City (Oklahoma Co. side) | 8.625% (base 4.5 + city 4.125 + county 0) | **Matches** current official (city place FIPS `55000` @ 4.125% since 2018-01-01; Oklahoma County FIPS `109` @ 0%) |
| `OK0921` Oklahoma City (Canadian Co. side) | 8.725% (base 4.5 + county 0.35 + city 3.875) | **Stale.** Canadian County's 0.35% local matches current official exactly, but the city component (3.875%) is Oklahoma City's **pre-2018-01-01** rate. The file shows OKC's rate changed `0.03875 → 0.04125` effective 2018-01-01 and has been 4.125% ever since — an 8-year-old rate still live in A+. |
| `OK1404` Moore | 8.5% (city 3.875 + county 0.125) | Matches (Moore @ 3.875% since 2020-04-01; Cleveland Co. @ 0.125%) |
| `OK1411` Norman | 8.75% (city 4.125 + county 0.125) | Matches |
| `OK5507` Edmond | 8.25% (city 3.75 + county 0) | Matches |
| `OK0688`/`OK4988`/`OK5088`/`OK5188`/`OK5888`/`OK7288` (county-only rows: Blaine/Mayes/Murray/Muskogee/Ottawa/Tulsa Co.) | — | **All six match the current official county rate exactly** (0.875 / 1.375 / 2.0 / 1.499 / 1.35 / 0.367 respectively) |

Six-for-six exact matches on the county-only rows and 3-for-4 on the spot-checked city rows is a genuinely promising baseline — but the one confirmed miss (Oklahoma City's Canadian-County-side code) is exactly the same shape as NY's Suffolk/Yonkers finding: a real, live, material (0.25pt) staleness that a naive comparison would either silently paper over or need a human decision on before trusting any aggregate finding. It was found on the single highest-traffic OK code that wasn't a straightforward single-county city (`OK5521`+`OK0921` together carry 79 of OK's 272 active ship-tos), so this isn't an edge case — it's sitting on ~29% of Atlantic's live OK ship-to volume.

The unresolved special-district layer (744 active `63`-type rows, zero A+ representation) is a second, independent comparability question in the OH-transit-surcharge shape: unconfirmed whether any of Atlantic's 272 live OK ship-tos actually sit inside one of those districts, and unconfirmed whether A+'s `TBCRATE` numbers were ever meant to include such a layer.

## Do instead / open questions for whoever picks this up

- **Don't build a flat code-to-rate comparison for OK.** The Oklahoma City stale-rate finding alone means a naive full-state diff would report ~30% of ship-tos as "clean" when one of their two codes is actually wrong by a quarter point — a confidently-wrong result, not an honest one.
- Before building anything: get a human decision on the `OK0921` (Canadian-side OKC) stale rate the same way NY's Suffolk/Yonkers findings need one — this isn't a TaxAP bug, it's a real gap in Atlantic's A+ tax-body maintenance.
- Confirm whether any live OK ship-to address actually falls inside one of the 744 active special-tax-district ZIP ranges, using the same address-parsing/tiered-matching approach as `server/ga-boundary.mjs` against `OKB2026Q3JUN10.zip` (structurally compatible — same 89-column schema, same record types). This is unbuilt; only the SST directory listing and file structure were confirmed this session, not a working matcher.
- Investigate the two "East Duke" codes (`OK3304`/`OK3388`) and the 6-digit tax-body codes (`OK261126`, `OK360236`, `OK370637`, `OK450845`) for whether they represent a real second numbering scheme (CO-style) or are simply legacy artifacts — not yet understood, though their rates checked out fine in this session's sample.
- `OK000` (DO NOT USE) is used by only 2 of 272 active ship-tos — worth excluding explicitly in any future query (same pattern as NC/AL/MN/NE), but not a blocking finding at this volume.

## Sources used this session

- Live `XATXBD` pull via the standard `SQL03`→`APLUS` OPENQUERY chain (read-only, no `FETCH FIRST` limit).
- Live `ADDR`/`CUSMS` ship-to tax-body coverage query (read-only).
- SST rate file: `https://www.streamlinedsalestax.org/ratesandboundry/Rates/OKR2026Q3MAY29.zip` (fetched, unzipped, parsed fully — not just active rows, to recover OKC's rate history).
- SST boundary file: `https://www.streamlinedsalestax.org/ratesandboundry/Boundary/OKB2026Q3JUN10.zip` — confirmed to exist via the live directory listing at `https://www.streamlinedsalestax.org/ratesandboundry/Boundary/` (distinct from the Rates directory), downloaded, unzipped (163.5MB CSV, 1,130,033 rows: 777,875 `A` + 351,396 `4` + 762 `Z`), and its column layout confirmed against known Oklahoma FIPS values (e.g. Stillwater → county `119`/Payne, place `70300`).
- Census Gazetteer county file: `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_gaz_counties_40.txt` (77 rows) and place file `2025_gaz_place_40.txt` (846 rows), used to resolve county/place FIPS codes to names for the spot checks above.
