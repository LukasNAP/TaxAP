# New Jersey — findings

Status: **official-source adapter built** (`server/nj-rates.mjs`, `tests/nj-rates.test.mjs`, 12/12 passing). Not yet wired into `server/official-source-registry.mjs` or `app/page.tsx` — that's a separate step reserved for a human per this build's scope limits.

## Official source

NJ Division of Taxation, confirmed live 2026-08-26 (not the stale 2018 Streamlined Sales Tax file — per explicit prior decision, SST is not used for NJ):
- https://www.nj.gov/treasury/taxation/su_10.shtml — "6.625% on purchases made in 2018 and after."
- https://www.nj.gov/treasury/taxation/ratechange/su-salestax.shtml — confirms the 6.875% → 6.625% step effective 2018-01-01, no rate change since.
- No page found describing any county/municipal local-option sales tax anywhere in NJ.

**Current statewide rate: 6.625%, flat, no local-option layer.** This is the simplest structure seen in the rollout so far — one number for the entire state, same shape as CT/ME/MA.

## Address matching

**Not needed.** Confirmed two independent ways:

1. Live `XATXBD` pull (`WHERE TBTXBOD LIKE 'NJ%'`, no exclusion filter needed — see below) returns **exactly one row**: `NJ000` / "New Jersey" / `TBCBSRT 6.625` / `TBCLRT1-4 = 0` / `TBCRATE 6.625`.
2. Real ship-to assignments (`SASHST = 'NJ'`, active only) show **599 ship-tos / 217 customers all on `NJ000`**, plus exactly one outlier: 1 ship-to/1 customer on `GA060` — a physically-NJ-tagged ship-to actually taxed in Georgia (the same "border customer taxed in a neighboring state" pattern already documented for NC, not a bug, not investigated further here).

There is no per-county or per-city A+ tax-body granularity to match into, and NJ's own tax law doesn't have one either (no local option tax) — so there's nothing for address matching to resolve even in principle. This is an even simpler case than NC (which at least has 100 real county codes); NJ has one code for the whole state.

## Data quality / contamination check

- **No `DO NOT USE` rows.** Query B (unfiltered `LIKE 'NJ%'`, no exclusion at all) returns the same single `NJ000` row as the filtered query — there's nothing to exclude.
- **No wrong-state contamination found under the `NJ%` prefix** (only one row exists, and it's genuinely New Jersey).
- **Checked for a hidden UEZ-specific tax-body code under a different prefix** — searched `TBTXNAM LIKE '%JERSEY%' OR '%UEZ%' OR '%ENTERPRISE ZONE%'` with no prefix restriction at all. Found only two rows: `NJ000` itself and an unrelated `IL04200012` ("ILLINOIS JERSEYVILLE", a real Illinois city — correctly not a New Jersey match, just a same-word coincidence). **A+ has no UEZ-specific tax-body code anywhere.**
- **No scheduled rate change**: `TBNRATE = 0`, `TBTXDAT` = the `0001-01-01` "never set" sentinel (per the confirmed finding in `docs/aplus-data-findings.md`) on `NJ000`.

## Rate comparability (Step 2)

**Yes — directly comparable, confirmed live.** `TBCBSRT = 6.625`, all four `TBCLRT` local components are `0`, and `TBCRATE = 6.625` — exactly equal to NJ's current published statewide rate. No surcharge, no district layer, no Ohio-style "is this the same total" ambiguity: there's only one number on either side to compare, and they match exactly.

## Open question: Urban Enterprise Zone (UEZ) / Salem County reduced rate — noted, not a blocker

NJ has a real reduced-rate program: certified UEZ businesses (and certain Salem County retailers) may charge **3.3125%** (exactly half the standard rate) on qualifying **in-person retail** sales made **by a certified business holding a UZ-2 certificate**. Confirmed via:
- https://www.nj.gov/treasury/taxation/businesses/salestax/uez-over.shtml
- https://www.nj.gov/treasury/taxation/ratechange/su-urban.shtml

Key point: **this reduced rate is a seller-certification property, not a ship-to/jurisdiction property.** It depends on whether the *seller* (Atlantic) holds a UZ-2 certificate for a specific location, not on where the customer's ship-to address is. It explicitly excludes mail-order/catalog/internet sales and motor vehicles/prepared food. A+ has no UEZ-specific tax-body code at all (confirmed above), which is consistent with either (a) Atlantic is not a UEZ-certified seller and the reduced rate never applies to its sales, or (b) it applies and is simply not modeled in A+ today. **This wasn't resolved — it's a known caveat, not a guessed answer.** Do not assume 3.3125% applies to any NJ ship-to without confirming Atlantic's own UEZ-seller certification status first; that's a business fact this investigation can't determine from A+/DWStage data alone.

## What was built

`server/nj-rates.mjs` (`readOfficialNjRates`) reads NJ's current flat statewide rate directly from the NJ Division of Taxation — **not** a table, since NJ publishes no machine-readable rate file (SST's NJ file is 8+ years stale, per the explicit prior decision not to use it). Instead it cross-validates two independently-worded nj.gov pages against each other before trusting either:

