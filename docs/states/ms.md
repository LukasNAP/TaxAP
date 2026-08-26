# MS — findings

Status: **Layer 2 investigated (2026-08-26), no official-source adapter exists yet (Layer 1 = `research-needed`).** A+ has exactly one real Mississippi tax body (`MS000`, flat 7%) covering 267 of 270 active MS ship-tos — an NJ/HI-shaped setup, not a GA-shaped one. The remaining 3 ship-tos carry non-Mississippi tax bodies (cross-context findings, see below). Mississippi's own tax structure is a genuinely near-flat state (no general local-option sales tax), so a single A+ code is plausible coverage, not a sparse subset — but two narrow, real, named-city levies (Jackson +1%, Tupelo +0.25%) that Mississippi's own DOR publishes on separate standalone pages have **no corresponding A+ tax body at all**, which is a Step 2 (comparability), not Step 1 (address-matching), concern. No live rate cross-check is possible yet — no MS adapter is wired in `server/aplus-connector.mjs` / `scripts/fetch-official-rates.mjs`.

Live A+ (`XATXBD` via `readStateDetail("MS")`, ADDR/CUSMS active ship-to assignments) checked 2026-08-26: 270 active ship-tos, 124 active customer assignments, 4 distinct tax bodies. All 4 tax bodies' `activeShipTos` sum exactly to the reported total (267 + 1 + 1 + 1 = 270) — no evidence of a silently-excluded retired/DO-NOT-USE row shrinking the visible total for this state (see Open Questions for the caveat on how far this reconciliation can be trusted).

## Address matching

**Not needed for the general case — A+ has literally one tax body for the entire state (`MS000`, "Mississippi"), the same shape as NJ's `NJ000` and HI's `HI000`, not the county/city-per-code shape NC or NV have.** This lines up with real-world Mississippi tax law: Mississippi is one of the states with **no general local-option sales tax** — the state's 7% rate applies uniformly statewide, so a single flat code is plausible, correct coverage for the vast majority of ship-tos, not a sparse subset the way MO's 92 codes or CO's 57 codes are for their much more locally-fragmented states.

**But Mississippi does have two narrow, real exceptions the flat code can't represent: a Jackson-specific +1% levy and a Tupelo-specific +0.25% levy**, both published by MS DOR on their own standalone pages (per the state's official source, not folded into the main statewide rate table). Neither has any corresponding A+ tax body — there is no `MS`-prefixed code besides `MS000` anywhere in the live pull. This is not the GA-style "jurisdictions vary within a ZIP code across most of the state" problem — it's a much narrower, Ohio-transit-surcharge-shaped question: does the flat `MS000`/7% comparison silently miss a real add-on for any ship-to physically inside Jackson or Tupelo city limits?

**This can't be answered from the aggregate data `readStateDetail` returns.** The query groups by tax body, not by ship-to city/ZIP, and per the project's no-address-to-browser rule the script deliberately doesn't expose per-ship-to address detail. So whether any of the 267 `MS000` ship-tos are physically in Jackson or Tupelo is genuinely unknown from this investigation — reported as an open question, not guessed.

## Rate comparability

**Not yet confirmable — no adapter exists.** MS sits at Layer 1 `research-needed` in `docs/roadmap-50-states.md` (source found: `dor.ms.gov` rates page, HTML text; not wired into `server/aplus-connector.mjs` or `scripts/fetch-official-rates.mjs`). No live cross-check was run or is possible yet.

What can be said without a live check: A+'s `MS000` base rate (`TBCBSRT` = 7, all four `TBCLRT` local-rate slots = 0, `TBCRATE` = 7) is internally consistent (`rateTotalValid: true`) and matches Mississippi's well-known statewide 7% general sales tax rate in shape (a flat rate, no local components) — but this is a plausibility check against general knowledge, not a confirmed cross-reference against a live official source, and should not be reported as "confirmed." The real open item is the Jackson/Tupelo layering question above: even if `MS000`'s 7% is correct for the 98%+ of MS ship-tos outside those two cities, it would be a real, live understatement for any ship-to actually inside Jackson (true combined rate would be 8%) or Tupelo (7.25%) — unconfirmed because address-level detail isn't available from this pull and no adapter exists yet to even attempt the comparison.

`TBNRATE` is 0 on `MS000` (no scheduled future rate change pending in A+).

## Do-not-use and cross-context findings

