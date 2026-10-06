# Supported component-rate evidence

Implemented and expanded locally October 6, 2026. TaxAP can show a potential component-rate difference while the jurisdiction or combined rate remains unresolved. This evidence does not choose a destination jurisdiction, calculate customer tax, suggest a combined replacement rate, or update A+.

Deployed October6 as implementation4f9e408 after explicit authorization. All33 focused deployed tests passed and all51 source capability descriptions are served. Fresh batch at2026-10-06T17:40:21.816Z refreshed46 checks; Wisconsin retained older evidence because Census returned a Request Rejected HTML page in place of its county Gazetteer.326 returned groups have component evidence across21 states, subject to the safeguards below. NC had zero qualifying component differences. These observed counts are separate from adapter capability; they do not establish all-assignment verification. Review history integrity and public sign-in protection passed; signed-in visual acceptance remains pending. Earlier local-only validation statements below are historical.

## Equivalent components only

The read-only tax-body definition query now includes `TBL1DSC`–`TBL4DSC` beside `TBCLRT1`–`TBCLRT4`. These are free-form local-component labels, not fixed city/county slots. Component position is never used to infer its meaning.

The shared comparison requires:

- A source adapter explicitly identifies a true named city, county or special-scope component. A combined local amount, even if published on a city row, is insufficient for a named-layer comparison.
- Every retained candidate agrees on the component kind, complete normalized name and finite rate. Conflicting, missing or differently scoped components produce no comparison.
- Exactly one A+ local label matches that complete name. Normalization permits case/punctuation, an initial numeric code and a terminal Co./County abbreviation; it does not use fuzzy names or abbreviated place prefixes.
- A finite numeric configured component exists. Zero is valid; absent values are not converted to zero by the comparison.
- The existing 0.001 percentage-point difference threshold applies. Candidate agreement does not confirm physical location.

Alabama candidate evidence uses only its adapter's active general-sales city/county rows. Shared diagnostics exclude future, out-of-scope and inconsistent-identity rejections from component inference. Florida's official county discretionary surtax has an explicit county component marker and uses the same comparison/persistence/display code, including existing matched total-rate findings. The expansion below defines every state's capabilities. Existing 47 wired comparison checks and four no-general-sales-tax classifications are unchanged; capability is not verification of all assignments.

## Expansion and limitations

Fifteen states support named published layers; 29 support a subtotal above the published base, with overlap (31 states overall). The subtotal requires the source base to equal A+'s base, all four configured numeric local fields to reconcile to its stored total, and every candidate total to agree. It compares the sum against the published total minus the published base. The base itself can contain mandatory shared levies (for example, a statewide baseline); the remainder is never represented as a pure city or county levy. No component position or destination name is used to allocate it.

Arkansas retains its separately published city and county fields, including a city component when the county varies; it does not invent the varied county rate. Iowa retains sales LOST layers, treating unincorporated areas as a specifically named scope rather than a county-wide levy. Vermont retains its municipal sales option. Oklahoma retains agreed active sales/use city/county components. Minnesota retains explicitly present county/city map fields; a missing cell is unavailable, while an explicit zero is valid. Its PDF fallback supports only the subtotal. Arizona and Wisconsin retain original component names before composing display labels. Existing SST row semantics support OH, NE, SD and WV; Nebraska's current county levy scope differs from municipal scope and these are not stacked by this feature.

Georgia uses existing boundary-selected rate codes and compares only common named layers when all affected destinations are matched without ambiguity. It cannot compare a majority subset on behalf of unmatched destinations, or infer a component for an excluded cross-state tax body. NC reads the current published base from NCDOR's state-rate table and presents only a subtotal in its existing drawer; absent base metadata disables component evidence without breaking total checks. Its aggregate diagnostics persist safely through source outages.

Statewide-total checks stay in place for ten jurisdictions. ID/MS retain existing restrictions on local scopes; this feature does not add missing resort or city comparisons. AK/HI/ND/WY remain approved deliberate no-tax assignments; DE/MT/NH/OR retain no-general-sales-tax classifications. Unsupported labels, conflicting candidate identities/rates and incomplete source layers remain explicit. This is not destination verification or complete layer-by-layer coverage of every ship-to.

