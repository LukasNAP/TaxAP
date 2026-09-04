# OH — findings

Status: **No address matching needed — A+'s 77 active county codes map 1:1 to real Ohio counties, alphabetically numbered `OH001`–`OH088`.** Rate comparability is **not a straight diff** the way NC/NV are: Ohio has ~16 counties with a county-coextensive transit-authority (RTA) sales-tax surcharge that the Streamlined rate file reports as a separate, unnamed "special" jurisdiction line rather than folding into the county row's `totalGeneralRate`. Checked against real examples (Cuyahoga, Franklin, Hamilton), A+'s `TBCRATE` already includes this surcharge where it applies — but **one genuine, confirmed live stale rate was found independent of the transit question: Knox County (`OH042`) has been undercharging by 0.5pt since 2023-10-01.**

Live A+ (`XATXBD`-derived tax bodies on active OH ship-tos, via `investigate-state.mjs`) checked 2026-08-26: 936 active ship-tos, 589 active customer assignments, 79 distinct tax-body codes. Cross-referenced against the current Streamlined rate file for OH (`OHR2026Q1NOV28.csv`, retrieved live 2026-08-26 via `fetch-official-rates.mjs`).

## Address matching

**Not needed.** `TBTXBOD` is `OH001`–`OH088` (77 of the 88 slots currently carry at least one active ship-to), and `TBTXNAM` literally reads `"OHIO <COUNTY> CO."` for every real row — a direct, human-readable 1:1 code-to-county mapping, no wrong-state contamination found in any description. The numbering is not arbitrary: mapping each code number to Ohio's 88 counties **in alphabetical order** (Adams=1, Allen=2, Ashland=3, … Wyandot=88) lines up exactly with every code seen, the same real alphabetical/Gazetteer-style convention other clean states use. This makes sense structurally too — **Ohio has no municipal home-rule sales tax at all**; the only local layers are the county permissive tax and a county-coextensive transit-authority tax (see Rate comparability below), so a jurisdiction can never vary within a single city or ZIP code the way GA/CO/WA require.

The 11 numbering slots not seen in this pull (e.g. `OH016` Coshocton, `OH019` Darke, `OH027` Gallia, `OH033` Hardin, `OH034` Harrison, `OH036` Highland, `OH040` Jackson, `OH058` Morgan, `OH061` Noble, `OH064` Perry, `OH082` Vinton) simply have **zero currently-active ship-tos** in this query — this doesn't distinguish "code exists in A+ with 0 active ship-tos" from "code was never created," since `investigate-state.mjs` only surfaces tax bodies actually in use. Not resolvable without a full unfiltered `XATXBD` prefix pull, which is outside this investigation's two vetted scripts.

