# Minnesota — official-rate adapter status

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
