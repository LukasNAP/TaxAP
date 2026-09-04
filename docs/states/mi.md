# MI — findings

Status: **Simplest structure confirmed live (2026-08-26) and fully comparable, exact match — no address matching needed, no build blocked on any open question.** A+ has exactly one real Michigan tax body (`MI000`), and it carries the same 6% flat rate as the current official Michigan source, with no local-option layer on either side. Not yet wired into the dashboard as a connected adapter — the official source (`server/fetch-official-rates.mjs` → SST snapshot) and the A+ side (`readStateDetail`) were only run independently for this investigation, not joined into a reconciliation module the way NJ's is.

Live A+ (`XATXBD` + active `ADDR`/`CUSMS` ship-to assignments, via `scripts/investigate-state.mjs MI`) and the current Streamlined Sales Tax snapshot (via `scripts/fetch-official-rates.mjs MI`) were both checked 2026-08-26.

## Address matching

**Not needed — confirmed both by A+'s own structure and by Michigan's real tax law.** `readStateDetail("MI")` returns 7 distinct `SASTXB` values assigned to MI ship-tos, but only one of them is actually a Michigan tax body:

- `MI000` — description "Michigan", 459 of 466 active ship-tos (98.5%), 150 of 157 active customer assignments.

The other six codes are all real tax bodies from *other* jurisdictions, assigned to ship-tos whose `SASHST` happens to be `MI` — the same `SASTXB`/cross-context pattern already documented for NC/GA/NV (a ship-to physically tagged as one state can carry another state's or a foreign jurisdiction's tax body). None of these six is a Michigan code and none should be compared as if it were:

- `DR000` — "DOMINICAN REPUBLIC" (2 ship-tos)
- `NC024` — "North Carolina Columbus" (1 ship-to)
- `TN2404` — "TENNESSEE OAKLAND" (1 ship-to)
- `TX1421` — "Texas Midland" (1 ship-to)
- `WI067` — "Wisconsin Waukesha Co." (1 ship-to)
- `ZTEMP` — "TAX BODY TEMP USE" (1 ship-to) — not a `DO NOT USE`-worded code (so it isn't caught by `isRetiredTaxBody`'s pattern) and not a real jurisdiction of any state; looks like a generic temporary/placeholder tax body, not MI-specific.

459 + 2 + 1 + 1 + 1 + 1 + 1 = 466, which reconciles exactly against `readStateDetail`'s reported `activeShipTos` total — no unaccounted gap.

There is exactly **one** real Michigan jurisdiction to match into because Michigan's own sales tax law has no county, city, or special-district local-option layer at all — a single flat 6% state rate applies everywhere. This isn't a case of A+ having sparse coverage of a larger real structure (the way CO/MO/UT do); Michigan genuinely has nothing finer than the state level to code into, so one A+ code covering the whole state is complete, correct coverage, not a simplification. Confirmed independently by the official source (see below): 0 counties, 0 cities, 0 special jurisdictions in the current SST rate file.

## Rate comparability

**Yes — confirmed live, exact match, no surcharge or layering found.** `MI000`'s `TBCBSRT` (baseRate) is `6`, all four `TBCLRT` local-rate slots are `0`, and `TBCRATE` (currentRate) is `6` — internally consistent (`rateTotalValid: true`). The current Streamlined Sales Tax snapshot for Michigan reports `componentRate: 6` / `totalGeneralRate: 6` / `generalInterstateRate: 6` for the single state-level row (FIPS `26`), with 0 county/city/special rows returned — corroborating that there is nothing else to layer in. A+'s 6% and the official 6% are measuring the exact same thing on both sides.

- No scheduled rate change queued: `nextRate: 0`, `nextEffectiveDate: "0001-01-01"` (the confirmed "never set" sentinel per `docs/aplus-data-findings.md`), consistent with the official source's own rate history — the SST file's single rate row has been in effect since `1994-01-01` with no end date, i.e. Michigan's 6% rate has been unchanged for over three decades.
- The SST machine-readable file itself is dated `MIR2023Q1DEC22.csv` (last regenerated 2023Q1), which would normally be a staleness flag to check — but since the underlying rate hasn't moved since 1994, file vintage doesn't matter here the way it might for a state with frequent local-rate changes.

## Do-not-use and cross-context findings

