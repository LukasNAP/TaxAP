# TN — findings

## Implemented comparison — September 8, 2026

`server/tn-aplus.mjs` now reads distinct jurisdiction attributes from the [official lookup service](https://tnmap.tn.gov/arcgis/rest/services/COMMUNITY/SST/MapServer/4), linked by the state's [public lookup application](https://tnmap.tn.gov/sst/sst.html). It requests only SITUS, jurisdiction identifiers, county, general rates and surcharge fields; no addresses or customer information. The service returns 474 distinct records; 411 have resolvable county or ordinary-city identities through the current SST inventory. The reader validates all 95 counties, transfer completeness, general interstate/intrastate agreement and matching effective SST base components, then includes the explicit transit surcharge.

Exact A+ SITUS and name must agree. Duplicate code records, unresolved special jurisdictions, missing definitions, abbreviations and inconsistent names remain unmatched. The source's postal city field is deliberately not used as a municipality identity. The plain Nashville description remains unmatched against the longer Census metropolitan-government name; no alias was inferred. This does not establish delivery-address boundaries or transaction-specific tax treatment.

Current local Windows-authenticated A+ aggregate: 938 assignments, 608 compared across 79 groups, three differences, 328 unmatched, two cross-state. Build, lint and all 215 tests passed. Registered in batch findings and state drawer. No SQL changes or A+ writes. The following source-audit narrative records the preceding investigation; its municipality-source blocker was resolved by the jurisdiction service above.

## Current source audit — September 8, 2026

**Do not implement comparisons from the historical Nashville/Davidson findings below.** Tennessee DOR's current local-rate map states that a 0.5% Davidson transit surcharge began February 1, 2025, raising the effective local rate to 2.75%. The public map's CSV independently returns Davidson (Situs 1900, FIPS 037) at 0.0275, with surcharge effective date February 1, 2025. With the published general state rate, this is 9.75%, not the 9.25% used in the older mismatch table. This invalidates that table's 66-assignment Davidson/Nashville mismatch claim as a current implementation basis; no fresh A+ comparison was performed in this audit.

The existing SST adapter currently resolves `TNR2026Q4AUG21.csv`. Its date-filtered Davidson/Nashville records still expose 2.25% components, with Nashville's record ending October 31, 2026. These component records alone do not prove the full applicable local total. Do not simply add 7% to all TN city/county rows or stack every unnamed special record.

The official embedded map is a Tableau view. Its unauthenticated CSV export was verified HTTP 200 with `text/csv`, 95 county records, county names, SITUS identifiers, FIPS identifiers, effective dates and local totals. It does **not** include the tooltip municipality inventory in this export. This is a useful county crosswalk, not statewide city comparison completion. The next implementation step is to retrieve/validate the municipality and multiple-county detail and complete surcharge handling before registering the TN reader. Preserve this unresolved scope rather than manufacturing a county fallback for city assignments.

Sources:
- [DOR local rate map and surcharge notice](https://www.tn.gov/revenue/taxes/sales-and-use-tax/local-sales-tax/local-sales-tax-rates-map.html)
- [Official map county CSV](https://data.tn.gov/t/Public/views/SalesTaxRate/LocalSalesTaxRate.csv?:showVizHome=no)
- [DOR state and local rate scope](https://www.tn.gov/content/tn/revenue/taxes/sales-and-use-tax/due-dates-and-tax-rates.html)

## Historical investigation (corrections above take precedence)

Status: **Layer 2 investigated for the first time 2026-08-26** (Layer 1/official source was already `connected` before this — a direct Streamlined Sales Tax drop-in per `docs/roadmap-50-states.md` — but nobody had checked A+'s actual `XATXBD` tax-body setup against it until now). A+ matching is **not built**. Findings: TN needs real address-level (incorporated-city-vs-unincorporated-county) matching, similar in shape to SC — confirmed by two clean live examples, not assumed from OH/SST-connected status. **7 confirmed live rate mismatches found** covering 85 of 929 active ship-tos (~9.1%), plus 1 ambiguous case and a large DO-NOT-USE-shaped placeholder (`TN000`, 19.7% of active ship-tos). Do not compare or build without human decisions on both.

Live A+ (`XATXBD` + active `ADDR`/`CUSMS` ship-to assignments) checked 2026-08-26 via `scripts/investigate-state.mjs TN`, cross-checked against the current Streamlined rate file (`TNR2026Q3JUN11.csv`) via `scripts/fetch-official-rates.mjs TN`. Census/general-knowledge confirms **95 counties** for Tennessee — the official file's 95 county rows match this exactly.

## Address matching

**Needed — TN is SC-shaped, not NC-shaped, despite being an SST-connected state like OH.** A+ has 112 real TN-prefixed tax-body codes (115 total minus `TN000`, `GA060`, `DR000`) covering a mix of bare-county codes (e.g. `TN7900` "Shelby Co.") and city-specific codes (e.g. `TN7901` "Memphis") for the *same* county. Two live, unambiguous, currently-in-effect examples confirm real jurisdictions vary **within** a single county in a way a county-only lookup cannot resolve:

- **Memphis vs. the rest of Shelby County**: `TN7901` (Memphis, 138 active ship-tos) = 9.75% official; `TN7900` (Shelby Co. bare, 20 ship-tos) = 9.25% official. A ship-to's exact position relative to Memphis city limits — not just its county or even its ZIP, since Memphis-area ZIPs are not clean city/unincorporated splits — determines a real 0.5pt difference.
- **Gallatin vs. the rest of Sumner County**: `TN8301` (Gallatin, 6 ship-tos) = 9.75% official; `TN8300` (Sumner Co. bare, 3 ship-tos) = 9.25% official. Same pattern.

This is the same "clean unincorporated-county vs. incorporated-municipality split" SC already established needs address matching, not a sub-ZIP special-district free-for-all like CO/KS — TN's split is at real, discoverable municipal boundaries, just not always identifiable from ZIP/county alone.

**One reassuring negative control:** Nashville-Davidson's several small enclave cities (Belle Meade, Berry Hill, Oak Hill, Forest Hills) all carry the *same* official local rate (2.25%) as Davidson County itself and as "Nashville-Davidson metropolitan government (balance)" — so despite Nashville being Tennessee's largest consolidated city-county government, there is currently **no** live rate variation to resolve inside Davidson County. The Davidson-related mismatch found below (see Rate comparability) is a stale-rate problem, not an address-matching problem.

**TN's own numbering has no discoverable synthesized convention** (unlike NC) — codes are sparse, customer-driven 3-6-digit numbers with a `TBTXNAM` free-text city/county description as the only reliable identifier, the same shape as AL/MO/CO/NE/UT. 315 of TN's real incorporated places carry their own distinct rate row in the official source; a substantial share of the remainder (confirmed for at least 9 codes here — Humboldt, Tullahoma, Bean Station, Portland, Russellville, McKenzie, Talbott, South Pittsburg, Roane Co.) have no separate official row at all and simply inherit their county's rate, which A+ gets right for all 9. No `E`-suffixed equipment-tax variant codes and no third-tier "police-jurisdiction"-style split were found in TN's code list.

**73 unnamed `"special"`-type jurisdiction rows exist in the official rate file** (e.g. "Special jurisdiction 90102") with no name field decoding what they are — the same shape as KS's undecoded alphanumeric "79" type. Not investigated further here; flagged as an open question for Step 3 if finer-than-city precision is ever pursued.

## Rate comparability

**No — 7 confirmed live mismatches, covering 85 of 929 active ship-tos (~9.1%), found by comparing every one of A+'s 112 real TN `currentRate` values against the matching jurisdiction's current `totalGeneralRate` in the live Streamlined file. 90 of the other 97 matched codes agree exactly** (0.0pt difference) — so the underlying comparison methodology (diff `TBCBSRT`+`TBCLRT1-4` sum against the SST file's current-dated row) is sound; these are real, isolated discrepancies, not a systemic parsing problem:

| Code(s) | Description | Ship-tos | A+ rate | Official rate | Diff | Notes |
|---|---|---|---|---|---|---|
| `TN1900` + `TN1901` | Davidson Co. / Nashville | 12 + 54 = 66 | 9.75% | 9.25% | **+0.50** | A+ too high on both the bare-county and city code; official Davidson County rate (and its enclave cities) has been 2.25% local since 1989 — no recent change to point to |
| `TN5400`, `TN5401`, `TN5404` | Riceville, Athens, Etowah (all McMinn Co.) | 2 + 2 + 2 = 6 | 9.0% | 9.75% | **−0.75** | Stale since McMinn County's local rate rose to 2.75% on 2020-05-01 (confirmed via exact official rows for Athens city and Etowah city); no bare McMinn-Co. code exists in A+ to have caught this |
| `TN9503` | Mount Juliet (Wilson Co.) | 5 | 9.25% | 9.75% | **−0.50** | Stale since Wilson County's rate rose to 2.75% on 2020-05-01; both the county row and Mount Juliet's own official city row agree at 9.75% |
| `TN8401` | Tipton Co. | 2 | 9.75% | 9.25% | **+0.50** | Exact-name county match both sides; no obvious recent-change explanation |
| `TN6003` | Spring Hill (Maury Co.) | 1 | 9.25% | 9.75% | **−0.50** | Stale since Maury County's rate rose to 2.75% on 2020-05-01; A+'s own bare `TN6000` "Maury Co." code is correctly at 9.75% — only this Spring Hill sub-code missed the update |
| `TN8204` | Kingsport (Sullivan-side) | 3 | 9.5% | 9.25% | **+0.25** | Kingsport has no separate official row (inherits county); explicitly labeled Sullivan-side in `TBTXNAM`, Sullivan Co.'s official rate is an exact-name match |
| `TN4601` | Mountain City | 2 | 8.5% | 9.0% | **−0.50** | Very recently stale — official Mountain City rate rose 2025-01-01, just over a year old |

**One additional case is ambiguous, not confirmed either way — needs a human decision, not a guess:** `TN6202` "Sweetwater (Monroe Co.)" (1 ship-to) is configured at 9.75%, which does **not** match Monroe County's official 9.25% (its Monroe-County siblings `TN6201` Madisonville and `TN6204` Vonore both correctly show 9.25%) — but Sweetwater, TN is real-world known to straddle both Monroe and McMinn counties, and McMinn County's official rate is exactly 9.75%. This could be a genuine stale/wrong code, or it could be a McMinn-side ship-to that's mislabeled "(Monroe Co.)" in `TBTXNAM` — can't be resolved without the actual street address, which this investigation doesn't touch per the no-address-identity rule.

No surcharge/layering question like OH's transit tax was found — A+'s `TBCBSRT + TBCLRT1-4` sums cleanly to `TBCRATE` on every TN row checked (`rateTotalValid: true` throughout), and TN's own tax law doesn't publish a separate transit-style add-on the way OH's counties do.

## Do-not-use and cross-context findings

**`TN000` — no defined rate at all, not even a "DO NOT USE"-labeled 0% row.** Used by **183 of 929 active TN ship-tos (19.7%)** — the single largest tax-body bucket in the state, larger than Memphis's 138. `readStateDetail` reports `description: null` and `definitionStatus: "missing"` for this code, meaning it could find no matching `XATXBD` definition row for `TN000` at all — a rawer form of "unconfigured" than AL000/MN000/UT000/etc., which are real 0%-rate rows explicitly tagged "DO NOT USE" in `TBTXNAM`. This is directly visible in `readStateDetail`'s output (not hidden by the standard retired-tax-body exclusion, since there's no "DO NOT USE" text to match on) — but it raises an open question the other direction: **is there a separate, actually-`TBTXNAM`-tagged "DO NOT USE" TN code that *was* filtered out and is invisible here?** Not resolved by this investigation; would need a raw, unfiltered `XATXBD` pull to confirm one way or the other, which is outside this investigation's read-only script access.

**2 of 929 active TN ship-tos carry a non-Tennessee tax body** (`GA060` "Georgia Fulton" ×1, `DR000` "Dominican Republic" ×1) — the already-documented `SASTXB` cross-context pattern, not new TN-specific contamination. Exclude both from TN-specific findings the same way GA's and NV's live runs exclude their own outliers. No wrong-state contamination was found *within* the `TN`-prefixed codes themselves — every `TBTXNAM` value naming a place names a real Tennessee city or county (allowing for cosmetic typos like "Tennesse Roane Co." and "Tennnesee Sumner Co.").

## Open questions / do instead if building

- **Before building:** get a human decision on `TN000` (183/929 ship-tos, 19.7%) — what governs tax for these ship-tos in practice today, the same open question AL000/MN000/NE000/UT000/WA000 needed. This is large enough by itself to block a comparison.
- **Before building:** get a human decision on each of the 7 confirmed mismatches above (85 ship-tos, ~9.1%) — whether to refresh A+'s configured rate, and in which direction (3 of the 7 are A+-too-high, meaning customers may currently be overcharged; 4 are A+-too-low).
- **Before building:** resolve the `TN6202` Sweetwater ambiguity — determine (outside this tool, since it would require real address/geocoding) whether this ship-to is actually on the Monroe or McMinn side of the city.
- **Before building:** decide how to handle the 2 non-TN cross-context ship-tos (`GA060`, `DR000`) — exclude from TN findings with a visible count, same as GA's and NV's pattern.
- **If building the address-matching layer:** this needs a GA/SC-style boundary source capable of resolving incorporated-place limits, not just a county-to-rate table — check `docs/roadmap-50-states.md` for whether TN's Streamlined boundary file (parallel to `TNR2026Q3JUN11.csv`'s rate file) is machine-readable and covers place-level boundaries, since Step 3 wasn't run in this investigation (out of scope for this pass — this was a Step 1/Step 2 investigation only).
- **Open, not investigated:** the 73 unnamed `"special"`-type jurisdiction rows in the official rate file. Unclear what real-world TN tax concept they represent (special districts? something else?) or whether any active TN ship-to could plausibly fall inside one — flagged for a future pass, not resolved here.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level), for the same reason already established for NC/GA/NV — this investigation used `readStateDetail`, which already does this correctly.
