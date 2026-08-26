# MA — findings

Status: **No address matching needed — A+ has exactly one real tax-body code (`MA000`) for the entire state, matching Massachusetts' own law (no general local-option sales/use tax exists).** Rate comparability confirmed live: `MA000`'s configured `6.25%` matches the current statewide rate independently re-fetched from mass.gov (2026-08-26, direct `curl` fetch succeeded — see Rate comparability). No MA-prefixed DO-NOT-USE-shaped placeholder found. One immaterial cross-context finding: 1 of 343 active MA ship-tos carries a Nevada tax body (`NV002`) instead of an MA code.

Live A+ (`XATXBD`-backed `readStateDetail("MA")`, via `scripts/investigate-state.mjs MA`, standard suspended-row exclusions applied) checked 2026-08-26.

## Address matching

**Not needed.** `readStateDetail("MA")` returns exactly 2 tax-body rows for ship-tos whose `ADDR.SASHST = 'MA'`:

- `MA000` — "Massachusetts" — 342 of 343 active ship-tos (122 of 123 active customer assignments)
- `NV002` — "Nevada-Clark Cty" — 1 ship-to (cross-context outlier, see below — not a real MA code)

So effectively **100% of real MA ship-tos ride on a single tax-body code.** This matches real-world Massachusetts law, not just sparse A+ coverage: Massachusetts levies its general sales and use tax at a single flat statewide rate with **no county- or city-level local-option general sales tax at all** — unlike the state's separate local-option *meals* tax (up to 0.75%) and local-option *room occupancy* tax, which are different tax categories entirely and aren't what `XATXBD`/`SASTXB` track here. Since there is exactly one real jurisdiction for general sales/use tax purposes in MA (the state itself), a single code is the *correct*, complete mapping — not an under-coded subset the way AL's, MO's, or CO's sparse code lists are. This is structurally the same shape as NJ (`docs/states/nj.md`) and CT (per `docs/roadmap-50-states.md`'s source notes): a state whose own law has no sub-state general sales-tax variation, so a single flat A+ code is cleanly sufficient rather than a red flag.

No `E`-suffixed equipment-tax variant, no third-tier "police jurisdiction"-style split, and no wrong-state contamination in `TBTXNAM` — `MA000`'s description reads plainly "Massachusetts."

## Rate comparability

**Yes — confirmed live.** `MA000`'s `TBCRATE` (`currentRate`) is `6.25`, with all four `TBCLRT1-4` local-rate slots at `0` (`TBCBSRT` alone equals the total — `rateTotalValid: true`), and `TBNRATE`/`nextRate` is `0` with no scheduled next-effective-date, i.e. no pending change queued.

Independently re-confirmed against mass.gov itself on 2026-08-26: `WebFetch` against `mass.gov` returns a 403 (the page is live, just bot-blocked), consistent with `docs/roadmap-50-states.md`'s existing note. A direct `curl` request **with a plain `curl/8.0` User-Agent** (no browser UA — that combination is what got blocked) against `https://www.mass.gov/guides/sales-and-use-tax` returned **HTTP 200** and the live page text states plainly: *"...less than the 6.25% Massachusetts rate..."* and *"...Massachusetts use tax is the difference between the 2 states' sales tax rates"* against a 6.25% baseline — 8 occurrences of "6.25%" on the page, no other candidate general sales-tax rate mentioned, and no "local option" language anywhere on the general sales/use tax guide (consistent with the "no local variation" structural conclusion above). This is a direct, non-Wayback, non-archived confirmation, one step better than the prior source-discovery pass's Wayback-snapshot-only corroboration.

No surcharge/district/special-category layering was found on top of the base rate in this investigation (no Ohio-transit-style wrinkle surfaced) — MA's separate meals-tax and room-occupancy local options are different tax categories entirely, not a layer on top of the general sales/use rate `MA000` represents, so they don't create a comparability gap for this rate. `6.25%` (A+) and `6.25%` (official, live-refetched) match exactly.

