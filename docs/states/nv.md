# Nevada — findings

Status: **official source connected (2026-08-26)**, genuine drop-in `GENERIC_SST_STATES` entry in `server/sst-rates.mjs` — no code changes needed, unlike Nebraska (see `docs/states/ne.md`). Verified end to end by actually running `readOfficialSstStateRates("NV")` against the live file, not just the investigation's spot-checks: `stateRate` correctly reads as `0` (Nevada's SST encoding has no separate state line — each county row already carries the full combined total, e.g. Carson City = 7.6%), and all 17 counties parse and validate cleanly. A+ tax-body matching (comparing `NV001`-`NV017` against this source) still not built.

Live A+ (`XATXBD` + active `ADDR`/`CUSMS` ship-to assignments) checked 2026-08-26, cross-referenced against the current Streamlined rate file (`NVR2025Q4NOV05.zip`) and the current Streamlined boundary file (`NVB2025Q4NOV05.zip`), both confirmed to exist via a live directory-listing fetch. Census Gazetteer (FIPS `32`) confirms **17 real county-equivalents** (16 counties + Carson City independent city) — matches the prior research hint exactly.

## Address matching

**Not needed for the general case — A+'s 17 codes map 1:1 and directly to all 17 real county-equivalents, confirmed by name.** `TBTXBOD` is `NV001`–`NV017` (plus one `DO NOT USE` placeholder, see below); `TBTXNAM` literally spells out `"Nevada-<County> Cty"` (or `"Nevada-Carson City"`) for every row, and every one of the 17 real codes matches a real Nevada county/independent-city name — no wrong-state contamination, no `E`-suffixed equipment-tax variant codes, no third-tier "police jurisdiction"-style split. This is the cleanest A+ code structure found in any state investigated so far — even cleaner than NE's (NE's codes are sparse relative to its real place count; NV's 17 codes cover **100%** of Nevada's real jurisdictions).

**But a real, live structural wrinkle exists that the prior SST-only research (correctly) had no way to see: Nevada Tourism Improvement Districts (TIDs).** The Streamlined **boundary** file (`NVB2025Q4NOV05.zip`) contains 35 `"A"`-type records — literal street-name + house-number-range overrides — that assign a **`63` (special)** jurisdiction code to specific blocks inside Reno (89439 Verdi/Boomtown, 89501/89502 downtown), Sparks (89434, the Legends/Marina outlet-mall area), and Las Vegas (89101/89106/89102/89109, downtown/Symphony Park/Arts District), layered *within* ZIP codes that otherwise map only to the surrounding county. This is exactly the "can jurisdictions vary within a single ZIP code" case Step 1 asks about — it does, just very narrowly. All 453 five-digit-ZIP-range (`"4"`/`"Z"`) records in the same boundary file map to jurisdiction type `00` (county) only — no city-level ZIP variation exists outside these 35 address-range carve-outs.

**A quick LIKE-based screen against real live NV ship-to addresses found 22 active ship-tos whose city/ZIP/street-name loosely match one of these 35 flagged block ranges** (not exact house-number-range matching — a looser net that likely over-counts via generic street-name tokens like "CITY" or "LAKE"). This means the TID wrinkle is not a zero-probability edge case for Atlantic's real NV book of business; a small number of real ship-tos plausibly sit inside a TID boundary.

## Rate comparability

**Yes — confirmed live for all 17 counties, and (as a bonus) the TID wrinkle currently has zero rate impact.** Every one of A+'s 17 real `TBCRATE` values was cross-checked against the current-dated row (the row whose date range brackets today) in the Streamlined rate file for the matching county FIPS, and **all 17 match exactly** — e.g. Clark `8.375`, Washoe `8.265`, Carson City `7.6`, White Pine `7.725`, all the way down to the six counties at the state-minimum `6.85`. `TBCLRT1`–`4` are `0` for every row (`TBCBSRT` alone equals `TBCRATE`) — no split-component ambiguity like NY's or hidden-surcharge question like Ohio's transit tax.

**The TID special-jurisdiction rows in the *rate* file (not just the boundary file) currently carry the *same* combined rate as their surrounding county** — the Reno/Sparks TID codes (`32601`/`32603`/`32607`/`32609`, all `8.265%`) equal Washoe County's rate exactly; the Las Vegas TID codes (`32605`/`32611`/`32613`/`32615`/`32617`, all `8.375%`) equal Clark County's rate exactly. In other words: today, a ship-to physically inside one of these TID block ranges would be taxed at the *same* rate a flat county-level comparison already assumes — the TID financing increment appears to currently be `0` on top of the base county rate (structurally possible per NRS 271A, evidently not currently levied at these five active codes, or already fully absorbed into the county total as published). **This is not a structural guarantee, though** — if any TID's increment becomes nonzero in a future rate cycle, a flat-county comparison would silently miss it for ship-tos on those specific blocks, the same shape of risk Ohio's transit surcharge represents, just currently dormant rather than live.

## Do-not-use and cross-context findings

**`NV000` — "DO NOT USE."** Used by **8 of 271 active NV ship-tos (~3%)** — the same shape as AL000/MN000/NE000 but a much smaller share. Must still be surfaced as a visible exclusion count, not silently dropped, per the project's no-silent-caps rule.

**2 of 271 active NV ship-tos carry a non-Nevada tax body at the ship-to level** (`DR000` ×1, `NCPRST` ×1) — the already-documented `SASTXB` cross-context pattern (a ship-to physically in one state can carry a tax body that isn't that state's), not new NV-specific contamination. Exclude these from NV-specific findings the same way GA's live run excludes its NC060/NC041/SC126/CA1163/PA000 outliers.

**Customer-level `CMTXBD` disagrees with ship-to-level `SASTXB` for several NV customers** (`TR` ×4, `NC065` ×2, `CA000` ×1, alongside `NV002`/`NV016`/`NV007`/`NV013` that agree) — consistent with the general A+ `CMTXBD`/`SASTXB` divergence pattern already documented in `docs/aplus-data-findings.md`. Per that file's resolution note, the live NC/GA dashboard logic (and any future NV logic) should read `SASTXB` (ship-to level), not `CMTXBD`.

## Real live A+ codes (2026-08-26, `XATXBD` `LIKE 'NV%'`, unfiltered, no row limit — 18 rows total)

| Code | Name | Rate | Notes |
|---|---|---|---|
| `NV000` | DO NOT USE | 0 | placeholder — 8 active ship-tos |
| `NV001` | Nevada-Churchill Cty | 7.6 | matches SST |
| `NV002` | Nevada-Clark Cty | 8.375 | matches SST — largest ship-to concentration (151) |
| `NV003` | Nevada-Douglas Cty | 7.1 | matches SST |
| `NV004` | Nevada-Elko Cty | 7.1 | matches SST |
| `NV005` | Nevada-Esmaralda Cty | 6.85 | matches SST (name typo "Esmaralda" for Esmeralda — cosmetic) |
| `NV006` | Nevada-Eureka Cty | 6.85 | matches SST |
| `NV007` | Nevada-Humboldt Cty | 6.85 | matches SST |
| `NV008` | Nevada-Lander Cty | 7.1 | matches SST |
| `NV009` | Nevada-Lincoln Cty | 7.1 | matches SST |
| `NV010` | Nevada-Lyon Cty | 7.1 | matches SST |
| `NV011` | Nevada-Mineral Cty | 6.85 | matches SST |
| `NV012` | Nevada-Nye Cty | 7.6 | matches SST |
| `NV013` | Nevada-Carson City | 7.6 | matches SST |
| `NV014` | Nevada-Pershing Cty | 7.1 | matches SST |
| `NV015` | Nevada-Storey Cty | 7.6 | matches SST |
| `NV016` | Nevada-Washoe Cty | 8.265 | matches SST — second-largest concentration (89); Reno/Sparks TID blocks sit inside this county |
| `NV017` | Nevada-White Pine Cty | 7.725 | matches SST |

All 17 real counties confirmed 1:1 against `2025_gaz_counties_32.txt` (FIPS `32`) and against the current-dated rows of `NVR2025Q4NOV05.zip`.

## Official sources confirmed live (2026-08-26)

- **Rates:** `https://www.streamlinedsalestax.org/ratesandboundry/Rates/NVR2025Q4NOV05.zip` — readable today by `server/sst-rates.mjs` now that ZIP support has landed. 59 total rows (historical rate-change history included) / 17 currently-active county (`00`) rows + 1 state (`45`) row + 9 currently-active special (`63`) TID rows.
- **Boundary:** `https://www.streamlinedsalestax.org/ratesandboundry/Boundary/NVB2025Q4NOV05.zip` — **exists**, confirmed via a live directory-listing fetch. 577 total rows: 453 `"4"` + 89 `"Z"` five-digit-ZIP county-mapping record pairs (all jurisdiction type `00`), plus 35 `"A"` street-address-range TID override records (jurisdiction type `63`) — the real Step 3 answer if TID-level precision is ever needed.
- **Census Gazetteer (production URL, same as `server/sst-rates.mjs` uses):** `2025_gaz_counties_32.txt` confirms **17 rows** (16 counties + Carson City), FIPS `32`.

## Open questions / do instead if building

- **Before building:** get a human decision on whether `NV000` (8/271 ship-tos) needs the same "what governs tax for these in practice" question AL000/MN000/NE000 needed, even though the share here is much smaller — don't compare or silently drop these.
- **Before building:** decide how to handle the 2 non-NV ship-to-level tax bodies (`DR000`, `NCPRST`) — exclude from NV findings with a visible count, same as GA's cross-context outliers.
- **The TID wrinkle is real but currently dormant** — recommend shipping the flat-county comparison now (all 17 counties match exactly, live) while flagging in the UI or a code comment that ship-tos physically inside the Reno/Sparks/Las Vegas TID blocks listed above are a known, currently-zero-impact simplification, revisit if `NVR*.zip`'s `63`-type rows ever diverge from their county's rate.
- If finer precision is ever needed, `NVB2025Q4NOV05.zip`'s `"A"`-type records give exact street-name + house-number ranges to match against, the same shape `ga-boundary.mjs` already parses — no new file format to support, just a much smaller override list (35 rows vs. GA's 2M+).
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level), for the same reason already established for NC/GA.
