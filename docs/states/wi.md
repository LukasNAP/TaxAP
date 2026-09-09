# Wisconsin — official-rate adapter status

## What is connected

TaxAP reads Wisconsin's current effective-dated Streamlined Sales Tax rate file and retains the Wisconsin Department of Revenue's location-rate lookup as the human-readable authority.

- State sales/use-tax component: 5%.
- Live validation on 2026-09-02: 1,924 active records — one state row, all 72 county components, and 1,851 municipality rows.
- Explicit zero-rate county/city records remain visible; TaxAP does not discard them or treat every municipality as having a local tax.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, all 72 counties, and Wisconsin's reviewed state/county/city shape.

Wisconsin's official source says the SST rate/boundary files cover state, county, and city sales/use taxes but exclude premier-resort-area and local-exposition taxes. Its location lookup requires sale date plus ZIP+4 or street address, so the component file is not a universal invoice-total source.

## Assigned-code comparison wired — September 8, 2026

`server/wi-aplus.mjs` compares explicit county/Co. descriptions to official county totals. Bare place names do not imply county scope. Milwaukee County remains unmatched because its saved assignments may include the city; explicitly labelled City of Milwaukee codes combine the official county total with the official city component. No delivery-address or resort/exposition-tax conclusion is made.

Authority: https://www.revenue.wi.gov/Pages/FAQS/pcs-county.aspx. The current official source returned 72 counties. A synthetic county check matched 71 and deliberately left Milwaukee County unresolved; the city fixture verifies the separate city addition. Three tests cover county/city separation, unknown and unsupported labels, cross-state assignments and invalid/partial sources. Full suite: 202 tests passed, lint and build passed. No current A+ query.

## Historical A+ inventory

A read-only aggregate A+ inventory on 2026-09-02 found 425 active Wisconsin ship-tos across 51 tax-body groups. `WI000` has no configured definition and covers 42 ship-tos; one additional ship-to uses a North Carolina tax body. The configured Wisconsin groups are predominantly county-labelled totals.

Milwaukee County's configured 5.9% matches the ordinary county total, but Wisconsin DOR says transactions in the City of Milwaukee are 7.9% because of the additional 2% city tax. No active city-specific 7.9% A+ group appeared in the aggregate inventory, so TaxAP must not assume that all 47 Milwaukee County assignments are outside the city. Delivery-address resolution and excluded premier-resort/local-exposition taxes remain open. No customer/address records may reach the browser, and TaxAP must never write to A+.
