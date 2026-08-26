# WY — findings

Status: **Not safe to build — 100% of active WY ship-tos sit on non-jurisdiction placeholder-shaped tax bodies.** Live A+ (`SASTXB` ship-to assignments via `readStateDetail`) checked 2026-08-26: only 22 active WY ship-tos and 2 distinct tax bodies exist across A+'s entire live WY book of business — `WY000` ("WYOMING NO TAX", 21/22 ship-tos, 0% rate) and `ZTEMP` ("TAX BODY TEMP USE", 1/22 ship-tos, 0% rate). Neither maps to any of Wyoming's 23 real counties. Cross-checked against the current Streamlined rate file (`WYR2026Q3JUN2.CSV`), which confirms 23 real county rows (state 4% + county add-ons of 0–3%, total range 4%–7%) and 2 unnamed special-jurisdiction rows. This is a coverage gap shaped like ND's (100% on a single non-jurisdiction code), not a code-to-jurisdiction mismatch to diff.

## Address matching

Structurally, Wyoming's real-world tax system is clean and would need no GA-style address matching if A+ ever built real per-county codes: the official snapshot shows exactly **23 county rows and 0 city/home-rule rows** — matching the Census Gazetteer county count for WY (FIPS `56`) cited in the prior Layer-1 research. There's no evidence of jurisdictions varying within a single ZIP/city the way GA, CO, or WA need; a WY county-option system is NC/NV-shaped in principle (one code, one county, no sub-county splits) if it existed.

**But that's moot for the live book of business today.** `readStateDetail("WY")` — the same live query the dashboard uses, grouping active ship-tos by `SASTXB` for `SASHST = 'WY'` — returns exactly 2 tax bodies, and **neither is a real per-county WY code**:

- `WY000` — "WYOMING NO TAX" — 21 of 22 active ship-tos (9 of 10 active customers), rate 0%.
- `ZTEMP` — "TAX BODY TEMP USE" — 1 of 22 active ship-tos (1 of 10 active customers), rate 0%.

`21 + 1 = 22` reconciles exactly against the total active-ship-to count, so there's no evidence of additional hidden/retired codes being silently excluded for WY beyond these two — the full live population is accounted for. No wrong-state contamination and no cross-context (`CMTXBD` vs `SASTXB`) divergence was visible in this pull (only 2 tax bodies total, both examined).

Because there is no real per-jurisdiction WY code in current use at all, the Step 1 question ("does a code map 1:1, or is address matching needed") cannot actually be tested against live data — there's nothing to test. Whether A+'s `XATXBD` table even contains unused `WY001`–`WY023`-style definitions that simply have zero ship-tos assigned today is **unavailable** from the two vetted read-only scripts (they surface only codes with at least one active ship-to assignment); confirming that would need a raw `XATXBD` prefix pull, which is out of scope for this investigation.

## Rate comparability

**Not comparable today, and not a "stale rate" in the usual sense — there's no real jurisdiction on the A+ side to diff against.** The official Streamlined snapshot shows every one of WY's 23 counties charging a combined state+county rate between 4% (Park, Sublette — state-only, no county add-on) and 7% (Teton), with most counties in the 5–6% range. Both of A+'s live WY tax bodies are configured at exactly **0%**, and neither is named for or tied to any specific county — `WY000` reads as a blanket "no tax" designation and `ZTEMP` reads as a temporary/placeholder code, not a jurisdiction assignment.

Whether this 0% reflects a legitimate business reason (e.g., no nexus, exempt drop-ship customers, or another policy Atlantic applies to its current WY accounts) or an unbuilt/gap-shaped setup is **a human decision, not something inferable from the data alone** — the same open-question shape as ND's `ND000` (100% on a zero-rate placeholder, Wyoming's sales tax is not legally optional the way HI's GET pass-on is, so the ND framing is the closer analogy of the two). No confirmed live stale-rate mismatch is reported here because there is no mapped WY county code to compare against the official per-county numbers in the first place.

