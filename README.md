# TaxAP

TaxAP is an internal sales and use tax rate monitoring application for Atlantic Packaging. It compares authoritative North Carolina tax-rate information with the tax-body assignments used by active A+ customer ship-to records. Differences are presented to a tax administrator for review; the MVP does not update A+.

## MVP scope

- North Carolina only
- General sales and use tax rates only
- Only jurisdictions containing active A+ ship-to addresses
- Read-only extraction from A+
- Scheduled source checks and effective-dated comparisons
- Human confirmation or dismissal of every discrepancy
- Audit evidence for the source, time checked, effective date, and decision
- No automatic A+ changes

The dashboard currently uses clearly labeled sample data. It is a product prototype, not a tax calculation system.

## Atlantic branding

- Product name: **TaxAP**
- Official Atlantic Packaging horizontal logo in the application header
- Official stacked logo as the browser icon
- Atlantic brand blue, green, navy, black, gray, and white only
- Gotham-compatible Montserrat web typography
- Supplied brand tokens are stored in `app/brand-tokens.css`
- Logos are embedded without recoloring, distortion, or rearrangement

## Intended workflow

1. Read active North Carolina ship-tos from A+.
2. Normalize each delivery address and associate it with a tax jurisdiction.
3. Retrieve current and announced rates from an authoritative North Carolina source.
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

The supported A+ interface for maintaining tax-body rates has not been identified. The application must remain read-only until the GUI workflow and its underlying import or vendor-supported interface are documented.

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
- Prototype counts and customer records must be labeled as sample data until connected to A+.

## Discovery still required

1. Observe the exact A+ GUI steps used to maintain a tax body or rate.
2. Determine the A+ company numbers that own active North Carolina ship-tos.
3. Confirm whether the `SAVTSH` field represents an active, legacy, or unused Vertex integration.
4. Identify the approved read-only connection method for the A+ environment.
5. Agree on check frequency, reviewer identity, and notification method.

## Delivery stages

1. Product prototype and approved requirements
2. Read-only A+ ship-to inventory
3. North Carolina source ingestion and effective-date history
4. Address-to-jurisdiction matching
5. Comparison and review queue
6. User acceptance testing with the tax administrator
7. Optional supported A+ update integration as a separate phase
