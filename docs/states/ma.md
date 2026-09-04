# Massachusetts — official-rate adapter status

## What is connected

TaxAP reads the Massachusetts Department of Revenue sales-and-use-tax guide, currently marked updated May 7, 2026. It validates that both the general sales tax and use tax on tangible personal property are 6.25%, and fails closed if either rate or the page's update-date evidence disappears.

Local-option taxes on meals, marijuana, lodging, and other category-specific charges remain outside this general tangible-property comparison.

## A+ validation

The read-only aggregate A+ refresh on 2026-09-03 found 344 active Massachusetts ship-tos and 123 active customer assignments across two tax-body groups:

- `MA000` at 6.25% covers 343 ship-tos and exactly matches the current official general rate.
- One ship-to uses Nevada tax body `NV002` at 8.38%. It is kept visible as a cross-state assignment and is not compared as though it were a Massachusetts rate.

No address or county/city boundary matcher is required for the statewide general rate. TaxAP remains read-only; no A+ record was changed.
