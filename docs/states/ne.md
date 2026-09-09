# Nebraska — official-rate adapter status

## What is connected

TaxAP reads Nebraska's current effective-dated Streamlined Sales Tax rate file, with the Nebraska Department of Revenue's local-rate page retained as the human-readable authority.

- State sales/use-tax component: 5.5%.
- Live validation on 2026-09-02: 277 active records — one state row, 270 city components, five special-jurisdiction components, and one county component.
- Nebraska has 93 physical counties, but the source does not publish 93 county-tax rows. The one active county component is Dakota County; TaxAP does not synthesize nonexistent county taxes.
- The adapter validates state FIPS, active effective dates, unique jurisdiction keys, the reviewed one-county shape, and Nebraska's known state/county/city/special types.

Nebraska's published guidance says local taxes may be imposed by a city or county. Dakota County's 0.5% rate applies outside a municipality that imposes its own local tax, so blindly adding every component would overstate some totals.

## Assigned municipality comparison wired — September 8, 2026

`server/ne-aplus.mjs` requires an exact five-digit city code AND the matching municipality name before using the existing adapter's published combined city total. It never stacks Dakota County onto a municipality. County, special, undefined, retired, unknown and disagreeing code/name assignments remain unmatched. No physical delivery boundary or special-district conclusion is made.

Primary composition authority: https://revenue.nebraska.gov/about/frequently-asked-questions/nebraska-sales-and-use-tax-faqs. The Department's local-rate table also publishes FIPS identifiers: https://revenue.nebraska.gov/businesses/local-sales-and-use-tax-rates.

Current source fetch: 270 cities, one county, five special records. All 270 cities passed a synthetic code-and-name mapping check; this is not current A+ validation. Tests cover a South Sioux City difference without adding Dakota County, conflicting names/codes, unresolved totals, duplicates, and failures. County/special mapping remains unfinished.

## Historical A+ inventory

A read-only aggregate A+ inventory on 2026-09-02 found 115 active Nebraska ship-tos across 23 tax-body groups. `NE000` has no configured definition and accounts for 21 ship-tos.

Several configured A+ codes appear compatible with five-digit place identifiers, but that observation alone does not prove complete rate comparability. The Dakota County municipality exception and five special components must be reconciled before TaxAP produces totals or findings. No comparison was added.

The implemented municipality matcher does not resolve the county exception or special layers for unidentified assignments. `NE000`, missing definitions, and ambiguous locations remain unmatched. No customer/address records may reach the browser, and TaxAP must never write to A+.
