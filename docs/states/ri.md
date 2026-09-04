# RI — findings

Status: **investigated live 2026-08-26, not safe to build.** A+ has exactly one tax body for the entire state (`RI000`), which structurally matches Rhode Island's real tax law perfectly (no local-option tax exists anywhere in RI, and its Census "counties" have no taxing authority at all — confirmed by both the task context and the live official-rate fetch). But that single code's configured rate is stale — it needs updating from `0` to the current flat statewide `7%` — on effectively 100% of active RI ship-tos. This is the same shape ND's investigation found (a single flat statewide code sitting at `0` while the real state tax is not optional), not the same shape as HI's (where 0% is plausibly a legitimate optional-pass-on business choice).

`readStateDetail('RI')`: `activeShipTos: 40`, `activeCustomerAssignments: 22`, `taxBodyCount: 1`.

## Address matching

**Not needed — and RI is the cleanest possible case for this, cleaner even than NJ/HI/LA's single-code states, because there is nothing finer to match into even in principle.** Rhode Island has no county government of any kind (its 5 Census counties are statistical/judicial boundaries only, not taxing authorities — consistent with the context this investigation started from) and no municipal home-rule or local-option sales tax. The official-rate fetch confirms this independently: `counts.counties: 0`, `counts.cities: 0`, `counts.specialJurisdictions: 0`, and `boundaryStatus`: *"No local-option sales tax exists in this state - a single flat statewide rate applies to every ship-to. No address or boundary matching is needed."*

A+'s side matches this exactly: the live `XATXBD` pull (`TBTXBOD LIKE 'RI%'`, standard exclusions applied) returns exactly **one** row, `RI000` / "Rhode Island," and it accounts for all 40 active ship-tos and all 22 active customer assignments — no fragmentation, no second code, no shortfall between the single code's count and the state total. A code-to-jurisdiction mapping is not just sufficient here, it's a mapping of 1-to-1 onto a state that genuinely only has one taxing jurisdiction.

## Rate comparability

**No — confirmed live, and it is not a subtle gap.** A+'s `RI000` reads `baseRate: 0`, `localRates: [0,0,0,0]`, `currentRate: 0`. The live official snapshot (Streamlined Sales Tax, `RIR2019Q2MAR27.csv`) shows Rhode Island's single statewide jurisdiction (`jurisdictionCode: 44`, "Rhode Island") at `componentRate: 7`, `totalGeneralRate: 7`, in effect since `2007-01-01` with no end date — a stable, long-standing rate, not a recent change A+ merely hasn't caught up to yet. `nextRate` is also `0` with `nextEffectiveDate: 0001-01-01` (the project's confirmed sentinel for "no scheduled future rate," not a phase-in row) — so this isn't a rate that's about to self-correct either.

**A+ 0% vs. official 7%, on the state's only tax body, covering 40 of 40 active ship-tos and 22 of 22 active customer assignments.** Unlike Hawaii (where 0% is plausibly an intentional choice because Hawaii's GET pass-on is legally optional), Rhode Island's 7% sales tax is not an optional pass-through — a real customer sale physically shipped into RI is subject to it by law. A configured `0%` here reads as an unbuilt/never-configured tax body, the same inference the ND investigation made under an identical structural shape (single flat statewide code, mandatory tax, `TBCRATE=0` on 100% of active volume) — not confirmed intent, and not something to resolve by guessing; it needs the same kind of human/Atlantic-tax-team confirmation ND and HI were flagged for.

## Real live A+ codes (2026-08-26, `readStateDetail('RI')`, standard retired/suspended exclusions applied)

| Code | Description | Current rate | Active ship-tos | Active customers | Notes |
|---|---|---|---|---|---|
| `RI000` | Rhode Island | 0 | 40 | 22 | Sole tax body for the entire state; official flat statewide rate is 7% — needs updating |

## Do-not-use and cross-context findings

No DO-NOT-USE-shaped placeholder pattern (the AL000/MN000/ND000/NE000/UT000/WA000 shape) was found for RI, and there's a concrete reason to believe none is hiding here: `RI000`'s own ship-to count (40) already equals `readStateDetail`'s total `activeShipTos` (40), and its customer count (22) already equals the total `activeCustomerAssignments` (22) — there is no gap between the single reported code and the state total that a silently-excluded retired code could be filling. `RI000`'s description field reads plainly as `"Rhode Island"`, not any `DO NOT USE`/`INACTIVE`/`OBSOLETE` phrasing, so it is not itself a retired row that happens to still be live — it is the real, only, and correctly-scoped tax body for the state; its problem is the configured rate value, not its identity or its exclusion status.

No wrong-state contamination found — there was only the one row to eyeball, and its description names Rhode Island correctly.

## Open questions / do instead if building

- **Before building anything:** get an explicit human/Atlantic-tax-team decision on why `RI000` is configured at `0%` when Rhode Island's 7% sales tax is not optional — same open question ND's investigation raised under an identical structural shape. Don't assume it should simply be bumped to 7% without confirming Atlantic actually collects/remits RI sales tax today; if it turns out they do and A+ is simply unset, this becomes a straightforward "needs updating" fix once a person signs off, not a technical build.
- If/when the rate is confirmed correctable to 7%, no address-matching or boundary-source work (Step 3) is needed at all — RI's structure means the eventual "build" step is the simplest possible shape: one code, one rate, no per-jurisdiction table to validate against beyond the single state-level row already fetched from Streamlined.
- Re-run this investigation's live query if RI's official rate ever changes from 7% (it has been stable since 2007-01-01 per the Streamlined snapshot, so this is a low-likelihood but easy check for a future refresh).
