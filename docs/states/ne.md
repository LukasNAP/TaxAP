# Nebraska — findings

Status: **official source connected (2026-08-26)**, `GENERIC_SST_STATES` entry in `server/sst-rates.mjs`. A+ tax-body matching (comparing `NE#####` codes against this source) still not built.

**Correction, worth reading before trusting the rest of this file:** the initial investigation recommended `expectedCountyCount: 93` and claimed this was a pure config-only, zero-code-change addition. Neither survived actually running `readOfficialSstStateRates("NE")` against the live file:
1. **`expectedCountyCount` is 1, not 93.** Unlike SD (which has a 0%-rate row for every one of its 66 counties), Nebraska's SST file only includes an active county-type row for a county that actually levies one — confirmed live, only Dakota County does today.
2. **It is not config-only.** The live file's 5 `GL80x` special-district rows use alphanumeric jurisdiction codes (`GL801`, not a number), which threw `SST rate row ... has an invalid jurisdiction identifier` against the parser's old numeric-only regex. Fixed in `parseSstRateCsv` by widening the jurisdiction-code check to accept alphanumeric codes generally (the same fix Kansas's `11KAN`-style codes and Washington's `L####` codes will also need once those states are attempted).
3. A `cityRateIsFullLocal: true` config flag was added specifically for Nebraska, since its real local-tax variation is entirely city-level with no separate county component to stack — see the comment in `server/sst-rates.mjs` for why this must NOT be copied to a future state without re-confirming the same fact.

Live A+ (`XATXBD` + active `ADDR`/`CUSMS` ship-to assignments) checked 2026-08-26, cross-referenced against the current Streamlined rate file (`NER2026Q3MAY26.zip`) and the current Streamlined boundary file (`NEB2026Q3JUN08.zip`), both confirmed to exist. Census Gazetteer (FIPS `31`) confirms 93 real Nebraska counties (only 1 has an active county-level option tax).

## Address matching

**Not needed — real, discoverable place-code convention, confirmed live.** A+'s Nebraska tax-body codes are `NE` + a 5-digit number, and that number is the real Census/GNIS **place FIPS code** for the city, not a synthesized index (unlike NC's alphabetical scheme). Confirmed directly against `2025_gaz_place_31.txt`:

| A+ code | `TBTXNAM` | Census place GEOID |
|---|---|---|
| `NE00905` | Nebraska Alliance | `3100905` (Alliance city) |
| `NE18580` | Nebraska Gering | `3118580` (Gering city) |
| `NE28000` | Nebraska Lincoln | `3128000` (Lincoln city) |
| `NE37000` | Nebraska Omaha | `3137000` (Omaha city) |

The same 5-digit code is also exactly the `jurisdictionCode` Streamlined's own NE rate file uses for its city-type (`01`) rows — so A+'s code, the Census place FIPS code, and Streamlined's jurisdiction code are all the same number. This is the cleanest joinable numbering scheme found in any state investigated so far (no assumption/trust required the way NC's alphabetical-index scheme needs).

**Real live A+ state has only 22 real city codes** (plus 1 `DO NOT USE` placeholder and 1 wrong-country contamination row — see below), not anywhere near the 93-county or ~600-place scale — Atlantic simply doesn't ship to most Nebraska cities. All 22 real codes matched cleanly against the current Streamlined city-rate rows by code.

