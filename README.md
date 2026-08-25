# TaxAP

TaxAP is an internal sales and use tax rate monitoring application for Atlantic Packaging. Its dashboard helps Ana distinguish newly published government rates, jurisdictions relevant to Atlantic ship-tos, confirmed A+ differences, and completed human reviews. TaxAP presents evidence and aggregate impact for review; it does not update A+.

## MVP scope

- Dashboard-first rate-change inbox with separate attention, upcoming, jurisdiction, history, and source views
- Read-only A+ state coverage across official U.S. state codes when the connector is explicitly enabled
- Official-rate adapters for North Carolina, Georgia, California, Texas, Florida, Pennsylvania, Ohio, and Tennessee, plus a preserved Georgia rate/boundary adapter
- General sales and use tax rates only
- Only jurisdictions containing active A+ ship-to addresses
- Read-only extraction from A+
- Planned scheduled source checks and effective-dated comparisons
- Human confirmation or dismissal of every discrepancy
- Audit evidence for the source, time checked, effective date, and decision
- No automatic A+ changes

The repository contains a working local MVP, not a tax calculation system. The map-based workflow was retired on August 25, 2026. The application now opens on a rate-change dashboard backed by a validated aggregate North Carolina fallback snapshot, with production refresh intentionally reserved for a separate supervised step. No customer names, addresses, invoice numbers, or other record-level data are stored in the application or repository.

## Working application

- Open directly to a rate-change dashboard showing needs-attention, upcoming-change, affected-ship-to, source-coverage, and freshness summaries.
- Keep government publication, Atlantic relevance, A+ comparison, and human review as distinct workflow stages.
- Use dedicated **Needs attention**, **Upcoming**, **All jurisdictions**, and **Review history** views.
- Search and filter jurisdiction records by state, jurisdiction type, effective-date state, review status, A+ comparison status, official-source availability, jurisdiction name, and tax-body code.
- Select any covered U.S. state to query its aggregate active ship-to/customer assignments and A+ tax-body rates when supervised live access is enabled.
- Validate the official NCDOR 100-county current-rate table and compare every county with its A+ `XATXBD` configuration when supervised live access is enabled.
- Show matched rates, current differences, announced future changes, and unavailable sources with distinct statuses instead of geographic color coding.
- Preserve the official source URL, retrieval time, effective period, and SHA-256 evidence fingerprint for each comparison refresh.
- Select any North Carolina county to inspect its A+ tax body, configured rate components, and aggregate coverage.
- Search and filter all 100 counties, including the seven without active ship-tos.
- Export the aggregate county inventory and configured A+ rates as CSV.
- Review the empty approval queue and the resolved Mecklenburg audit case.
- Inspect official and internal evidence sources, including active special-purpose A+ tax bodies outside the standard county inventory. Explicitly retired definitions are suppressed.
- Read and validate the current XATXBD tax-body master through the local read-only A+ connector only when that connector is explicitly started.
- In a supervised connected environment, refresh A+ rates when the application opens, every six hours while it remains open, or when an administrator selects **Refresh now**.
- Use the CSV importer only as an administrator fallback when the connector is unavailable or an export needs testing.
- Close detail panels with the close button, backdrop, or Escape key.

When the connector is running, configured rates are read live from `APLUSV8FAQ.XATXBD` and validated before display. Aggregate ship-to counts still come from the dated DWStage snapshot of August 17, 2026. If the live read fails, TaxAP clearly falls back to its validated August 18 rate snapshot; it does not claim that fallback data is live.

### Read-only A+ connector

- Runs as a local backend service on port 3001; database credentials and Microsoft tokens never enter browser code.
- Uses Microsoft Entra ID passwordless authentication through `DefaultAzureCredential`. Local development uses the signed-in Azure CLI identity; a hosted service can later use an approved managed identity.
- Connects to Azure SQL `DWStage`, reads aggregate active ship-to assignments from `ADDR`/`CUSMS`, then follows the existing `SQL03` → `APLUS` linked-server path for matching `APLUSV8FAQ.XATXBD` definitions.
- Validates exactly 100 standard county rows before replacing the displayed rates. Failed connections or invalid results leave the last validated snapshot visible.
- Returns only state-level and tax-body-level aggregate counts, definitions, and rates—no customer names, addresses, ship-to records, or invoices.
- Filters state coverage to the 50 official state codes plus the District of Columbia; international, blank, full-name, and malformed A+ state values are excluded from the U.S. jurisdiction inventory and counted only as data-quality exclusions.

### Official North Carolina comparison

