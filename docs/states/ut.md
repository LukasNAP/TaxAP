# Utah — official-rate adapter status

## What is connected

TaxAP reads Utah's current effective-dated Streamlined Sales Tax rate file and retains the Utah State Tax Commission's rate page as the human-readable authority.

- State general sales/use-tax component: 4.85%.
- Live validation on 2026-09-02: 211 active records — one state row, all 29 county components, and 181 city components.
- The state row separately reports Utah's 3% food rate; TaxAP's general-merchandise monitoring uses the 4.85% general rate and does not misapply it to grocery food.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, all 29 counties, and Utah's reviewed state/county/city shape.

Utah's official guidance says the combined rate includes multiple local and transportation layers and that an out-of-state seller should source to the buyer's receipt location using ZIP+4/boundary data. The component inventory is connected, but a complete destination total still requires address-level reconciliation.

## Assigned-code comparison wired — September 8, 2026

`server/ut-aplus.mjs` now reads the official combined workbook for the current quarter, requiring its link on the primary directory. It validates the general section header, component sum including FD, and a minimum inventory; other tax sections are excluded. Both reporting code and exact official location name must match before comparison. No address sourcing, name guessing, or rate-based matching is performed.

Live local Windows-authenticated aggregate validation: 222 active assignments, 35 matched tax-body groups covering 148 assignments, 19 rate differences, and 74 unmatched assignments. These are review findings; tax treatment and physical delivery jurisdiction remain separate. Unmatched groups include UT000 and abbreviated/conflicting names. The current workbook contains 389 general-rate rows. The reader is connected to the batch and drawer, with its compared count excluding unmatched rows.

Lint, production build and 206 tests passed. Three new tests cover FD arithmetic, section boundaries, exact code/name requirements, truthful comparison counts and rejection of a future-quarter fallback. Existing SQL was used unchanged. No A+ writes, commits or deployments.

## Earlier investigation notes

September 8 continuation: the existing local Windows-authenticated aggregate reader succeeded. Examples establish A+ county/city-code syntax: `UT01002` Beaver, `UT06035` N. Salt Lake, `UT18138` South Jordan. Codes and full official location descriptions still need reviewed matching; code `UT29000` describes Farr West, demonstrating why a county-code suffix alone cannot establish identity.

The current primary source page https://tax.utah.gov/business/sales-tax/sales/rates/ links quarterly combined XLSX files, including `https://files.tax.utah.gov/tax/salestax/rate/26q3combined.xlsx`. Future Q4 is already listed, so a reader must select by date. The Q3 workbook has 451 worksheet rows, including notes and a second rate section; the general table header is A=Location, C=Code, E=ST*, Z=Sales Rate. Only that section may be parsed. Its own sourcing warning prohibits using the chart as a substitute for delivery-address validation.

Inspection found a shared XLSX parser bug: empty self-closing cells consumed the following populated cell, shifting column values. `server/xlsx-utils.mjs` now parses those cells separately. A regression test checks a Utah-shaped row's code and Z total. A fresh workbook parse now places Beaver City code `01-002` in C and its general total in Z. The Utah comparison reader is not implemented yet; next work is period/header validation, full-code/name matching, and aggregate verification.

A read-only aggregate A+ inventory on 2026-09-02 found 221 active Utah ship-tos across 45 tax-body groups. `UT000` has no configured definition and covers 37 ship-tos. The remaining groups are Utah municipality-labelled totals.

A+ identifiers resemble Utah county/city reporting codes but do not directly equal SST county FIPS or Census place codes. A future matcher must use an explicit reviewed location-code crosswalk and Utah's boundary source; it must not join by a numeric suffix or city name alone. `UT000` must remain separately visible. No customer/address records may reach the browser, and TaxAP must never write to A+.
