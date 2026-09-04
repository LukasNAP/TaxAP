# Maine — official-rate adapter status

## What is connected

TaxAP reads Maine Revenue Services' current rate table and validates the column effective January 1, 2026. Both the general sales rate and use-tax rate are 5.5%. The adapter fails closed if the current effective-date column disappears, either general rate changes, or the two rates stop agreeing.

Prepared food, lodging, short-term vehicle rental, adult-use cannabis, medical cannabis, and other special categories remain outside this general-merchandise comparison.

## A+ validation

The read-only aggregate A+ refresh on 2026-09-02 found 76 active Maine ship-tos and 31 active customer assignments. Every ship-to uses the single `ME000` tax body, labelled `Maine`, at 5.50%. That exactly matches the current official general sales and use-tax rate. Maine Revenue Services publishes one statewide rate rather than locality rows, so no general-rate address boundary layer is needed.

TaxAP remains read-only. No A+ tax body, ship-to, customer, order, or invoice record was changed.
