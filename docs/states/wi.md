# Wisconsin — official-rate adapter status

## What is connected

TaxAP reads Wisconsin's current effective-dated Streamlined Sales Tax rate file and retains the Wisconsin Department of Revenue's location-rate lookup as the human-readable authority.

- State sales/use-tax component: 5%.
- Live validation on 2026-09-02: 1,924 active records — one state row, all 72 county components, and 1,851 municipality rows.
- Explicit zero-rate county/city records remain visible; TaxAP does not discard them or treat every municipality as having a local tax.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, all 72 counties, and Wisconsin's reviewed state/county/city shape.

Wisconsin's official source says the SST rate/boundary files cover state, county, and city sales/use taxes but exclude premier-resort-area and local-exposition taxes. Its location lookup requires sale date plus ZIP+4 or street address, so the component file is not a universal invoice-total source.

## A+ matching: not built

A read-only aggregate A+ inventory on 2026-09-02 found 425 active Wisconsin ship-tos across 51 tax-body groups. `WI000` has no configured definition and covers 42 ship-tos; one additional ship-to uses a North Carolina tax body. The configured Wisconsin groups are predominantly county-labelled totals.

Milwaukee County's configured 5.9% matches the ordinary county total, but Wisconsin DOR says transactions in the City of Milwaukee are 7.9% because of the additional 2% city tax. No active city-specific 7.9% A+ group appeared in the aggregate inventory, so TaxAP must not assume that all 47 Milwaukee County assignments are outside the city. A future matcher needs delivery-address jurisdiction resolution and must separately account for excluded premier-resort/local-exposition taxes. No customer/address records may reach the browser, and TaxAP must never write to A+.
