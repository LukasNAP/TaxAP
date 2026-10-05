# Jurisdiction identity and ship-to location audit

Audit date: October 5, 2026. Baseline: main, d05e679 (also the remote main HEAD when checked). Scope: current comparison code, documented conventions, synthetic inputs and existing local tests. No production records were queried, no customer addresses were submitted to external services, and no application, SQL or matching behavior was changed.

Implementation follow-up, October 5: the user subsequently authorized local ambiguity fixes and separate identity/location statuses. AL county/code selection, TX explicit-county selection and VA duplicate-name handling are hardened; the VA current official row-shape mismatch was also corrected. The UI and aggregate evidence now distinguish identity from address verification; equal-rate variants do not imply unique identity. See HANDOFF.md for validation and release status. The findings below describe the audit baseline and are retained as historical evidence; broader geography/address validation remains future work.

## Conclusion

TaxAP isolates official inventories by state, but a successful assigned-tax-body rate comparison generally does not establish that each ship-to physically belongs to that jurisdiction. Of the 47 wired paths, 43 compare rates and four enforce deliberate no-tax policies. Georgia is the only path that performs ship-to address/ZIP boundary matching; its matches include several evidence levels, not exclusively street-address matches. DE, MT, NH and OR have no-general-sales-tax classifications outside these 47 paths.

Duplicate names across states are largely handled by choosing a state-specific source. Within-state duplicate names, city/county distinctions, county slices and special districts need separate controls. There is no universal geography certification covering every record.

Three distinct questions should remain visible:

1. Is this an official jurisdiction within the selected state?
2. Does the A+ tax body identify that same jurisdiction and rate scope?
3. Does this particular ship-to physically belong in that jurisdiction?

Equal rates answer none of these identity questions by themselves.

## Priority findings

### 1. Ambiguous county hints and candidate selection can produce a match

- **Alabama:** `server/al-aplus.mjs:63` uses the first county name starting with up to four characters from a parenthetical hint. It does not require exactly one matching county. A synthetic `Saint` hint with `SAINT ALPHA` and `SAINT BETA` selected the first county and produced a matched rate. The locality code and short name check do not resolve the county ambiguity. Replace prefix selection with candidate collection and a unique reviewed identity; unresolved hints must remain reviewable.
- **Texas:** `server/tx-aplus.mjs:46` selects the first matching county among same-locality candidates. Two synthetic entries for the same locality and county, with different totals, produced a match to the first entry. Require a unique scope after county filtering. Its separate same-rate-variants branch supports a rate conclusion without a unique identity; its matches-no-candidate branch can establish a discrepancy against the candidate set but cannot identify the delivery jurisdiction. Preserve those distinctions instead of presenting a representative row as physical jurisdiction proof.

These are reproduced code behaviors, not confirmed errors in current customer assignments. Official source validation upstream may narrow which input shapes occur; the matching boundary should still refuse conflicting identities explicitly.

### 2. Duplicate identity handling is inconsistent

`server/va-aplus.mjs:25` overwrites a previous official row for the same bare name and jurisdiction type. Reversing two synthetic same-name county rows changed the matched official rate from 6.000% to 5.300%. The official parser currently rejects duplicate FIPS codes and validates the 95-county/38-city shape, but does not reject duplicate name/type keys with distinct codes. Add that guard to both source and comparison boundaries. The existing bare-name county preference is a documented A+ convention; it does not prove that a ship-to belongs to the county rather than its same-named independent city.

Other maps worth hardening: AZ city/county names, NY type/name keys and OH county/special keys. AL source parsing already rejects duplicate general-sales locality keys, but its comparison map itself has no duplicate-code guard. CO's numeric-code branch uses first-match selection. These are inspection risks, not additional reproduced production failures.

### 3. Matching evidence is not carried through consistently

The generic reconciler checks that the A+ snapshot has the expected state, then returns a label, rates and `matched`; it does not preserve the selected official jurisdiction ID, jurisdiction type or match method (`server/direct-mapping-aplus.mjs:14`). The dashboard labels matched discrepancies `confidence: confirmed` (`app/dashboard-findings.ts:170`). That describes the implemented rate comparison, not the physical location of all affected ship-tos.

Recommended evidence fields: state, official identifier namespace and code, jurisdiction type, county context where applicable, match method, identity status, address-verification status, scope and source period. Keep Census geography codes distinct from state tax-agency location codes. Require official-source state consistency at the comparison boundary; NJ and LA already have explicit snapshot-state guards, while many direct readers rely on their fixed reader/source selection.

