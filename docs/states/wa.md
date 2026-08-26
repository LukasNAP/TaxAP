# Washington — findings

Status: **investigated, not built.** Live A+ (`XATXBD` `WA%` prefix pull, plus active `ADDR`/`CUSMS` WA ship-to assignments) checked 2026-08-26. Cross-referenced against the current Streamlined rate file (`WAR2026Q3MAY27.zip`) and current Streamlined boundary file (`WAB2026Q3MAY27.zip`), both confirmed to exist via a live directory-listing fetch. Census Gazetteer (FIPS `53`) confirms **39 real counties** — matches the prior research hint exactly.

## Address matching

**Needed — confirmed live, not just inferred from SST's ~400+-location-code reputation.** A+ has **64 real `WA%` codes** (2 more, `WA000` and `WA3500`, are explicit `DO NOT USE` placeholders — see below) against 39 real counties: far more granular than a flat county model, because Washington's own DOR "location code" system (which A+'s numbering directly rides on — see below) assigns a **separate code per incorporated city**, not just per county, plus at least one **third-tier "unincorporated annexation area" code** distinct from both the county and the city:

- `WA2700` "PIERCE CO" (unincorporated county) — 9.5%
- `WA2717` "TACOMA" (incorporated city) — 10.3%
- `WA2717UNI` "TACOMA UN-AREA" (an unincorporated-but-Tacoma-adjacent area, presumably an urban growth area annexation zone) — 10.1%

This three-way split is a new shape, not the same as AL's county/city/police-jurisdiction split or SC's county/incorporated-municipality split, but it's the same *lesson* `state-rollout.md` already calls out: don't assume a state's jurisdiction model has only two levels.

**Real live confirmation that this isn't just a theoretical multi-code state:** grouping the 472 active WA ship-tos by mailing city, **24 of 101 distinct cities span 2 or more different A+ tax bodies**, several with materially different real rates on the same city name:

| City | Tax bodies present | Rate spread |
|---|---|---|
| Tacoma | `WA2700` 9.5%, `WA2717` 10.3%, `WA2717UNI` 10.1% | 0.8 pt |
| Auburn | `WA1700` (King Co Uninc) 10.3%, `WA1702` (Auburn) 10.4% | 0.1 pt |
| Kent | `WA1700` 10.3%, `WA1715` (Kent) 10.4% | 0.1 pt |
| Seattle | `WA1700` 10.3%, `WA1725` (Renton/King Co) 10.5%, `WA1726` (Seattle) 10.55% | 0.25 pt |
| Vancouver | `WA0600` (Clark Co) 7.8%, `WA0605` (Vancouver) 8.8% | 1.0 pt |

City/ZIP alone (the way NC/NY read a human-readable code) is not enough to resolve these — the same mailing city genuinely covers ship-tos in more than one real jurisdiction. This is the GA/SC/OK/UT-shaped Step 1 answer: **real address-level matching is needed.**

## A+'s numbering is Washington DOR's own "location code" scheme, not an arbitrary internal scheme

This is the most useful structural finding for future matching work. A+'s WA codes (`WA0100`, `WA1700`, `WA1726`, `WA2717`, ...) are the "`WA`" prefix plus Washington State DOR's own well-known 4-to-6-digit local sales/use tax **location codes** (the same codes WA DOR itself publishes rate lookups by) — not a synthesized or trusted-assumption numbering scheme like NC's. Confirmed two independent ways:

1. `TBTXNAM` values read as real WA DOR jurisdiction names paired with codes that match DOR's public numbering exactly where checked (e.g. `1700` = King County unincorporated, `1726` = Seattle, `2717` = Tacoma — all real, well-known WA DOR location codes).
2. **The Streamlined *boundary* file's own special-jurisdiction code column uses the identical numbering with an `L` prefix instead of `WA`** — e.g. a boundary row covering ZIP `98001` (Auburn) carries special code `L1702`, matching A+'s `WA1702` for the same place. This cross-file agreement (A+ and Streamlined's boundary file independently landing on the same 4-digit number for Auburn) is strong evidence this is a real external numbering standard both sides are drawing from, not coincidence.

This is a genuinely useful lead for a future GA-style build: rather than needing full free-text address parsing to find the *code*, WA ship-tos might already carry (or be derivable to) the correct DOR location code directly — but this still needs an explicit re-derivation step (from an address) to catch cases where the *assigned* code is stale or wrong, the same reasoning `state-rollout.md` uses to warn against trusting NC's alphabetical-index scheme without re-verification.

## Two real parser blockers found in the SST files themselves — separate from the already-fixed ZIP-extraction issue

**1. The rate file's special-jurisdiction codes are alphanumeric, not numeric — `server/sst-rates.mjs`'s `parseSstRateCsv` cannot read them today.** WA's `WAR2026Q3MAY27.zip` has 15,506 rows across 3 jurisdiction types: `00` (county, 44 distinct active codes), `01` (city, 277 distinct active codes), and `63` (special, **1,153 distinct active codes**, far more than the ~400 the prior SST-only research estimated). The `63`-type codes are formatted `L####` (e.g. `L1702`, `L2720`) — `parseSstRateCsv`'s validation regex, `/^\d{2,5}$/`, rejects any non-numeric `jurisdictionCode` and throws `"SST rate row N has an invalid jurisdiction identifier."` **Calling `readOfficialSstStateRates("WA")` today would fail immediately on the first `L`-coded row**, a distinct, unfixed blocker from the ZIP-unzipping fix that already landed. Any WA adapter needs its own parsing path (or a regex relaxation) before the rate file is usable at all.

**2. The rate file's county-type (`00`) rows include 5 codes with no real WA county behind them.** 44 active `00`-type rows exist, but Washington only has 39 real counties (Census FIPS suffixes `001`–`077`, all odd-numbered). The extra 5 codes — `079`, `081`, `083`, `085`, `087` — are outside the real county FIPS range entirely and don't correspond to any Census county. (Plausible explanation, not confirmed: a split of a transit-affected county into "inside Sound Transit RTA boundary" / "outside RTA boundary" variants, since Washington's RTA covers only parts of King/Pierce/Snohomish counties — but this needs a real WA DOR cross-reference before treating it as fact.) **A naive `GENERIC_SST_STATES`-style adapter with `expectedCountyCount: 39` would correctly throw rather than silently misreading these** — which is the validation working as designed, but it also means WA cannot be dropped in as a flat-county `GENERIC_SST_STATES` entry the way OH/TN/AR/WY were; the county-count mismatch is a real structural fact about WA, not a bug to configure around.

**3. The boundary file's column count is 90, not GA's 89 — `ga-boundary.mjs`'s parser cannot be reused unmodified.** `WAB2026Q3MAY27.zip` is a 383 MB CSV; every sampled row (including a `4`-type, `A`-type, and `Z`-type row) has exactly 90 comma-separated fields, one more than `ga-boundary.mjs`'s hardcoded `EXPECTED_COLUMN_COUNT = 89`. **Encouragingly, the offsets that matter line up with GA's exactly where checked** — `columns[22]` = state FIPS (`53`), `columns[24]` = county FIPS suffix (e.g. `051` for Pend Oreille) — so this looks like an extra column *inserted* somewhere rather than a wholesale re-shuffle, and a WA-specific boundary parser adapted from `ga-boundary.mjs` (not a rewrite from scratch) looks plausible. But it has not been fully mapped out (the exact extra column's meaning, and where `specialCode`/`fipsPlace` land relative to GA's `columns[25]`/`columns[30]`, still need a dedicated pass) and the current code will throw on every single WA boundary row until that mapping is done and the parser is forked or parameterized.

## Rate comparability — not yet confirmed either way

Washington's real sales tax stacks up to three concurrent components: the 6.5% state rate, a county-or-city local rate, and (in Sound Transit / PTBA / TBD areas) a separate transit or benefit-district surcharge. A+'s `XATXBD` rows only ever populate `TBCLRT1` (every sampled row has `TBCLRT2`/`3`/`4` = 0) — e.g. Seattle (`WA1726`): base `6.5` + local `4.05` = total `10.55`. **Whether that single `TBCLRT1` figure already nets in Sound Transit's RTA surcharge (folded into one number, the way NY's MCTD 0.375% was confirmed already baked into `TBCRATE`) or omits a separate `L####` special-district layer (the way OH's transit-authority surcharge or GA's special-district component sit *on top of* the base) has not been checked against a real official total yet** — this needs a live comparison against WA DOR's own published rate for a known location code (e.g. Seattle `1726`) before any comparison is built, exactly the kind of check Ohio's finding warns is state-specific and can't be inferred from code structure alone.

## Do-not-use and cross-context findings

**`WA000` — "DO NOT USE."** Used by **33 of 472 active WA ship-tos (~7%)** — the same blocking shape as `AL000`/`MN000`/`NE000`/`UT000`. Must be surfaced as a visible exclusion count, not silently dropped, and understood before any comparison is built.

**`WA3500` is also marked "DO NOT USE" in `TBTXNAM`, but is actively assigned to 2 real ship-tos** (Longview, WA, ZIP `98632`, Cowlitz County). Unlike `WA000`, this isn't just a generic placeholder-in-use pattern — **Cowlitz County has no other WA code in A+ at all** among the 64 real rows. These 2 ship-tos have no valid, non-retired A+ tax body configured for their real jurisdiction — a genuine coverage gap (like AL's missing Jefferson County Uninc code), not just "needs the placeholder resolved."

**No wrong-state contamination found in the `WA%` prefix.** A `TBTXNAM LIKE '%WASHINGTON%'` search across *all* prefixes turned up 12 other states' own "Washington [County]" rows (AL, FL, GA, IA, MN, MO, NC, NY, OH, VA, VT, WI all have a real county or city named Washington) — none of those leaked into the `WA%` prefix results, and every one of the 64 real `WA%`-prefixed rows names a real Washington place. Unlike SC's `SC3622`, there is no SC3622-style needle to exclude here.

**0 of 472 active WA ship-tos carry a non-`WA`-prefixed tax body** — clean on the `SASTXB` cross-context check (unlike GA's 5 outliers or NV's 2).

**A likely `SASCTY` data-quality wrinkle, not an A+ config problem:** one ship-to's city field reads `BURLINGTON` at ZIP `98223` with tax body `WA4231` (Snohomish County) — but ZIP `98223` is Arlington's ZIP, and the real Burlington, WA (Skagit County) ship-tos correctly show ZIP `98233` with tax body `WA2902`. Consistent with the already-documented pattern that free-text city/state fields (`SASHST`, `CMSTAT`) shouldn't be trusted at face value — don't build city-name-based logic without also checking ZIP.

## Real live A+ codes (2026-08-26, `XATXBD` `LIKE 'WA%'`, unfiltered, no row limit — 66 rows total, 64 real + 2 DO NOT USE)

Full 64-row list (code, name, total rate) — see the raw query output for base/local component breakdown; every row has `TBCLRT2`–`4` = 0, `TBCRATE` = `TBCBSRT`(6.5) + `TBCLRT1`:

`WA0100` Adams Co Uninc 8.0 · `WA0202` Clarkston 8.5 · `WA0300` Benton Co 8.1 · `WA0304` Richland 8.8 · `WA0400` Chelan Co 8.4 · `WA0405` Wenatchee 8.6 · `WA0500` Clallam Co 8.6 · `WA0600` Clark Co 7.8 · `WA0602` Camas 8.6 · `WA0604` Ridgefield 8.7 · `WA0605` Vancouver 8.8 · `WA0701` Dayton 8.4 · `WA0803` Kelso 8.1 · `WA0805` Woodland 7.9 · `WA0909` East Wenatchee 8.7 · `WA1000` Ferry Co 8.0 · `WA1100` Franklin Co 8.1 · `WA1101` Connell 8.3 · `WA1103` Basin City Uninc 8.1 · `WA1104` Pasco 8.9 · `WA1300` Ephrata 8.4 · `WA1309` Moses Lake 8.5 · `WA1310` Quincy 8.2 · `WA1313` Warden 8.2 · `WA1401` Aberdeen 9.08 · `WA1408` Westport 8.9 · `WA1503` Oak Harbor 9.2 · `WA1700` King Co Uninc 10.3 · `WA1702` Auburn 10.4 · `WA1704` Bellevue 10.3 · `WA1714` Issaquah 10.5 · `WA1715` Kent 10.4 · `WA1725` Renton/King Co 10.5 · `WA1726` Seattle 10.55 · `WA1728` Snoqualmie 9.3 · `WA1735` Woodinville 10.3 · `WA1800` Kitsap Co 9.2 · `WA2100` Lewis Co Uninc 8.0 · `WA2101` Centralia 8.2 · `WA2423` Brewster 8.4 · `WA2424` Omak 8.4 · `WA2700` Pierce Co 9.5 · `WA2706` Fife 10.1 · `WA2717` Tacoma 10.3 · `WA2717UNI` Tacoma Un-Area 10.1 · `WA2902` Burlington 8.9 · `WA3105` Everett 9.9 · `WA3210` Spokane 9.1 · `WA3302` Colville 8.0 · `WA3400` Thurston Co 8.3 · `WA3402` Lacey 9.7 · `WA3406` Tumwater 9.7 · `WA3604` Walla Walla 9.1 · `WA3701` Bellingham 9.1 · `WA3705` Lynden 9.2 · `WA3737` Whatcom Co 8.8 · `WA3812` Pullman 8.0 · `WA3900` Yakima Co 8.2 · `WA3907` Selah 8.5 · `WA3911` Union Gap 8.4 · `WA3913` Yakima City 8.5 · `WA4200` Stanwood 9.3 · `WA4231` Snohomish Co 9.1 · `WACR` "Credits Only" (base 8.6, no local component — likely a non-jurisdictional bookkeeping code, not a real place; exclude from any place-based comparison)

64 codes cover a subset of Washington's real cities/counties (customer-driven, like MO/CO/UT — not exhaustive of all ~280 real incorporated WA cities).

## Official sources confirmed live (2026-08-26)

- **Rates:** `https://www.streamlinedsalestax.org/ratesandboundry/Rates/WAR2026Q3MAY27.zip` — exists, downloads and unzips fine with `readSingleFileZip`, but **`parseSstRateCsv` cannot validate it as-is** (alphanumeric special-jurisdiction codes; see above). 15,506 total rows / 44 active county rows (5 unexplained beyond the real 39) / 277 active city rows / 1,153 active special rows.
- **Boundary:** `https://www.streamlinedsalestax.org/ratesandboundry/Boundary/WAB2026Q3MAY27.zip` — exists, confirmed via live directory-listing fetch. 90-column CSV (not GA's 89), ~383 MB uncompressed. `ga-boundary.mjs`'s parser needs adaptation, not direct reuse.
- **Census Gazetteer (production URL, same as `server/sst-rates.mjs` uses):** `2025_gaz_counties_53.txt` confirms **39 rows**, FIPS `53`.

## Open questions / do instead if building

- **Before building:** relax or extend `parseSstRateCsv`'s jurisdiction-code regex to accept WA's `L####` special codes (or write a WA-specific rate parser) — this is a real code change, separate from the ZIP-support fix already landed.
- **Before building:** map out WA's boundary file's extra (90th) column and confirm `fipsPlace`/`specialCode` offsets before adapting `ga-boundary.mjs` — don't assume GA's exact offsets hold past `columns[24]` without checking further.
- **Before building:** get a live answer on whether Sound Transit RTA / PTBA / TBD special-district amounts are already netted into `TBCLRT1`/`TBCRATE` or need to be added from the `L####` special-code layer — check at least one well-known jurisdiction (e.g. Seattle `1726`) against WA DOR's own published total, the same way NY/OH's layering questions were resolved.
- **Before building:** get a human decision on `WA000` (33/472 ship-tos, ~7%) the same way AL000/MN000/NE000/UT000 needed one.
- **Before building:** decide what to do about the 2 `WA3500`-tagged Longview/Cowlitz ship-tos that have no real code to fall back to at all.
- Investigate what the 5 extra county-type codes (`079`/`081`/`083`/`085`/`087`) in the rate file actually represent — plausibly an RTA-boundary county split, not confirmed.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level), for the same reason already established for NC/GA — not separately re-verified for WA in this pass, but no evidence found to treat WA differently.
