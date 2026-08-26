# Kansas — findings

Status: **investigated live 2026-08-26, not safe to build.** Official source is real and current (SST rate file, boundary file `KSB2026Q3MAY20.zip`, both confirmed). Strategy is boundary-matching — real address ambiguity confirmed live — but a parser-breaking code type and very sparse A+ coverage keep it from being built yet.

## Address matching

**Yes — confirmed live, not just structurally.** A+'s 62 non-retired codes already have to split several cities into 2–3 county-specific variants for the exact same place: Bonner Springs → `KS078` Johnson Co./`KS079` Leavenworth Co./`KS080` Wyandotte Co., all different rates (9.725/9.25/9.25); DeSoto → `KS172` Johnson Co./`KS173` Leavenworth Co.; Manhattan → `KS545` Pottawatomie Co./`KS546` Riley Co. Direct live evidence a place-name-to-rate mapping alone is insufficient — the same city genuinely carries different combined rates depending on which county the ship-to falls in.

## Rate comparability

**Unclear/partial.** The state component matches exactly — A+'s `TBCBSRT` is 6.500 on every row, matching the live SST file's single active state row. But full-total comparability is unconfirmed for two reasons:
1. A+ has only 62 non-retired jurisdiction codes state-wide, versus the official file's 105 active county + 628 active city + 304 active type-63 special-district rows (2,146 active rows total) — A+ covers roughly 9% of real jurisdictions.
2. **The official file's jurisdiction type "79" — 1,108 of 2,146 active rows (51.6%, the single largest bucket) — uses alphanumeric codes** (`11KAN`, `AEATC`, `ALIOL`) that are not in the code's `JURISDICTION_TYPES` map and are not numeric FIPS-style codes. What a type-79 row actually represents (a combined city+district total vs. a separate overlay on top of county+city) was not decoded — so A+'s per-city `TBCRATE` can't yet be confirmed to measure the same total as the matching official row.

**Update 2026-08-26 (later pass):** the parser itself no longer throws on type-79's alphanumeric codes — `parseSstRateCsv`'s jurisdiction-code regex was widened from numeric-only to alphanumeric while wiring in Nebraska (which hit the identical problem with its `GL80x` codes). That fixes the crash, but **what type "79" rows actually mean is still undecoded** — this is a meaning question, not a parsing question, and remains open.

## Other findings

- 65 raw rows, 3 legitimately excluded as retired (`KS000` "KansasDO NOT USE", `KS438` "DO NOT USE", `KS572XXX` "KS McPhers-OLD DO NOT USE" — the standard filter caught all three), leaving 62 real active codes.
- No wrong-state contamination — every `TBTXNAM` names a real Kansas city/county (the one row without a literal "Kansas" prefix, `KSFORBB` "Fort Scott (Bourbon Co.)", is a genuine KS place).
- `KS672` and `KS685` are both named "Iola" with the identical rate 8.75% — a duplicate/orphaned code pair, not a conflict, but don't silently pick one without checking which ship-tos use which.
- Arithmetic is internally consistent everywhere (`TBCBSRT` + `TBCLRT1` + `TBCLRT2` = `TBCRATE`, `TBCLRT3`/`4` always 0).
- A real, current SST boundary file exists (`KSB2026Q3MAY20.zip`) — same `GAB*.zip`-style naming `ga-boundary.mjs` already parses for GA, so the discovery pattern should port directly once the type-79 question is resolved.
- Confirmed 105 counties two independent ways (Census gazetteer + the SST file's own active type-00 row count), matching prior research.

## Do instead

- Decode what jurisdiction type "79" actually represents before building any comparison — check a known example against Kansas DOR's own published total.
- Reconcile A+'s sparse 62-code coverage against the official file's much larger jurisdiction set before assuming a comparison is complete.
- Don't silently resolve the `KS672`/`KS685` Iola duplicate — check real ship-to assignment first.
