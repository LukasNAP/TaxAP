# Alabama assignment review — October 6, 2026

## Outcome

Start human review with AL9137 (Alabama Birmingham), the largest unmatched Alabama assignment group: 48 active ship-tos. There is both unresolved jurisdiction identity and a potential outdated rate component. This investigation does not establish a correct replacement tax body or customer tax rate. No A+ changes or production review decisions were made.

## Evidence and timing

Read-only hosted connector queries against the configured SQL03/DWStage/A+ path succeeded at 2026-10-06T13:04:16Z. Existing state-detail and affected-ship-to queries were used without changing SQL. Customer identities and addresses were processed only inside the application container; only aggregate completeness and postal-city counts were returned. Nothing was sent to an external address lookup.

The retained Alabama comparison was validated October 5 at 16:25:06Z using the October 2026 official file. The official current CSV was independently fetched October 6 and the relevant rows rechecked. The retained comparison source hash is `1869be3d39e1d1816ddb5a75359af432b6b36f35ec6cdf50bb4456642f646972`; this is the retained snapshot hash, not a hash of the independently fetched CSV.

Primary sources:

- [ALDOR current local-rate file](https://www.revenue.alabama.gov/sales-use/local-cities-and-counties-tax-rates-text-file/), including [current CSV](https://www.revenue.alabama.gov/wp-content/uploads/2024/03/taxrates_current.csv).
- [File field definitions](https://www.revenue.alabama.gov/sales-use/taxrates-file-help/): sales tax is ST; general rate category is GENER; county tax references are separate from county-number metadata.
- [County code explanations](https://www.revenue.alabama.gov/sales-use/city-and-county-tax-rates/): 7237 is a restaurant alcohol tax scope, not a general county rate. The page explains that Jefferson's special revenue levy is incorporated into 7037; its historical date wording is inconsistent, so this packet relies on the current CSV's active-date/rate fields rather than interpreting those historical dates.

## AL9137: Birmingham — 48 ship-tos

A+ definition: base 4.000%; local components 3.500%, 1.000%, 0.000%, 0.000%; stored total 8.500%. The components reconcile arithmetically. Their intended jurisdiction labels were not retrieved, so component order alone does not establish county identity.

The matcher finds three general-sales Birmingham corporate-limit rows under locality code 9137 and stops because the code is not unique. It does not select a combined official rate.

| Official candidate key | City component | County reference | Supported general county component |
| --- | --- | --- | --- |
| AL:9137:7037:CL | 4.000% | 7037 — Jefferson County | 2.000%, active January 1, 2025 |
| AL:9137:7058:CL | 4.000% | 7058 — Shelby County | 1.000%, active April 1, 2001 |
| AL:9137:7237:CL | 4.000% | 7237 — Jefferson Co Restaurant Alcoh | None: its ST row is category ALCOH, 3.000%, not GENER |

All three city rows are active September 1, 2024, with PJ=N. The 7237 reference is not a third physical county, and a missing supported general component must not be treated as zero. Filtering that reference would still leave Jefferson and Shelby alternatives; it would not resolve all 48 destinations.

Internal address completeness: 48/48 rows returned, all have postal city and postal code, but one lacks street line 1. Of 48 postal city labels, 35 normalize to Birmingham (including one trailing-comma variant), one says Pratt City, and 12 use other city labels. Other labels include Bessemer, Scottsboro, Robertsdale, Tuscaloosa, Oxford, Vestavia Hills, Hoover, Homewood, Mountain Brook and Adamsville. These are aggregate labels, not verified physical jurisdictions. Mailing-city labels cannot certify municipal limits or county boundaries.

**Classification:** tax-team confirmation required, with a potential stale city component and possible mixed jurisdiction assignments. The current official city component is 4.000%, versus A+'s 3.500% first local component; this is evidence to investigate, not authorization to change a rate or calculate customer tax.

## Two next groups

| Tax body | Active ship-tos | Current evidence | Next decision |
| --- | --- | --- | --- |
| AL7058 — Alabama Birmingham(Shelby | 25 | A+ total 9.000%, components 4.000% + 4.000% + 1.000%. The code points to official Shelby County, while the description expects Birmingham; the match is rejected by the name check. | Confirm whether this is intentionally a combined Birmingham/Shelby body. An explicitly supported crosswalk may be appropriate after confirming scope; do not broadly relax name checks. |
| AL9145 — Alabama Huntsville | 23 | A+ total 9.000%, components 4.000% + 4.500% + 0.500%. Official city candidates reference Limestone (7042, 2.000%) and Madison county-wide (7745, 0.500%). | Confirm physical county and city limits for affected destinations before selecting a candidate. Equal component arithmetic does not prove location. |

## Review steps for Ana or Liv

1. In Needs attention, open Assignment reviews, Alabama, AL9137, then its affected ship-tos and official candidates. Use the authenticated application for customer details; do not copy them into repository documents or chat.
2. Confirm the intended scope of AL9137 and its local components: Birmingham corporate limits in which county, or another supported tax scope? Identify whether it is intentionally shared across different destinations.
3. Verify destination county and municipal limits using approved boundary evidence. Prioritize the missing street address and the non-Birmingham postal labels. Do not infer boundaries from city name or ZIP alone.
4. Separate confirmed destination groups. Decide whether each needs manual A+ assignment/rate maintenance, an approved code-to-jurisdiction crosswalk in TaxAP, or further evidence. Do not substitute the configured rate for jurisdiction evidence.
5. The tax team performs any approved A+ maintenance through its normal process. Refresh TaxAP afterward and check that counts, assignments and findings agree with the confirmed scope.

Suggested internal question: “I checked the largest Alabama group, AL9137, which has 48 active ship-tos. Its definition is Birmingham at 8.500%, and the official city component differs from its stored local component. The assignments also have several postal city labels. Can we confirm the intended county/city scope and review the affected destinations before deciding which A+ corrections or TaxAP mappings are appropriate?”

## Follow-up application work

Consider explicit, source-backed county-reference scope explanations for Alabama candidate rows, including 7237. Confirmed business crosswalks may resolve codes such as AL7058. Neither change should silently choose a jurisdiction for mixed or unverified destinations. Address/boundary verification remains separate from code matching.

Verification was read-only live query success, count reconciliation (48 returned/48 active), A+ component arithmetic and independent official CSV/code-explanation checks. No runtime code changed, so lint/build/test suites were not rerun. No commit, push or deployment performed.