The 2 unmapped `jurisdictionType "69"` special rows flagged in the prior Layer-1 research could not be independently confirmed by name in this pull — the fetched snapshot's `rates` array shows exactly 2 special-jurisdiction rows (codes `02290` and `02291`, both a 2% component rate, no `totalGeneralRate` populated), but the adapter reports them only as generic `"Special jurisdiction 02290"` / `"02291"` with no place name attached. The "likely Wind River Reservation/tribal" identification from the prior research is plausible (Wyoming's only reservation-based special sales tax jurisdiction is Wind River) but **unconfirmed by this session's own data** — reported as ambiguous, not asserted as fact. This is moot for the current comparison regardless, since none of A+'s 22 live WY ship-tos are assigned to either special code.

## Do-not-use and cross-context findings

**`WY000` ("WYOMING NO TAX") is the AL000/MN000/ND000/NE000/UT000/WA000-shaped placeholder pattern this project watches for, and at 21/22 (95.5%) it is the single largest share found in any state investigated so far** — larger than UT000's 23.9% or MN000's 29%, because WY's whole active book is only 22 ship-tos. It was not caught by `readStateDetail`'s automatic retired-tax-body text filter (which matches on `DO NOT USE`/`DONT USE`/`INACTIVE`/`OBSOLETE` in the description) because its description text doesn't contain any of those phrases — it reads as a normal "configured" tax body with a valid (if zero) rate total, so it appears directly in the live findings rather than being silently dropped.

`ZTEMP` (1/22, "TAX BODY TEMP USE") is a second, smaller placeholder-shaped code, also not caught by the retired-tax-body filter, also 0% and not tied to any real jurisdiction.

Together these two codes account for **100% of A+'s live WY book of business** — there is no real per-county WY code in current use to exclude these two *from*.

## Real live A+ codes (2026-08-26, `SASTXB` for active `SASHST = 'WY'` ship-tos, via `readStateDetail`)

| Code | Description | Active ship-tos | Active customers | Current rate | Maps to a real WY county? |
|---|---|---|---|---|---|
| `WY000` | WYOMING NO TAX | 21 | 9 | 0% | No |
| `ZTEMP` | TAX BODY TEMP USE | 1 | 1 | 0% | No |

Official snapshot for comparison (`WYR2026Q3JUN2.CSV`, retrieved 2026-08-26): 23 real counties, rates ranging 4% (Park, Sublette) to 7% (Teton), state base rate 4%, plus 2 unnamed special-jurisdiction rows (`02290`, `02291`) at a 2% component rate each.

## Open questions / do instead if building

- **Blocking, needs a human decision:** is `WY000`'s 0% a deliberate business/exemption policy for Atlantic's current WY accounts, or an unbuilt gap the same shape as `ND000`? This has to be answered before any WY comparison is meaningful, since it currently covers 21 of 22 (95.5%) of the live book.
- **Blocking, needs a human decision:** what governs the single `ZTEMP` ship-to — is it a genuinely temporary/in-flight setup, or has it been left in this state long-term?
- **Unavailable from the two vetted scripts:** whether A+'s `XATXBD` table has any real, unused `WY001`–`WY023`-style county definitions sitting dormant (zero ship-tos assigned) — `readStateDetail` only surfaces codes with at least one active assignment, so this can't be distinguished from "never configured" without a raw `XATXBD` prefix pull, which was out of scope here.
- **Unconfirmed:** whether the 2 official special-jurisdiction rows (`02290`, `02291`) are actually the Wind River Reservation tribal jurisdiction as prior research hypothesized — the fetched snapshot doesn't carry a place name for them. Moot for now since no live ship-to is assigned to either.
- If a real per-county WY build is ever undertaken: Wyoming's underlying structure (23 clean counties, 0 home-rule cities) would support a direct NC/NV-style code-to-county mapping with no address matching needed, *if and when* A+ has real per-county codes to map from. Today it doesn't.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level), for the same reason already established for NC/GA — not independently re-verified for WY in this pass since neither live tax body split by customer vs. ship-to level, but noted per the project's standing convention.
