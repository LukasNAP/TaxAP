# Oklahoma — official-rate adapter status

## Current comparison — September 8, 2026

`server/ok-aplus.mjs` reads the official COPO CSV linked from the Tax Commission publications page. The quarterly COPO chart explicitly documents the first two digits as the county identifier and the additional county tax. The reader selects effective sales/use history, adds the appropriate county component once, verifies the 4.5% state rate through the existing SST source, and compares only exact four-digit code/name identities where sales/use totals agree. It is registered in batch findings and the state drawer.

Current CSV: 904 locations excluding the generic `0088` record, with all 77 counties. 812 totals resolve under this scope. The Inola use history contains overlapping open periods; other rows contain malformed dates (including `10/1/205`). Those records remain unresolved; no dates or rates are repaired by inference. Six-digit A+ suffixes, conflicting or truncated names, missing definitions and differing sales/use rates also remain unmatched.

Local Windows-authenticated aggregate validation: 272 assignments, 98 compared across 37 groups, 11 differences and 174 unmatched. Build, lint and all 218 tests passed. This compares the assigned COPO rate; it does not establish delivery-address boundaries or transaction treatment. No SQL changes or A+ writes.

Sources:
- [OTC publications and CSV link](https://oklahoma.gov/tax/reporting-resources/publications.html)
- [Official COPO CSV](https://oklahoma.gov/content/dam/ok/en/tax/documents/resources/publications/businesses/csv-excel-rates/Currentcsv.csv)
- [Q3 2026 chart and county-code explanation](https://oklahoma.gov/content/dam/ok/en/tax/documents/resources/publications/businesses/sales-and-use-tax/rate-charts-copos/2026/copo3Q26.pdf)

The unwired status below records the historical investigation and is superseded by this implementation.

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
