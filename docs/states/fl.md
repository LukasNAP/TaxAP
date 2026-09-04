# FL — findings

Status: **Layer 2 investigated live (2026-08-26), not yet built.** Address matching is not needed — A+'s `FL001`–`FL067` codes are a clean, direct 1:1 alphabetical-index mapping onto all 67 real Florida counties, the cleanest numbering convention found in any state so far (even more mechanically obvious than NV's named county codes, since the index itself is derivable — alphabetical rank 1–67 — rather than just human-readable). But rate comparability is **not clean**: 4 of the 58 currently-active county codes show a real, live rate difference against the Florida DOR's current discretionary-surtax snapshot, needing a human decision before any comparison is built.

Live A+ (`XATXBD` + active `ADDR`/`CUSMS` ship-to assignments, via `readStateDetail("FL")`) checked 2026-08-26, cross-referenced against `fetch-official-rates.mjs FL`'s live Florida DOR discretionary sales surtax snapshot (retrieved same day). `activeShipTos` totals 1,479; `activeCustomerAssignments` totals 870; 68 distinct tax-body codes are assigned to at least one active FL ship-to.

## Address matching

**Not needed — A+'s 58 currently-populated `FL0##` codes map 1:1 and directly onto real Florida counties, using a discoverable alphabetical-index numbering scheme, not synthesized FIPS.** Florida has exactly 67 counties (Census Gazetteer, FIPS state `12`), and Florida law imposes its discretionary sales surtax at the *county* level only — there is no city/home-rule sales-tax layer in Florida the way GA, CO, or WA have, so there is no possibility of two ship-tos in the same ZIP/city needing different codes for real-tax-law reasons. This is exactly the "67-county discretionary surtax workbook" structure the task context named.

