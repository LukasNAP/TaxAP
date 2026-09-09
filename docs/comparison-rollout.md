# Remaining A+ comparison rollout

Updated September 9, 2026. User priority: finish comparison wiring before hosted Entra setup. TaxAP monitors assigned tax-body rates and preserves ambiguity; it does not calculate customer tax or write to A+.

## Current coverage

Official sources: 47 connected plus four no-general-sales-tax classifications. Comparison readers: **39 jurisdictions (38 states plus D.C.)**.

- Previously wired: AL, AZ, CA, CO, CT, FL, GA, IN, KY, ME, MD, MA, MI, MS, NJ, NY, NC, OH, PA, TX, VA.
- Added in this batch: NV, RI, DC, WA, NE, WV, IL, SD, WI, UT, NM, AR, TN, OK, KS, MN, MO, SC.
- Remaining connected sources without readers: AK, HI, ID, IA, LA, ND, VT, WY.
- DE, MT, NH, OR retain explicit no-general-sales-tax classification.

All additions are registered in the findings batch and state drawer. Wiring does not establish complete assignment coverage or verify delivery-address boundaries.

## Verification

Production build, ESLint and all 230 tests passed. Tests cover supported identities, invalid sources, effective periods, ambiguity and shared findings integration. The batch also fixes XLSX empty-cell parsing and New Mexico country classification, preserves Illinois override identities, and replaces South Carolina's external PDF dependency with bundled extraction.

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
| SC | 1900 | 1377 | 161 | 4 | 516 | 7 |

Other additions were verified with official sources and synthetic fixtures; current A+ aggregate coverage remains unverified. Public-source checks included NV's 17 county equivalents, WA's 403 locations, NE's 270 municipalities, WV's 101 municipalities, IL's 1,343 general rates and 200 overrides, SD's 254 municipalities, and WI's 71 supported counties with Milwaukee County deliberately unresolved. RI/DC fixtures exercise the flat-state connector and D.C.'s effective-date transition. Individual state notes preserve source details and limitations.

## Remaining work and limits

- Implement the eight remaining readers only where official rate scope and assigned jurisdiction can be established. IA/VT local-option sales rates must not be treated as use-tax rates; HI optional GET pass-on needs a business decision. AK nonmember scope, ID resort taxes, LA domicile mapping, and ND/WY catch-all assignments remain unresolved.
- Improve unmatched coverage within wired states. Missouri's exact filing-name scope is narrow; Minnesota rejects conflicting official identities; South Carolina retains multi-county ambiguity. Assigned-name/code matching does not prove the delivery address belongs to that jurisdiction.
- Preserve county qualifiers, special tax scopes, effective dates and source conflicts. Do not guess exemptions, tax liability or unidentified locations.
- Validate current A+ aggregates separately from synthetic tests. Keep output aggregate-only and all ERP access read-only.
- Address refresh-failure visibility and the NC-only review form before user acceptance. Keep hosted data labelled snapshot/fallback until connectivity is validated.

The nationwide objective is not complete. Committing this batch does not imply deployment or acceptance of unresolved mappings.
