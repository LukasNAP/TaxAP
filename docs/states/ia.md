# Iowa — findings

Status: **investigated live 2026-08-26, not safe to build.** Official source is real and current (SST rate file `IAR2025Q3MAY19.zip`, boundary file `IAB2026Q3MAY19.zip`, both confirmed). Strategy is flat-county — no address matching needed — but a blocking placeholder and an incomplete-coverage gap keep it from being built yet.

## Address matching

**Not needed.** Live data shows Iowa's real local sales tax is currently uniform per county, not city/place-level as earlier (pre-live) research assumed. The official SST rate file's "special" (jurisdictionType 63) rows — where Iowa's real Local Option Sales Tax actually lives — show identically 1.00% for all 100 county-wide LOST districts, zero variation. A+'s 57 real county tax-body codes all show an identical 6%+1%=7% total. Both sides agree the state is currently flat.

**Structural surprise:** the official SST rate file does **not** carry local tax on its "county" (type 00, 100 rows) or "city" (type 01, 1,013 rows) records at all — every one of those 1,113 rows shows exactly 0% local. The real 1% LOST lives entirely in a separate "special" (type 63) bucket of exactly 100 rows, whose `jurisdictionCode` is `98000 + county FIPS` (verified against all 99 real FIPS codes, plus one reserved non-county code, FIPS "199"/98199, that must be excluded from any per-county map). **The existing `GENERIC_SST_STATES` pattern (reads local rate off county rows directly) would silently read 0% local for all of Iowa if pointed at this file as-is — a real, new code path is needed, not a drop-in config entry**, even though the state itself is structurally simple. This almost certainly reflects Iowa's 2019 reform (effective 2024-07-01) that unified the old per-city LOST patchwork onto one countywide 1% rate.

## Rate comparability

**Yes, for the 57 counties A+ has configured** — `TBCRATE` (7%) exactly equals the live official total (6% state + 1% uniform county LOST) for every one checked, zero discrepancies. **Not evaluable for the other 42 real Iowa counties** — A+ has no tax-body row for them at all.

## The blocking finding: IA000

`IA000` ("Iowa," `TBCRATE=0`) has no `DO NOT USE` tag but is nonetheless the single largest live tax-body bucket in the state: **55 of 262 active IA ship-tos (28 customers)** sit on it — more traffic than any real county code (Polk/`IA077` is next at 33). Same red-flag shape as `AL000`/`MN000`/`NJ000`/`ND000` elsewhere — **blocks building without a human decision on what it means** (real data gap vs. deliberate zero-tax policy).

## Coverage gap

A+ only has real county codes for 57 of Iowa's 99 real counties (Census-confirmed via `2025_gaz_counties_19.txt`). 42 real counties have zero A+ tax-body row — unconfirmed whether ship-tos there simply don't exist or get miscoded onto `IA000` or something else.

## Other findings

- Live `XATXBD` pull for `IA%` (58 rows, no truncation) is clean of `DO NOT USE` rows and wrong-state contamination — every `TBTXNAM` says "Iowa"/"IOWA".
- One live IA ship-to (`SASHST=IA`) is assigned tax body `FL049` (Florida) instead of an IA code — the already-documented `SASTXB` cross-state-context pattern, needs excluding, not counting as an IA mismatch.
- A+'s own `IA{01-99}` numbering is a real, historically-documented convention — Iowa's classic license-plate/DOR county-number scheme (`IA077`=Polk, `IA097`=Woodbury, `IA007`=Black Hawk, `IA057`=Linn, `IA031`=Dubuque all match well-known real assignments). This can be read directly rather than needing NC-style alphabetical-index trust.
- A real, current SST boundary file exists (`IAB2026Q3MAY19.zip`, 89 columns — identical schema to Georgia's, 2,214,617 address rows) — not needed given the confirmed county-level uniformity today, but exists if any county's LOST status ever changes.

## Do instead

- Resolve `IA000` (55/262 ship-tos) before anything else.
- Decide whether to expand A+'s county coverage to the other 42 counties, or confirm no ship-tos exist there.
- If building the official-source side: read the LOST rate from the "special" (type 63) bucket, `jurisdictionCode - 98000 = county FIPS`, not from county/city rows — a new code path, not a `GENERIC_SST_STATES` line.
