# Virginia — official-rate adapter status

## What is connected

TaxAP downloads Virginia Tax's official `sales-tax-rates.xlsx` workbook and validates it before returning any rate data.

- Direct source: `https://www.tax.virginia.gov/sites/default/files/inline-files/sales-tax-rates.xlsx`
- Source page: `https://www.tax.virginia.gov/sales-tax-rate-and-locality-code-lookup`
- The official server reported `Last-Modified: Fri, 09 Jan 2026 01:16:04 GMT` during the 2026-09-02 validation. This supersedes the repository's old 2023 freshness concern.
- SHA-256 of the validated workbook: `ade4d5e90cd8a6af4f702497925bf7a3fb7dd1b14d0cf1822fc8010f9ff3a505`.
- Coverage: all 133 current Virginia localities — 95 counties and 38 independent cities — keyed by their five-digit state-plus-locality FIPS code.
- Published general-rate tiers: 94 localities at 5.3%, 28 at 6.0%, eight at 6.3%, and three at 7.0%.

The adapter fails closed unless the workbook retains its reviewed 12-column schema, Virginia state FIPS `51`, unique three-digit locality codes, the complete 95/38 county/city shape, the 4.3% state component, the 1% mandatory local component, known regional/additional-local component sizes, and arithmetic totals that reconcile to one of the current published rate tiers. It also exposes the separate 1% food and personal-hygiene rate as source evidence rather than substituting it for general merchandise.

## A+ audit: comparison intentionally not built yet

The read-only aggregate A+ refresh on 2026-09-02 found:

- 830 active Virginia ship-tos and 641 active customer assignments.
- 107 active tax-body groups in use: 106 Virginia-prefixed groups covering 829 ship-tos, plus one `NC092` assignment covering one Virginia ship-to.
- 104 Virginia groups matched a current official locality name and rate directly or through four reviewed label normalizations (`Albermarle` → Albemarle; James City and Charles City are counties; Virginia Beach is an independent city).
- `VA071` is assigned to seven active ship-tos at 5.30%, while the official Pittsylvania County rate is 6.30%.
- `VA240` is labelled `Virginia Bedford (city)` and is assigned to one active ship-to, but Bedford is no longer an independent city and has no row in the current 133-locality workbook.

The A+ code numbers are internal alphabetical/ordinal identifiers, not Virginia FIPS codes. Name/type matching is promising, but publishing an automatic comparison now would either hide a confirmed rate difference or silently force a retired jurisdiction onto a current locality. TaxAP therefore connects the official inventory only and leaves A+ comparison pending business review.

## Decisions needed

1. Confirm whether `VA071` should be updated from 5.30% to the current 6.30% Pittsylvania County rate or whether an Atlantic-specific treatment explains the difference.
2. Identify the current legal destination represented by the one `VA240` Bedford City assignment and reassign or document it through the supported A+ workflow.
3. Confirm whether the single Virginia ship-to using `NC092` is an approved cross-state exception.

TaxAP remains read-only. No A+ tax body, ship-to, customer, order, or invoice record was changed.
