# CT — findings

Status: **Cleanest structural case investigated so far, but not yet buildable — no official-source adapter exists.** Live `XATXBD` pull (2026-08-26) shows exactly one active CT tax body, `CT000` ("Connecticut"), covering 100% of active CT ship-tos at a flat 6.35% rate — no address matching needed, and none would ever be useful, because Connecticut's own tax law has zero county- or municipal-level sales tax variation. A+'s configured rate numerically matches the flat rate the DRS source page states, but per this project's rule that can't be called "confirmed" until a real adapter runs a live cross-check — Layer 1 status for CT is still "real source found, not machine-readable" (HTML text), not "connected."

## Address matching

`readStateDetail("CT")` (live, 2026-08-26) returned exactly **1** tax body:

- `CT000` — "Connecticut" — covers all **181** active CT ship-tos and all **75** active CT customer assignments returned by the query. No other CT-prefixed code appeared. No cross-state contamination: `buildStateTaxBodyQuery` groups by each ship-to's own `SASTXB` filtered on `SASHST = 'CT'`, and every one of the 181 rows grouped into the single `CT000` bucket — unlike GA (NC060/NC041/SC126/CA1163/PA000 outliers) or NV (DR000/NCPRST), no non-CT tax body showed up attached to a CT ship-to.

**Connecticut has no county or municipal general sales tax at all** — Connecticut abolished county government in 1960 and has never enacted a local-option sales tax; the DRS confirms a single statewide 6.35% sales-and-use tax rate (aside from narrow, non-geographic product-category variations — see Rate comparability below). Given that real-world structure, one A+ code covering the entire state is not a sparse subset the way AL's ~124 codes (vs. ~366 real localities) or CO's 57 codes are — it is complete, correct coverage, because there is no finer real jurisdiction level that could have been missed. This is the same shape as NJ's `NJ000` and HI's `HI000` (a single statewide code verified against a real absence of local jurisdictions), not NC-style (many codes, 1:1) or GA-style (address/boundary matching required).

**Conclusion: no address matching needed, and none would ever be needed** — there is no finer real jurisdiction to match into.

## Rate comparability

A+'s `CT000` definition: base rate `6.35`, all four local-rate components `0`, current total rate `6.35`, `TBNRATE` (next scheduled rate) `0` — no pending change queued.

The DRS source page (per this project's Layer 1 research, `portal.ct.gov` DRS) states Connecticut's sales-and-use tax is a flat 6.35% statewide with zero geographic variation, so A+'s `6.35` figure numerically matches the publicly stated rate.

**That numeric match is not the same as a confirmed live cross-check, and per this task's instructions is reported as such: rate comparability is "not yet confirmable — no adapter exists."** `docs/roadmap-50-states.md` lists CT's Layer 1 status as a real source found but not machine-readable (HTML text), not "connected" — there is no `server/ct-rates.mjs`-equivalent, and no automated fetch of the current DRS page happened as part of this investigation. The visual agreement (6.35% both sides) is a strong, low-risk lead for whoever builds the adapter, not a substitute for actually running one.

**A separate, non-blocking Step 2 note:** DRS publishes several **product-category** rate variations layered on top of the general 6.35% rate — e.g. ~7.75% on certain luxury goods, ~9.35% on certain short-term motor-vehicle rentals/leases, 1% on certain computer/data-processing services. None of these are jurisdiction-based (they don't vary by ship-to address), so they do not create a Step-1-style address-matching problem or an Ohio-transit-surcharge-style "subset of jurisdictions" comparability gap — CT has no jurisdictions to subset. But they do mean any single "6.35%" ship-to-level comparison is implicitly a general-merchandise-only comparison, the same simplifying assumption already made for every other state, not a CT-specific gap. Worth naming explicitly in any CT adapter's documentation since CT's own source page foregrounds these categories prominently.

## Do-not-use and cross-context findings

- **No DO-NOT-USE-shaped placeholder code appeared in the returned `taxBodies` list**, and no sign of partial coverage: the single `CT000` code accounts for all 181 active ship-tos and 75 active customers the query returned — there is no leftover gap implying a second, hidden bucket.
- **No cross-state contamination observed** — every one of the 181 CT-ship-to rows (grouped by the ship-to's own `SASHST = 'CT'`) carried the `CT000` tax body; nothing to exclude.
- **Open question this investigation cannot resolve from `readStateDetail` alone (per the task's Step 5 guidance):** `readStateDetail`'s automatic retired-tax-body exclusion (`isRetiredTaxBody`) filters out any matching code — by code pattern (`DNU`, `DONOTUSE`, `INACTIVE`, `OBSOLETE`, trailing `XXX`) or by a "DO NOT USE"-style description — **before** summing `activeShipTos`. If a genuinely DO-NOT-USE-shaped CT tax body with real ship-tos existed, it would already have been silently dropped from the 181 total, and this report has no way to see that from the filtered output alone. Nothing in the returned data hints at a shortfall (no independent "true" CT ship-to count exists to compare 181 against), so this is flagged as an open question, not asserted either way — a human should spot-check with a raw, unfiltered `XATXBD LIKE 'CT%'` pull before treating 181 as certainly complete, following the same caution that surfaced AL000/MN000/ND000/NE000/UT000/WA000 in other states.

## Real live A+ codes (2026-08-26, `readStateDetail("CT")`, retired-code exclusion already applied)

| Code | Description | Base rate | Local rates (1–4) | Current total | Active ship-tos | Active customers | Notes |
|---|---|---|---|---|---|---|---|
| `CT000` | Connecticut | 6.35 | 0 / 0 / 0 / 0 | 6.35 | 181 | 75 | Only CT tax body found; flat statewide rate; `TBNRATE = 0` (no scheduled change); matches CT's real zero-local-tax legal structure — not a placeholder, this is the correct, complete configuration |

## Open questions / do instead if building

- **Before building:** have a human run a raw, unfiltered `XATXBD LIKE 'CT%'` pull (outside `readStateDetail`'s automatic exclusion) to confirm no DO-NOT-USE-shaped CT code with real ship-tos is being silently dropped from the 181 total — the project's recurring AL000/MN000/ND000/NE000/UT000/WA000 pattern means this can't be assumed absent just because the filtered result looks clean.
- **Build a CT official-source adapter before claiming rate comparability is confirmed.** Given CT has no per-jurisdiction table to maintain at all, the likely right call is to hardcode 6.35% the same way MD's flat no-local-tax rate was hardcoded, rather than build an HTML scraper against the DRS page for a single number — but that's a build-time decision, not asserted here as done.
- **If hardcoding or scraping, document the DRS category-based rate exceptions explicitly** (luxury goods, short-term vehicle rental, computer/data-processing services) as an intentional general-merchandise-only scope note, not a gap discovered later.
- **No blocking finding identified in this pass.** Modulo the placeholder spot-check above, CT looks like one of the cheapest states left to close — no address matching, no boundary file, no surcharge layering, a single flat rate that already numerically agrees with A+'s configured value.
