# South Dakota — official-rate adapter status

## What is connected

TaxAP reads South Dakota's current effective-dated Streamlined Sales Tax rate file and retains the South Dakota Department of Revenue's guidance as the human-readable authority.

- State sales/use-tax rate: 4.2%.
- Live validation on 2026-09-02: 327 active records — one state row, all 66 county rows, 254 municipality components, and six tribal/special-jurisdiction records.
- County rows are retained even though their current general component is 0%; South Dakota's ordinary local variation is municipal rather than county-level.
- SST type-49 records are preserved as special jurisdictions without a computed combined total. Department guidance says qualifying Indian-country sales use special reporting codes and the 4.2% special-jurisdiction tax replaces rather than stacks on top of ordinary state tax.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, all 66 counties, and South Dakota's reviewed state/county/city/type-49 shape.

The Department says municipalities may impose a general municipal rate up to 2%. Delivery within a municipality or tribal special jurisdiction therefore requires boundary/agreement reconciliation before TaxAP can claim a complete total.

## A+ matching: not built

A read-only aggregate A+ inventory on 2026-09-02 found 42 active South Dakota ship-tos across 13 configured tax-body groups. Nine ship-tos use `SD000` at 0%, one uses a separately labelled 4.2% no-local-rate code, and the remaining groups are municipality-labelled at 6.2%.

The municipality-labelled rates are plausible, but `SD000` cannot be treated as an ordinary statewide result because South Dakota's base is 4.2%. A future matcher needs an explicit reviewed municipality map and a separate special-jurisdiction path; it must not infer tribal status from a city or ZIP alone. No customer/address records may reach the browser, and TaxAP must never write to A+.