**Caveat:** no official-source adapter is wired up for MA in `server/` yet (see `docs/roadmap-50-states.md` — MA is listed as a bot-blocked HTML source, not yet machine-readable/parsed by any adapter). This finding is a **manual, one-time spot confirmation**, not a live, repeatable cross-check the dashboard can run automatically today. Treat comparability as "confirmed by hand, not yet automatable" rather than "wired and monitored."

## Do-not-use and cross-context findings

**No MA-prefixed DO-NOT-USE-shaped placeholder found with a real ship-to share.** Unlike AL000/MN000/ND000/NE000/UT000/WA000, the only two rows `readStateDetail` returned for MA are the real `MA000` code and the cross-context `NV002` outlier — there is no third row representing an inert/placeholder MA code, and `342 + 1 = 343` accounts for the entire active-ship-to total with no unexplained gap. That said, `readStateDetail` (like the raw `XATXBD` query per `docs/state-rollout.md`) automatically excludes any row matching the DO-NOT-USE/retired-tax-body filter *before* it reaches this output — so this investigation cannot directly rule out an excluded MA-prefixed retired code existing behind the scenes with its own (excluded) ship-to count. There is no positive evidence of one (no gap in the ship-to total that would suggest hidden excluded rows), but this is a structural blind spot of the tooling, not a confirmed "none exists" — flagged as an open question below rather than asserted.

**1 of 343 active MA ship-tos (0.3%) carries a non-Massachusetts tax body: `NV002` ("Nevada-Clark Cty").** This ship-to has `ADDR.SASHST = 'MA'` (i.e. it's counted as a Massachusetts ship-to by state field) but its `SASTXB` tax-body assignment is Nevada's Clark County code — the same already-documented `SASTXB` cross-context pattern seen in GA's live run (`NC060`/`NC041`/`SC126`/`CA1163`/`PA000`) and NV's own findings (`DR000`/`NCPRST`). The share here (1/343) is immaterial in volume but should still be excluded from any MA-specific rate-comparison table with a visible exclusion count, per the project's no-silent-caps rule — not silently dropped, and not treated as if it represents an MA rate.

## Real live A+ codes (2026-08-26, `readStateDetail("MA")`, standard exclusions applied — 2 rows total)

| Code | Description | Rate | Active ship-tos | Notes |
|---|---|---|---|---|
| `MA000` | Massachusetts | 6.25% | 342 | Matches live-refetched official statewide rate exactly; only real MA jurisdiction for general sales/use tax purposes |
| `NV002` | Nevada-Clark Cty | 8.375% | 1 | Cross-context outlier — ship-to has `SASHST='MA'` but a Nevada tax body; exclude from MA findings, don't compare as an MA rate |

## Open questions / do instead if building

- **No adapter exists yet.** Before building a live MA comparison, someone needs to solve the bot-block for a *repeatable* automated fetch (the working `curl/8.0`-UA path used here for a one-time manual check may or may not survive mass.gov's bot-detection tuning over time — don't assume it's stable enough to hardcode into `server/` without re-verifying, and don't assume a browser-style UA will ever work here since it was the one that got blocked).
- **Cannot fully rule out an excluded MA-prefixed DO-NOT-USE code** — `readStateDetail`'s automatic retired-tax-body exclusion means a hidden placeholder row, if one exists, would not appear in this output at all. No evidence of one was found (the two visible rows fully account for the active ship-to total), but this is a blind spot of the standard tooling, not a proven negative. If a future full raw `XATXBD LIKE 'MA%'` pull (unfiltered, per `docs/state-rollout.md`'s Step 1 template) is ever run, re-check for this.
- **Before building:** decide how to handle the 1-ship-to `NV002` cross-context outlier — exclude from MA findings with a visible count, same convention as GA/NV.
- If an MA adapter is ever built, it should be the simplest possible shape in the codebase (closer to NJ's `server/nj-rates.mjs`/`server/nj-aplus.mjs` pattern than to any address-matching adapter) — one flat statewide rate, one A+ code, no boundary file needed.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level) — same established convention as every other state investigated so far; `readStateDetail`'s query already reads `SASTXB`.
