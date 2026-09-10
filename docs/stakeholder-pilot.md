# Stakeholder pilot and operational readiness

Updated September 10, 2026. The application remains read-only toward A+. These are acceptance gates, not a declaration that the hosted installation is production-ready.

## Application behavior delivered

- Every inbox finding can open a review form, retain a reviewer/note/status, and show its event history. Review history includes open and completed records, even after the source finding disappears.
- Approval means ready for manual maintenance. It does not update A+, determine tax liability, or confirm that maintenance occurred. A remaining rate difference stays visible with its saved review status until a comparison actually changes.
- Changed A+/official rate pairs receive separate review keys. Older decisions remain in history. The UI detects concurrent saves and requires refreshed history before retrying.
- Failed state batches, failed Georgia reads, NC fallback/official-source availability, timestamps and other-state unchecked/excluded assignment counts are visible. Whole-read failures retain earlier findings with a warning. Partial batches omit failed states and name them explicitly.
- Coverage counts distinguish actual numeric rate comparisons, deliberate no-tax policy assignments, and unchecked/excluded assignments. A zero finding count is never an all-state or all-assignment clearance.
- New review databases start empty. Earlier seeded Mecklenburg records remain intact and are labeled imported history. The separately documented historical evidence remains accessible.
- Reviewers are still manually selected. Names are not authenticated identities. Do not present this audit trail as signed-in attribution.

## Acceptance session with Ana and Liv

Use the approved restricted test environment and aggregate fixtures or a supervised read-only refresh. Record pass/fail, date and reviewer for each scenario; never put customer-level data in acceptance notes.

| Scenario | Expected result |
|---|---|
| Confirmed non-NC difference | Open finding, inspect official source and scope, record in-review/approval note, reopen history and verify the saved event. A+ remains unchanged. |
| Unverified jurisdiction | Uncertainty is visible; maintenance approval is disabled. No guessed jurisdiction or rate is accepted. |
| Source/batch unavailable | Incomplete-check warning appears, failed states are identified when known, earlier results are labeled as retained and no all-clear is shown. |
| Louisiana/Iowa/Idaho assignment gaps | Unchecked/excluded counts remain visible even when the reader successfully finishes. |
| AK/HI/ND/WY no-tax policy | Approved existing zero assignments are counted separately from official rate matches. Changed/missing definitions remain unresolved. |
| Iowa/Vermont | Sales-tax scope is visible in finding and saved record. Use-tax comparison is not implied. |
| Two reviewers save the same case | The second stale save is rejected; refresh history and inspect the first decision before retrying. |
| Rate changes after resolution | New rate evidence receives a new review record; old decisions remain available. |
| Database restart and restored backup | Reviews, notes and complete event histories survive and match the original counts. |

Automated tests cover persistence, concurrent-save detection, changed-rate identity, coverage arithmetic, API behavior, rendering and backup recovery. They do not replace this human acceptance session or hosted validation.

## Review backups

The SQLite store is separate from A+. Local default: `.data/taxap-reviews.sqlite`; Docker uses its configured database path on the review-data volume. Confirm the actual path from the deployment configuration without copying secrets into logs.

Run the bundled utility with a unique destination on an approved protected backup location:

```powershell
node server/review-backup.mjs .data/taxap-reviews.sqlite .data/backups/reviews-2026-09-10.sqlite
```

The utility includes committed WAL contents, refuses an existing destination and verifies SQLite integrity and review tables. It does not export record contents to the console. A copy on the same host alone is not disaster recovery: IT must set access controls, off-host storage, retention, schedule and ownership before routine use.

For a restore drill, open the backup as a separate test database, compare aggregate case/event counts, and inspect synthetic event history. For an actual restoration, stop the connector, preserve the original database and its WAL/SHM files together, validate the restored copy, then configure the stopped connector to use it. Restart and verify review history through the restricted application. Do not overwrite a running database or discard the original files. Production restoration/deployment requires explicit authorization.

## Remaining rollout gates

1. Ana and Liv complete and approve the acceptance session above.
2. IT restricts application/API access and establishes authenticated reviewer attribution. User identity is separate from SQL workload identity.
3. When the owner resumes hosted Entra work, validate certificate, workload identity, least-privilege SQL access and network path end to end. Until then hosted A+ data remains snapshot/fallback.
4. Agree who owns unresolved assignments, review cadence and backups. The application refreshes while open; it is not a guaranteed unattended monitoring/notification service.
5. Explicitly approve release/deployment of the reviewed commit. No deployment was performed for this readiness work.
