# IL — findings

Status: **Layer 2 investigated (2026-08-26), not built.** A+'s real Illinois tax bodies (`IL#######`, 154 of them, 429 active ship-tos) are Illinois Department of Revenue's own composite county+place "location codes" — a real, discoverable numbering scheme, not synthesized — so a *correctly assigned* code already represents the fully-resolved combined jurisdiction (no re-derivation needed to read it). But two real, separate problems exist independent of that: (1) **51.0% of active IL ship-tos (454 of 891) carry a tax body with no rate definition in `XATXBD` at all** (`IL000`/`ILOOO`), the largest such gap found in any state investigated in this rollout so far, and (2) a handful of real Illinois cities straddle county lines and carry two different location codes for the same city name, so *assigning* the right code (as opposed to reading an existing one) does need real address knowledge. Rate comparability is **not yet confirmable — no official-source adapter exists for IL** (Layer 1 status is `machine-readable-source`, not `connected`).

Live A+ (`XATXBD` + active `ADDR`/`CUSMS` ship-to assignments) checked 2026-08-26 via `scripts/investigate-state.mjs IL`: 891 active ship-tos, 553 active customer assignments, 160 total tax-body rows.

## Address matching

**A+'s `IL#######` codes are Illinois DOR's own official composite county+place "location code," confirmed by decoding the prefix against known Illinois counties — not a synthesized or trusted-assumption scheme like NC's.** The first three digits of the 7-digit suffix consistently match Illinois DOR's own alphabetically-ordered county code: `016` = Cook (`IL0160011` Chicago, `IL01600923` Niles, `IL01601164` Schaumburg, `IL01601512` Streamwood), `022` = DuPage (`IL02200023` Addison, `IL02200538` Carol Stream, `IL02200181` Naperville), `045` = Kane (`IL04500229` St Charles, `IL04500091` Elgin), `099` = Will (`IL09900012` Joliet, `IL09950004` Will Co. bare-county code), `001` = Adams (`IL0010013` Quincy). This is internally consistent across every multi-digit prefix checked. Chicago's own code (`IL0160011`) totals `10.25%` (`6.25` base + `1 + 1.25 + 1.75` local), matching Chicago's well-known real combined rate exactly and confirming the up-to-4-slot local-rate decomposition is real, not placeholder data.

**A confirmed, real, Illinois-specific stacking layer beyond plain county+city: "Business District" overlay codes.** Several codes carry a `BUS DIST`/`BUS D`/`BUS DIS` description and a distinct code from their base-city sibling, each charging exactly one point more than the base city total — e.g. `IL01600451` "Illinois Skokie" (`10.25%`) vs. `IL0160451A` "Illinois Skokie BUS DIST" (`11.25%`); `IL02200181` "Illinois Naperville" (`7.75%`) vs. `IL0220181A` "Illinois Naperville BUS D" (`8.75%`). This matches Illinois's real Business District sales-tax overlay (65 ILCS 5/11-74.3, municipalities can levy an extra district-specific tax) — a genuine third stacking layer, the same *shape* of finding as Alabama's police-jurisdiction wrinkle, though structurally different. **Separately, a number of codes carry an unexplained trailing `R`** (e.g. `IL0500016R` Dixon Lee Co., `IL0600126R` Godfrey, `IL9400011R` Monmouth) with no unsuffixed sibling present in the data to compare against — meaning of the `R` suffix is **unconfirmed, needs a real IDOR document check**, not guessed.

**Real cities that straddle a county line get two different location codes — the "same city, different code depending on which side of the county line" pattern already seen in OK and NE.** Aurora has `IL02200422` "Illinois Aurora(Dupage Co" (`8.25%`) and `IL04500024` "Illinois Aurora KANE CO" (`8.25%`, coincidentally equal here); Elgin has `IL04500091` "Illinois Elgin" (Kane-side, `8.5%`) and `IL01601210` "Illinois Elgin" (Cook-side, `10.5%`) — a real, material difference between the two Elgin codes. **Picking the correct one of these for a given ship-to is an address-dependent decision** — reading an already-assigned code doesn't require address matching, but assigning one from scratch does, the same caveat NY's home-rule-city finding already established.