### 4. Physical assignment validation is largely absent

Most comparisons operate on aggregate tax-body groups selected using the stored A+ state field. They do not independently locate addresses. `describesOtherJurisdiction` screens code prefixes and selected descriptive phrases; it deliberately avoids interpreting single-word state names as states because they can be legitimate locality names. It is a useful screening rule, not a geographic validator (`app/tax-body-policy.ts`). Dirty/unrecognized state values are excluded before state comparisons and reported separately.

GA validates boundary state FIPS 13 (`server/ga-boundary.mjs:135`) and rejects conflicting active candidates. It exposes address, ZIP+4, ZIP5 and ZIP5-from-ZIP+4 tiers. Mixed tax-body groups use a representative majority jurisdiction and remain unverified in the dashboard. Unmatched/ambiguous assignments can also coexist with matched assignments within a group; a consistent matched subset is not proof that the entire group was checked.

Add address checks in stages using authoritative tax boundary data or approved official lookup services. Do not send customer addresses to a third party without a separate privacy decision. Mailing city and ZIP alone must not be treated as legal tax boundaries.

## Complete wired-path inventory

Unless the row says GA, physical ship-to location is **not independently verified**. “Rejects duplicates” describes the listed matching guard, not a claim that all possible bad inputs are covered. Each abbreviation below refers to `server/<lowercase-state>-aplus.mjs` unless another file is named.

| State | Assigned-jurisdiction identity and ambiguity handling | Main remaining geography concern |
|---|---|---|
| AK | Explicit configured-zero policy: AK000; no official rate match | Policy is not geography/exemption proof |
| AL | Official locality code plus short name check; county hint prefix | First county prefix match; multi-county identity |
| AR | Official location code plus exact normalized name; duplicate codes rejected | Assigned scope, not delivery boundary |
| AZ | County suffix or city name plus explicit/static county crosswalk | Map duplicates and multi-county membership |
| CA | Name plus city/county type; requires exactly one candidate | No delivery boundary check; truncated county hints may be stripped |
| CO | Six-digit official code, otherwise name and optional county; name fallback requires one candidate including variants | Numeric branch lacks the same uniqueness/name guard |
| CT | CT000 statewide via flat-state reconciler | Stored state trusted; special treatment outside general scope |
| DC | DC000 statewide via flat-state reconciler | Stored state trusted; tax treatment separate |
| FL | Validated county name; numeric suffix is not assumed alphabetical | Actual county assignment unverified |
| GA | Official FIPS/boundary address ranges, then ZIP tiers; conflicting candidates rejected | Show tier and unchecked subset; mixed groups stay unverified |
| HI | Explicit configured-zero policy: HI000 | Policy is not geography/exemption proof |
| IA | County/city names; county or same-name city variants compared only if totals agree | Uniform rate does not establish a unique locality; sales scope only |
| ID | Public Idaho city/county inventory; duplicate names rejected; resort intersections withheld | Geography inventory checks public areas, not customer addresses |
| IL | Official location ID; shortened prefix must resolve uniquely; address overrides withheld | Code identifies scope without checking actual delivery address |
| IN | IN000 statewide via flat-state reconciler | Stored state trusted |
| KS | Unique name; special/alphanumeric code must also agree | Delivery district membership unverified |
| KY | KY000 statewide via flat-state reconciler | Stored state trusted |
| LA | Unique domicile name and validated parish context; parish total only when uniform | Parish uniformity/identity does not locate ship-to |
| MA | MA000 statewide via flat-state reconciler | Stored state trusted |
| MD | MD000 statewide via flat-state reconciler | Stored state trusted |
| ME | ME000 statewide via flat-state reconciler | Stored state trusted |
| MI | MI000 statewide via flat-state reconciler | Stored state trusted |
| MN | Name and official county context; ambiguous areas withheld; multiple same-name rows allowed only for uniform totals | Equal totals do not prove identity or boundary |
| MO | Exact unique name across all variants; sales/interstate scope must agree | Address-level jurisdiction still unverified |
| MS | MS000 statewide via flat-state reconciler | Stored state trusted |
| NC | Fixed reviewed NC001–NC100 county crosswalk; official rows read by county name | Internal sequence is not FIPS; actual ship-to county unverified |
| ND | Explicit configured-zero policy: ND000 | Policy is not geography/exemption proof |
| NE | Official city code plus exact name; duplicate codes rejected | Actual city membership unverified |
| NH/DE/MT/OR | Not wired checks: intentionally no-general-sales-tax classifications | Separate from the 47 paths; not physical-location checks |
| NJ | NJ000 and exactly one NJ statewide row; both snapshot states validated | Stored state trusted; business/special treatment separate |
| NM | Official GRT location code plus exact name, city scope only; duplicate codes rejected | GRT scope and delivery location separate |
| NV | Complete 17-county-equivalent inventory; unique county names | Internal tax-body numbers are not FIPS; actual county unverified |
| NY | Type/name map; explicit county/city suffix, aliases; bare label tries city before county | Name/type duplicates and future ambiguous bare names need guards |
| OH | County name plus documented tax-body/transit-code crosswalk | Surcharge membership and name/code agreement need independent evidence |
| OK | Official COPO code plus exact name; duplicate codes rejected | Actual city/county membership unverified |
| PA | PA001 maps Philadelphia; PA000 compares statewide base | PA000 does not prove exclusion from Philadelphia/Allegheny |
| RI | RI000 statewide via flat-state reconciler | Stored state trusted |
| SC | Unique county/municipality label; multi-county cities withheld | No address membership verification |
| SD | Unique municipality name; duplicate normalized names rejected | Municipality boundary not checked |
| TN | Official code plus exact name; requires one code candidate | Actual situs membership unverified |
| TX | Locality plus optional county; uniform variants or candidate-set discrepancy allowed | First county candidate; rate conclusion differs from unique identity |
| UT | Official code plus exact name; requires one remaining candidate | Actual jurisdiction boundary unverified |
| VA | Bare name plus county/city convention; explicit city suffix | Duplicate same-type overwrite; assignment location unverified |
| VT | Unique official municipality names and sales-only scope | Municipality boundary not checked |
| WA | Unique official four-digit location code; special categories excluded | Name is not cross-checked; delivery location unverified |
| WI | Unique county names, explicit Milwaukee city composition; Milwaukee county withheld | Actual county/city membership unverified |
| WV | Unique municipality name; explicit reviewed no-local-rate code | City vs outside-city location unverified |
| WY | Explicit configured-zero policy: WY000 and ZTEMP | Policy is not geography/exemption proof |

