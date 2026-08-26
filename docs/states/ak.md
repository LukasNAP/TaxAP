# AK — findings

Status: **Layer 2 investigated (2026-08-26), not buildable yet.** A+ has exactly one Alaska tax body (`AK000`, "Alaska no tax", 0% across base/local/current/next) covering all 8 active AK ship-tos and 3 active customers — there is no per-jurisdiction granularity in A+ at all, so there is nothing to compare against even in principle until an official source is chosen. No Layer 1 adapter exists yet (AK is `research-needed`/no adapter in `docs/roadmap-50-states.md`), so rate comparability is not yet confirmable, only the A+-side facts below are.

## Address matching

**Live pull (`investigate-state.mjs AK`, 2026-08-26):** 1 tax body, 8 active ship-tos, 3 active customer assignments — 100% of AK's active ship-tos sit on the single code.

| Code | Name | Base | Local 1-4 | Current | Next | Active ship-tos | Active customers |
|---|---|---|---|---|---|---|---|
| `AK000` | Alaska no tax | 0 | 0,0,0,0 | 0 | 0 | 8 | 3 |

`AK000`'s `TBTXNAM` is a plain, honest description ("Alaska no tax"), not a `DO NOT USE`/`INACTIVE`/`OBSOLETE`-style placeholder — it wasn't caught by `readStateDetail`'s retired-tax-body filter because it isn't retired, it's the only row that exists. `activeShipTos` at the top level (8) equals the sum across `taxBodies` (8), so there is no gap suggesting a second, silently-excluded AK code absorbing ship-tos elsewhere the way AL000/MN000/ND000/NE000/UT000/WA000 do in other states (see the Do-not-use section below for the caveat on this).

**This doesn't fit either of the two Step-1 patterns cleanly, because A+ currently tracks zero local distinction for AK at all** — it isn't NC-style (no code-to-jurisdiction convention exists to read), and it isn't yet built as GA-style either (no matching logic exists). Reasoning from outside knowledge of Alaska's real tax structure, rather than from A+'s data (which has nothing more to show):

- Alaska has **no state-level sales tax**, so a flat 0% base is factually correct at the state layer — `AK000` is not wrong about that part.
- Alaska's **local** sales tax is entirely home-rule: 100+ boroughs and cities each set and administer their own rate independently (current figures put it around 107-110 taxing jurisdictions), with no state-level coordination layer comparable to a county-option system. These boundaries do not align cleanly to ZIP codes or a single incorporated-place-per-code scheme — a city and the surrounding borough can differ, and (per the ARSSTC's own structure) member jurisdictions can have shared or graduated rates depending on delivery destination within a single ZIP.
- **If** Atlantic ever wants AK local tax tracked, that would need genuine ship-to address/city-level matching (GA-style), not a per-jurisdiction A+ code convention (NC-style) — and it would need it from a worse starting position than GA had, since A+ has no partial jurisdiction breakdown to extend, only a single statewide 0% catch-all.

**Open, unresolved by data:** whether any of the 8 real active AK ship-tos are physically located inside a taxing borough/city is not knowable from `investigate-state.mjs`'s tax-body-level aggregation alone — it returns counts per tax body, not ship-to addresses. This is a real open question, not something I'm guessing an answer to either way.

## Rate comparability

**Not yet confirmable — no adapter exists.** `docs/roadmap-50-states.md` and `official-source-registry.mjs` both show AK has no connected official source and no adapter wired in `scripts/fetch-official-rates.mjs` (confirmed directly — AK isn't in that script's state list, so running it would simply error). What's known about the real structure, from the roadmap's prior research pass, without treating it as a live cross-check:

- The only confirmed machine-readable source is the **Alaska Remote Seller Sales Tax Commission (ARSSTC)** XLSX, which is genuinely live and machine-readable but **covers only its member jurisdictions — not every Alaska taxing municipality**, so it cannot ground a full-state comparison the way NC DOR's file or the SST files do for other states.
- A separate, potentially more complete source ("Alaska Taxable," an annual Dept. of Commerce report) was referenced in an earlier research pass but its live URL could not be verified (commerce.alaska.gov returned 403 on every fetch attempt) — unconfirmed, not to be relied on until a human checks it directly in a browser.
- Because `AK000` is 0% and there is no adapter, there is nothing to diff yet — the honest current state is "unavailable to compare," not "matches" or "doesn't match."

## Do-not-use and cross-context findings

No `DO NOT USE`/`DONT USE`/`INACTIVE`/`OBSOLETE` row was found or excluded for AK — `AK000` itself is the only row and reads as an intentional, descriptive placeholder for "no tax owed," not a retired or abandoned code. No wrong-state contamination either: the single row's `TBTXNAM` ("Alaska no tax") names the correct state.

**Caveat on "no evidence of a hidden excluded code":** `readStateDetail`'s retired-tax-body filter operates on `TBTXNAM` text patterns, and I can only see what it returns — I have no way to directly query what it excluded. The fact that the visible total (8) accounts for 100% of the reported `activeShipTos` is reassuring but is not proof a retired AK code doesn't exist somewhere in `XATXBD` with zero currently-active ship-tos on it (which would be invisible either way, active-count-wise). This should be treated as an open question, not a confirmed "clean," per the project's exclusion-transparency standard.

## Open questions / do instead if building

- **Scoping decision needed before any AK build (already flagged in `docs/roadmap-50-states.md`'s phase list):** does Atlantic want AK local home-rule tax tracked at the ship-to/city level at all, given the only known machine-readable source (ARSSTC) is confirmed partial? If yes, this is a real, from-scratch build — no existing A+ code structure to extend, unlike every other investigated state.
- **Not yet resolvable from data:** whether any of the 8 real active AK ship-tos sit inside a taxing borough/city (in which case `AK000`'s 0% would represent a real, uncaptured local-tax amount, not a correct "no tax" state) versus all 8 being in non-taxing areas (in which case 0% is fully correct today). Answering this needs the actual ship-to addresses/cities, which `investigate-state.mjs`'s aggregate output does not expose — would need a targeted, still-read-only follow-up query scoped to AK ship-to city/borough only.
- **"Alaska Taxable" (Dept. of Commerce annual report)** needs a human to check `commerce.alaska.gov` directly in a browser (automated fetch 403'd) before treating it as a real second candidate source alongside ARSSTC.
- Given AK's very small footprint at Atlantic (8 active ship-tos, 3 customers), this is a low-urgency but real gap — worth folding into the same product-decision batch as DE/MT/NH/OR/HI/NM in `docs/pending-business-decisions.md` (AK needs its own decision, not automatic inclusion in the "no general sales tax" bucket, since AK does have real local tax unlike those four).
- Do not build a flat "no tax" comparison for AK and call it confirmed — it would be accurate for the state layer only and silently wrong for any ship-to inside a taxing municipality.
