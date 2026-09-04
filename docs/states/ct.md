# Connecticut — official-rate adapter status

## What is connected

TaxAP reads the Connecticut Department of Revenue Services sales-and-use-tax page and validates both facts required for general-rate monitoring:

- The general sales and use tax rate for most retail goods is 6.35%.
- Connecticut local jurisdictions impose no additional sales tax.

The adapter fails closed if the official page stops stating either fact or reports a different general rate. Product- and service-specific rates—such as computer/data-processing services, certain luxury goods, and short-term vehicle rentals—remain outside this general-merchandise rate comparison.

## A+ validation

The read-only aggregate A+ refresh on 2026-09-02 found 181 active Connecticut ship-tos and 75 active customer assignments. Every ship-to uses the single `CT000` tax body, labelled `Connecticut`, at 6.35%. That exactly matches the current official general rate. Because Connecticut has no additional local sales tax, no address or county/city boundary matcher is required for this general-rate setup.

TaxAP remains read-only. No A+ tax body, ship-to, customer, order, or invoice record was changed.
