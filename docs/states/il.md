# Illinois — official-rate adapter status

## What is connected

`server/il-rates.mjs` reads Illinois Department of Revenue's current fixed-width county/municipality file and exposes the current **Receipts General Merchandise High-Rate** for locations where IDOR says the jurisdiction-wide rate applies.

- Source: [IDOR machine-readable sales-tax files](https://tax.illinois.gov/research/taxrates/sales-tax-rate-machine-readable-files.html).
- Live validation on 2026-08-31: 1,343 comparable jurisdiction-wide rates, across all 102 Illinois counties.
- State component: 6.25%.
- The file's one duplicate `100-0001-1` record is only accepted when the location, county, override status, and rate agree; the newer effective date wins. Any conflicting duplicate fails closed.

## Deliberate limits

Illinois now uses destination-based Retailers' Occupation Tax for applicable shipped goods. IDOR's address-specific file is the authority when a location carries an address override, but that archive is roughly 2 GB compressed / 9 GB expanded. This adapter does **not** download or process it yet.

The current source contains 200 address-override locations. IDOR sets their jurisdiction-wide merchandise rate to zero and says the address-level file must be used. TaxAP excludes them rather than turning zero, a city total, or a county total into a guessed rate.

## A+ matching: not built

An aggregate-only local A+ inventory on 2026-08-31 found 895 active Illinois ship-tos across 161 assigned tax-body groups. The common tax-body pattern appears to preserve IDOR location IDs after the `IL` prefix (for example, `IL02200023` corresponds to `022-0002-3`), but some codes omit the final check digit (`IL0160011` corresponds to `016-0011-7`) while others retain it (`IL01600125` corresponds to `016-0012-5`).

No A+ tax-body-to-Illinois-location comparison has been added yet. A future matcher may accept only a unique exact full-ID or unique seven-digit-prefix match; it must report conflicts, address overrides, `IL000`, misspelled/legacy codes, and cross-state assignments as aggregate exclusions. It must not attempt address matching or use a plausible city/county fallback. If a later phase requires ship-to addresses, obtain an explicit privacy and implementation decision for the address-level source first.

Never send a customer, ship-to, or address row to the browser. Never write to A+.
