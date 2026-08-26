# WV — findings

Status: **investigated live 2026-08-26, not safe to build.** No official-source adapter exists yet for WV (it sits in the "claimed SST source, needs a special flat/no-county-tax code path" bucket per `docs/roadmap-50-states.md` 5b, not `CONNECTED_GENERIC_SST_STATES`), so rate comparability is not yet confirmable. On the A+ side, WV has no county-level tax body at all — every real code is a named municipality — and two findings need a human decision before any comparison is built: an undefined `WV000` catch-all covering ~19% of active ship-tos, and one code (`WV961`) whose free-text description names Missouri, not West Virginia.

Live A+ (`XATXBD` + active `ADDR`/`CUSMS` ship-to assignments) checked 2026-08-26 via `scripts/investigate-state.mjs WV`: 112 active ship-tos, 90 active customer assignments, 30 distinct tax-body codes, no row-limit truncation (well under any `FETCH FIRST` risk). Every row's `activeShipTos`/`activeCustomers` was summed by hand against the script's totals — both sums (112 and 90 respectively) reconcile exactly against the reported `activeShipTos`/`activeCustomerAssignments`, so there is no evidence of a further silently-excluded retired body absorbing extra live ship-tos beyond what's discussed below.

## Address matching

**Yes, in the SC/AL sense — not the NC sense.** WV has **no county sales tax at all** (confirmed both by the SST source note carried into `docs/roadmap-50-states.md` — 0 county rows in WV's rate file — and by A+ having zero county-named codes). All local tax is municipal: West Virginia law lets an incorporated municipality adopt its own municipal sales-and-use tax (in practice, every adopting city in this A+ pull uses the same 1% add-on), and that tax applies only inside the municipality's corporate limits. A ship-to's real jurisdiction therefore depends on whether it sits inside or outside a specific city's boundary — the same "incorporated place vs. everything around it" structural split SC needed address matching for, and it can vary within a single ZIP code the same way (a ZIP straddling a city line has taxed addresses and untaxed addresses side by side). This is a place-level question, not a county-count question, which matches the state-specific note this investigation was scoped from.

A+'s 27 real municipal codes (see table below) are customer-driven and already-assigned per ship-to, so existing ship-tos aren't currently mismatched by this — but deriving or validating a code from a bare address/ZIP (the way a fresh build or an official-source cross-check would need to) cannot skip real boundary matching here. No SST boundary file for WV has been fetched or confirmed in this pass (Step 3 not attempted) — that would be the next thing to check before building.

**`WV0100` ("West Virginia No Local Rt", 23/112 active ship-tos — the single largest bucket) is a real jurisdiction, not a placeholder.** It represents the flat 6% state-only rate that applies everywhere in WV outside an adopting municipality's limits (or inside a non-adopting municipality). It has a fully configured, internally consistent rate (`TBCBSRT=6`, all local components `0`) and should not be confused with `WV000` below.

## Rate comparability

**Not yet confirmable — no adapter exists.** What's known from general knowledge about WV's structure (not yet cross-checked against a live official source): the state sales/use tax base rate is 6%, and municipalities that adopt a local sales/use tax do so at a rate that in current A+ data is uniformly 1% (giving a flat 7% total everywhere a municipal code applies). Every one of the 27 real municipal codes below shows exactly `baseRate=6`, `localRates=[1,0,0,0]`, `currentRate=7` — internally consistent and uniform, with no variation between cities (unlike CO/UT's patchwork) and no `E`-suffixed equipment-tax variants or third-tier police-jurisdiction-style split found. `nextRate` is `0` and `nextEffectiveDate` is `0001-01-01` on every row — A+ has no scheduled change queued for any WV code.

This uniformity is encouraging but not a substitute for a live check: it only shows A+ is internally consistent with itself, not that 7% (or the underlying 1% municipal add-on) is still each city's *current* official rate. Do not report any WV rate as matching or stale until a real official source (WV's own State Tax Department, or a working SST rate-file adapter) is actually fetched and compared per Step 2's rule.

## Do-not-use and cross-context findings

**`WV000` — 21 of 112 active ship-tos (~18.75%), the second-largest bucket in the state.** Unlike AL000/MN000/ND000/NE000/UT000/WA000, this code's `TBTXNAM` came back `null` and `definitionStatus: "missing"` rather than literal "DO NOT USE" text — meaning it was **not** caught and dropped by `readStateDetail`'s automatic retired-tax-body exclusion (that filter matches on `DO NOT USE`/`DONT USE`/`INACTIVE`/`OBSOLETE` text in `TBTXNAM`, and `WV000` has no `TBTXNAM` row to match against at all). It is present in the returned `taxBodies` list with no rate defined at all (`baseRate: null`, `rateTotalValid: null`). This is the same *shape* of finding as the AL000/MN000/etc. family (a `<STATE>000` code carrying a large real share of active ship-tos with no usable rate) even though the underlying mechanism is different (missing definition vs. explicit retirement tag) — **treat as blocking, same as those states.** Open question: what does WV000 actually mean operationally (a genuinely unconfigured ship-to, a migration artifact, something else) — needs a human decision, not a guess.

**`WV961` — "Missouri Lewisburg," 1 of 112 active ship-tos.** Per the standing rule (the SC3622/"South Dakota Vermillion" check), this row's free-text description names a different state and must be flagged, not silently folded into the WV findings. Lewisburg is a real West Virginia city (Greenbrier County seat), and the row's rate shape (`baseRate=6`, local `1`, total `7`) is identical to every other confirmed WV municipal code — consistent with this being a mislabeled description on an otherwise-real WV jurisdiction, the same cosmetic-typo shape as NV's "Esmaralda" — but that is a plausible read, not a confirmed one, and this investigation does not assert it. **Excluded from the real-codes table below; reported as "ambiguous, needs a human decision," not compared or counted as a normal WV code.**

**`WV071` ("West Virginia Cross Lanes," 1 active ship-to) needs verification, not immediate exclusion.** Cross Lanes, WV is — per general knowledge, not yet confirmed against a live source — an unincorporated census-designated place in Kanawha County rather than an incorporated municipality, and WV's municipal sales tax by statute applies only within incorporated limits. If that's correct, this code's real-world basis is unclear (it may be an informal trade-area label used for a ship-to actually inside a neighboring incorporated municipality, similar to VT's "Orleans Co." catch-all). Flagged as an open question rather than removed from the table, since it isn't confirmed to be wrong.

