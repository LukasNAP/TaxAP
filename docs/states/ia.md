# Iowa — official-rate adapter status

## What is connected

TaxAP now reads the current Iowa Streamlined Sales Tax rate file, selected from the publisher's rate directory. The file has active effective-date records and validates against Iowa's real geography:

- 6% state sales/use tax.
- 99 real county rows.
- 1,013 city rows.
- 101 special rows, including the source's non-county `199` row. It is deliberately classified as special rather than being treated as a 100th Iowa county.

The Iowa Department of Revenue confirms that local option sales tax is a 1% add-on where authorized, and that city and unincorporated-county coverage can differ. TaxAP therefore does not collapse this into a single statewide 7% result.

## A+ comparison implemented September 9 — sales tax only

The user selected sales-tax-only comparisons. `server/ia-aplus.mjs` uses the [DOR Local Option Rates and Sunsets workbook](https://revenue.iowa.gov/media/195/download?inline), linked from the [official LOST page](https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/local-option-sales-tax-lost). The July 1, 2026 workbook contains 1,136 records across 99 counties, with a separate unincorporated record for each county. State-rate guidance and Census county names are independently validated. This reader does not depend on the inconsistent SST directory response observed during this investigation.

An assigned county name compares only if all its listed cities and unincorporated area share one resolved sales rate. Exact city names compare only when all same-name county parts have the same rate. A+ numeric suffixes are not treated as official county identifiers. IA000, county-wide ambiguity, undefined/retired groups and invalid or expired rate periods remain unresolved. The workbook header, current half-year, column scope, component arithmetic, county identities, uniqueness and effective/sunset dates are validated. Hotel/motel worksheets are excluded.

Current read-only Windows-authenticated aggregate: 270 assignments, 102 compared across 29 groups, zero differences, 167 unmatched and one cross-state. No customer/address data was exposed and no SQL changed. Sales-only labels appear in the drawer and shared inbox. Production build, lint and 239 tests passed. Delivery-boundary coverage and business exemptions remain separate limitations.

## Historical A+ investigation

September 8 continuation: an existing `readStateDetail('IA')` call using local Windows Authentication succeeded with 269 active ship-tos. Unlike the older snapshot below, descriptions now resolve (examples: `IA077` Polk Co., `IA057` Linn Co., `IA029` Des Moines Co.). `IA000` is a configured 0% group with 55 assignments. This removes the blank-description blocker but does not prove county-wide local-option coverage: municipality/unincorporated boundaries still need reconciliation. No SQL was changed and no customer/address records were retrieved by this aggregate call.

An aggregate-only local A+ inventory on 2026-08-31 found 268 active Iowa ship-tos across 53 assigned tax-body groups. The common codes (`IA077`, `IA057`, `IA029`) do not directly use Iowa's odd-numbered county FIPS identifiers, and they contain values above Iowa's 99 county count (`IA101`–`IA106`). Tax-body descriptions are blank in the returned aggregate data.

There is no safe deterministic code-to-jurisdiction match yet. Do not compare these codes to the county rows, and do not use a city-name fallback or an address lookup without a separate design and privacy decision. Any future Iowa matcher must first establish the meaning of the A+ numbering scheme and report unresolved, cross-state, and `IA000` assignments as aggregate exclusions.

No A+ writes are allowed.
