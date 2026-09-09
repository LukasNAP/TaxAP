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

## Assigned-ID comparison wired — September 8, 2026

`server/il-aplus.mjs` now compares exact eight-digit A+ location IDs with the existing official general-merchandise rates. A seven-digit ID is accepted only when exactly one full official ID has that prefix, counting address overrides as candidates too. The source snapshot now preserves all override IDs specifically to prevent a false unique match after excluding their rates.

Unknown codes, incorrect check digits, duplicate prefixes, address overrides, future-effective rows, missing definitions, retired codes and explicit category-specific descriptions remain unmatched. No city/county fallback or address inference is used. This monitors the configured general-merchandise location rate, not customer taxability or physical delivery jurisdiction.

Current official fetch: 1,343 jurisdiction-wide rates and 200 override IDs. All 1,343 eligible IDs passed synthetic full-ID comparisons with zero differences. Five new matcher tests cover full/truncated IDs, override collisions, unknown IDs, future rates and category/missing-definition exclusions. No current A+ aggregates were queried.

## Historical A+ evidence

An aggregate-only local A+ inventory on 2026-08-31 found 895 active Illinois ship-tos across 161 assigned tax-body groups. The common tax-body pattern appears to preserve IDOR location IDs after the `IL` prefix (for example, `IL02200023` corresponds to `022-0002-3`), but some codes omit the final check digit (`IL0160011` corresponds to `016-0011-7`) while others retain it (`IL01600125` corresponds to `016-0012-5`).

The current matcher uses the documented full-ID and unique-prefix conventions above; current A+ coverage still needs aggregate validation. Address-level matching remains unimplemented. If a later phase requires ship-to addresses, obtain an explicit privacy and implementation decision for the address-level source first.

Never send a customer, ship-to, or address row to the browser. Never write to A+.
