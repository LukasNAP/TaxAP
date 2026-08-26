# KY — findings

Status: **Cleanest possible shape — confirmed live 2026-08-26.** A+ has exactly one real tax body for the entire state (`KY000`, "Kentucky"), covering 299 of 302 active KY ship-tos, and its configured rate (6%) matches the current official Kentucky statewide rate (6%) exactly. No address/boundary matching applies, no local-option tax exists to miss, and no comparability layering question exists either. The only wrinkle is 3 ship-tos carrying non-KY, cross-context tax bodies (Dominican Republic, Honduras) — the already-documented `SASTXB` cross-context pattern, not a KY-specific finding.

Live A+ (`readStateDetail`, via `scripts/investigate-state.mjs KY`) and the current Streamlined Sales Tax snapshot (via `scripts/fetch-official-rates.mjs KY`) both checked 2026-08-26.

## Address matching

**Not needed — Kentucky has no local-option sales tax, and A+ mirrors that with a single statewide code.** `readStateDetail` returns exactly one real KY tax body:

- `KY000` — "Kentucky" — 299 active ship-tos (122 active customers), base rate 6%, all four local-rate components 0, `currentRate` 6%.

This is consistent with outside knowledge: Kentucky is one of the states with no county- or city-level general sales tax at all — every jurisdiction in the state charges the same 6% rate, so a single code is not a sparse subset of real jurisdictions, it's full and correct coverage. The official Streamlined snapshot corroborates this independently: it returns exactly one row (`jurisdictionType: "state"`), zero counties, zero cities, zero special jurisdictions, and its own `boundaryStatus` field states plainly: "No local-option sales tax exists in this state - a single flat statewide rate applies to every ship-to. No address or boundary matching is needed." Same shape as NJ (`NJ000`) and HI (`HI000`) in prior investigations, and matches the pre-existing note in `docs/roadmap-50-states.md` ("1 row, state-level ... Flat 6% statewide, no local tax").

## Rate comparability

**Yes — confirmed live, exact match, no layering question.** A+'s `KY000.currentRate` (6%) equals the official snapshot's `totalGeneralRate` (6%) for Kentucky's one state-level row exactly. `TBCLRT1-4` are all 0 on the A+ side, and the official row's `componentRate` (6%) equals its own `totalGeneralRate` (6%) — no split-component ambiguity on either side. `nextRate` is 0 (`nextEffectiveDate` the null-sentinel `0001-01-01`), so there's no pending scheduled change on the A+ side either.

No surcharge, transit-district, or special-category layer applies here the way Ohio's transit-authority surcharge does — Kentucky's general sales tax has no local add-on of any kind to omit or double-count. (Some Kentucky cities levy narrow local taxes on specific categories like restaurant meals or transient room rentals, but those are separate, category-specific taxes outside the general sales-and-use tax base this project tracks — not a general-rate layering gap comparable to Ohio's.)

The official snapshot's machine-readable file is dated `KYR2012Q4Aug13.csv` in its filename, but its row's `beginDate` (2006-06-01) and `endDate` (2999-12-31) show the 6% rate has been continuously current since well before that filename's date — the old-looking filename doesn't indicate stale data, since nothing about Kentucky's flat rate has changed to require a newer file.

## Do-not-use and cross-context findings

**No KY-specific DO-NOT-USE-shaped placeholder found, and the numbers rule one out at any meaningful share.** `readStateDetail`'s three returned tax bodies account for all 302 active ship-tos exactly (299 + 2 + 1 = 302) — there is no gap between the visible tax-body breakdown and the state's total active-ship-to count that would suggest a retired/placeholder code silently absorbing a chunk of KY's real book of business the way `AL000`/`MN000`/`NE000`/`UT000`/`WA000` did in other states. (`readStateDetail` does still exclude retired/DO-NOT-USE rows automatically per the project's standard filter, so this can't be verified by inspecting an excluded row directly — but if one existed with a real ship-to share, the visible-vs-total ship-to arithmetic above would show a shortfall, and it doesn't.)

**3 of 302 active KY ship-tos carry a non-Kentucky, cross-context tax body** — the already-documented `SASTXB` cross-context pattern (a ship-to nominally under a KY customer can carry a tax body naming a different place entirely), not new KY-specific contamination:

- `DR000` — "DOMINICAN REPUBLIC" — 2 active ship-tos, 1 active customer, rate 0.
- `HN000` — "HONDURAS no tax" — 1 active ship-to, 1 active customer, rate 0.

Both descriptions unambiguously name a country other than the United States, let alone Kentucky — these must be excluded from any KY-specific findings table, the same way GA's live run excludes its `NC060`/`NC041`/`SC126`/`CA1163`/`PA000` outliers and NV's excludes `DR000`/`NCPRST`. (Note `DR000` recurs by code here with the same "Dominican Republic" meaning seen in other states' investigations — it is a cross-context code, not a Kentucky-specific one.)

## Real live A+ codes (2026-08-26, `readStateDetail("KY")`, retired/DO-NOT-USE rows already excluded)

| Code | Description | Rate | Active ship-tos | Notes |
|---|---|---|---|---|
| `KY000` | Kentucky | 6% | 299 | Real KY code — matches official statewide rate exactly |
| `DR000` | DOMINICAN REPUBLIC | 0% | 2 | Cross-context — not Kentucky, exclude from KY findings |
| `HN000` | HONDURAS no tax | 0% | 1 | Cross-context — not Kentucky, exclude from KY findings |

## Open questions / do instead if building

- **None blocking.** This is the simplest state investigated so far: single real code, exact rate match, no address matching, no layering, no material placeholder share.
- Exclude `DR000` and `HN000` from any KY-specific comparison or findings table (3/302 ship-tos, ~1%) — same visible-exclusion-count pattern used for other states' cross-context outliers. Do not report them as KY mismatches; they aren't KY at all.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level), for the same reason already established for NC/GA/NV.
- If a category-specific local tax (restaurant/transient-room) is ever brought into this project's scope, that would be a new, separate question from the general sales-and-use-tax comparison done here — not something this file's "no local tax" conclusion should be read as covering.
