# Kansas — official-rate adapter status

## Current comparison — September 8, 2026

`server/ks-aplus.mjs` now selects the linked current-quarter Publication 1700 workbook, validates its effective-period cover and general-rate columns, and reconciles published totals against state/county/city/special components. It retains 1,071 named jurisdictions (748 ordinary and 323 special), without retaining address continuation rows. Food columns are not used for general-rate comparisons.

Legacy numeric A+ codes use unique exact published jurisdiction names, preserving county qualifiers. Alphabetic codes also require the official code to agree. Special districts require an explicit matching code and full name; a city description never implies special-district membership. Truncated names, catch-all codes, duplicates and missing definitions remain unmatched. This is assigned-jurisdiction rate monitoring, not confirmation of physical delivery boundaries.

Current local Windows-authenticated aggregate: 270 assignments, 209 compared across 48 groups, five differences, 60 unmatched and one cross-state. Registered in batch findings and the state drawer. Build, lint and all 220 tests passed. No SQL changes or A+ writes.

Sources: [KDOR quarterly publication directory](https://www.ksrevenue.gov/salesratechanges.html) and [Q3 2026 Publication 1700](https://www.ksrevenue.gov/pdf/pub17000726.xlsx).

The unwired status below is historical and superseded by this implementation.

## What is connected

TaxAP reads the current Kansas Streamlined Sales Tax rate file selected from the publisher's directory, with Kansas Department of Revenue's quarterly local-sales-tax update page retained as the primary human-readable source.

- Kansas state sales/use-tax component: 6.5%.
- Live validation on 2026-08-31: 2,146 active components — 105 county rows, 628 city rows, and 1,412 special-jurisdiction rows.
- Kansas special-jurisdiction identifiers are not always numeric. For example, `11KAN` is preserved as an opaque special-jurisdiction identifier, never interpreted as a county or city code.
- The adapter validates the state FIPS, exactly 105 county rows, active effective dates, duplicate jurisdiction keys, and the known Kansas jurisdiction-type set (`00`, `01`, `45`, `63`, `79`). Any unexpected type fails closed.

## A+ matching: not built

An aggregate-only local A+ inventory on 2026-08-31 found 267 active Kansas ship-tos across 57 assigned tax-body groups. The A+ codes are internal tax-body identifiers and do not deterministically correspond to Kansas's county FIPS, Census place IDs, or the SST special-jurisdiction IDs. Kansas also has substantial place and special-district variation, so a county-level fallback would be inaccurate.

No rate comparison was added. A future matcher needs a separately validated crosswalk from each A+ tax body to the specific Kansas jurisdiction combination, must make any unmatched or cross-state assignments visible as aggregate exclusions, and must not use a plausible-name or address fallback. No customer, ship-to, or address row may be sent to the browser, and TaxAP must never write to A+.