**County-level variation is real but tiny, and A+ has zero representation of it.** Confirmed directly against the SST rate file: of Nebraska's 93 counties, only **one** (Dakota County, FIPS `31043`) currently has an active county-level option tax (0.5%, since 2015-04-01); a second (Dawson, `31067`) had one that expired 2022-12-31. All 91 other counties have no county-level row in the file at all — they're taxed at exactly the 5.5% state rate outside any city with its own option tax, confirming the prior research hint. A+ has **no** `NE`+county-FIPS codes at all (unlike NC's per-county scheme) — a ship-to in unincorporated Dakota County, or in a small NE city not in Atlantic's 22-code list, would have no correct A+ code to be assigned to at all. This isn't a live problem today (no evidence any ship-to needs it) but it's a real structural gap if Atlantic ever ships somewhere in Nebraska outside these 22 cities.

## Rate comparability

**Comparable for 20 of 22 real codes; 1 confirmed live, material stale-rate discrepancy; 1 needs no comparison (0% local, correctly).** Checked every one of the 22 real A+ codes' `TBCRATE` against the Streamlined file's currently-active total (5.5% state + active city local rate, matched by the shared 5-digit code):

- **20/22 match exactly** (e.g. Omaha, Lincoln, Alliance, Bellevue, Grand Island, Fremont, Kearney, all others) — no surcharge/layering ambiguity found, `TBCBSRT` + `TBCLRT1` = `TBCRATE` in every real row, and that total equals Streamlined's current published total.
- **`NE02656` (Aurora): correctly 5.5% (no local component)** — Aurora has no row at all in the current Streamlined file (active or historical), meaning Aurora currently levies no city option tax; A+ agrees (`TBCLRT1 = 0`). Not a mismatch.
- **`NE18580` (Gering): confirmed stale.** A+ shows `TBCRATE = 7.0%` (`TBCBSRT 5.5 + TBCLRT1 1.5`). Streamlined's file shows Gering's local rate rose from 1.5% to **2.0%** (total **7.5%**) effective **2022-10-01** — nearly 4 years ago, not a pending future change. Confirmed via a direct follow-up query: `TBNRATE = 0`, `TBTXDAT` is the `0001-01-01` sentinel (not a scheduled-but-unapplied update). This is a genuine, material, unexplained live discrepancy — the same shape as AZ's Douglas/Cochise finding and NY's Suffolk/Yonkers findings.

No Ohio-style surcharge-layering question found for the base city/state comparison — the two special-district `GL80x` codes (see below) are the only "is this already included" wrinkle, and they aren't in play for any current ship-to.

## Do-not-use and contamination — both real, both confirmed live

**`NE000` — "Nebraska DO NOT USE."** Used by **21 of 114 active NE ship-tos (18%)** — the same blocking-finding shape as `AL000` (101/~500) and `MN000` (113/387). A meaningful fraction of Atlantic's real Nebraska ship-tos carry a placeholder code with `TBCRATE = 0`, not a real jurisdiction rate. Must be understood (what governs tax for these ship-tos in practice — the point-of-sale/invoicing system, a different override field, or a genuine data gap) before any NE comparison can report a trustworthy match rate; comparing them as "0% correct" or silently excluding them without a visible count would both be wrong per the project's no-silent-caps rule.

**`NEDS000` — "Netherlands No Tax." Wrong-jurisdiction contamination, same pattern as SC3622.** This code matches the naive `LIKE 'NE%'` prefix filter but is not Nebraska at all — it's a country-level placeholder for the Netherlands. Confirmed **not currently assigned to any active NE ship-to** (absent from the live `SASTXB` assignment list), so it's inert today, but it must be excluded explicitly (`AND TBTXBOD <> 'NEDS000'`) from any future NE query the way NC excludes `NCUSE`/`NC060XXX` and SC excludes `SC3622` — a plain prefix filter is not safe on its own here either.

**`GL801`–`GL805` — special (type `63`) districts, not currently in play.** Five active Streamlined special-jurisdiction rows exist (0.55%–5.5%+2.75% local depending on code), almost certainly narrow tourism/improvement districts in the Omaha/La Vista area. None of Atlantic's 22 real A+ codes or 114 active ship-tos reference anything resembling these, and A+ has no corresponding tax-body codes for them at all. Not a live problem, but flagged in case a future Omaha-area ship-to ever needs finer-than-city granularity.

## Real live A+ codes (2026-08-26, `XATXBD` `LIKE 'NE%'`, unfiltered, no row limit — 24 rows total)

| Code | Name | Base | Local1 | Total | Notes |
|---|---|---|---|---|---|
| `NE000` | Nebraska DO NOT USE | 0 | 0 | 0 | placeholder — 21 active ship-tos |
| `NE00905` | Nebraska Alliance | 5.5 | 1.5 | 7.0 | matches SST |
| `NE02656` | Nebraska Aurora | 5.5 | 0 | 5.5 | matches SST (no active local row) |
| `NE03950` | Nebraska Bellevue | 5.5 | 1.5 | 7.0 | matches SST |
| `NE11020` | Nebraska Cozad | 5.5 | 1.5 | 7.0 | matches SST |
| `NE11370` | Nebraska Crete | 5.5 | 2.0 | 7.5 | matches SST |
| `NE17670` | Nebraska Fremont | 5.5 | 1.5 | 7.0 | matches SST |
| `NE18580` | Nebraska Gering | 5.5 | 1.5 | **7.0** | **stale — SST active local is 2.0% (7.5%) since 2022-10-01** |
| `NE19595` | Nebraska Grand Island | 5.5 | 2.0 | 7.5 | matches SST |
| `NE20260` | Nebraska Gretna | 5.5 | 2.0 | 7.5 | matches SST |
| `NE21415` | Nebraska Hastings | 5.5 | 1.5 | 7.0 | matches SST |
| `NE25055` | Nebraska Kearney | 5.5 | 1.5 | 7.0 | matches SST |
| `NE26385` | Nebraska LaVista | 5.5 | 2.0 | 7.5 | matches SST |
| `NE28000` | Nebraska Lincoln | 5.5 | 1.75 | 7.25 | matches SST |
| `NE33705` | Nebraska Nebraska City | 5.5 | 2.0 | 7.5 | matches SST |
| `NE34615` | Nebraska Norfolk | 5.5 | 2.0 | 7.5 | matches SST |
| `NE35980` | Nebraska Ogallala | 5.5 | 1.5 | 7.0 | matches SST |
| `NE37000` | Nebraska Omaha | 5.5 | 1.5 | 7.0 | matches SST — largest ship-to concentration (36) |
| `NE38295` | Nebraska Papillion | 5.5 | 2.0 | 7.5 | matches SST |
| `NE45295` | Nebraska Sidney | 5.5 | 2.0 | 7.5 | matches SST |
| `NE50020` | Nebraska Valley | 5.5 | 1.5 | 7.0 | matches SST |
| `NE50965` | Nebraska Wahoo | 5.5 | 2.0 | 7.5 | matches SST |
| `NE54045` | Nebraksa York | 5.5 | 2.0 | 7.5 | matches SST (name has a typo, "Nebraksa" — cosmetic, harmless like NC's typos) |
| `NEDS000` | Netherlands No Tax | 0 | 0 | 0 | **wrong-jurisdiction contamination — not Nebraska, exclude explicitly** |

## Official sources confirmed live (2026-08-26)

- **Rates:** `https://www.streamlinedsalestax.org/ratesandboundry/Rates/NER2026Q3MAY26.zip` — readable today by `server/sst-rates.mjs` now that ZIP support has landed. 417 total rows / 277 active as of 2026-08-26: 1 state row (5.5%), 1 active county row (Dakota, 0.5%), 270 active city rows, 5 active special-district rows.
- **Boundary:** `https://www.streamlinedsalestax.org/ratesandboundry/Boundary/NEB2026Q3JUN08.zip` — **exists**, confirmed via a live directory-listing fetch. Not yet needed for Step 4 given Step 1's conclusion (code-to-place mapping is clean and direct), but available if a future finding requires real address-level resolution (e.g. resolving the Dakota-County-but-no-A+-code gap, or the GL80x special districts).
- **Census Gazetteer (production URL, same as `server/sst-rates.mjs` uses):** `2025_gaz_counties_31.txt` confirms **93 counties**, FIPS `31`. `2025_gaz_place_31.txt` confirms the place-FIPS-to-name mapping used above.

## Open questions / do instead if building

- **Before building:** get a human decision on `NE000` (21/114 ship-tos, 18%) the same way AL000/MN000 need one — don't compare or silently drop these.
- **Before trusting any future "config-only, drop-in" recommendation for a similar state again: actually run the real adapter function against the live file first.** This state's own history is the counterexample — a confident-sounding report and manual spot-checks both missed a parser-breaking row and a wrong county count that only surfaced by executing the real code.
- **Before building:** decide how to report `NE18580` (Gering) — a confirmed real, material, multi-year-stale rate, not a scheduled/pending change.
- Exclude `NEDS000` explicitly by code (`AND TBTXBOD <> 'NEDS000'`) — the plain `LIKE 'NE%'` prefix filter alone is not safe, same lesson as SC's `SC3622`.
- The A+-code-is-a-real-place-FIPS convention (unlike NC's synthesized alphabetical index) means the join can be built by reading `TBTXBOD`'s numeric suffix directly and matching it against Streamlined's `jurisdictionCode` column — no external trusted list of city names/order needs to be hardcoded the way NC's adapter does.
- If Atlantic ever ships to a Nebraska address outside these 22 cities (including anywhere in Dakota County), there is currently no correct A+ code for it — worth flagging to a human rather than assuming `NE000` covers that case correctly.
