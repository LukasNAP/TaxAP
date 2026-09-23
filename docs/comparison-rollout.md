# A+ state wiring and comparison coverage

Updated September 10, 2026. User priority: finish comparison wiring before hosted Entra setup. TaxAP monitors assigned tax-body rates and preserves ambiguity; it does not calculate customer tax or write to A+.

## Current coverage

Official sources: 47 connected plus four no-general-sales-tax classifications. Comparison readers: **43 jurisdictions (42 states plus D.C.)**.

- Previously wired: AL, AZ, CA, CO, CT, FL, GA, IN, KY, ME, MD, MA, MI, MS, NJ, NY, NC, OH, PA, TX, VA.
- Added in this batch: NV, RI, DC, WA, NE, WV, IL, SD, WI, UT, NM, AR, TN, OK, KS, MN, MO, SC; VT, IA, ID and LA added in subsequent local continuations.
- AK, HI, ND, WY now run explicit deliberate no-tax policies confirmed by the user September 10. Approved current codes: AK000, HI000, ND000, WY000 and ZTEMP (Wyoming only). The policy requires configured definitions and a zero rate; changed/unknown/retired definitions remain unresolved.
- DE, MT, NH, OR retain explicit no-general-sales-tax classification.

All additions are registered in the findings batch and state drawer. Wiring does not establish complete assignment coverage or verify delivery-address boundaries.

## Verification

Production build, ESLint and all 250 tests passed. Tests cover supported identities, invalid sources, effective periods, ambiguity and shared findings integration. The batch also fixes XLSX empty-cell parsing and New Mexico country classification, preserves Illinois override identities, and replaces South Carolina's external PDF dependency with bundled extraction.

Current local A+ aggregate checks used the existing Windows-authenticated connector without SQL changes. Counts describe assigned tax bodies and their associated ship-tos, not customer tax liability.

| State | Assignments | Compared | Groups compared | Differences | Unmatched | Cross-state |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| UT | 222 | 148 | 35 | 19 | 74 | 0 |
| NM | 89 | 23 | 12 | 1 | 65 | 1 |
| AR | 326 | 223 | 50 | 9 | 102 | 1 |
| TN | 938 | 608 | 79 | 3 | 328 | 2 |
| OK | 272 | 98 | 37 | 11 | 174 | 0 |
| KS | 270 | 209 | 48 | 5 | 60 | 1 |
| MN | 389 | 224 | 38 | 15 | 162 | 3 |
| MO | 520 | 27 | 8 | 4 | 488 | 5 |
| LA | 220 | 1 | 1 | 0 | 217 | 2 |
| ID | 98 | 58 | 13 | 0 | 39 | 1 |
| IA | 270 | 102 | 29 | 0 | 167 | 1 |
| VT | 48 | 28 | 11 | 2 | 20 | 0 |
| SC | 1900 | 1377 | 161 | 4 | 516 | 7 |

Other additions were verified with official sources and synthetic fixtures; current A+ aggregate coverage remains unverified. Public-source checks included NV's 17 county equivalents, WA's 403 locations, NE's 270 municipalities, WV's 101 municipalities, IL's 1,343 general rates and 200 overrides, SD's 254 municipalities, and WI's 71 supported counties with Milwaukee County deliberately unresolved. RI/DC fixtures exercise the flat-state connector and D.C.'s effective-date transition. Individual state notes preserve source details and limitations.

## Remaining work and limits

- State wiring is complete within the confirmed business scope: 43 rate-comparison jurisdictions, four deliberate no-tax policies and four no-general-sales-tax states. Independent registry/backend/UI inventory audit found no missing state or duplicate route classification. No-tax connector checks accounted for AK 8, HI 26, ND 33 and WY 22 assignments (89 total), without any fabricated official rate.
- User selected sales-tax-only comparison for IA/VT. Local-option use tax is not inferred. Idaho resort-tax scope, Louisiana domicile detail and other unmatched identities remain further coverage work.
- Improve unmatched coverage within wired states. Missouri's exact filing-name scope is narrow; Minnesota rejects conflicting official identities; South Carolina retains multi-county ambiguity. Assigned-name/code matching does not prove the delivery address belongs to that jurisdiction.
- Preserve county qualifiers, special tax scopes, effective dates and source conflicts. Do not guess exemptions, tax liability or unidentified locations.
- Validate current A+ aggregates separately from synthetic tests. Keep output aggregate-only and all ERP access read-only.
- Address refresh-failure visibility and the NC-only review form before user acceptance. Hosted connectivity was validated on September 15 through the dedicated SQL login; the app must still label data as snapshot/fallback whenever the connector is not live.

The state-wiring objective is complete under the confirmed no-tax policies; complete assignment matching and application acceptance are separate outstanding work. Committing this batch does not imply deployment or acceptance of unresolved mappings.
