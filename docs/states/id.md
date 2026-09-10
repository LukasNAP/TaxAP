# Idaho — official-rate adapter status

## What is connected

TaxAP reads two current Idaho State Tax Commission pages. It validates that both the state sales-tax rate and use-tax rate are 6%. It also validates the Commission's complete current list of 23 resort cities that impose some form of separately administered local-option sales tax.

The Tax Commission does not publish those city rates or product scopes centrally; it directs taxpayers to contact each city. TaxAP therefore exposes the authoritative 6% state rate and the 23-city source limitation, but never invents local totals. This is a connected statewide source with an explicit local-data gap, not a claim of complete address-level Idaho coverage.

## Sales-tax comparison wired September 10

The assigned-jurisdiction reader uses the current Tax Commission rates/list plus its [2025–2026 city and county GIS service](https://services.arcgis.com/91hXl6NfvLGEi8x5/arcgis/rest/services/Idaho_City_Taxing_Districts/FeatureServer). The service item owner is `Idaho_State_Tax_Comm`. City layer 6 has 200 records but 198 unique names (Garden City has three records); county layer 7 has 44 records. All 23 listed resort cities are present. The city COUNTY field is zero and is not used as a mapping.

Public polygon intersections identify all county overlaps for every resort-city geometry part. Fourteen counties stay unresolved: Adams, Bannock, Blaine, Boise, Bonner, Bonneville, Boundary, Custer, Idaho, Kootenai, Lemhi, Shoshone, Teton and Valley. Intersection includes boundary touches, so this is a conservative exclusion list, not a claim that every excluded county has taxable resort sales throughout it. No customer geometry, addresses or records are sent to the service.

Exact non-resort city names and explicitly named counties with no resort intersections compare against the validated state sales rate. Resort city rates, product scopes, exemptions and delivery boundaries remain unresolved; absence of a match is never treated as zero tax. The live resort list must agree exactly with the reviewed source list so newly listed cities cause validation failure. Partial geography, absent intersections and changed state rates also fail validation.

Current aggregate: 98 assignments, 58 compared across 13 groups, zero differences, 39 unmatched, one cross-state. Existing Windows-authenticated aggregate SQL only; no SQL changes or A+ writes. Build, lint and 243 tests passed. Tests cover all parts of duplicate-name resort geometry, both intersected counties, source changes, unmatched identities and sales-only inbox scope.

## Historical A+ validation

The supervised read-only aggregate A+ refresh on 2026-09-03 found 98 active Idaho ship-tos and 77 active customer assignments across 20 tax-body groups:

- Seventeen configured Idaho groups at 6% cover 85 ship-tos and match the statewide official rate.
- Undefined `ID000` covers 12 ship-tos and cannot be treated as a verified rate.
- One Idaho ship-to uses Minnesota tax body `MN430` at 7.525%; it is cross-jurisdiction and excluded from Idaho comparison.

No conclusion was made about whether any address is inside one of the 23 resort cities or whether a city's local tax applies to Atlantic's general merchandise. That requires approved address-boundary work plus authoritative rates/scopes obtained from the individual cities.

## Remaining decision and engineering work

Confirm what `ID000` means and whether the `MN430` assignment is intentional. Decide whether TaxAP should contact and maintain evidence from all 23 cities or only cities containing active Atlantic ship-tos. TaxAP remains read-only and made no A+ changes.