## Real live A+ codes (2026-08-26, `XATXBD`-backed, no row limit — 30 rows total)

| Code | Name | Rate | Active ship-tos | Notes |
|---|---|---|---|---|
| `WV0100` | West Virginia No Local Rt | 6% | 23 | real statewide default (outside/non-adopting municipalities), not a placeholder |
| `WV000` | *(none — no `TBTXNAM` row)* | undefined | 21 | **blocking — see above** |
| `WV029` | West Virginia Martinsburg | 7% | 11 | |
| `WV034` | West Virginia Morgantown | 7% | 7 | |
| `WV003` | West Virginia Beckley | 7% | 4 | |
| `WV010` | West Virginia Charleston | 7% | 4 | state capital |
| `WV033` | West Virginia Moorefield | 7% | 4 | |
| `WV041` | West Virginia Parkersburg | 7% | 4 | |
| `WV002` | West Virginia Barboursvil[le] | 7% | 3 | name truncated in source |
| `WV024` | West Virginia Huntington | 7% | 3 | |
| `WV047` | West Virginia Ranson | 7% | 3 | |
| `WV057` | WV South Charleston | 7% | 3 | |
| `WV063` | West Virginia Vienna | 7% | 3 | |
| `WV038` | West Virginia Nitro | 7% | 2 | |
| `WV068` | West Virginia Wheeling | 7% | 2 | |
| `WV004` | West Virginia Bluefield | 7% | 1 | |
| `WV006` | West Virginia Bridgeport | 7% | 1 | |
| `WV016` | West Virginia Elkins | 7% | 1 | |
| `WV018` | West Virginia Fairmont | 7% | 1 | |
| `WV025` | West Virginia Hurricane | 7% | 1 | |
| `WV026` | West Virginia Kingwood | 7% | 1 | |
| `WV030` | West Virginia Masontown | 7% | 1 | |
| `WV035` | West Virginia Moundsville | 7% | 1 | |
| `WV037` | WV New Martinsville | 7% | 1 | |
| `WV044` | West Virginia Princeton | 7% | 1 | |
| `WV052` | WV Shepherdstown | 7% | 1 | |
| `WV059` | West Virginia St Albans | 7% | 1 | |
| `WV067` | West Virginia Weston | 7% | 1 | |
| `WV071` | West Virginia Cross Lanes | 7% | 1 | **needs verification — see above, possibly not an incorporated municipality** |
| `WV961` | ~~Missouri Lewisburg~~ | 7% | 1 | **excluded — wrong-state-named description, see above** |

27 of these 30 rows (all but `WV0100`, `WV000`, `WV961`) are confirmed-real, uniquely-named West Virginia municipalities carrying the same internally-consistent 6%+1%=7% structure; `WV071` is flagged separately above pending incorporation-status verification.

## Open questions / do instead if building

- **Get a human decision on `WV000`** (21/112, ~18.75% of active ship-tos) before building anything — same category of blocker as AL000/MN000/NE000/UT000/WA000, but note the mechanism differs (undefined/no `TBTXNAM` row, not an explicit "DO NOT USE" tag), so it will not be caught by the existing `isRetiredTaxBody()`-style filter and needs its own handling.
- **Get a human decision on `WV961` ("Missouri Lewisburg")** — likely a cosmetic mislabel of a real WV jurisdiction (Lewisburg, Greenbrier Co.) given its rate matches the standard WV municipal pattern exactly, but not confirmed; do not fold it into WV findings as-is, and do not silently rename or reclassify it without sign-off.
- **Verify whether Cross Lanes (`WV071`) is a real incorporated municipality that can legally levy this tax**, or an informal/CDP label — general knowledge suggests it is not incorporated, but this needs an actual source check, not an assumption.
- **No official-source adapter exists for WV yet** — per `docs/roadmap-50-states.md` 5b, this needs its own "flat default + named municipal override" code path (not a `GENERIC_SST_STATES` county-count entry, which would misvalidate on WV's 0-county-row file shape). Fetch and confirm the current SST rate file (and check for a boundary file, for Step 3) before attempting any real comparison.
- **Once a source exists, validate by place name, not by county count** — the per-state note that scoped this investigation is correct: the usual "does the code count roughly match the real county count" sanity check doesn't apply here since WV has zero taxable counties: validate each municipal code's *name* against WV's real list of municipalities that have adopted the local sales tax, and validate `WV0100`'s applicability against everywhere else.
- **Real address/boundary matching (SC/AL-style) will be needed for any ship-to not already correctly coded**, since municipal limits don't align with ZIP boundaries — a bare ZIP or city-name lookup risks misclassifying addresses near a city line. No WV boundary file has been fetched in this pass.