**The dominant, more consequential problem is not sub-ZIP boundary complexity — it's that most ship-tos aren't assigned a real code at all** (see "Do-not-use and cross-context findings" below). Net answer to Step 1: **address matching is genuinely needed for IL, but for a different mix of reasons than GA** — assigning the right code among split-county siblings, and (much larger in volume) assigning any real code at all to the `IL000`/`ILOOO` majority — not because a single code's own stacked-local-rate total is ambiguous once correctly chosen.

**Step 3 lead, not yet confirmed:** Illinois DOR itself publishes a genuine **address-specific machine-readable sales-tax-rate file** (`tax.illinois.gov/research/taxrates/machine-readable-file-address-specific.html`), separate from the state's regular per-jurisdiction rate table — a comma-delimited file, ~2 GB compressed / ~9 GB uncompressed, refreshed for the January 1 and July 1 effective dates each year, explicitly aimed at software developers doing address-level tax determination. This is plausibly the same "Addendum Address Files" concept flagged in this investigation's briefing, and — if it turns out to be keyed by the same composite location code decoded above — could let a future matcher validate or re-derive a ship-to's correct `IL#######` code directly from its address without GA-style boundary geometry. **Not confirmed**: the actual column layout (a separate "File Layout Description" spreadsheet on the same page was not downloaded/inspected in this pass) — a real next step before assuming it solves the problem, not a decided fact.

## Rate comparability

**Not yet confirmable — no adapter exists.** IL's Layer 1 status in `docs/roadmap-50-states.md` is `machine-readable-source` (source confirmed real, files dated through 08/01/2026), not `connected` — there is no `server/il-rates.mjs`-equivalent to run a live cross-check against, so this cannot be answered from data the way NC/GA/NJ/NV were.

What's known/observable from the A+ side alone (informal signal only, not a substitute for a real cross-check): `baseRate` is uniformly `6.25` across every one of the 154 real IL codes, matching Illinois's known statutory general-merchandise state rate; every row's `rateTotalValid` is `true` (`baseRate + sum(localRates) == currentRate` to the cent) with zero exceptions found; and `nextRate` is `0` / `nextEffectiveDate` is the null-sentinel `0001-01-01` on every row, meaning A+ has no scheduled future change queued for any IL code today. None of this proves the *current* rates are still correct against IDOR's live file — it only shows A+'s own numbers are internally self-consistent and structurally plausible, exactly the same caveat NV's pre-adapter spot-check carried before its adapter was actually run.

## Do-not-use and cross-context findings

**`IL000` — 451 of 891 active ship-tos (50.6%) — no `XATXBD` definition exists for this code at all.** This is a different shape from the classic AL000/MN000/ND000/NE000/UT000/WA000 "DO NOT USE"-labeled placeholder pattern: those codes *do* have a real `XATXBD` row (usually 0%), just tagged retired in `TBTXNAM` and excluded from the returned list by `isRetiredTaxBody`. `IL000` has **no row in `XATXBD` at all** — `readStateDetail`'s definition lookup finds nothing, so it surfaces directly in the returned list with `definitionStatus: "missing"`, `description: null`, `baseRate: null`. It was not silently dropped — this investigation saw it directly, with no need to infer its existence indirectly. **This is the largest placeholder-shaped share found in any state investigated in this rollout so far**, larger than UT's previous high of 23.9% (`UT000`, 64/268).

**`ILOOO` — 3 of 891 (0.3%) — the same "missing definition" shape as `IL000`, almost certainly a data-entry variant** (capital letter "O"s substituted for the digit "0"), not a separately meaningful code. Combined with `IL000`: **454 of 891 active IL ship-tos (51.0%) carry a tax body with no rate configured anywhere in `XATXBD`.**

