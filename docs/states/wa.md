# Washington — official-rate adapter status

## What is connected

TaxAP reads Washington's current effective-dated Streamlined Sales Tax rate file and retains the Washington Department of Revenue's rate pages as the human-readable authority.

- State retail sales-tax component: 6.5%.
- Live validation on 2026-09-02: 1,475 active records — one state row, all 39 real county rows, 277 city rows, 1,153 special/location-code rows, and five additional non-Census identifiers encoded by the source as county type.
- Source county-type codes `079`, `081`, `083`, `085`, and `087` do not identify Washington counties. TaxAP preserves them as special jurisdictions instead of claiming Washington has 44 counties.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, all 39 Census counties, the five reviewed exceptions, and Washington's known state/county/city/special types.

Washington says retail sales tax contains state and local portions, and sellers must use the location where the customer receives the goods or services. The state provides an address/ZIP+4 lookup for the authoritative destination rate, so component records alone are not a complete address match.

## A+ matching: not built

A read-only aggregate A+ inventory on 2026-09-02 found 469 active Washington ship-tos across 62 tax-body groups. `WA000` has no configured definition and covers 30 ship-tos; `WA3500` is also undefined and covers two. The configured groups use Washington DOR-style four-digit location codes, and sampled codes such as Seattle `1726` align with SST special identifier `L1726` and the reviewed total.

That alignment is strong evidence for a future exact location-code matcher, but it must be fixture-tested across every active code and reconciled to delivery addresses before TaxAP claims comparison coverage. Undefined codes must remain visible, and industry-specific motor-vehicle/lodging rates must not enter the general retail comparison. No customer/address records may reach the browser, and TaxAP must never write to A+.
