# Vermont — official-rate adapter status

## What is connected

TaxAP reads Vermont's current effective-dated Streamlined Sales Tax rate file and retains the Vermont Department of Taxes' guidance as the human-readable authority.

- State general sales/use-tax rate: 6%.
- Live validation on 2026-09-02: 37 active records — one state row and 36 municipality local-option components, each 1%.
- Vermont has no county sales-tax layer. TaxAP explicitly distinguishes “zero county rows with municipal taxes” from a truly flat statewide-rate state.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, zero county rows, and Vermont's reviewed state/city shape.

Vermont says sales tax is destination-based and some municipalities impose a 1% local option in addition to the 6% state rate. Local option tax does not apply to use tax, and certain tracked vehicles have statutory tax caps; the percentage inventory alone does not model those transaction-specific rules.

## A+ matching: sales-only reader implemented September 9

The user selected sales tax only for now. `server/vt-aplus.mjs` reads the official Department of Taxes [Local Option Tax Finder](https://tax.vermont.gov/business/local-option-tax) municipality layer and cross-checks it against the page's sales-tax table and current SST component inventory. The 256 named areas include explicit 6% sales-tax locations and 36 currently active 7% local-sales-tax areas. Rates are effective-dated: Peru remains 6% until October 1, 2026, and Montgomery's rescinded local sales tax is excluded. Meals, rooms and alcohol tables are not used.

The reader matches unique exact assigned municipality names, with St./Saint spelling normalization. It preserves town/city qualifiers and does not guess abbreviations, misspellings, county-only labels or Manchester Center. Current Windows-authenticated aggregate verification: 48 assignments, 28 compared across 11 groups, two differences, 20 unmatched. No customer/address fields were retrieved from the public map, and no SQL changed. Drawer and inbox explicitly label sales-tax comparison. This does not establish use-tax treatment, exemptions or delivery boundaries.

Production build, lint and 235 tests passed, including date transitions, rescission, source conflicts, incomplete inventories, unresolved assignments and sales-only inbox output.

## Historical A+ investigation

A read-only aggregate A+ inventory on 2026-09-02 found 47 active Vermont ship-tos across 17 tax-body groups. `VT000` has no configured definition and covers nine ship-tos. Several configured municipality-labelled groups are 6% or 7%; one county-labelled 7% group cannot be accepted as a direct municipal match.

A future matcher needs an explicit reviewed municipality map and must distinguish locations with and without the local option. It must separately review duplicate or inconsistent labels, keep `VT000` visible, and avoid applying sales-only local option tax to use-tax transactions. No customer/address records may reach the browser, and TaxAP must never write to A+.
