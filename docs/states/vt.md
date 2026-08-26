# Vermont — findings

Status: **investigated live 2026-08-26, not safe to build.** Official source is real and current (SST rate file `VTR2026Q3MAY20.zip`, boundary file `VTB2026Q3MAY20.zip`, both confirmed). Strategy is boundary-matching — confirmed live, with real, material stale rates found on top.

## Address matching

**Yes — confirmed live.** Real tax variation is at the town (not county) level, and A+'s 19 real codes don't map 1:1 to it: two codes are literally named "Williston" (duplicate), three codes are named after counties ("Washington Co.", "Chittenden Co.", "Orleans Co.") even though Vermont has **no county-level sales tax at all** — those are informal catch-alls whose correctness depends entirely on which specific town inside that county a ship-to sits in, and one of them (Orleans Co.) is confirmed wrong for its one live ship-to. Distinct legal municipalities that both currently tax (Rutland Town vs. Rutland City; St. Albans Town vs. St. Albans City) share confusingly similar names and A+ has only one code per pair.

## Rate comparability — confirmed stale on real, populous codes

**No — confirmed live and material, not just theoretically possible.**
- **`VT005` "Essex Junction"** (A+'s single largest live VT tax body, 9 of 46 active ship-tos) is coded 6% flat in A+ while Essex Junction's official local-option tax has been active at 7% total since 2023-01-01 — ~3.5 years stale.
- **`VT008` "Waterbury"** (3 live ship-tos) is coded 6% in A+ while Waterbury's official local tax has been active at 7% since 2024-07-01.
- **`VT019` "Orleans Co."** (1 live ship-to, Derby VT) is coded 7% in A+, but no town in Orleans County currently has an active local-option tax in the official file at all — that ship-to is being overcharged today.

`TBCBSRT + TBCLRT1` does equal `TBCRATE` consistently (no internal-arithmetic problem), and 8 of A+'s 19 codes do currently agree with the official rate — but "some codes happen to be right" is not the same as comparable.

## Other findings

- `XATXBD` `VT%` = 20 rows, no truncation risk (small state), no wrong-state contamination (`VT003` has a harmless typo, "Vermonth Burlington," still functionally Vermont). `VT000`="Vermont DO NOT USE" is the only exclusion needed — already caught by the existing generic `isRetiredTaxBody()` filter.
- **`VT000` (DO NOT USE) is used by 9/46 (19.6%) of live VT ship-tos** — same blocking shape as `AL000`/`MN000`/`NE000`/`IA000`/`SD000` — and several of those 9 sit in towns (Milton, South Burlington, Waterbury, St. Albans) that already have a correct dedicated code, so they're misfiled, not merely "no code exists."
- VT's official local-option-tax list currently has **36 active town/city jurisdictions**, cross-referenced by hand against Census cousub/place gazetteers, since VT's "type 1" SST rows are New England county-subdivisions, not simple Census Places — the existing generic `readCensusNames()` in `sst-rates.mjs` only fetches county+place gazetteers, **not** a cousub gazetteer. Extending VT support needs that lookup added, or ~27 of 36 town names would render as generic "Place FIPS #####".
- The local-option list is actively growing (8 towns added just 2026-07-01: Waitsfield, Morristown, Fair Haven, Mendon, Pomfret, Vergennes-city, Bristol, Swanton — none has any A+ code yet) — A+'s already-sparse 19-code coverage is falling further behind over time, not holding steady.
- A real, current SST boundary file exists (`VTB2026Q3MAY20.zip`, 253,490 rows, 89 columns — same shape as GA/OK/UT's boundary files) — a plausible `ga-boundary.mjs`-pattern starting point, not yet attempted.

## Do instead

- **Do not build a naive flat-rate comparison off `TBCRATE` alone** — it will silently misreport Essex Junction, Waterbury, and the Orleans Co. catch-all as correct when they aren't.
- Add a Census cousub-gazetteer lookup before attempting real place-name resolution for VT — the existing place-only lookup will mislabel most towns.
- Resolve `VT000` (9/46 ship-tos) before building anything.
- Re-check the local-option list periodically — it's growing, not stable.
