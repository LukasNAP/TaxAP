# Mississippi — official-rate adapter status

## What is connected

TaxAP reads three current Mississippi Department of Revenue pages and validates the general-merchandise layers that can affect ordinary tangible-property retail sales:

- 7% statewide general tangible-personal-property rate.
- Jackson's additional 1% levy on tangible personal property and services otherwise taxed at 7% or more, currently scheduled through June 30, 2035.
- Tupelo's additional 0.25% levy on retail sales and services subject to the general rate.

The normalized general totals are therefore 7% outside those cities, 8% in Jackson, and 7.25% in Tupelo. Other tourism/economic-development levies generally target lodging, prepared food, restaurants, or similar categories and remain outside TaxAP's general-merchandise comparison.

## A+ validation

The supervised read-only aggregate A+ refresh on 2026-09-03 found 271 active Mississippi ship-tos and 124 active customer assignments across four tax-body groups:

- `MS000` at 7% covers 268 ship-tos and matches the official statewide base rate.
- `DR000` (Dominican Republic), `HN000` (Honduras no tax), and `MO031` (Missouri Jackson) each cover one Mississippi ship-to. They are cross-jurisdiction assignments and are not compared as Mississippi rates.

No Mississippi-specific Jackson or Tupelo tax body appeared in the active aggregate inventory. That does not prove the local levies are missing: TaxAP has not exposed or matched Mississippi street/city data in this audit. It does mean the current 7% `MS000` match is only a statewide-base result, not proof that every Jackson or Tupelo delivery carries its required local layer.

## Remaining decision and engineering work

Confirm the three cross-jurisdiction assignments. Then use an approved address/city-boundary method to determine whether any active delivery lies within Jackson or Tupelo and whether its A+ assignment includes the applicable local levy. TaxAP remains read-only and made no A+ changes.
