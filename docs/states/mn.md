# Minnesota — official-rate adapter status

## Implemented map comparison — September 9, 2026

The reader is now registered in the findings batch and state drawer using the [official Minnesota tax map](https://taxmaps.state.mn.us/salestax/). Its configured ArcGIS web map exposes a current-quarter `locgnrl_sales_usetax_areas_2026Q3` layer. The reader selects exactly that period, validates the source host, transfer completeness and each state/city/county/special component sum, and retains the published total. It requests no geometry, street addresses or customer fields.

The current layer has 159 records. Four records have inconsistent label/formal identities; these remain ambiguous, including the conflicting Mankato/Oakdale identity. An assigned name compares only if every matching record has a consistent identity and the same total. County labels require explicit county names. St. Cloud Area has different totals across counties and remains unmatched. County-rate matching does not prove a delivery address is outside an additional municipal jurisdiction.

Local Windows-authenticated validation: 389 assignments, 224 compared across 38 groups, 15 differences, 162 unmatched and three cross-state. Build, lint and all 226 tests passed. The earlier PDF draft is not the active source; missing Q3 PDF no longer blocks this implementation. No SQL changes, A+ writes or deployment.

## Draft comparison investigation — September 9, 2026

`server/mn-aplus.mjs` and its tests now contain a draft municipal combined-rate reader. **It is not registered in the connector or UI and is not counted as wired.** The official directory currently links Q4, which cannot be applied to September assignments. A Q3 guide at `/sites/default/files/2026-05/local-sales-and-use-tax-rate-guide-2026-q3.pdf` returned a valid July–September guide during the earlier read but subsequently returned HTTP 404 on September 9. The media record now links Q4 too. A cached search result is not proof the Q3 file remains retrievable.

The draft checks embedded effective dates, sums rate components, preserves multiple-taxing-area asterisks, ignores township lists, and matches exact municipality names only when all published occurrences agree. County-only, abbreviated, missing and unidentified no-local assignments remain unresolved. The Q4 document parses 792 municipality rows when explicitly tested for October 1; that is prospective parser validation, not current A+ coverage. Offline tests verify missing-current-source failure without substituting Q4.

Next: locate an official current-period combined source (calculator/map or the nine-digit ZIP rate workbook), or recover a supported current guide URL. Broader county and physical boundary matching is still open. Existing aggregate A+ names were read without SQL changes or customer/address output. No production registration, A+ writes or deployment occurred.

Primary sources: [DOR local tax information](https://www.revenue.state.mn.us/local-sales-tax-information), [guide media record](https://www.revenue.state.mn.us/media/document/58056), and [Q4 guide](https://www.revenue.state.mn.us/sites/default/files/2026-08/local-sales-and-use-tax-rate-guide-2026-q4.pdf).

## What is connected

TaxAP reads Minnesota's current Streamlined Sales Tax rate file selected from the publisher's directory. Minnesota Department of Revenue explicitly lists the SST rate and boundary files as a source businesses can program into sales systems.

- Minnesota state general rate: 6.875%.
- Live validation on 2026-09-02: 137 active components — 62 county rows, 63 city rows, and 11 special-jurisdiction rows, plus the single state row.
- The source lists only counties with an active local component; TaxAP does not pretend that all 87 physical counties levy a county tax.
- The downloaded Q4 file includes effective-dated history and future changes. TaxAP filters it to the requested comparison date, validates the state FIPS, active jurisdiction keys, exactly one state row, the reviewed active county count, and Minnesota's known jurisdiction types.

Minnesota requires the 6.875% state rate plus all applicable local and special layers. The correct total follows the delivery location, and the Department recommends an address, ZIP+4, map, spreadsheet, API, or boundary file for determining that location.

## A+ matching: not built

A read-only aggregate A+ inventory on 2026-09-02 found 387 active Minnesota ship-tos across 55 tax-body groups. The unresolved `MN000` definition covers 106 ship-tos; all missing definitions together cover 107. Four Minnesota-address assignments use a different state's tax-body prefix.

Minnesota's county, city, transit, metro-area, and other special layers make a code- or city-name-only comparison unsafe. The official component file does not establish that an internal A+ code maps to one complete geographic combination, and `MN000` has no confirmed business meaning. No comparison was added.

A future matcher needs a validated address/boundary design, aggregate exclusion counts for `MN000`, missing definitions, ambiguous locations, and cross-state assignments, plus a business answer on whether `MN000` is intentional. Customer and address rows must remain server-side, and TaxAP must never write to A+.
