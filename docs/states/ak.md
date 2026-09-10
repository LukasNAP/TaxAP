# Alaska — official-rate adapter status

## Current policy — September 10, 2026

The user confirmed the existing assignments are deliberate no-tax treatment. The connector now applies the explicit policy in `server/no-tax-policy-aplus.mjs`, requiring the approved state's existing codes, configured definitions and zero rates. They are excluded from discrepancy comparisons and labelled deliberate no-tax; they are not matched to an invented official zero rate. New/nonzero/missing/retired assignments remain unresolved. Earlier policy questions and unwired statements below are historical and superseded by this confirmation. Official sources remain separately connected.


Status: **current ARSSTC member-jurisdiction source connected 2026-09-03; statewide nonmember and A+ matching remain unresolved.**

## Official source and scope

Alaska has no state-level sales tax, but cities and boroughs may levy local sales taxes. `server/ak-rates.mjs` dynamically resolves the newest non-ZIP Alaska Remote Seller Sales Tax Commission workbook and validates its general remote-sales sheet. The current workbook is dated 2026-09-01 and contains 56 unique destination/filing rows: 10 borough-area rows and 46 city/taxing-area rows. TaxAP also exposes an explicit 0% state row.

The adapter validates the workbook's own no-state-tax policy statement, headers, as-of date, unique filing codes, row counts, rate bounds, and the arithmetic between borough, city, and published total rates. This is important for nested locations: for example, the current Ketchikan City row is a 2.5% borough component plus 5.5% city component, totaling 8%. Seasonal rates are taken from the current dated workbook rather than inferred from ZIP codes or an older annual description.

## Coverage limitation

ARSSTC is an intergovernmental commission for participating remote-seller jurisdictions, not a complete inventory of every Alaska municipality. The connected source therefore proves current rates only for its member destination rows. TaxAP does not interpret absence from the workbook as 0%, does not infer local tax from ZIP or ZIP+4, and does not claim statewide municipality completeness.

Alaska DCRA separately confirms that the state does not levy sales tax, that municipalities may levy it, and that both city and borough tax can apply. Its latest Alaska Taxable/ArcGIS inventory is useful completeness evidence, but it is annual and includes free-text seasonal rules. A future reconciliation should compare that statewide inventory with ARSSTC membership and use an approved address-boundary source for active ship-tos.

## September 9 aggregate refresh

The existing Windows-authenticated aggregate reader succeeded: eight active ship-to assignments, all on `AK000` (Alaska no tax), configured at 0%. There is no assigned municipality identity to compare with ARSSTC rows. This replaces the earlier authentication failure as current evidence; it does not prove tax liability or statewide zero tax. No SQL changes or A+ writes.

## Historical A+ status

The aggregate-only A+ refresh attempted on 2026-09-03 failed because the local connector's Entra token was rejected by Azure SQL. No A+ count, tax-body mapping, or comparison is claimed from that failed attempt. The official-source adapter remains fully functional and read-only; no A+ write occurred.

## Next decision

Decide whether Atlantic's Alaska remote-sales obligations are fully represented by ARSSTC membership. If not, define the approved nonmember municipality and address-boundary source. Once A+ authentication is available, refresh only aggregate Alaska tax-body usage and reconcile every active assignment without exposing customer or address rows to the browser.

Sources:

- https://arsstc.org/business-sellers/tax-rates/
- https://www.commerce.alaska.gov/web/dcra/OfficeoftheStateAssessor/AlaskaSalesTaxInformation