The numbering is not arbitrary: `TBTXBOD` (`FL001`…`FL067`) matches Florida's 67 counties in **strict alphabetical order** (Alachua=1, Baker=2, Bay=3, Bradford=4, … Washington=67) — not the state's real (odd-only) FIPS county codes. Every one of the 58 codes that has at least one active ship-to today decodes correctly against this scheme, and every `TBTXNAM` reads `"Florida <County>"` with no cross-state contamination found anywhere in the FL-prefixed rows (unlike SC's `SC3622`/"South Dakota Vermillion").

The 9 numeric slots with no active ship-to today (`FL002` Baker, `FL013` DeSoto, `FL018` Franklin, `FL022` Gulf, `FL029` Holmes, `FL032` Jefferson, `FL037` Levy, `FL038` Liberty, `FL063` Union) are all real, low-population/rural Florida counties — plausible for Atlantic's customer base to simply have no current ship-tos there, not necessarily evidence the codes are undefined in A+. `readStateDetail` only returns codes with ≥1 active assignment, so this investigation cannot distinguish "code doesn't exist in `XATXBD`" from "code exists, 0 active ship-tos" — see Open questions.

## Rate comparability

**No — 4 confirmed live, real rate differences, out of 58 checked.** Every A+ `currentRate` (`baseRate` 6 + `localRates[0]`, `rateTotalValid: true` on all 58 rows — no split-component ambiguity) was compared against the matching county's `totalGeneralRate` in the Florida DOR discretionary-surtax snapshot fetched the same day. 54 of 58 match exactly. 4 do not:

| County | A+ code | A+ current rate | Official total rate | Direction |
|---|---|---|---|---|
| Collier | `FL011` | 7.0% | 6.0% | A+ above official (A+ carries a 1% surtax the official snapshot shows Collier no longer has) |
| Flagler | `FL017` | 7.5% | 7.0% | A+ above official by 0.5pt |
| Hamilton | `FL023` | 7.0% | 8.0% | A+ **below** official by 1.0pt |
| Palm Beach | `FL050` | 7.0% | 6.5% | A+ above official by 0.5pt |

These are real stale-rate findings, not a structural/layering problem like Ohio's transit surcharge — A+'s `baseRate`+`localRates[0]` and the DOR's state-rate+`componentRate` are measuring the same total (state 6% + county discretionary surtax), so the comparison itself is apples-to-apples; the 4 discrepancies are genuine differences between what's configured in A+ and Florida's current published rate, needing updating. Active-ship-to counts on the 4 affected codes: Collier (`FL011`) 24, Flagler (`FL017`) 4, Hamilton (`FL023`) 1, Palm Beach (`FL050`) 83 — Palm Beach is FL's third-largest ship-to concentration, so that one mismatch in particular is not a low-volume edge case.

## Do-not-use and cross-context findings

**`FL000` — no `XATXBD` definition found at all (not text-tagged `DO NOT USE`, just missing), used by 1 of 1,479 active FL ship-tos (~0.07%).** This is shaped like the AL000/MN000/ND000/NE000/UT000/WA000 placeholder pattern (a bare `<STATE>000` code), but at a share so small it is not a blocking finding the way it was for AL (101/~500), MN (113/387), NE (21/114), UT (64/268), or WA (33/472) — those states saw the placeholder covering a meaningful share of real ship-tos; FL's equivalent affects a single ship-to. Still worth surfacing as a visible exclusion, per the project's no-silent-caps rule, and worth noting that `readStateDetail`'s pattern-based `isRetiredTaxBody` filter does **not** catch it (no `DNU`/`XXX`/`INACTIVE` text signal exists to match against a missing definition) — it shows up in the main `taxBodies` list with `definitionStatus: "missing"` rather than being silently dropped.

**41 of 1,479 active FL ship-tos (2.8%) carry a non-Florida tax body** — the already-documented `SASHST`/`SASTXB` cross-context pattern (a ship-to physically flagged `SASHST = 'FL'` can carry a tax body that isn't Florida's), confirmed live here for the first time at a larger scale than NV's (2/271) or GA's (5/2,404) equivalents:

| Tax body | Description | Active ship-tos |
|---|---|---|
| `DR000` | Dominican Republic | 20 |
| `MX000` | Mexico no tax | 8 |
| `HN000` | Honduras no tax | 7 |
| `NC060` | North Carolina Mecklenburg | 1 |
| `NC065` | North Carolina New Hanover | 1 |
| `AR0403` | Arkansas Bentonville | 1 |
| `DR001` | ITBIS (Dominican Republic) | 1 |
| `EL000` | El Salvador no tax | 1 |
| `MA000` | Massachusetts | 1 |

The three largest of these (`DR000`/`MX000`/`HN000`, 35 of the 41) are non-US "no tax" catch-all codes, plausibly ship-tos that are administratively filed under `SASHST = 'FL'` (e.g. a Florida-based freight-forwarder/distribution address) but represent actual export destinations — a materially different shape from the NC/AR/MA rows, which look like ordinary US cross-state mis-assignment. Either way, all 41 must be excluded from any FL-specific rate-comparison findings table with a visible count, the same way GA's live run excludes its NC060/NC041/SC126/CA1163/PA000 outliers, rather than compared as if FL-priced.

## Real live A+ codes with a confirmed rate check (2026-08-26, `readStateDetail("FL")`, 58 populated county codes)

54 of 58 match the Florida DOR snapshot exactly (all at state 6% + the shown local surtax component); the 4 exceptions are tabled above. Full per-county table omitted here since it is the same "match" outcome repeated 54 times — see the mismatch table above for the only 4 rows that need a human decision, and the DOR snapshot itself (`fetch-official-rates.mjs FL`) for the complete 67-county reference list.

## Open questions / do instead if building

- **Before building:** get a human decision on the 4 confirmed stale rates (Collier, Flagler, Hamilton, Palm Beach) — Hamilton in particular is understated (A+ below official), the opposite direction from the other three, so this isn't a single systemic "old snapshot" explanation; each looks like it needs its own confirm against Form DR-15DSS effective-date history.
- **Before building:** decide how to handle the 41 non-FL cross-context ship-tos (`DR000`/`MX000`/`HN000`/`NC060`/`NC065`/`AR0403`/`DR001`/`EL000`/`MA000`) — exclude from FL findings with a visible count, same as GA/NV's cross-context outliers. The non-US "no tax" codes in particular may need a policy decision (are these genuinely out-of-scope exports, or a Florida ship-to that's been mis-tagged?) rather than a pure data-matching fix.
- **Open question, not resolved here:** whether the 9 alphabetical slots with zero active ship-tos (`FL002` Baker, `FL013` DeSoto, `FL018` Franklin, `FL022` Gulf, `FL029` Holmes, `FL032` Jefferson, `FL037` Levy, `FL038` Liberty, `FL063` Union) actually have no `XATXBD` definition row at all, or simply have zero currently-active ship-tos assigned. `readStateDetail`'s assignment-driven query can't distinguish these two cases; a raw unfiltered `TBTXBOD LIKE 'FL%'` prefix pull (not run in this investigation, per the read-only-scripts-only constraint) would resolve it before any "58 vs. 67 coverage" claim is made in a build.
- **Before building:** confirm `FL000`'s single ship-to isn't a bulk/placeholder pattern waiting to grow — at 1/1,479 it's not blocking today, but it's the same code shape (`<STATE>000`) that became a large share in AL/MN/NE/UT/WA; worth a quick re-check the next time this state's data is pulled rather than assumed static.
- **If building the comparison:** adapt `server/ncdor-rates.mjs`'s pattern directly — Florida needs no address matching, and the alphabetical-index-to-county convention is fully discoverable and stable, so a config-only mapping (not a synthesized/trusted-assumption scheme like NC's) should be possible once the 4 stale rates and 41 cross-context exclusions are handled.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level), for the same reason already established for NC/GA/NV — not independently re-verified for FL in this pass, but no evidence found to expect FL to differ.
