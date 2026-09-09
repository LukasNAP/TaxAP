# Washington — official-rate adapter status

## What is connected

TaxAP reads Washington's current effective-dated Streamlined Sales Tax rate file and retains the Washington Department of Revenue's rate pages as the human-readable authority.

- State retail sales-tax component: 6.5%.
- Live validation on 2026-09-02: 1,475 active records — one state row, all 39 real county rows, 277 city rows, 1,153 special/location-code rows, and five additional non-Census identifiers encoded by the source as county type.
- Source county-type codes `079`, `081`, `083`, `085`, and `087` do not identify Washington counties. TaxAP preserves them as special jurisdictions instead of claiming Washington has 44 counties.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, all 39 Census counties, the five reviewed exceptions, and Washington's known state/county/city/special types.

Washington says retail sales tax contains state and local portions, and sellers must use the location where the customer receives the goods or services. The state provides an address/ZIP+4 lookup for the authoritative destination rate, so component records alone are not a complete address match.

## A+ comparison wired — September 8, 2026

`server/wa-aplus.mjs` now retrieves the Washington DOR general sales/use rate table directly using `items_per_page=All`: https://dor.wa.gov/taxes-rates/sales-use-tax-rates/local-sales-use-tax/local-sales-use-tax-rate-table?items_per_page=All. The current quarter returned 403 unique four-digit location codes. This companion source provides complete general rates and named locations; it does not infer totals from SST special components.

The parser requires the current calendar quarter, validates its exact start/end dates, rejects pagination, duplicate codes, invalid component arithmetic, changes to the reviewed state rate, and inventories below 400 rows. It retains URL, quarter, retrieval timestamp, and SHA-256 evidence. A future legitimate schema/rate/inventory change requires review rather than accepting partial data.

The matcher accepts configured `WA` plus four-digit codes that exist in that table. Missing definitions, unknown codes, retired descriptions, and explicitly category-specific codes remain unmatched. Cross-jurisdiction assignments stay separate. This monitors the assigned code's general rate; delivery-address validation and business exemptions remain unresolved.

Validation: the current public DOR table parsed successfully; all 403 codes matched a synthetic aggregate fixture with zero differences. Four offline tests cover exact mapping, source failure, stale dates, invalid/partial sources, unknown/category codes, and shared inbox output. No current A+ aggregates were read.

## Historical A+ evidence

A read-only aggregate A+ inventory on 2026-09-02 found 469 active Washington ship-tos across 62 tax-body groups. `WA000` has no configured definition and covers 30 ship-tos; `WA3500` is also undefined and covers two. The configured groups use Washington DOR-style four-digit location codes, and sampled codes such as Seattle `1726` align with SST special identifier `L1726` and the reviewed total.

Current A+ aggregate coverage still needs independent validation; the synthetic fixture is not evidence that every active A+ code maps. Undefined codes remain unmatched, and industry-specific motor-vehicle/lodging rates must not enter the general retail comparison. No customer/address records may reach the browser, and TaxAP must never write to A+.
