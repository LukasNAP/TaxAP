# Oklahoma — official-rate adapter status

## What is connected

TaxAP reads Oklahoma's current effective-dated Streamlined Sales Tax rate file and retains the Oklahoma Tax Commission's sales/use-tax page as the human-readable authority.

- State sales-tax component: 4.5%.
- Live validation on 2026-09-02: 1,620 active records — one state row, all 77 county components, 798 municipality rows, and 744 special/combined local identifiers.
- Active zero-rate municipality rows are preserved because they are explicit source records; TaxAP does not silently discard a jurisdiction merely because its current component is zero.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, all 77 counties, and Oklahoma's known state/county/city/special types.

The Oklahoma Tax Commission says shipped goods use the rates in effect at the delivery location. A county or municipality tax applies when the transaction occurs within its boundary, so the official component inventory is connected but a complete invoice total still requires delivery-location reconciliation.

## A+ matching: not built

A read-only aggregate A+ inventory on 2026-09-02 found 272 active Oklahoma ship-tos across 61 tax-body groups. `OK000` has no configured definition and covers two ship-tos. The other groups are Oklahoma-labelled city, county, or city/county combinations.

Many A+ identifiers resemble Oklahoma Tax Commission COPO codes, but they do not directly equal the SST county, Census place, or special-jurisdiction identifiers. A future matcher must use an explicit reviewed COPO/location crosswalk and handle overlapping county, municipality, and special layers; a suffix or name guess is not sufficient. No customer/address records may reach the browser, and TaxAP must never write to A+.
