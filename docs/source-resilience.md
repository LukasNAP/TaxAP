# Official-source resilience and Outlook alerts

This work reduces failures; it cannot guarantee government sites always respond or preserve their formats. Never label retained data current or guess rates to reach 47/47.

Official-source reads retry transient network errors and HTTP 408/429/500/502/503/504 at most three times, within their existing deadlines. Certificate failures, HTTP 403 and parser validation failures are not retried automatically. Publisher Retry-After delays exceeding two seconds are returned to the caller rather than ignored.

Each successful all-state comparison saves aggregate evidence in TAXAP_EVIDENCE_DIR, defaulting to state-evidence beside TAXAP_REVIEW_DB. Production therefore uses /data/state-evidence on the existing data volume. Records use atomic replacement and a checksum. Customer/ship-to lists, names, addresses, SQL credentials and tokens are not saved. Restore supports the comparison inbox (including NC/GA), not every standalone state inventory endpoint. A fresh successful read is necessary before a state can have retained evidence.

When a state fails, its prior validated evidence remains visible with source retrieval and comparison timestamps. It is marked stale/unverified, excluded from successful-check totals, and the existing UI approval gate remains blocked while the batch is incomplete. The October 5 release adds independent review-API approval validation against the selected state's current comparison, requiring source and comparison timestamps within the existing six-hour cache window. Reviewer attribution remains manual. Missing/corrupt/unwritable evidence produces visible warnings. Current treatment counts cannot suppress stale findings.

Back up the entire state-evidence directory with the review database. A SQLite-only backup omits it. Stop writes or take a volume snapshot for a consistent multi-file backup. Validate a restored directory with a synthetic failed-state read before relying on recovery. Protect the directory from modification; checksums detect accidental corruption, not malicious changes by someone with file access.

## Source repairs validated October 2, 2026

Missouri now locates exactly one full expected column header instead of requiring row 12. Exact columns, sheet, row count, duplicate codes and rate validation remain required. The official Q4 workbook returned 2,597 validated rows.

Utah permits direct retrieval of the official current-quarter workbook if its directory is unavailable. If the directory responds successfully, the current workbook must still be listed. The workbook's internal effective date must match the current quarter, and component sums and inventory validation must pass. The official Q4 workbook returned 391 validated rows. No prior-quarter substitution occurs.

Primary sources: [Missouri 2026 rate tables](https://dor.mo.gov/taxation/business/tax-types/sales-use/rate-tables/2026/) and [Utah Q4 official workbook](https://files.tax.utah.gov/tax/salestax/rate/26q4combined.xlsx).

## Outlook email preparation

Delivery is disabled by default. Intended recipient is lukasn@atlanticpkg.com. Mail uses Microsoft Graph with a separate app credential; neither SQL authentication nor browser sign-in grants mail access.

Ask IT for an approved sender mailbox and an app authorized to send from that mailbox. IT should restrict the app to the intended sender mailbox using its Exchange access controls. [Microsoft Graph sendMail documentation](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0) documents application Mail.Send permission and 202 Accepted; acceptance is not confirmation of delivery.

Configure the protected deployment .env with these non-secret settings:

```
TAXAP_ALERT_EMAIL_ENABLED=false
TAXAP_ALERT_TENANT_ID=<mail app tenant>
TAXAP_ALERT_CLIENT_ID=<mail app client>
TAXAP_ALERT_SENDER=<approved sender mailbox>
TAXAP_ALERT_RECIPIENT=lukasn@atlanticpkg.com
TAXAP_ALERT_CLIENT_SECRET_FILE=<protected host mail secret file>
```

Store only the secret value in the host file, readable by the app container user. Add docker-compose.email-alerts.yml to both existing Compose files so Docker mounts it at /run/secrets/taxap-alert-client-secret. Do not commit credentials or reuse a personal password. After explicit activation authorization and configuration, set TAXAP_ALERT_EMAIL_ENABLED=true and recreate the app container.

Every observed change in the failed-state set prepares an aggregate outage or recovery email. Identical failures are deduplicated across requests and restarts using alerts.json. Attempts are spaced at least 15 minutes apart; errors/ambiguous delivery may therefore produce a duplicate later. Emails contain only state codes, timestamps and instructions, not raw errors or customer records. A mail error is logged without sensitive detail and shown in the coverage banner.

Alerts currently run when an authenticated all-state batch is requested (including an open dashboard's refresh). This is not unattended monitoring: no browser activity means no check or email. A separately authorized scheduler/monitor is still needed for continuous coverage. No email has been sent or real mailbox credentials tested in this implementation. A whole-batch failure before state results is not covered by per-state email alerts.

Deployment verification October 2: b41f6c9 is deployed, hosted batch succeeded 47/47, and /data/state-evidence contains all 47 aggregate evidence records. Email delivery remains disabled and no real mailbox test has occurred.