**`ZTEMP` — 3 of 891 (0.3%) — description "TAX BODY TEMP USE," a `0%`-configured generic system placeholder**, not Illinois-specific and not caught by the retired-tax-body filter (its description doesn't match the `DO NOT USE`/`INACTIVE`/`OBSOLETE` pattern). Small share, but should be excluded from any real-rate comparison the same way the other placeholders are.

**Cross-context contamination — 5 of 891 (0.6%) active "IL" ship-tos carry a non-Illinois tax body**, the already-documented `CMTXBD`/`SASTXB` cross-context pattern (same shape as GA's `NC060`/`PA000`/etc. and NV's `DR000`/`NCPRST`): `NC065` ("North Carolina New Hanove[r]", 2 ship-tos), `PA000` ("Pennsylvania", 2 ship-tos), `NC034` ("North Carolina Forsyth", 1 ship-to). None of these name Illinois anywhere in their description — confirmed by eyeball per the project's standing exclusion rule — and must be excluded from any IL-specific findings table with a visible count, not silently dropped.

**Net: only 429 of 891 active IL ship-tos (48.1%), across 154 real codes, currently sit on an actual, rated Illinois location code.** The other 462 (51.9%) are either undefined (`IL000`/`ILOOO`, 454), a generic temp placeholder (`ZTEMP`, 3), or a real tax body for a different state entirely (5).

## Real IL codes (representative sample, 2026-08-26 pull)

| Code | Description | Rate | Note |
|---|---|---|---|
| `IL000` | *(none — no XATXBD row)* | — | missing definition, 451 ship-tos (50.6%) |
| `IL0160011` | Illinois Chicago | 10.25 | Cook Co.; decomposes to `6.25 + 1 + 1.25 + 1.75`, matches known real Chicago rate |
| `IL09900012` | Illinois Joliet | 8.75 | Will Co. |
| `IL0010013` | IL Quincy | 8.0 | Adams Co. |
| `IL02200023` | Illinois Addison | 8.75 | DuPage Co. |
| `IL02200422` | Illinois Aurora(Dupage Co | 8.25 | Aurora, DuPage side |
| `IL04500024` | Illinois Aurora KANE CO | 8.25 | Aurora, Kane side |
| `IL04500091` | Illinois Elgin | 8.5 | Elgin, Kane side |
| `IL01601210` | Illinois Elgin | 10.5 | Elgin, Cook side — same city, different code/rate |
| `IL01600451` | Illinois Skokie | 10.25 | base city rate |
| `IL0160451A` | Illinois Skokie BUS DIST | 11.25 | Business District overlay, +1pt over base |
| `IL09950004` | Illinois Will Co. | 7.0 | bare-county code |
| `IL0500016R` | Illinois Dixon Lee Co. | 8.25 | unexplained `R` suffix, no unsuffixed sibling seen |
| `ILOOO` | *(none — no XATXBD row)* | — | missing definition, typo variant of IL000, 3 ship-tos |
| `ZTEMP` | TAX BODY TEMP USE | 0 | generic system placeholder, 3 ship-tos |
| `NC065` | North Carolina New Hanove[r] | 7.0 | cross-context — not Illinois, exclude |
| `PA000` | Pennsylvania | 6.0 | cross-context — not Illinois, exclude |
| `NC034` | North Carolina Forsyth | 7.0 | cross-context — not Illinois, exclude |

(154 real `IL#######` codes total; only a representative sample shown above — full set is in the raw `investigate-state.mjs IL` output.)

## Open questions / do instead if building

- **Get a human decision on `IL000`/`ILOOO` before anything else.** At 51.0% of active ship-tos, this is the largest blocking placeholder share found across the whole rollout so far (bigger than UT000's 23.9%, MN000's 29%, or NE000's 18%) — understand what actually governs tax today for these ship-tos (is a rate applied at invoice time some other way, and if so how) before any comparison or dashboard tile is built, and before treating the 429 correctly-coded ship-tos as "the real IL picture."
- **Confirm the `R`-suffix code convention with a real IDOR document** before relying on it — it's unconfirmed whether it means "revised," a boundary/annexation update, or something else; don't guess.
- **Confirm the `A`-suffix/"BUS DIST" reading against a real IDOR Business District list** before treating it as settled — the description text and consistent +1pt deltas are a strong signal, not a confirmed cross-reference.
- **Download and inspect the actual layout of IDOR's "Sales Tax Rate Machine Readable Files - Address Specific"** (`tax.illinois.gov/research/taxrates/machine-readable-file-address-specific.html`, ~9 GB uncompressed, comma-delimited, semiannual) before assuming it solves the split-county-city and IL000-assignment problems — check specifically whether it's keyed by the same composite location code decoded above.
- **Exclude `NC065`, `PA000`, `NC034` (5 ship-tos) and `ZTEMP` (3 ship-tos) explicitly** from any IL findings table, the same way GA's and NV's cross-context outliers are handled.
- **Do not build a rate comparison until an official IL adapter exists** — Layer 1 status is `machine-readable-source`, not `connected`; nothing here has been checked against IDOR's live numbers yet.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level), for the same reason already established for NC/GA/NV.
