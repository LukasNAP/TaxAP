# Idaho — official-rate adapter status

## What is connected

TaxAP reads two current Idaho State Tax Commission pages. It validates that both the state sales-tax rate and use-tax rate are 6%. It also validates the Commission's complete current list of 23 resort cities that impose some form of separately administered local-option sales tax.

The Tax Commission does not publish those city rates or product scopes centrally; it directs taxpayers to contact each city. TaxAP therefore exposes the authoritative 6% state rate and the 23-city source limitation, but never invents local totals. This is a connected statewide source with an explicit local-data gap, not a claim of complete address-level Idaho coverage.

## A+ validation

The supervised read-only aggregate A+ refresh on 2026-09-03 found 98 active Idaho ship-tos and 77 active customer assignments across 20 tax-body groups:

- Seventeen configured Idaho groups at 6% cover 85 ship-tos and match the statewide official rate.
- Undefined `ID000` covers 12 ship-tos and cannot be treated as a verified rate.
- One Idaho ship-to uses Minnesota tax body `MN430` at 7.525%; it is cross-jurisdiction and excluded from Idaho comparison.

No conclusion was made about whether any address is inside one of the 23 resort cities or whether a city's local tax applies to Atlantic's general merchandise. That requires approved address-boundary work plus authoritative rates/scopes obtained from the individual cities.

## Remaining decision and engineering work

Confirm what `ID000` means and whether the `MN430` assignment is intentional. Decide whether TaxAP should contact and maintain evidence from all 23 cities or only cities containing active Atlantic ship-tos. TaxAP remains read-only and made no A+ changes.
