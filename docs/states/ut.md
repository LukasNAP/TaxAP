# Utah — official-rate adapter status

## What is connected

TaxAP reads Utah's current effective-dated Streamlined Sales Tax rate file and retains the Utah State Tax Commission's rate page as the human-readable authority.

- State general sales/use-tax component: 4.85%.
- Live validation on 2026-09-02: 211 active records — one state row, all 29 county components, and 181 city components.
- The state row separately reports Utah's 3% food rate; TaxAP's general-merchandise monitoring uses the 4.85% general rate and does not misapply it to grocery food.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, all 29 counties, and Utah's reviewed state/county/city shape.

Utah's official guidance says the combined rate includes multiple local and transportation layers and that an out-of-state seller should source to the buyer's receipt location using ZIP+4/boundary data. The component inventory is connected, but a complete destination total still requires address-level reconciliation.

## A+ matching: not built

A read-only aggregate A+ inventory on 2026-09-02 found 221 active Utah ship-tos across 45 tax-body groups. `UT000` has no configured definition and covers 37 ship-tos. The remaining groups are Utah municipality-labelled totals.

A+ identifiers resemble Utah county/city reporting codes but do not directly equal SST county FIPS or Census place codes. A future matcher must use an explicit reviewed location-code crosswalk and Utah's boundary source; it must not join by a numeric suffix or city name alone. `UT000` must remain separately visible. No customer/address records may reach the browser, and TaxAP must never write to A+.
