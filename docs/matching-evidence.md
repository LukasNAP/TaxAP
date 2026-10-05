# Matching evidence across states

Implemented locally October 5, 2026; not released. This extends the Alabama diagnostics described in [alabama-matching-evidence.md](alabama-matching-evidence.md).

## What reviewers see

Assignment reviews now share a matching-evidence display: the batch's state, A+ tax-body description, lookup value/type/county hint where available, rejection reason, official rows considered, next steps and source retrieval/period/fingerprint/links. Ambiguous rate findings also carry this evidence, including cases where several candidates share a rate or Texas's existing comparison reports a discrepancy against a bare official locality. This does not turn those findings into confirmed jurisdiction identities.

All wired comparison paths supply an explanation: direct-mapping adapters record their rejection branches; statewide checks explain exclusions outside the supported code and missing rates; NC records missing official-code matches or configured rates; GA retains its existing public boundary failure categories/counts and component rows for inconsistent assignment groups. The four approved deliberate no-tax policies explain assignments that fail their conditions without inventing an official zero rate. Source coverage remains distinct from completed A+ comparison coverage. DE, MT, NH and OR remain no-general-sales-tax classifications, not newly added rate comparisons.

Detailed candidate work includes Texas, Virginia, Minnesota and Iowa. Other adapters retain candidate rows where their existing lookups provide them, including code/name disagreements, duplicate names, mixed Louisiana parish scopes and Idaho location-dependent exclusions. A failed lookup or scope exclusion may legitimately have no candidate rows. The display explicitly distinguishes missing candidates from a confirmed match; it does not run a broader guessed place-name search.

## Data and behavior boundaries

- Matching decisions, compared rates, coverage arithmetic, confidence, SQL and review approval gates are unchanged. No A+ writes or customer-tax calculation.
- Candidates come from the same validated, state-scoped source snapshot used by the adapter. Matching a name/code identifies an assigned jurisdiction only; ship-to physical location remains a separate status.
- Candidate totals and partial components are labeled separately. Alabama keeps its county-tax-reference/component display. Georgia components do not establish a combined destination rate.
- Nested allowlists retain only tax-body matching inputs, public source metadata and official jurisdiction fields. No customer names, addresses, identifiers, ZIP values, geometry or credentials enter the diagnostics.
- Diagnostic evidence follows its original batch, including persisted rate findings during an outage. Refreshing the state drawer alone does not update that evidence. Failed states still supply no current assignment counts.
- Older payloads without specific branch evidence say that diagnostics are unavailable; they do not infer a rejection cause. State-level aggregate groups do not invent tax-body candidates or affected ship-to lists.

## Verification

Full build and all 354 tests passed. Regression coverage exercises TX conflicting/equal rates and county hints, VA city/county selection, MN identity/rate conflicts, IA mixed counties/cities, no-tax and statewide exclusions, GA aggregate privacy, retained diagnostic storage and source-link handling. Lint, TypeScript and whitespace checks passed.

An independent temporary replay ran 86 existing adapter tests against both the prior committed matcher and the edited matcher, comparing outputs after removing only diagnostics and retrieval timestamps. All 86 passed with unchanged matching, rate, confidence and aggregate outcomes. No SQL or customer-detail queries were needed. Synthetic component browser inspection verified the shared candidate table at desktop and 600px widths; this is not signed-in hosted acceptance. Temporary preview and replay files were removed.
