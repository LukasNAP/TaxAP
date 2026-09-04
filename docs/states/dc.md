# District of Columbia — official-rate adapter status

## What is connected

TaxAP reads the District of Columbia Office of Tax and Revenue's current tax-law-change notice. The adapter validates the complete enacted general-rate schedule rather than accepting a single undated percentage:

- 6% through September 30, 2026.
- 7% for periods beginning October 1, 2026.

The adapter returns the 6% rate before the transition, exposes the announced 7% change to the dashboard, and automatically rolls to 7% on the effective date. It fails closed if either rate or either schedule date disappears or changes. D.C. is one citywide jurisdiction, so no county, city, ZIP, or address boundary matcher is required.

## A+ validation

The supervised read-only aggregate A+ refresh on 2026-09-03 found 21 active D.C. ship-tos across two tax-body assignments:

- `DC000`, described as `District of Columbia no t`, is configured at 0% and covers 20 ship-tos.
- `HN000`, described as `HONDURAS no tax`, is configured at 0% and covers one D.C. ship-to. It is a cross-jurisdiction assignment and must not be compared as a D.C. rate.

`DC000` differs from the current official 6% rate, and A+ has no 7% next rate or October 1 effective date scheduled. TaxAP records this as a configuration finding and remains read-only; no A+ record was changed.

## Business decision

The tax owner should confirm whether the 20 `DC000` assignments and the one `HN000` assignment are documented exempt/no-tax treatments or incomplete jurisdiction setup. If they are ordinary taxable sales, A+ needs supported manual maintenance for the current rate and the scheduled October transition. TaxAP must not infer exemption status from a 0% tax-body description.
