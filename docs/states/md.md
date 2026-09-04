# MD — findings

Status: **Trivial confirmed live (2026-08-26).** Maryland's flat 6% statewide sales tax preemption of local sales tax is exactly reflected in A+: there is exactly **one** real Maryland tax-body code (`MD000`), it is used by 729 of 731 active MD-ship-to assignments, and its configured rate (`TBCRATE` 6%) matches the current Comptroller of Maryland rate (6%) exactly. No address matching needed, no rate gap found, no `MD###`-style DO-NOT-USE placeholder found. The only real finding is a small cross-context anomaly (2 ship-tos physically in MD carrying a North Carolina tax body), which is excluded from the MD-specific numbers below, not treated as an MD jurisdiction.

Live A+ (`ADDR`/`CUSMS` active ship-to assignments, via `readStateDetail("MD")`, which already applies the project's standard retired-tax-body exclusion) checked 2026-08-26, cross-referenced against a live fetch of the Comptroller of Maryland's rate source the same day.

## Address matching

**Not needed.** Every currently-assigned, real Maryland tax body reduces to a single code, `MD000` ("Maryland"), used by 729 of the 731 active ship-to assignments that come back for state code `MD` (99.7%). This isn't a sparse subset of a larger real jurisdiction set the way AL/CO/MO/UT are — Maryland's actual tax law has no county or city sales tax at all (Maryland preempts local general sales tax by statute), so one statewide code *is* full, correct coverage, not a gap. This is the same shape as NJ's `NJ000` and HI's `HI000` (a real, live-confirmed single-code state) — not the same shape as ND's `ND000` (which is 0% and looks like an unbuilt setup) or the AL000/MN000/NE000/UT000/WA000 DO-NOT-USE placeholder pattern (see below — `MD000` itself is not a placeholder; its description is plainly "Maryland", not "DO NOT USE").

No `E`-suffixed equipment-tax variant, no third jurisdiction tier, and no other `MD`-named code shows up anywhere in the live assignment data.

## Rate comparability

**Yes — confirmed live, exact match.** `MD000`'s `TBCBSRT`/`TBCRATE` is `6`, with all four local-rate slots (`TBCLRT1`–`4`) at `0` (`rateTotalValid: true` — the 6 + 0+0+0+0 arithmetic is internally consistent). The Comptroller of Maryland's current rate chart (fetched live 2026-08-26, `https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/Tax_rate_chart.pdf`) gives Maryland's state sales-and-use tax as a flat 6% with no county or city component and no special-district layering — the same conclusion `docs/roadmap-50-states.md` already recorded for MD's source-discovery pass. A+'s 6% and the official 6% are measuring the same, single, unlayered total: no Ohio-transit-surcharge-shaped "different things being compared" risk exists here, because there is no local layer on either side to disagree about. No scheduled rate change is pending (`nextRate: 0`, `nextEffectiveDate: 0001-01-01`).

## Do-not-use and cross-context findings

**No `MD`-named DO-NOT-USE placeholder found in live usage.** The only two tax bodies that come back for any active MD ship-to are `MD000` and `NC060` — no third, retired-looking MD code (no `MDXXX`, `MD000E`, etc.) appears in current assignments. `readStateDetail`'s automatic retired-tax-body exclusion runs before the totals are computed, though, so this can only confirm what's visible in the post-exclusion result, not rule out a retired MD placeholder holding ship-tos this view can't surface — see Open Questions.

**2 of 731 active MD ship-tos carry a non-Maryland tax body (`NC060`, "North Carolina Mecklenbur[g]").** This is the same `SASTXB` cross-context pattern already documented for GA (`NC060`/`NC041`/`SC126`/`CA1163`/`PA000` on real GA addresses) and NV (`DR000`/`NCPRST`). `NC060`'s own definition (`baseRate` 4.75 + local 3 + 0.5 = `currentRate` 8.25) is a real, correctly-configured North Carolina Mecklenburg County rate — it is not miscoded, it's simply the wrong state's code sitting on a ship-to physically located in Maryland (most likely a border-adjacent or misassigned customer). These 2 ship-tos must be excluded from any MD-specific findings table, not compared as if they were MD-priced, the same way GA's cross-context outliers are excluded.

## Real live A+ codes (2026-08-26, active MD ship-to assignments via `readStateDetail`)

| Code | Description | Active ship-tos | Active customers | Current rate | Notes |
|---|---|---|---|---|---|
| `MD000` | Maryland | 729 | 381 | 6% | Matches Comptroller of Maryland flat statewide rate exactly; no local component |
| `NC060` | North Carolina Mecklenbur[g] | 2 | 2 | 8.25% | **Not a Maryland jurisdiction** — cross-context `SASTXB` anomaly, exclude from MD comparison |

729 + 2 = 731, reconciling exactly against `readStateDetail`'s reported `activeShipTos` total — no unaccounted-for gap between the two rows shown and the state total.

## Open questions / do instead if building

- **Cannot independently confirm the absence of a hidden `MD`-named DO-NOT-USE placeholder.** `readStateDetail` filters retired tax bodies (by code pattern `DNU|DONOTUSE|INACTIVE|OBSOLETE|XXX$` or description text `DO NOT USE`/`DONT USE`/`INACTIVE`/`OBSOLETE`) *before* summing the reported `activeShipTos` total, so if a retired MD placeholder exists with ship-tos assigned to it, those ship-tos would simply not appear anywhere in this view — not as a smaller-than-expected total, just silently absent. The 729+2=731 reconciliation only proves the two rows shown account for everything this query surfaces; it does not prove nothing was filtered out upstream. This is a genuine visibility gap in the read-only tooling available for this investigation, not a claim that a placeholder exists — treat as unresolved, not as evidence either way, without a raw (unfiltered) count to compare against.
- **Before building:** decide how to handle the 2 `NC060` cross-context ship-tos — exclude from MD findings with a visible count, same as GA/NV's pattern, rather than silently dropping or mis-comparing them.
- No boundary/address-matching source is needed for MD (Step 3 is moot) — if this state is built, it should follow the NJ/HI-style single-code adapter pattern (`server/nj-rates.mjs` shape), not the GA-style boundary matcher.
- Re-verify the Comptroller of Maryland source periodically rather than treating today's 6% as permanent — it's a PDF rate chart, not a machine-readable feed, so a future rate change would require noticing the PDF changed, not an automated diff.