- **No `DO NOT USE`-style placeholder found for Michigan itself.** `MI000` is the real, correctly-rated Michigan code, not a stand-in the way `AL000`/`MN000`/`ND000`/`NE000`/`UT000`/`WA000` are for their states — its description is "Michigan," not "DO NOT USE," and it carries the correct 6% rate rather than a 0% placeholder rate.
- **`ZTEMP`** ("TAX BODY TEMP USE," 1 of 466 active ship-tos, 0.2%) is a generic-looking placeholder code, but it is not MI-specific, does not match the project's `DO NOT USE`-family retirement pattern, and covers too small a share to be a blocking finding at this volume. Worth knowing about if this code shows up again in another state's pull.
- **Open question, not resolved here**: `readStateDetail`'s retired-tax-body exclusion (`isRetiredTaxBody`, matching code patterns like `DNU`/`XXX` suffix or description text like "DO NOT USE"/"INACTIVE"/"OBSOLETE") is applied *before* the `activeShipTos` total is computed — the total is the sum of the rows actually shown, not an independent count of all active MI ship-tos. If a genuinely retired `MI`-prefixed tax body existed with real ship-tos still assigned to it, both the code and its ship-to count would be silently absent from this investigation's output, the same blind spot noted for other states. Nothing in this pull hints at that (459+7=466 reconciles cleanly, with no suspicious round-number gap the way AL000/MN000/UT000 showed), but it can't be ruled out from the vetted scripts alone — a raw, unfiltered `XATXBD LIKE 'MI%'` pull (outside this investigation's read-only tooling) would be the way to confirm there's nothing hiding behind the exclusion filter.

## Real live A+ codes (2026-08-26, active MI ship-to `SASTXB` values, unfiltered by state-of-code — 7 rows total)

| Code | Description | Current rate | Active ship-tos | Notes |
|---|---|---|---|---|
| `MI000` | Michigan | 6.0 | 459 | the only real MI code; matches official SST rate exactly |
| `DR000` | DOMINICAN REPUBLIC | 0 | 2 | cross-context, not Michigan — exclude from MI findings |
| `NC024` | North Carolina Columbus | 6.75 | 1 | cross-context, not Michigan — exclude from MI findings |
| `TN2404` | TENNESSEE OAKLAND | 9.75 | 1 | cross-context, not Michigan — exclude from MI findings |
| `TX1421` | Texas Midland | 8.0 | 1 | cross-context, not Michigan — exclude from MI findings |
| `WI067` | Wisconsin Waukesha Co. | 5.0 | 1 | cross-context, not Michigan — exclude from MI findings |
| `ZTEMP` | TAX BODY TEMP USE | 0 | 1 | generic placeholder, not MI-specific, not `DO NOT USE`-worded |

## Official source confirmed live (2026-08-26)

- **Rates:** Michigan via Streamlined Sales Tax, `https://www.streamlinedsalestax.org/ratesandboundry/Rates/MIR2023Q1DEC22.csv` — 1 row, state-level (FIPS `26`), `componentRate`/`totalGeneralRate`/`generalInterstateRate` all `6`, effective `1994-01-01`–`2999-12-31`. `counts.counties`/`counts.cities`/`counts.specialJurisdictions` all `0`. `boundaryStatus` text explicitly states: "No local-option sales tax exists in this state - a single flat statewide rate applies to every ship-to. No address or boundary matching is needed."

## Open questions / do instead if building

- Before wiring an adapter: confirm with a raw (non-vetted-script) query whether any retired `MI`-prefixed tax body carries live active ship-tos that `readStateDetail`'s automatic exclusion is hiding from this investigation's totals — low suspicion given the clean 466-ship-to reconciliation, but not independently verified.
- Exclude the 7 cross-context codes (`DR000`, `NC024`, `TN2404`, `TX1421`, `WI067`, `ZTEMP`) from any MI-specific comparison with a visible count, the same way GA's and NV's live runs exclude their own cross-context outliers — do not compare them against Michigan's rate.
- If building a connector adapter, this is the same shape as NJ (`server/nj-rates.mjs`/`server/nj-aplus.mjs`) or MD's `state-flat-rate` precedent: single statewide rate, no per-jurisdiction join needed. Unlike NJ, Michigan's rate genuinely is covered by the existing Streamlined Sales Tax pipeline (`server/sst-rates.mjs`), so this may be closer to NV's "zero-code-change, `GENERIC_SST_STATES` entry" shape than to NJ's custom two-page-scrape adapter — worth checking whether `server/sst-rates.mjs`'s existing state list already handles MI before writing anything new.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level), for the same reason already established for NC/GA/NV.
