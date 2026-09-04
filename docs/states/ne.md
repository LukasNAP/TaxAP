# Nebraska — official-rate adapter status

## What is connected

TaxAP reads Nebraska's current effective-dated Streamlined Sales Tax rate file, with the Nebraska Department of Revenue's local-rate page retained as the human-readable authority.

- State sales/use-tax component: 5.5%.
- Live validation on 2026-09-02: 277 active records — one state row, 270 city components, five special-jurisdiction components, and one county component.
- Nebraska has 93 physical counties, but the source does not publish 93 county-tax rows. The one active county component is Dakota County; TaxAP does not synthesize nonexistent county taxes.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, the reviewed one-county shape, and Nebraska's known state/county/city/special types.

Nebraska's published guidance says local taxes may be imposed by a city or county. Dakota County's 0.5% rate applies outside a municipality that imposes its own local tax, so blindly adding every component would overstate some totals.

## A+ matching: not built

A read-only aggregate A+ inventory on 2026-09-02 found 115 active Nebraska ship-tos across 23 tax-body groups. `NE000` has no configured definition and accounts for 21 ship-tos.

Several configured A+ codes appear compatible with five-digit place identifiers, but that observation alone does not prove complete rate comparability. The Dakota County municipality exception and five special components must be reconciled before TaxAP produces totals or findings. No comparison was added.

A future matcher may accept only validated exact place-code links, must separately handle the county exception and special layers, and must visibly exclude `NE000`, missing definitions, and ambiguous locations. No customer/address records may reach the browser, and TaxAP must never write to A+.