**No DO-NOT-USE-shaped placeholder found for MS itself** — `MS000` carries the real 7% rate, not a 0%/placeholder value, and it is not excluded by `readStateDetail`'s retired-tax-body filter (it's the single largest bucket, 267/270). This is a different shape from AL000/MN000/ND000/NE000/UT000/WA000 — there is no evidence here of a zeroed catch-all masking real coverage gaps.

**3 of 270 active MS ship-tos (1.1%) carry a non-Mississippi tax body** — the same `SASTXB` cross-context pattern already documented for GA (`NC060`/`NC041`/`SC126`/`CA1163`/`PA000`) and NV (`DR000`/`NCPRST`):

- `DR000` — "DOMINICAN REPUBLIC" (1 ship-to, 1 customer, rate 0). Also seen in NV's investigation (`docs/states/nv.md`) — appears to be a generic non-US placeholder reused across states, not MS-specific contamination.
- `HN000` — "HONDURAS no tax" (1 ship-to, 1 customer, rate 0).
- `MO031` — "MISSOURI JACKSON" (1 ship-to, 1 customer, rate 8.225 = 4.225 base + 2.5 + 1.5 local). A genuine cross-state code, same shape as SC's `SC3622`/"South Dakota Vermillion" contamination — a real Missouri jurisdiction's tax body attached to a ship-to whose `ADDR.SASHST` reads `MS`.

None of these three should be compared as if they were MS-priced rows; they should be excluded from any future MS findings table with a visible count (3/270), the same way GA's and NV's cross-context outliers are handled.

## Real live A+ codes (2026-08-26, `readStateDetail("MS")`, active `ADDR`/`CUSMS` assignments)

| Tax body | Description | Active ship-tos | Current rate | Notes |
|---|---|---|---|---|
| `MS000` | Mississippi | 267 | 7.0 | Flat statewide code; matches MS's known no-local-option structure in shape only (no live cross-check yet) |
| `DR000` | DOMINICAN REPUBLIC | 1 | 0 | Cross-context — not Mississippi; exclude from MS findings |
| `HN000` | HONDURAS no tax | 1 | 0 | Cross-context — not Mississippi; exclude from MS findings |
| `MO031` | MISSOURI JACKSON | 1 | 8.225 | Cross-context — real Missouri jurisdiction code, not Mississippi; exclude from MS findings |

## Open questions / do instead if building

- **Needs a human decision / follow-up data pull:** whether any of the 267 `MS000` ship-tos are physically located inside Jackson or Tupelo city limits — if any are, the flat 7% comparison would need a narrow named-city override (not full GA-style boundary matching) to avoid an apples-to-oranges "confirmed match" that's actually missing a real local add-on. This investigation's aggregate, privacy-preserving query can't answer it; a targeted, still-read-only city/ZIP check would be needed first.
- **Before building:** find or build a real MS official-source adapter — today MS is Layer 1 `research-needed`, source is `dor.ms.gov`'s HTML rates page (per `docs/roadmap-50-states.md`), not yet wired into `server/aplus-connector.mjs` or `scripts/fetch-official-rates.mjs`. The Jackson/Tupelo levies reportedly live on separate standalone DOR pages, not the main table — the adapter will need to fetch and parse those pages too, not just the main 7% rate, or the comparability gap above stays permanently invisible.
- **Before building:** decide how to handle the 3 cross-context ship-tos (`DR000`, `MO031`, `HN000`) — exclude from MS findings with a visible count, same treatment as GA's and NV's cross-context outliers. Confirm whether `DR000` recurring in both NV's and MS's data (and possibly others) warrants a single, shared exclusion list rather than rediscovering it per state.
- **Open reconciliation caveat:** the 4 tax bodies returned sum exactly to the reported 270 active ship-tos, which is a good sign no DO-NOT-USE row is being silently dropped for MS — but this reconciliation only proves nothing is missing *from this specific query's own total*, not that MS's real customer base couldn't independently be larger than 270 (e.g. if there were additional retired/suspended ship-tos entirely outside the active-ship-to filter). Treat "no placeholder found" as what was checked, not an exhaustive audit.
- No `E`-suffixed equipment-tax-variant codes, no "police jurisdiction"-style third-tier split, and no `FETCH FIRST`/truncation concern — the entire real MS-side result set is a single row (`MS000`), too small for either pattern to apply.