- Reads NCDOR's official historical total general state, local, and transit sales/use tax table and selects the column explicitly marked current.
- Requires exactly one valid rate for each of North Carolina's 100 counties before accepting the source.
- Reads NCDOR's separate local/transit effective-date table for future component changes.
- Refreshes on application startup, every six hours while open, or through **Refresh now**; the backend caches a validated source snapshot for six hours.
- Marks an A+ rate difference only after both the A+ and official datasets pass validation. Source failures produce an unavailable state, never a guessed match or mismatch.
- Suppresses known retired codes and definitions explicitly marked `DO NOT USE`, `DONT USE`, `DON'T USE`, `INACTIVE`, or `OBSOLETE` from state drill-down results and the displayed special-tax-body inventory.
- Stores review ownership, decisions, notes, and timestamped audit events in a local SQLite database under `.data/`. Review records are separate from A+ and survive local application restarts.
- Uses a temporary Ana/Liv reviewer selector until Microsoft Entra ID sign-in supplies the authenticated identity.
- Maintains a 50-state-plus-DC official-source registry, ordered in the interface by active A+ ship-to coverage. The registry distinguishes connected adapters, identified machine-readable sources, official document sources awaiting reliable parsing, and states that still require source research.
- Connects Georgia's current Streamlined Sales Tax rate file with Georgia DOR provenance and Census Gazetteer jurisdiction names. The adapter validates one active state rate and all 159 county rate components before returning data.
- Displays Georgia's state, county, city, and special-jurisdiction rate components from the official file.
- Matches active Georgia ship-to addresses against the official Streamlined boundary archive (address, then ZIP+4, then ZIP-5 fallback) entirely on the backend, and reconciles the result by A+ tax body. No ship-to address or customer data reaches the browser; only matched/unmatched/ambiguous aggregate counts and rate comparisons are returned.
- Connects California's effective-dated CDTFA city and county table and requires coverage of all 58 counties before accepting a refresh.
- Connects Texas's quarterly Comptroller control file with its published city/combined-area totals. Overlapping local components are retained as evidence and never naively summed.
- Connects Florida's downloadable Department of Revenue workbook, deduplicates identical rows safely, and requires all 67 counties before accepting its current state-plus-surtax totals.
- Reuses the validated Streamlined rate-file contract for Ohio and Tennessee while enforcing their complete county counts (88 and 95 respectively).
- Connects Pennsylvania's official 6% statewide rule and the published Allegheny/Philadelphia local add-ons, then requires all 67 Census counties before accepting the normalized county totals.
- Identifies Illinois and Virginia machine-readable sources and Maryland's official guidance without claiming those pending adapters are connected.
- Identifies South Carolina's official ST-575 municipality/unincorporated-area publication but leaves it unconnected until a reliable PDF-table parser is validated.

Copy `.env.example` to `.env.local` and fill in the non-secret server settings. Run `az login` before local development; `npm run dev` starts both the web application and connector.

For interface work that must not contact production, run only the web application in explicit offline mode:

```powershell
$env:NEXT_PUBLIC_TAXAP_OFFLINE_MODE = "true"
npm run dev:web
```

Offline mode uses the August 18 validated fallback snapshot, disables refresh controls, does not start the connector, and does not call `/api/aplus/*`. Live read-only validation is a separate supervised step.

### Administrator CSV fallback

- Accepts `.csv` files up to 2 MB in the verified 19-column XATXBD export order, with or without a header row.
- Requires exactly one row for every standard county tax body from `NC001` through `NC100`.
- Verifies numeric ranges, duplicate and missing codes, current and next rate-component totals, and effective dates for scheduled rates.
- Separates noncounty tax bodies from the standard county inventory and previews representative transit-rate counties.
- Applies validated rates only to the current browser session. It does not upload the CSV, persist it, or write to A+.

## A+ county rate snapshot

- 100 standard county definitions (`NC001` through `NC100`)
- 50 counties configured at 6.75%
- 46 counties configured at 7.00%
- Wake (`NC092`) configured at 7.25%
- Durham (`NC032`) and Orange (`NC068`) configured at 7.50%
- Mecklenburg (`NC060`) configured at 8.25%
- No future rate or effective date populated on any standard county row
- 10 noncounty definitions exist in the verified NC master; the two explicitly marked `DO NOT USE` are suppressed from TaxAP queries and displays

## Verified pilot case

- Jurisdiction: Mecklenburg County (`NC060`)
- Previous rate: 7.25%
- Current rate: 8.25%
- Effective date: July 1, 2026
- Active NC ship-to snapshot: 5,518 NC-address records; 5,498 are assigned to 93 standard county tax bodies
- Mecklenburg assignment snapshot: 783 active ship-tos
- Review population: 78 prior-rate invoices across 39 customers
- Positive taxable sales reviewed: $91,211.53
- Initial one-percentage-point review estimate: $912.12
- Resolution: A+ rate changed and the prior-rate invoices were handled by the tax team

