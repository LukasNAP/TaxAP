# South Dakota — findings

Status: **investigated live 2026-08-26, not safe to build.** Official source is real and current (SST rate file `SDR2026Q3JUN02.zip`, boundary file `SDB2026Q3JUN04.zip`, both confirmed). Strategy is boundary-matching — confirmed with a live same-ZIP example, not just structurally — but a blocking placeholder needs resolving first.

## Address matching

**Yes — confirmed live on real ship-to data.** Two active South Dakota ship-tos share the exact same city+ZIP (Yankton, 57078) but carry different real A+ tax bodies: `SD1000` "No Local Rt" at 4.2% vs. `SD4052` "Yankton" at 6.2% — a ZIP alone cannot disambiguate. SD's own SST rate file also confirms city-level local rates are non-uniform statewide (230 of 254 active cities at 2%, but 21 at 1%, plus isolated 1.5%/1.95%/3% rows), so no flat per-city assumption is safe beyond what's individually verified.

## Rate comparability

**Yes, for correctly-coded tax bodies — confirmed live and cross-checked against the real SST rate file.** State rate is 4.2% (active since 2023-07-01). All 66 real SD counties carry 0% local tax (no county-option sales tax in SD — confirmed both via A+, which has zero county-named tax bodies, and via the SST county rows, all literally 0.00000). Every one of A+'s 11 real named-city tax bodies (Aberdeen, Box Elder, Brookings, Huron, Mitchell, Pierre, Rapid City, Sioux Falls, Vermillion, Watertown, Yankton) shows `TBCBSRT=4.2 + TBCLRT1=2 = TBCRATE 6.2`, and cross-referencing each city's real Census place FIPS against the SST file confirms every one of those 11 cities' official local rate is exactly 2.0% today — full agreement, no discrepancy found. `SD1000` ("No Local Rt", 4.2%) also matches the current state-only rate correctly.

## The blocking finding: SD000

`SD000` ("South Dakota" catch-all) has `TBCBSRT=0`/`TBCLRT1=0`/`TBCRATE=0` — not the real 4.2% state floor, an apparent placeholder — and is live on **9 of 43 active SD ship-tos (~21%)**, scattered across cities (Aberdeen, Brookings, Rapid City, Sioux Falls) that also have correctly-coded ship-tos elsewhere in the same city. The same `AL000`/`MN000`/`NE000`-shaped blocking pattern: real revenue-bearing ship-tos silently showing 0% when they should show at least 4.2%.

## Other findings

- Full unfiltered `SD%` pull = 14 rows (small state, no truncation risk). `SD001` is the only `DO NOT USE` row; no wrong-state contamination found in the remaining 13.
- Real SST boundary file confirmed and directly fetched: `SDB2026Q3JUN04.zip`, 89 columns (matches GA/OK's schema exactly), 231,736 rows, record types 4 (ZIP-range)/A (address-range)/Z — a `ga-boundary.mjs`-pattern build looks structurally viable, not yet attempted.
- SST rate file confirms: FIPS 46, 66 counties all 0%, 254 active city rows (matches prior research exactly) with non-uniform rates. A 15-row "type 49" jurisdiction category also exists (6 currently active, numeric codes resembling CBSA-style codes, meaning unconfirmed) with no corresponding A+ tax body found — low materiality today (0 ship-tos observed on it), same shape as KS's undecoded type 79.

## Do instead

- Resolve `SD000` (9/43 ship-tos) before building anything.
- The Yankton same-ZIP example is a ready-made test case for whatever address matcher gets built — use it to validate the matcher actually disambiguates correctly.
- Decode "type 49" before including any of its 6 active rows in a comparison.
