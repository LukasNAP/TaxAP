# TaxAP dashboard-first redesign loop prompt

Continue working on TaxAP until the dashboard-first redesign is complete and verified.

## Critical production safety boundary

A+ and DWStage are production systems.

For this dashboard redesign:

- Do not connect to A+, DWStage, SQL03, APLUS, or any production database.
- Do not start the live A+ connector.
- Do not call any live `/api/aplus/*` endpoint.
- Do not execute SQL through SSMS, `sqlcmd`, application scripts, linked servers, or database tools.
- Do not add or execute `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `EXEC`, `TRUNCATE`, `DROP`, `ALTER`, `CREATE`, or other database-changing statements.
- Do not change A+ tax bodies, customers, ship-tos, rates, or configuration.
- Do not test any proposed A+ write behavior.
- Use existing snapshots, fixtures, mocks, and automated tests for the redesign.
- Preserve the existing SELECT-only connector code unless a UI type adjustment is strictly required.
- If any task appears to require production access, stop and report what needs to be verified manually.
- Live read-only validation will happen later as a separate, explicitly approved step supervised by Lukas.

These restrictions override every other instruction in this prompt. If an acceptance criterion cannot be verified without production access, document it as pending supervised live validation; do not bypass this boundary.

## Start by reading

- `CLAUDE-HANDOFF.md`
- `README.md`
- `app/page.tsx`
- `app/globals.css`
- `app/brand-tokens.css`
- `app/review-workflow.tsx`
- `app/tax-data.ts`
- `server/aplus-connector.mjs`
- `server/official-source-registry.mjs`
- `server/ncdor-rates.mjs`
- `server/sst-rates.mjs`
- `server/ga-boundary.mjs`
- All relevant tests

Before changing any A+ SQL or field behavior, consult the available A+ ERP skill. Follow the existing Atlantic branding rules.

## Objective

Redesign TaxAP around Ana's actual workflow instead of making the map the primary experience.

TaxAP should help Ana answer:

> What newly published sales/use tax-rate changes affect Atlantic's active ship-to locations, and does anything in A+ require review?

The primary interface should be a searchable, filterable rate-change dashboard. Remove the maps from the main workflow. If retaining map code is materially simpler and does not increase bundle size or maintenance burden, it may remain as a secondary optional Coverage view. Otherwise, remove unused map dependencies and code cleanly.

## Required workflow

The application must distinguish these separate concepts:

1. A government source published a new or future rate.
2. The affected jurisdiction contains active Atlantic A+ ship-tos.
3. The official rate differs from the configured A+ tax-body rate.
4. Ana or Liv reviewed the finding and determined whether action is required.

Do not label a publication as an A+ discrepancy until both datasets have passed validation.

## Primary views

Create these user-facing views:

1. **Needs attention**
   - Confirmed official-to-A+ differences
   - Ambiguous jurisdiction matches
   - Source or mapping problems requiring review
   - Highest-priority and already-effective findings first

2. **Upcoming changes**
   - Officially published future rate changes
   - Effective date
   - Current official rate
   - New official rate
   - Current A+ rate
   - Number of affected active ship-tos
   - Days until effective
   - Review status

3. **All jurisdictions**
   - Searchable and filterable state, county, city, and special-jurisdiction inventory
   - Official rate
   - A+ rate
   - Difference
   - Active ship-to count
   - Effective date
   - Official-source status
   - Last checked time

4. **Review history**
   - Reviewer
   - Decision
   - Notes
   - Timestamp
   - Finding and jurisdiction
   - Evidence used

## Dashboard requirements

Add a concise summary at the top showing:

- Findings needing attention
- Upcoming changes
- Affected active ship-tos
- Connected official state sources
- Last successful refresh

The main table should include, where available:

- Effective date
- State
- County, city, or jurisdiction
- Jurisdiction type
- Published official rate
- Configured A+ rate
- Difference
- Active ship-tos
- Publication/source status
- Review status
- Link to official evidence

Add useful filters:

- State
- Jurisdiction type
- Effective-date range
- Review status
- A+ comparison status
- Connected/unavailable source
- Search by jurisdiction or tax-body code

Use clear statuses such as:

- Needs review
- Upcoming
- A+ differs
- A+ matches
- Already handled
- Not applicable
- Ambiguous
- Source unavailable

## Data and safety constraints

- Preserve the existing read-only A+ connector without contacting it during this task.
- Never write to A+.
- Do not expose customer names, addresses, invoices, credentials, or tokens to the browser.
- Only aggregate ship-to counts may reach the frontend.
- Preserve the existing NC and Georgia official-source adapters and Georgia boundary work.
- Do not invent or guess official rates.
- A missing, malformed, stale, or ambiguous source must produce an unavailable or review state.
- Keep review decisions in TaxAP.
- Retain suppression of retired tax bodies such as `DO NOT USE`, `DONT USE`, `DON'T USE`, `INACTIVE`, and `OBSOLETE`.
- Keep Ana and Liv as temporary reviewer options until Entra ID is implemented later.
- Authentication, deployment, Docker, Azure resources, automatic A+ maintenance, and new state adapters are outside this task.
- Do not commit, push, deploy, reset, stash, or discard existing work.
- Preserve unrelated existing changes.

## Implementation loop

Repeat this loop until every locally verifiable acceptance criterion is met:

1. Inspect the current implementation and separate map-specific presentation code from reusable tax-rate and review data.
2. Maintain a concise implementation plan with only one step in progress at a time.
3. Implement one coherent portion of the redesign.
4. Run the relevant automated tests and lint checks.
5. Inspect the rendered structure using only the web application, fixtures, mocks, or fallback snapshots. Do not start or contact the production connector.
6. Fix failures, accessibility problems, confusing states, and regressions.
7. Continue to the next portion without stopping merely because one intermediate step passes.
8. Stop only when the acceptance criteria are satisfied or a genuine blocker cannot be resolved without prohibited production access or a new user decision.

Prefer adapting existing components and data structures over duplicating logic. Keep backend comparison behavior separate from presentation. Update or add tests for the redesigned workflow.

## Acceptance criteria

Do not declare completion until all locally verifiable criteria are true:

- The application opens on a dashboard, not a map.
- Ana can immediately see what needs attention and what is upcoming.
- Existing NC and Georgia data shapes and adapter integrations remain supported, verified through tests, fixtures, or mocks rather than live A+ calls.
- A+ matches are visually different from confirmed discrepancies.
- New publications are not automatically treated as A+ problems.
- State, jurisdiction, effective-date, comparison, and review filters work.
- Official evidence links and retrieval details remain available.
- Review decisions and history still work using TaxAP's local test storage.
- Customer-level data never appears in browser responses, fixtures, or rendered HTML.
- Empty, loading, source-unavailable, and error states are clear.
- The interface remains responsive and accessible.
- Atlantic branding is preserved.
- Obsolete map code and dependencies are removed if no longer used.
- `README.md` and `CLAUDE-HANDOFF.md` accurately describe the redesigned workflow and the deferred live-validation step.
- The complete test suite passes without contacting production.
- Lint passes.
- The production build passes locally.
- `git diff --check` passes.
- No secrets are introduced.
- No production connections, A+ writes, commits, pushes, or deployments occur.

Do not claim live NC or Georgia validation occurred. Record it as a pending, separately approved step.

## Final report

At the end, report:

- What changed
- What was preserved
- Files changed
- Tests and validation performed
- Confirmation that no production system was contacted
- Items intentionally left for supervised live validation
- Any remaining limitations
- The safest next step

Do not stop after only writing a plan. Continue implementing and validating until the locally verifiable acceptance criteria are satisfied.
