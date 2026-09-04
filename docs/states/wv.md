# West Virginia — official-rate adapter status

## What is connected

TaxAP reads West Virginia's current effective-dated Streamlined Sales Tax rate file and retains the West Virginia Tax Division's municipal-rate page as the human-readable authority.

- State sales/use-tax component: 6%.
- Live validation on 2026-09-02: 102 active records — one state row and 101 municipality components, each 1%.
- West Virginia has no county sales-tax layer. TaxAP explicitly preserves the municipal model rather than interpreting zero county rows as a flat statewide-only rate.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, zero county rows, and West Virginia's reviewed state/city shape.

West Virginia says municipal tax applies within the taxing municipality's boundaries and combines with the 6% state rate to produce 7%. Its guidance warns that nine-digit ZIP codes do not always match municipal corporate boundaries, so address/boundary reconciliation remains necessary.

## A+ matching: not built

A read-only aggregate A+ inventory on 2026-09-02 found 112 active West Virginia ship-tos across 30 tax-body groups. `WV000` has no configured definition and covers 21 ship-tos. A distinct `WV0100` no-local-rate group correctly carries 6% for 23 ship-tos. `WV961` is labelled “Missouri Lewisburg” despite its `WV` prefix and covers one ship-to.

The municipality-labelled 7% groups are plausible, but internal sequence codes do not directly equal Census place identifiers. A future matcher needs an explicit reviewed municipality map and boundary resolution, must preserve the valid no-local group, and must separately classify `WV000` and `WV961`. No customer/address records may reach the browser, and TaxAP must never write to A+.
