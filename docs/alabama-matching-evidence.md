# Alabama assignment matching evidence

Prepared October 5, 2026. This feature explains existing read-only comparison outcomes; it does not change matching, select a jurisdiction, calculate customer tax or update A+.

## Evidence shown in assignment review

Alabama's matcher records the exact rejection branch, locality code, normalized description/name-check token, county hint and complete official rows considered at that step. The drawer distinguishes duplicate locality rows, a missing code, rejected name check, missing/ambiguous county hint, unavailable rate and excluded scope. A rejected official row is not presented as a confirmed candidate for the destination.

Each official row shows its locality name/code/type, effective date, local component and county-tax reference. County references are resolved only by their exact official code against published general-sales county rows. If no reference row is available, its code remains visible with an explicit unresolved label. No names or rates are inferred. Components are not labeled as a confirmed combined rate. The panel includes source period, retrieval time, fingerprint and official source/CSV links. Missing/older diagnostics keep the existing fallback and prompt a queue refresh. Narrow screens stack complete candidate rows.

The current matcher rejects multiple general locality rows before applying a county hint. The explanation makes that stop visible; showing the hint and candidate rows does not imply the hint was accepted. Repeated city codes can refer to different county-tax scopes within the same county, not just multiple counties. Official public evidence: [Alabama DOR current rate files](https://www.revenue.alabama.gov/sales-use/local-cities-and-counties-tax-rates-text-file/) and [field definitions](https://www.revenue.alabama.gov/sales-use/taxrates-file-help/). The CountyCode field is a county-tax locality reference, not a FIPS identifier or proof of a ship-to boundary.

## Aggregate replay verification

Replayed the hosted aggregate AL evidence validated at2026-10-05T14:52:59Z against freshly validated official data with source period2026-09-01. Read only the saved tax-body descriptions, codes, rates and aggregate counts; no SQL or customer-detail query was executed. All102 previously comparable groups retained their matched/unmatched outcome and official rate. All37 unmatched groups received an explanation:

| Rejection reason | Groups |
| --- | ---: |
| Multiple official general-sales rows share the locality code | 26 |
| Code's official locality fails the existing description/name check | 5 |
| County hint has no available unambiguous county component | 4 |
| County hint identifies multiple county names | 1 |
| No supported official locality row for the code | 1 |

These are assignment groups across tax treatments, not the19 Alabama rate-risk findings previously removed from the rate queue. They do not establish that an A+ assignment is incorrect. Excluded/missing-definition groups receive separate diagnostics but were not present in this saved comparable-group replay.

Example public-source evidence: locality9149 has MOBILE rows referencing7049 (MOBILE COUNTY) and7749 (MOBILE COUNTY CL PRICH & MOBIL). Both city components are5.000%; the referenced county components are1.500% and1.000%. Those components explain why the existing unique-row guard stopped; they do not establish the appropriate combined rate for a customer. Resolving tax-scope applicability or changing matching requires a separately reviewed task with authoritative evidence.

## Validation and delivery

Production build,345 tests, lint, TypeScript and whitespace checks passed. Tests cover candidate retention/order, exclusion of police-jurisdiction rows, rejected-name/code evidence, county-hint outcomes, unchanged resolved rates, scope exclusions, queue propagation and nested diagnostic allowlisting across persistence/restart. Offline component inspection verified actual candidate evidence at desktop and600px widths. No production review events were created. Changes remain local; no commit, push or deployment requested for this task.