Flat-state paths share `server/flat-state-aplus.mjs`; dispatch and completeness are in `server/aplus-connector.mjs` (10 flat, NJ, 34 direct/policy, NC and GA = 47).

## Implementation sequence for a later selected task

1. Close AL/TX first-candidate and VA overwrite risks with synthetic regression tests; review additional unchecked maps and code-only branches. Preserve legitimate documented conventions and distinguish ambiguous identity from uniform-rate evidence.
2. Carry official identity and match-method evidence through findings, review history and the UI. Show address status separately, defaulting to not checked; avoid implying a name/code comparison certifies every address.
3. Add a state-scoped authoritative geography reference for county/city existence, with type and full identifiers. Treat multi-county places as relationships, not a one-city-to-one-county assumption. This validates jurisdiction identity, not tax applicability.
4. Select address-boundary pilots with Ana/Liv based on current review demand. CA/TX/CO/AL and PA catch-all scope are useful candidates; inventory volume and authoritative source availability should determine order. Keep ambiguity and unavailable evidence visible and leave A+ maintenance manual.

## Verification and limitations

- Clean initial working tree; local HEAD and remote main both d05e679. Registry inspected for all 47 paths.
- 147 existing comparison, import, connector, GA boundary and NC source tests passed locally. They do not cover all identity failure modes found here.
- Six synthetic cases executed directly against the current modules without source edits: VA duplicate name/type in both orders; AL conflicting county hint; TX conflicting same-locality/same-county variants; CA duplicate city; UT duplicate code/name. VA/AL/TX accepted the problematic inputs; CA/UT returned unmatched.
- This is a code and input-contract audit. It does not establish prevalence in current official feeds or A+ records, nor validate current hosted connectivity or deployed behavior. No build/lint was needed for documentation-only changes; whitespace and inventory completeness were checked separately.

## Authoritative geography guidance

[Census GEOID guidance](https://www.census.gov/programs-surveys/geography/guidance/geo-identifiers.html) explains why full county identifiers include the state code and why a county suffix alone is not nationally unique. These are geography identifiers, not a replacement for state tax-agency jurisdiction codes.

[CDTFA rate guidance](https://www.cdtfa.ca.gov/taxes-and-fees/know-your-rate.htm) distinguishes mailing addresses from actual city/county limits and directs users to address-based tax-rate lookup. This supports keeping mailing-city/ZIP evidence separate from tax-boundary verification.
