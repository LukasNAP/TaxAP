# ME — findings

Status: **Layer 2 investigated (2026-08-26), not built.** A+ has exactly **one** tax-body row for the entire state (`ME000`, described plainly as `"Maine"`), and it is the *only* code any active Maine ship-to is assigned — 76 of 76 active ship-tos (100%), 31 of 31 active customer assignments. This is the NJ/HI/LA000-style single-flat-code shape, not a placeholder pattern: the description is a clean, correctly-named state label, not a "DO NOT USE"-style string, and it accounts for full coverage rather than a partial or sparse subset. No official-source adapter exists yet for ME (`research-needed` per `docs/roadmap-50-states.md`), so rate comparability against a live official fetch is **not yet confirmable** — but A+'s configured rate does match the widely-documented statewide rate on file.

Live A+ (`readStateDetail("ME")`, which queries active `ADDR`/`CUSMS` ship-to assignments by `SASHST='ME'` and joins `XATXBD` for the assigned codes' definitions — not a raw `XATXBD` prefix pull) checked 2026-08-26: **76 active ship-tos, 31 active customer assignments, 1 tax-body row.**

## Address matching

**Not needed — and not just "not needed for the general case" the way NV or NE turned out, but structurally impossible to need, because Maine's own tax law has no local-option sales tax at all.** Maine imposes sales tax only at the state level; there is no county- or municipality-level sales-tax variation anywhere in the state (well-established fact about Maine tax law, consistent with the roadmap's Layer 1 note: "Flat 5.5% statewide, no local variation"). Maine has 16 real counties, but none of them — nor any city — carries its own sales-tax rate. A single A+ code covering literally every active ship-to is therefore the objectively correct structure, not a coarse approximation or a sparse customer-driven subset the way WI's 49-of-72 or NE's 22-of-93 codes are.

`TBTXBOD` = `ME000` only; no other `ME`-prefixed or Maine-named codes were returned by the live ship-to-driven query, and no wrong-state contamination was found — `TBTXNAM` reads simply `"Maine"`, a correct, unambiguous single-word match for the state itself.

## Rate comparability

**Not yet confirmable — no official-source adapter exists for ME.** `fetch-official-rates.mjs` has no ME branch (confirmed by reading `scripts/fetch-official-rates.mjs` and `server/aplus-connector.mjs`'s official-source wiring), and ME is listed `research-needed` in `docs/roadmap-50-states.md` with only a source *location* noted (`maine.gov` rates page, HTML table), not a built parser. No live cross-check was run in this pass.

What can be said from the A+ data alone, pending that adapter:

- `ME000`'s `TBCBSRT` (base rate) is `5.5`, all four `TBCLRT1-4` local components are `0`, and `TBCRATE` (total) is `5.5` — internally consistent (`rateTotalValid: true`), with zero local component, exactly the shape expected for a state with no local-option tax.
- `5.5%` matches the flat statewide rate the Layer 1 research note already recorded for Maine from `maine.gov`. This is a strong plausibility signal, but it is a match against a research note, not a live, automated fetch of the current maine.gov table — it should be re-verified once a ME adapter exists, the same discipline NJ's `TBCBSRT`/`TBCRATE` match required before being called "confirmed."
- No scheduled change is pending: `TBNRATE` (next rate) is `0` and `nextEffectiveDate` reads as the sentinel `0001-01-01` (A+'s "nothing scheduled" convention, same as NV/NJ/NE's `TBNRATE=0` rows) — consistent with Maine's rate having been stable at 5.5% for some time, but again unconfirmed against a live source in this pass.

## Do-not-use and cross-context findings

**No DO-NOT-USE-shaped placeholder found, and none is plausible from this data.** `ME000` is not itself a placeholder — its description is `"Maine"`, not `"DO NOT USE"` or any retired-pattern string, and `isRetiredTaxBody` (checked against `app/tax-body-policy.ts`'s code pattern — `DNU`, `DONOTUSE`, `INACTIVE`, `OBSOLETE`, or a trailing `XXX`) does not match `ME000`. Because `readStateDetail` groups by every active ship-to's real assigned `SASTXB` code (not a fixed list), a second, differently-coded placeholder bucket — the AL000/MN000/ND000/NE000/UT000/WA000 shape — would have shown up as its own row here if any active ME ship-to carried one; none did. `activeShipTos` (76) accounting for 100% of the returned tax-body total, with no gap between the two, is itself evidence against a silently-excluded retired code sitting on real ship-tos (unlike WI's `WI000`, which showed up as an explicit 42-ship-to row with a missing definition). This can't be fully ruled out at the XATXBD-definition level with the vetted read-only tooling available (a raw, unfiltered `TBTXBOD LIKE 'ME%'` prefix pull — including retired rows — was not run, per the project's read-only/no-raw-SQL rule), so it is noted here as an open question rather than asserted as zero, but nothing in the live ship-to-assignment data suggests one exists.

No cross-context findings: no active ME ship-to carries a non-Maine tax body, and the sole real code's description correctly names Maine, not a different jurisdiction.

## Real live A+ codes (2026-08-26, ship-to state = ME, via `readStateDetail`, no row limit — 1 row total)

| Code | Name | Rate | Active ship-tos | Active customers | Notes |
|---|---|---|---|---|---|
| `ME000` | Maine | 5.5% | 76 | 31 | sole code, covers 100% of active ME ship-tos; matches the known flat statewide rate; not a placeholder |

## Open questions / do instead if building

- **Before anything else:** build a ME official-source adapter against `maine.gov`'s rates page (HTML table) — no live rate comparison is possible until then. Given the rate is flat and known to be non-varying, this is likely one of the simpler adapters to build (same shape as MD's hardcoded-flat treatment), but should still be parsed from the live page rather than hardcoded from this write-up's research note, and re-checked for any rate change since this investigation.
- **Re-verify 5.5% against a live maine.gov fetch** before treating the current A+/official match as confirmed — this pass only compared A+'s number against an earlier research note, not a fresh fetch.
- **Open, not fully closeable with available tooling:** whether a retired/DO-NOT-USE ME-prefixed code exists in `XATXBD` with zero currently-active ship-tos. Nothing in the live ship-to-driven data suggests one is silently absorbing real traffic (100% of active ship-tos land on `ME000`, the same completeness signal NJ's 599/600 and HI's clean single-code coverage showed), but this project's read-only/vetted-script rule means a raw unfiltered `XATXBD` prefix pull to rule it out entirely wasn't run in this pass.
- If ME's real rate structure ever changes (e.g. a future local-option tax is enacted), re-run Step 1 from scratch rather than assuming today's single-code finding still holds — this file's "no address matching needed" conclusion is a fact about Maine's *current* tax law, not a permanent structural guarantee.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level) — same established convention as NC/GA/NV/WI; not independently re-checked for a ME-specific divergence in this pass, but `readStateDetail` already reads ship-to level only, so no comparison built on its output needs to revisit this.