No `E`-suffixed equipment-tax variants and no third jurisdiction tier (no OH equivalent of AL's police-jurisdiction split) were found.

## Rate comparability

**Confirmed comparability trap, resolved with real examples — plus one genuine stale rate found underneath it.**

Ohio's sales tax = state (5.75%) + county permissive tax +, in ~16 counties, a separate county-coextensive transit-authority (RTA) tax. The Streamlined rate file represents these as **two different jurisdiction types**: a `county` row (`totalGeneralRate` = state + county-permissive only) and a same-file, unnamed `special` row (`"Special jurisdiction NNNNN"`, no county attribution in the fetched fields) carrying just the transit increment. Comparing A+'s `TBCRATE` directly against the official file's `county`-row `totalGeneralRate` alone — the naive approach — produces 14 apparent "mismatches" out of 77 real codes. Checking real, well-known combined rates confirms most of these are not stale rates at all:

- **`OH018` Cuyahoga Co.**: A+ `TBCRATE` = 8.0% (`5.75 + 1.25 + 1.0` across `TBCBSRT`/`TBCLRT1`/`TBCLRT2`). Official file's `county` row alone = 7.0%. **8.0% is Cuyahoga's real, publicly known combined rate** (Greater Cleveland RTA's 1% transit tax, in effect since 1975 — matching the oldest `special` row's `beginDate` of `1975-10-01`, componentRate `1.0`). A+ is correct; the official county-only row is not the right number to compare against.
- **`OH025` Franklin Co.**: A+ `TBCRATE` = 8.0% (`5.75 + 1.75 + 0.5`). Official county-only = 7.0%. 8.0% matches Franklin/Columbus's real current combined rate after COTA's LinkUS transit increase brought the transit component to a full 1.0% — again, A+ appears correct, not stale.
- **`OH031` Hamilton Co.**: A+ `TBCRATE` = 7.8% vs. official county-only 7.0% (a 0.8pt gap) — matches the file's single `0.8`-rate special row exactly; 7.8% is Hamilton/Cincinnati's real current combined rate (SORTA transit tax).

The remaining 11 mismatches (`OH057` Montgomery +0.5, `OH077` Summit +0.5, `OH048` Lucas +0.5, `OH067` Portage +0.5, `OH043` Lake +0.5, `OH079` Tuscarawas +0.5, `OH076` Stark +0.25, `OH050` Mahoning +0.25, `OH008` Brown +0.25, `OH002` Allen +0.1) are all **A+ higher than the official county-only figure**, the same direction and same shape as the confirmed transit examples above — consistent with all of them also being real transit-authority surcharges already correctly baked into `TBCRATE`, not stale rates. This is plausible but **not individually name-confirmed for all 11**, because the official file's `special` rows carry no county name — only a generic `"Special jurisdiction NNNNN"` label. There is also a small unresolved count mismatch: 6 real A+ codes show a +0.5pt gap, but the official file has only 5 `special` rows at exactly `0.5`. One of those six could in principle be an independent, coincidentally-0.5pt stale rate rather than a transit surcharge — **not safe to assert which one without a named transit-authority crosswalk.**

**One mismatch runs the other direction and is not transit-shaped at all — a genuine, confirmed live stale rate:**

- **`OH042` Knox Co.: A+ `TBCRATE` = 6.75% (base 5.75 + local 1.0), while Ohio's official current rate for Knox County has been 7.25% (local 1.5%) since 2023-10-01** — just under 3 years stale as of today (2026-08-26). 4 active ship-tos on this code. No scheduled update queued (`nextRate` / `TBNRATE` = 0). This is the one finding here that's a straightforward needs-updating rate, independent of the transit-surcharge question.

No `TBCLRT3`/`TBCLRT4` usage seen (always 0) — the transit increment, where present, sits in `TBCLRT1` or `TBCLRT2` alongside the county-permissive rate, not a dedicated slot.

## Do-not-use and cross-context findings

**`OH000` — description "Ohio" (not tagged DO NOT USE/INACTIVE/OBSOLETE), so `readStateDetail`'s retired-tax-body filter did *not* exclude it — it appears in the main results, not hidden.** `baseRate`/all `localRates`/`currentRate` = 0. Used by **65 of 936 active OH ship-tos (~6.9%)** — same shape as the AL000/MN000/ND000/NE000/UT000/WA000 catch-all-placeholder pattern seen in other states, but structurally different in one important way: those are explicitly DO-NOT-USE-tagged and get silently dropped by the connector's standard exclusion before ever reaching a results list, whereas `OH000` is *visible* in the returned tax-body list today with an implausible 0% rate for general Ohio sales (real Ohio general sales tax is never 0% — minimum statewide is 5.75%). Must still be understood (real fallback behavior vs. an actually-unconfigured bucket) before being compared or included in any OH rate-accuracy metric.

**`DR000` ("DOMINICAN REPUBLIC") appears twice among active OH-ship-to tax-body assignments.** This is the already-documented `SASTXB` cross-context pattern (a ship-to physically in one place can carry a tax body naming somewhere else entirely) — not new OH-specific contamination, and not evidence of any OH mismatch. Exclude these 2 from OH-specific findings with a visible count, the same way GA's live run excludes its non-GA outliers and NV excludes `DR000`/`NCPRST`.

No wrong-state-named descriptions found among the 77 real `OH###` rows (every `TBTXNAM` reads `"OHIO <county> CO."`), and no `E`-suffixed equipment-tax variant codes exist for OH.

## Real live A+ codes with a rate difference from the official county-only total (2026-08-26)

| Code | County | A+ `TBCRATE` | Official county-only total | Diff | Active ship-tos | Read as |
|---|---|---|---|---|---|---|
| `OH018` | Cuyahoga | 8.00% | 7.00% | +1.00 | 82 | Transit (GCRTA) — confirmed real combined rate, A+ correct |
| `OH025` | Franklin | 8.00% | 7.00% | +1.00 | 122 | Transit (COTA) — confirmed real combined rate, A+ correct |
| `OH031` | Hamilton | 7.80% | 7.00% | +0.80 | 89 | Transit (SORTA) — confirmed real combined rate, A+ correct |
| `OH057` | Montgomery | 7.50% | 7.00% | +0.50 | 68 | Plausibly transit — not individually name-confirmed |
| `OH077` | Summit | 6.75% | 6.25% | +0.50 | 42 | Plausibly transit — not individually name-confirmed |
| `OH048` | Lucas | 7.75% | 7.25% | +0.50 | 22 | Plausibly transit — not individually name-confirmed |
| `OH067` | Portage | 7.25% | 6.75% | +0.50 | 12 | Plausibly transit — not individually name-confirmed |
| `OH043` | Lake | 7.25% | 6.75% | +0.50 | 10 | Plausibly transit — not individually name-confirmed |
| `OH079` | Tuscarawas | 7.25% | 6.75% | +0.50 | 3 | Plausibly transit — not individually name-confirmed |
| `OH076` | Stark | 6.50% | 6.25% | +0.25 | 20 | Plausibly transit — not individually name-confirmed |
| `OH050` | Mahoning | 7.50% | 7.25% | +0.25 | 7 | Plausibly transit — not individually name-confirmed |
| `OH008` | Brown | 7.25% | 7.00% | +0.25 | 2 | Plausibly transit — not individually name-confirmed |
| `OH002` | Allen | 6.85% | 6.75% | +0.10 | 9 | Plausibly transit — not individually name-confirmed |
| `OH042` | Knox | 6.75% | **7.25%** | **-0.50** | 4 | **Confirmed stale — needs updating, since 2023-10-01** |

63 of the other 77 real codes matched the official county-only total exactly.

## Open questions / do instead if building

- **Before building a general OH comparison:** get a human decision on how to treat the ~13 "A+ higher" transit-shaped codes — the safest framing is "A+ appears to already include the real transit-authority surcharge for these counties, confirmed for Cuyahoga/Franklin/Hamilton by public knowledge of their real combined rates; the other 10 are presumed the same pattern but not individually source-confirmed" — don't report them as stale rates.
- **The Knox County (`OH042`) finding is safe to report as needing updating today** — it doesn't depend on the transit question, runs the opposite direction from every transit-shaped mismatch, and has a clear, dated official effective date (2023-10-01) to cite.
- **Before building:** resolve the 6-codes-vs-5-special-rows count mismatch in the +0.5pt group — ideally by finding a real, named Ohio DOR transit-authority list (the SST file's `special` rows carry no name) to confirm which specific counties they correspond to, rather than assuming all six are transit and none are independently stale.
- **Before building:** get a human decision on `OH000` (65/936 ship-tos, ~6.9%, 0% rate, not DO-NOT-USE-tagged) — same open question shape as other states' placeholder codes, but note for whoever picks this up that it is *not* silently excluded by the connector today, unlike AL000/MN000/etc.
- **Before building:** exclude the 2 `DR000` (Dominican Republic) cross-context ship-tos from any OH-specific rate-accuracy metric, with a visible count.
- If a full 88-county coverage picture is ever needed (not just the 77 currently active), a full unfiltered `XATXBD LIKE 'OH%'` prefix pull would need to be run — the two vetted scripts used for this investigation don't surface codes with zero active ship-tos.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level), for the same reason already established for NC/GA/NV.
