# Vermont — official-rate adapter status

## What is connected

TaxAP reads Vermont's current effective-dated Streamlined Sales Tax rate file and retains the Vermont Department of Taxes' guidance as the human-readable authority.

- State general sales/use-tax rate: 6%.
- Live validation on 2026-09-02: 37 active records — one state row and 36 municipality local-option components, each 1%.
- Vermont has no county sales-tax layer. TaxAP explicitly distinguishes “zero county rows with municipal taxes” from a truly flat statewide-rate state.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, zero county rows, and Vermont's reviewed state/city shape.

Vermont says sales tax is destination-based and some municipalities impose a 1% local option in addition to the 6% state rate. Local option tax does not apply to use tax, and certain tracked vehicles have statutory tax caps; the percentage inventory alone does not model those transaction-specific rules.

## A+ matching: not built

A read-only aggregate A+ inventory on 2026-09-02 found 47 active Vermont ship-tos across 17 tax-body groups. `VT000` has no configured definition and covers nine ship-tos. Several configured municipality-labelled groups are 6% or 7%; one county-labelled 7% group cannot be accepted as a direct municipal match.

A future matcher needs an explicit reviewed municipality map and must distinguish locations with and without the local option. It must separately review duplicate or inconsistent labels, keep `VT000` visible, and avoid applying sales-only local option tax to use-tax transactions. No customer/address records may reach the browser, and TaxAP must never write to A+.
