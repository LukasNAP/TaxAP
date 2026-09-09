# Nevada — official-rate adapter status

## What is connected

TaxAP reads Nevada's current effective-dated Streamlined Sales Tax rate file and retains the Nevada Department of Taxation's guidance as the human-readable authority.

- Minimum statewide sales/use-tax rate: 6.85%.
- Live validation on 2026-09-02: 27 active records — one source state row, all 17 county/equivalent totals, and nine special-jurisdiction totals.
- Nevada's file is not shaped like the other SST component files: its state row is 0%, while county and special rows contain complete combined rates. The adapter independently verifies that convention, replaces the display state rate with 6.85%, preserves each published total, and derives a local component only as `published total - 6.85%`.
- The adapter fails closed if the source state row changes from 0%, a combined total falls below 6.85%, the county/equivalent count changes from 17, or an unexpected jurisdiction type appears.

The official Nevada guidance says the base rate is 6.85%, local jurisdictions may add tax, and the applicable rate varies by county. The current official totals range from 6.85% to 8.375%.

## A+ matching: county comparison wired September 8, 2026

`server/nv-aplus.mjs` now compares explicitly county-labelled Nevada tax bodies with the existing SST adapter's complete county totals. The matcher requires all 17 unique county equivalents, rejects missing/invalid official totals, and never interprets internal A+ numbers as FIPS. `NV000`, retired descriptions, unknown places, and special-district descriptions remain unmatched; cross-jurisdiction assignments remain separate. The response also lists official counties absent from the matched active footprint. This validates the assigned county code's rate, not the ship-to's physical location.

Current official NV and RI source fetches succeeded on September 8. Nevada returned 17 county equivalents and nine special rows; the latter are not used as county aliases. Independent authority: https://tax.nv.gov/wp-content/uploads/2024/03/Basic-Training-New-1.pdf. Synthetic aggregate tests cover differences, Carson City, duplicate/missing counties, invalid totals, fallback codes, cross-state assignments, and source failures. No live A+ query was run for this implementation; actual current matching coverage still needs aggregate validation.

A read-only aggregate A+ inventory on 2026-09-02 found 273 active Nevada ship-tos across 14 assignment groups. Eleven configured `NVxxx` codes are county-labelled and their rates align with the reviewed official county totals. `NV000` has no configured definition and covers eight ship-tos. Three additional ship-tos use tax bodies labelled for another jurisdiction and remain visibly separate.

The A+ Nevada identifiers are internal ordinal codes, not county FIPS codes, so TaxAP does not join them by number. No customer/address records may reach the browser, and TaxAP must never write to A+.