These figures are preserved as aggregate audit evidence. The estimate is not an outstanding balance, and TaxAP did not change A+.

## Atlantic branding

- Product name: **TaxAP**
- Official Atlantic Packaging horizontal logo in the application header
- Official stacked logo as the browser icon
- Atlantic brand blue, green, navy, black, gray, and white only
- Gotham-compatible Montserrat web typography
- Supplied brand tokens are stored in `app/brand-tokens.css`
- Logos are embedded without recoloring, distortion, or rearrangement

## Intended workflow

1. Read aggregate active ship-to coverage from A+.
2. Associate the relevant tax-body coverage with its official jurisdiction.
3. Retrieve current and announced rates from authoritative state sources.
4. Compare the authoritative rate and effective date with the current A+ assignment.
5. Create a review flag when the values differ or the address cannot be resolved confidently.
6. Let the tax administrator confirm the discrepancy, reject it, or defer it.
7. Create an A+ maintenance work item for confirmed discrepancies.

## Relevant A+ fields

The available A+ warehouse dictionary identifies these read-side fields:

| Purpose | Table and field |
| --- | --- |
| Company | `ADDR.SACONO` |
| Customer number | `ADDR.SACSNO` |
| Ship-to number | `ADDR.SASHP#` |
| Ship-to street | `ADDR.SASAD1` through `ADDR.SASAD4` |
| City | `ADDR.SASCTY` |
| State | `ADDR.SASHST` |
| ZIP code | `ADDR.SASZIP` |
| Current tax body | `ADDR.SASTXB` |
| Taxable code | `ADDR.SATXCD` |
| Geographic code | `ADDR.SAGEOC` |
| Possible Vertex identifier | `ADDR.SAVTSH` |
| Last maintenance date | `ADDR.SALMDT` |
| Order tax body and rate | `ORHED.OHSTXB`, `ORHED.OHTXPC` |
| Historical tax body and rate | `HSHED.OATXBD`, `HSHED.OATXPC` |

The operational DB2 library `APLUSV8FAQ` contains the current tax-body master in `XATXBD`:

| Purpose | Field |
| --- | --- |
| Tax body and description | `TBTXBOD`, `TBTXNAM` |
| Current base rate | `TBCBSRT` |
| Current local components | `TBCLRT1` through `TBCLRT4` |
| Current total rate | `TBCRATE` |
| Next base and local components | `TBNBSRT`, `TBNLRT1` through `TBNLRT4` |
| Next total and effective date | `TBNRATE`, `TBTXDAT` |

The known A+ maintenance path is **Accounts Receivable → File Maintenance → Tax Body**. The exact approved procedure and any vendor-supported integration still need documentation, so the application remains read-only.

## Proposed application records

- `ship_to_snapshot`: a dated, read-only snapshot of the A+ ship-to fields used for comparison
- `jurisdiction_assignment`: normalized address, county, municipality, special jurisdiction codes, and match confidence
- `source_artifact`: source URL, retrieval time, content hash, publication date, and covered effective period
- `tax_rate`: jurisdiction components, sales rate, use rate, and effective date range
- `rate_finding`: A+ value, authoritative value, difference type, impacted ship-tos, and status
- `review_decision`: reviewer, decision, note, and timestamp

## Safety rules

- Never infer a rate solely from a five-digit ZIP when a more precise official boundary source is available.
- Preserve original source files and hashes for audit evidence.
- Never silently replace a prior effective-dated rate.
- Never write directly to A+ from the monitoring job.
- A source failure or ambiguous jurisdiction produces a review flag, not a guessed value.
- Prototype figures must identify whether they are verified aggregates or sample data; customer-level records must never be committed to source control.

## Discovery still required

1. Document the exact fields and approval steps used under Accounts Receivable → File Maintenance → Tax Body.
2. Define the A+ taxable-code values (`0`, `3`, and `J`) and the remaining order-type codes used during review.
3. Confirm whether the `SAVTSH` field represents an active, legacy, or unused Vertex integration.
4. Identify the approved runtime service connection for repeatable read-only A+ imports.
5. Agree on check frequency, reviewer identity, notification method, and Entra ID access policy.

## Delivery stages

1. Product prototype and approved requirements
2. Repeatable read-only imports for the A+ ship-to inventory and `XATXBD` tax-body master
3. North Carolina source ingestion and effective-date history
4. Address-to-jurisdiction matching
5. Comparison and review queue
6. User acceptance testing with the tax administrator
7. Optional supported A+ update integration as a separate phase
