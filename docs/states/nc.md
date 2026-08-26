# North Carolina — findings

Status: **fully wired** (dashboard live at `/api/official/states/NC` + `app/page.tsx` "jurisdictions" view). Verified end-to-end against live data on 2026-08-25.

## Address matching

**Not needed.** NC's sales tax varies only by county — no home-rule cities, no special districts, no sub-county overlap. An A+ tax-body code maps to exactly one county, so a straight code-to-jurisdiction lookup is correct; GA-style ship-to address/ZIP matching would be unnecessary work here.

## The code mapping is synthesized, not read — and that's the one real risk

`server/ncdor-rates.mjs`'s `NC_COUNTIES` is a hardcoded, alphabetically-sorted list of North Carolina's 100 counties. The adapter assumes `NC001` = 1st county alphabetically (Alamance), `NC060` = 60th (Mecklenburg), etc. — a trusted convention, not something read from `TBTXNAM` at parse time.

Verified live against `XATXBD` on 2026-08-25 (query: `SELECT TBTXBOD, TBTXNAM, TBCRATE FROM APLUSV8FAQ.XATXBD WHERE TBTXBOD LIKE 'NC0%' OR TBTXBOD LIKE 'NC1%'`):
- All 100 `NC001`–`NC100` codes exist and their `TBTXNAM` values line up with the synthesized alphabetical order (checked by index, not by name — `TBTXNAM` has cosmetic typos: "Northamton" for Northampton on `NC066`, "Tyrell" for Tyrrell on `NC089`, "Montgomery"/"Richmond" in inconsistent casing — harmless since the app never matches or displays on this field, only on the code).
- **Rate comparison: 0/100 mismatches** against a fresh NCDOR pull (`readOfficialNcRates()`), matched strictly by `taxBody` code in `mergeOfficialRates()` (`app/page.tsx`).

The synthesized mapping works today, but it's still an assumption, not a read — if NCDOR or A+ ever reorders/renumbers, nothing would catch it automatically. Re-verify this mapping (same query) after any suspicious NC finding, rather than trusting it forever.

## Rate comparability

**Yes, confirmed.** No surcharge/layering issue found — A+'s `TBCRATE` for each `NC0xx` code is the full county rate (state 4.75% base + county's local components), directly comparable to NCDOR's published county total. No Ohio-style "is this the same total" ambiguity here.

## Resolved: the `NCMK65` vs `NC060` discrepancy

Earlier investigation flagged `NCMK65` ("Meck Cty 7.25 for credits," rate 7.25%) as possibly disagreeing with `NC060`'s then-current rate of 7.00% for Mecklenburg. Re-checked live on 2026-08-25:

- NCDOR raised Mecklenburg's rate **7.25% → 8.25%, effective 2026-07-01**.
- `NC060` (the real county code) is already updated to **8.25%**, matching NCDOR exactly.
- `NCMK65` is a separate, frozen legacy/credit-memo code at the old 7.25% rate — its name says as much ("for credits"). It is correctly excluded from the app's county query (`buildTaxBodyQuery`'s `LIKE 'NC%'` catches it, but it's never in the `NC001`–`NC100` comparison set, and no NC ship-to is currently assigned to it).

**Conclusion: not a bug.** The two codes were never competing county-rate claims — one is the live jurisdiction rate, the other is an unrelated fixed-rate credit code. Resolved by re-pulling fresh data rather than reasoning from the earlier (now-stale) snapshot.

## Other non-county `NC%` codes seen in `XATXBD`

Beyond `NC001`–`NC100`, the live `LIKE 'NC%'` result also includes: `NC101` (1% North Carolina Tax — an add-on component, not a jurisdiction), `NC6.75%`, `NC7%CR`, `NC7.75%`, `NCCR06`, `NCMK65`, `NCRC08` (various "for credits" fixed-rate codes), `NCPRST` ("NC Prestige Int. Billings"), and `NCUSE` ("DO NOT USE," already excluded by the retired-code filter). None of these represent a county and none should ever enter the county comparison table. `NC101` is explicitly asserted as *not* retired in `tests/tax-body-policy.test.mjs` (it's a real, active surcharge component) — worth remembering if extending the app to ever reconcile component-level rates instead of just totals.

## Real finding: NC-tagged ship-tos assigned to other states' tax bodies

Querying live ship-to assignments for `SASHST = 'NC'` (`buildStateTaxBodyQuery`) turns up **8 ship-tos across 101 distinct assigned tax bodies** that are NOT `NC0xx` county codes:

| Tax body | Active ship-tos | Active customers |
|---|---|---|
| `DR000` | 5 | 4 |
| `HN000` | 5 | 3 |
| `NCPRST` | 2 | 1 |
| `GA060` | 1 | 1 |
| `OH000` | 1 | 1 |
| `SC124` | 1 | 1 |
| `TR` | 1 | 1 |
| `VA043` | 1 | 1 |

Most likely explanation: border customers whose ship-to address is tagged NC but whose real tax jurisdiction is a neighboring state (GA060, SC124, VA043, OH000), plus a few non-standard/legacy codes (`DR000`, `HN000`, `TR`) that aren't state-prefixed at all. **This is not a bug in the app** — `describesOtherJurisdiction()` (`app/tax-body-policy.ts`) already detects and separates these into a distinct "physically in NC but taxed elsewhere" UI section (`app/page.tsx` around the `anomalousTaxBodies` split) rather than silently merging them into the county comparison or dropping them. Confirmed correct behavior, not something to fix — but worth knowing this data exists if the ship-to counts ever look off from what's expected.

## Do instead (if extending this work)

- Don't trust `TBTXNAM` for county identity — it has real typos. Match on code only, as the app already does.
- Don't assume the `NC001`–`NC100` synthesized mapping is permanent — re-run the verification query above periodically or after any NC rate anomaly, since it's a trusted convention, not a read value.
- Don't add `NC101` or the credit-memo codes to the county comparison — they're real, active A+ codes but not jurisdictions.
