# IN — findings

Status: **No address matching needed, rate comparability confirmed exact.** Indiana has no local-option sales tax at all — A+ has exactly one real Indiana tax body (`IN000`, 510 of 514 active ship-tos physically flagged `SASHST='IN'`) configured at a flat 7%, which matches the current Streamlined Sales Tax statewide rate exactly. The other 3 codes returned for `SASHST='IN'` are cross-context outliers, not Indiana data: `IND00` is literally the country **India** (a naming collision worth flagging on its own, not a typo of "Indiana"), and `MI000`/`PA000` are the already-documented `SASTXB` cross-context pattern (ship-to physically in Indiana carrying a Michigan or Pennsylvania tax body). No DO-NOT-USE-style placeholder code was found in the live result.

Live A+ (`XATXBD` + active `ADDR`/`CUSMS` ship-to assignments, via `readStateDetail`) checked 2026-08-26, cross-referenced against the current Streamlined Sales Tax rate file for Indiana.

## Address matching

**Not needed.** Indiana's own law has no county or city option sales tax — the official Streamlined rate file for IN contains exactly one row (`jurisdictionType: "state"`, FIPS `18`, "Indiana"), with `counts.counties = 0`, `counts.cities = 0`, `counts.specialJurisdictions = 0`. A+'s real Indiana tax body list matches this shape: only one live, correctly-named code (`IN000`, `TBTXNAM = "Indiana"`) is configured, carrying all 4 local-rate slots (`TBCLRT1`–`4`) at `0` — there is nothing finer to match into, and A+'s single-code structure is exactly the coverage this state's actual tax law calls for (same shape as NJ's `NJ000` and HI's `HI000` — a real single-rate state, not a sparse subset of a state that actually varies).

**Cross-context finding — `IND00` is the country India, not a misspelling of Indiana.** The live pull for `SASHST='IN'` (2 active ship-tos, 2 active customers) returned a tax body named `"India"` at a `0` rate. This is not the "wrong-U.S.-state-named-in-TBTXNAM" pattern SC's `SC3622`/"South Dakota Vermillion" established — it's a country/state ISO-code collision: India's own ISO 3166-1 alpha-2 code is also `IN`, so a ship-to or tax-body record using the two-letter code `IN` is ambiguous between "Indiana, USA" and "India" unless a separate country field disambiguates it. **Excluded from Indiana findings below** — these are (most likely) international ship-tos, not Indiana addresses, and must not be counted toward Indiana's active-ship-to total or compared against Indiana's tax rate.

**Cross-context finding — `MI000` (Michigan, 1 ship-to) and `PA000` (Pennsylvania, 1 ship-to).** Same already-documented `SASTXB` pattern seen on GA (`NC060`/`NC041`/`SC126`/`CA1163`/`PA000`) and NV (`DR000`/`NCPRST`): a ship-to physically flagged as Indiana (`SASHST='IN'`) carries a different state's tax body, most likely a border-adjacent customer or a data-entry artifact. **Excluded from Indiana findings below** — comparing these against Indiana's rate would be comparing the wrong jurisdiction entirely.

**Net: 510 of 514 "IN" ship-tos are real Indiana addresses on the real Indiana code; the other 4 (0.8%) are cross-context noise (2 India, 1 Michigan, 1 Pennsylvania), not Indiana coverage gaps.**

## Rate comparability

**Yes — confirmed exact.** `IN000`'s `TBCBSRT` (base rate) is `7`, all four `TBCLRT1`–`4` local-rate slots are `0`, and `TBCRATE` (current total) is `7` — internally consistent (`rateTotalValid: true`). This matches the current Streamlined Sales Tax file for Indiana exactly: one state-level row, `componentRate = 7`, `totalGeneralRate = 7`, effective `2008-04-01` through present (no newer rate change on file). No scheduled A+ rate change either (`TBNRATE = 0`, `nextEffectiveDate` unset).

No surcharge, district, or special-category layering question applies here (unlike Ohio's transit surcharges or NY's MCTD) — Indiana's official source itself shows zero local/special rows to layer, and A+'s local-rate slots are correspondingly all zero, so both sides are measuring the same thing: one flat statewide rate.

## Do-not-use and cross-context findings

**No DO-NOT-USE-style placeholder code (the AL000/MN000/ND000/NE000/UT000/WA000 pattern) was found in the live result.** All 4 codes returned (`IN000`, `IND00`, `MI000`, `PA000`) came back as `definitionStatus: "configured"` — none were dropped by `readStateDetail`'s automatic retired/DO-NOT-USE filtering, and none of their `TBTXNAM` values contain "DO NOT USE," "INACTIVE," or "OBSOLETE." This is a genuine structural difference from most states investigated so far, not just an assumption: a placeholder mainly matters in states with real local-rate variation (where "give up and use the fallback flat/zero code" is a meaningful failure mode); Indiana has no local variation to fall back away from in the first place, so there's less reason to expect one — but see the open question below, since a retired placeholder could still exist and be silently excluded from view the same way it would be for any other state.

## Real live A+ codes (2026-08-26, `SASHST='IN'`, active ship-tos only, via `readStateDetail`)

| Code | Name | Current rate | Active ship-tos | Notes |
|---|---|---|---|---|
| `IN000` | Indiana | 7 | 510 | Real Indiana code — matches SST exactly |
| `IND00` | India | 0 | 2 | **Not Indiana** — country ISO-code collision, excluded |
| `MI000` | Michigan | 6 | 1 | Cross-state `SASTXB` outlier, excluded |
| `PA000` | Pennsylvania | 6 | 1 | Cross-state `SASTXB` outlier, excluded |

## Open questions / do instead if building

- **Can't rule out a silently-excluded DO-NOT-USE placeholder for Indiana specifically.** `readStateDetail` automatically drops retired/DO-NOT-USE tax bodies before this file's numbers were ever visible, so a hidden `IN`-prefixed placeholder could in principle exist and simply not show up in the 514-ship-to total above. Nothing here overtly suggests one (510/514 fully accounted for by the one real code, no unusually large "missing" chunk of expected volume) — but this is an inference, not a direct check, since the raw pre-exclusion `XATXBD` rows were never seen. Flag as unresolved rather than asserting a clean bill of health.
- **Before building:** exclude `IND00`, `MI000`, and `PA000` from any Indiana-specific comparison or ship-to count, the same way GA excludes its non-Georgia outliers and NV excludes `DR000`/`NCPRST` — with a visible exclusion count, not a silent drop.
- **Worth a one-time sanity check if anyone owns the ADDR/country-code schema:** confirm whether `SASHST='IN'` is genuinely ambiguous between Indiana and India in the schema, or whether a separate country field exists that this investigation's tooling didn't consult. If a country field does exist and simply wasn't joined here, that's a real, fixable query gap for future country-vs-state disambiguation, worth raising with whoever maintains `server/aplus-connector.mjs`'s state-detail query — but that's a code-review question, not something to guess at or fix here (read-only investigation).
- If Indiana is built, it should follow NJ's/HI's pattern (`server/nj-rates.mjs`-style: one code, one rate, no boundary matching) rather than NC's/GA's — there is no boundary source to wire up because there is nothing to match, confirmed both by A+'s own structure and by the official source's `counts.counties/cities/specialJurisdictions` all reading `0`.
- Use `SASTXB` (ship-to level) if/when a live comparison is built, consistent with every other state investigated.