New primary-source verification: [Arkansas published component table](https://www.dfa.arkansas.gov/wp-content/uploads/cityCountyTaxTable_Apr_Jun_2025.pdf) (format evidence, not current rates), [Oklahoma sales-tax scope](https://oklahoma.gov/tax/businesses/sales-use-tax.html), [Vermont municipal local option](https://tax.vermont.gov/business/local-option-tax), [Nebraska city/county scope](https://revenue.nebraska.gov/about/frequently-asked-questions/nebraska-sales-and-use-tax-faqs), [Minnesota official rate/map guidance](https://www.revenue.state.mn.us/sales-tax-rate-calculator), and [NC published state base and county totals](https://www.ncdor.gov/taxes-forms/sales-and-use-tax/sales-and-use-tax-rates/historical-total-general-state-local-and-transit-sales-and-use-tax-rates). Arkansas and Vermont page fetches were blocked by the browsing tool; official search evidence corroborated their formats/scope. Adapters continue to validate current source periods, sums and identity. No claim that all 47 public endpoints were independently fetched during this extension.

Expansion validation: full build/369 tests, lint and TypeScript passed. Added all-51 policy coverage, every subtotal eligibility policy, base/component/total safeguards, candidate intersection/collisions, Arkansas component parsing, Minnesota missing-versus-zero, NC current base/aggregate retention, and GA complete/incomplete/cross-state integration checks. An independent fresh NCDOR HTML fetch/replay confirmed the 4.750% published base, all 100 county totals and the 7/1/2026–Current period. Synthetic actual-component desktop/600px browser inspection passed without document overflow. No production database queries, review writes, commit, push or deployment during this extension. The previous AL/FL validation below remains historical evidence.

## What reviewers see

An assignment card marks “Potential component-rate difference” when supported evidence exists. Its detail shows the A+ component label and rate beside the named official component, using three decimal places. The existing candidate table, source period/retrieval links and jurisdiction explanation remain available. Unsupported comparisons explicitly say that no equivalent component comparison is available, without implying correctness.

Evidence is nested inside the existing aggregate matching diagnostic and survives assignment-gap extraction and retained-state storage through a dedicated allowlist. No customer details, credentials, raw A+ rows or arbitrary candidate properties are included. Existing combined rates, match outcomes, coverage counts, review keys, approval behavior and A+ maintenance boundaries remain unchanged.

Older snapshots lacking labels or component evidence remain readable. Deployment plus a fresh comparison batch is required to populate the new evidence in the hosted application.

## Verified example and sources

A read-only aggregate definition query verified AL9137's local labels: Birmingham at3.500% and Shelby Co. at1.000%. Independently fetching the October2026 Alabama source at2026-10-06T15:47:00.384Z and replaying the verified aggregate returned three Birmingham city candidates at4.000%, a potential0.500 percentage-point component difference, `matched=false` and `officialRate=null`. No customer query or external address submission was needed for this replay.

Primary source semantics: [Alabama file definitions](https://www.revenue.alabama.gov/sales-use/taxrates-file-help/), [Alabama official local rates](https://www.revenue.alabama.gov/sales-use/local-cities-and-counties-tax-rates-text-file/), and [Florida official county surtax table](https://pointmatch.floridarevenue.com/General/DiscretionarySalesSurtaxRates.aspx/DiscretionarySalesSurtaxRates.aspx). Florida's ordinary information page returned an outage notice during this check; county surtax semantics were corroborated by the official PointMatch table and official search evidence, not by that outage response. No Florida rate values or source-fetch behavior changed.

Validation: full production build and361 tests passed; lint, TypeScript and whitespace checks passed. Seven added tests cover real-label-shaped Alabama ambiguity, missing/duplicated labels, conflicting candidates, combined-local rejection, future/scope guards, threshold/zero/privacy behavior, exact read-only fields, retained/gap evidence and a second-state Florida integration. Synthetic-only inspection of the actual shared components verified desktop and600px presentation (585px document width within600px viewport). This is not signed-in hosted acceptance.

No commit, push or deployment performed.

## Capability matrix

Eligibility only: every comparison still requires the evidence checks above. A yes does not assert a completed assignment match. Source links remain in the application registry.

| State | Named published layers | Subtotal above published base | Other supported scope |
| --- | --- | --- | --- |
| AL | Eligible | No | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| AK | No | No | deliberate-no-tax |
| AZ | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| AR | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| CA | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| CO | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| CT | No | No | statewide-total |
| DE | No | No | no-general-sales-tax |
| DC | No | No | statewide-total |
| FL | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| GA | Eligible | No | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| HI | No | No | deliberate-no-tax |
| ID | No | No | restricted-statewide-total |
| IL | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| IN | No | No | statewide-total |
| IA | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| KS | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| KY | No | No | statewide-total |
| LA | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| ME | No | No | statewide-total |
| MD | No | No | statewide-total |
| MA | No | No | statewide-total |
| MI | No | No | statewide-total |
| MN | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| MS | No | No | restricted-statewide-total |
| MO | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| MT | No | No | no-general-sales-tax |
| NE | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| NV | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| NH | No | No | no-general-sales-tax |
| NJ | No | No | statewide-total |
| NM | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| NY | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| NC | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| ND | No | No | deliberate-no-tax |
| OH | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| OK | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| OR | No | No | no-general-sales-tax |
| PA | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| RI | No | No | statewide-total |
| SC | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| SD | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| TN | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| TX | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| UT | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| VT | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| VA | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| WA | No | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| WV | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| WI | Eligible | Eligible | Existing assigned-jurisdiction total; unresolved matches stay unresolved |
| WY | No | No | deliberate-no-tax |
