# Arizona — findings

Status: **investigated live 2026-08-26, not safe to build without a human call on 3 live discrepancies.** Official CSV source confirmed real and current (`TPT_RATETABLE_ALL_08012026.csv`, resolved from the azdor.gov landing page — the filename date changes monthly, always resolve from the page's link text, don't hardcode).

## Address matching

**No, for the GA-style ZIP/geocoding problem** — each A+ AZ tax-body code names one specific jurisdiction via `TBTXNAM` (city or county), like NC/SC's codes, not a raw address needing geocoding. But it's not as clean as NC/SC's pure 1:1 join either:
- `AZ203` ("ARIZONA MARICOPA PINAL CO") is a synthetic hybrid for a Maricopa/Pinal county-line-straddling area with no counterpart row in the official CSV at all.
- `AZ3518` ("Arizona Green Valley") names an unincorporated community AZDOR's rate table has no row for either.

A pure `TBTXNAM`-to-official-`RegionName` string join will genuinely fail to resolve (not silently mismatch) for a real minority of codes — someone has to decide how those get flagged ambiguous/excluded.

## Rate comparability — 3 live discrepancies found, human judgment needed

Arizona's tax is legally a Transaction Privilege Tax (TPT). The official CSV bakes state+county into the county row and lists city rows city-only; `TBCRATE` is meant to be the pre-summed state+county+city total. Verified against the live CSV (business code `017` "RETAIL") for ~10 jurisdictions with exact/near-exact matches (Phoenix, Chandler, Tucson, Flagstaff, Eloy, Yuma, San Luis, Nogales, Safford, Oro Valley, plus pure county-only codes for Santa Cruz/La Paz) — **this confirms the methodology is sound and `TBCRATE` is the one field to diff.** `TBCLRT1`/`TBCLRT2` do **not** have fixed county/city semantics — which slot holds which component varies row to row, and Oro Valley even folds the county piece into `TBCBSRT` itself. Never interpret the sub-rate columns positionally.

Three real, live problems found that need a human call, not a guess:
1. **`AZ101` Douglas is stale** — its `TBCRATE` (9.9%) reflects Cochise County's *old* rate; the real Cochise rate rose to 6.6%... (the delta) effective 7/1/2026, already in effect as of the investigation date (2026-08-26), with no `TBNRATE`/`TBTXDAT` scheduled update queued. This is live drift, not a pending change.
2. **`AZ017` Casa Grande appears to be missing its Pinal County component** (1.1%) entirely — TBCRATE (7.6%) = state 5.6 + city 2.0 only. Confirmed suspicious because `AZ1001` Eloy, also Pinal County, correctly includes the identical 1.1% county piece.
3. **`AZ4052` "Arizona Taylor Navajo Co" totals to exactly Navajo County's county-only rate** (6.43%) with no trace of the Town of Taylor's real 3% city rate, despite the tax-body's own name claiming to represent Taylor. If a ship-to is actually inside Taylor town limits, this code would undercharge by a full 3 points.

Roughly 1 in 8–9 codes checked had *some* issue — high enough that a blind name-matching adapter is not safe to ship without exclusion/ambiguous-flagging logic. These three look like genuine A+ misconfigurations, but could also reflect an AZ-specific carve-out/exemption not yet understood — flag to Ana/Liv rather than guess.

## Exclusions found

No wrong-state contamination (every `TBTXNAM` says "Arizona"/"ARIZONA"). Real DO NOT USE rows: `AZ0300`, `AZ4500`. Also non-jurisdiction, must exclude: `AZ000` ("Arizona no tax", a 0% exemption code), `AZ6.3 CR` and `AZ8.6CR` ("Arizona Credits" — flat rate codes, no county/city components, presumably resale/use-tax credit bodies), `AZ628T` ("Arizona Phoenix TIERED RT" — a business-classification/threshold variant of Phoenix's rate, the same category as CA/AL's E-suffix equipment-tax pattern, just a different naming convention).

That leaves 35 plausible real jurisdiction codes out of 41 total raw rows (unfiltered, not truncated — confirmed via a non-round row count).

## Coverage and classification caveats

A+ only has 39 usable AZ codes configured — far short of AZ's ~15 counties + ~91 incorporated cities. This is expected (A+ only configures jurisdictions where Atlantic has ship-tos), but the ~10-jurisdiction spot check above is a small sample of the 35 real codes; most remain unverified.

The CSV is one row per (RegionCode, BusinessCode) pair. Business code `017` (RETAIL) was used throughout since it validated cleanly everywhere checked, but **nobody has confirmed `017` is the right default classification for Atlantic's actual products** — a packaging distributor could plausibly fall under a different AZDOR classification. Confirm before treating `017` as a standing default.

## Do instead

- Never interpret `TBCLRT1`/`TBCLRT2` positionally — diff `TBCRATE` only.
- Confirm business code `017` is actually right for Atlantic's product mix before using it as a default.
- Get a human call on the Douglas/Cochise, Casa Grande, and Taylor discrepancies before deciding whether they're bugs to surface or carve-outs to explain away.
- Resolve `AZ203` and Green Valley's "no official counterpart" gap explicitly (ambiguous/excluded), don't drop them silently.
