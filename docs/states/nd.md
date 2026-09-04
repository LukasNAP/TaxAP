# North Dakota — official-rate adapter status

## What is connected

TaxAP reads North Dakota's current effective-dated Streamlined Sales Tax rate file and retains the Office of State Tax Commissioner's local-tax page as the human-readable authority.

- General state sales-tax component: 5%.
- Live validation on 2026-09-02: 406 active records — one state row, all 53 county components, and 352 city components.
- The shared source resolver now verifies the actual filename begins with `NDR`; this fixed a path-matching bug that could previously select Wyoming's file because `andboundry/Rates` contains the letters `nd...r`.
- The adapter validates state FIPS, effective dates, unique active jurisdiction keys, exactly 53 county rows, and only the known state/county/city jurisdiction types.

North Dakota's general percentage file does not encode every transaction rule. Some city and county ordinances impose a maximum local tax per sale, handled through a refund-cap process. TaxAP therefore exposes rate components but does not present them as a complete invoice-tax calculator.

## A+ matching: statewide setup issue

A read-only aggregate A+ inventory on 2026-09-02 found 32 active North Dakota ship-tos across nine customer assignments. Every one uses `ND000`, configured at 0%.

North Dakota imposes 5% on most retail sales before applicable local taxes, so the current A+ snapshot cannot be reconciled to the official rate inventory as an ordinary jurisdiction comparison. TaxAP does not label individual invoices wrong because a documented exemption or alternate billing mechanism has not been ruled out, but `ND000` must remain a visible statewide setup decision rather than a silent exclusion.

No A+ writes are allowed. Any remediation belongs in the supported A+ interface after the tax owner confirms the intended treatment. A future address matcher must also preserve local maximum-tax jurisdictions as a separate invoice-level caveat.