- `https://www.nj.gov/treasury/taxation/su_10.shtml` — the Sales/Use Tax FAQ page, parsed for the "`X% on purchases made in YYYY and after`" sentence (both the Sales Tax and Use Tax statements use this phrasing, since NJ defines Use Tax as identical to Sales Tax; the parser requires them to agree if both are found).
- `https://www.nj.gov/treasury/taxation/ratechange/su-salestax.shtml` — the rate-change history page, parsed for the most recent "`rate decreased from X% to Y% effective <date>`" transition.

`readOfficialNjRates` throws (never silently guesses or picks one side) if either page's expected sentence pattern isn't found, if the two pages disagree on the current rate or its effective date, if a page comes back suspiciously small (likely a changed page shell), or if a parsed rate falls outside a plausible 4–10% sanity band. The snapshot it returns follows the same shape as the other connected adapters (`stateCode`, `source`, `rates: [...]`, `counts`, `boundaryStatus`) plus one addition: a `caveats` array carrying `NJ_UEZ_CAVEAT` verbatim, so the UEZ/Salem County open question below isn't dropped on the floor by anything consuming this snapshot later.

This is only the official-source half (Step 3/4's "official rate" side). It does not query `XATXBD` — mapping the single `NJ000` A+ tax body to this snapshot's single `NJ` rate row is a trivial direct-equality join (unlike NC's 100-row synthesized mapping), but still needs to be wired into `server/aplus-connector.mjs`/`app/page.tsx` by a human, along with excluding the one `GA060`-tagged NJ ship-to from the comparison set the same way NC's cross-state ship-tos are separated out (`describesOtherJurisdiction()` pattern in `app/tax-body-policy.ts`) rather than silently merging or dropping it.

Unit tests (`tests/nj-rates.test.mjs`, fixture-based, no live network) cover: correct extraction of rate/year and rate/effective-date; both pages agreeing; the FAQ page's own two statements agreeing; rejection of a missing/unrecognized rate statement, a missing/unrecognized transition sentence, an unrecognized date format, a zero-change transition, an implausible rate, a non-OK HTTP response, and the two pages disagreeing with each other; and the full snapshot shape including `caveats`.

## Do instead (if extending this work)

- Get an explicit answer (from Lukas/Ana, not guessed) on whether Atlantic holds any UEZ/Salem-County seller certification before wiring this adapter's output into any user-facing comparison — if yes, this becomes a real exception case the dashboard needs to represent (some NJ ship-tos legitimately taxed at 3.3125% rather than 6.625%, and A+ would need to be checked again for how/whether that's tracked); if no, the flat 6.625% comparison is safe as-is and `NJ_UEZ_CAVEAT` can stay as documentation-only metadata.
- When wiring into `official-source-registry.mjs`, use an adapter type consistent with MD's `state-flat-rate` precedent (MD is the closest existing analog: also a single statewide rate with no local-option tax) rather than inventing a new category — though note MD's adapter is a hardcoded constant with no live fetch at all (its only real page is a JS-rendered SPA), while NJ's two pages are real static HTML and are live-fetched and cross-validated here.
- If nj.gov ever reword these two pages, `readOfficialNjRates` will throw rather than silently drifting — treat that as a prompt to re-check the current wording and update the regexes in `server/nj-rates.mjs`, not to loosen the pattern to "whatever matches."
