# New Mexico — official GRT district inventory

Last verified: September 8, 2026

## Current comparison implementation

`server/nm-aplus.mjs` is registered in the aggregate findings batch and state drawer. It compares the official GRT total only when the full five-digit A+ suffix and municipality name agree with the official location. County qualifiers are preserved. County remainders, special classes, truncated names, short codes and catch-all codes remain unmatched; this reader does not establish delivery-address boundaries or exemption treatment.

Current local Windows-authenticated aggregate validation: 89 assignments, 23 compared across 12 groups, one rate difference, 65 unmatched and one cross-state assignment. The historical former-state-base finding below is not current: the fresh check found one difference among the matched groups. No SQL was changed. An initial aggregate attempt failed; a subsequent fresh read succeeded. Hosted connectivity remains unvalidated.

Fixed the shared jurisdiction classifier that confused New Mexico with the country Mexico. Regression tests retain actual Mexico and other-state exclusions. Production build, lint and all 209 tests passed. The older withholding conditions below now apply to unresolved assignments and address validation, not the implemented exact-identity reader.

## What is connected

`server/nm-rates.mjs` resolves the New Mexico Taxation and Revenue Department's current **Gross Receipts Tax Rates and Boundaries** link, follows its RGIS dataset UUID to `services.json`, downloads the advertised CSV archive, and validates both the CSV and its FGDC XML metadata before returning rates.

The current official period is July 1, 2026 through June 30, 2027. The source contains 248 boundary polygons that normalize to 284 unique location codes:

- 32 `Remainder of County` districts (Los Alamos is represented by its combined city-and-county district rather than a remainder row)
- 110 municipality-style districts
- 142 special-location records, including development districts, airports, tribal classes, and other named districts

The adapter uses the current 5.125% state GRT component and preserves each published combined rate. It also preserves the source's paired tribal location codes. Four Isleta Pueblo class-1 codes are legitimately 0% in the official file; they are explicit named special jurisdictions and must not be generalized into approval of A+'s unrelated `NM000` catch-all.

## Why this is not called sales tax

New Mexico GRT is legally imposed on the seller's gross receipts. Lukas previously decided TaxAP should treat it as functionally equivalent to sales tax for monitoring, but the UI and adapter continue to identify it as GRT so the legal distinction is not erased.

## Boundary and matching limits

The RGIS metadata says the polygons are intended to help determine the general location of a district and may contain inaccuracies or omissions. TRD's current download page separately identifies Lovington Industrial Park as missing from the GIS layer. TaxAP therefore exposes the official location-code/rate inventory but does not yet claim address-to-polygon matching.

Current examples that prove address context matters:

- Rio Rancho (Sandoval): 7.4375%, location code `29-524`
- Rio Rancho (Bernalillo): 7.875%, location code `02-647`
- Village at Rio Rancho TIDD: 7.4375%, location code `29-525`

## A+ status

The saved aggregate investigation from August 26 found 18 named New Mexico codes still using the former 4.875% state base, with Roswell already discrepant under that older base. It also found `NM000` at 0% on 26 of 88 active New Mexico ship-tos. Those findings are historical evidence, not a fresh September 3 query: the current Azure SQL identity failed authentication during the immediately preceding Alaska audit, so no new A+ access was attempted here.

Automatic comparison remains withheld until:

1. A+ access is restored and the aggregate counts/rates are revalidated.
2. `NM000` is classified as documented exemptions or an unfinished fallback; it cannot be equated to the four specifically named Isleta class-1 codes.
3. Address-aware handling is approved for multi-county places such as Rio Rancho.
4. The official Lovington Industrial Park omission is resolved or explicitly accepted.

## Sources

- New Mexico TRD GIS downloads: <https://www.tax.newmexico.gov/businesses/geographic-information-system-gis/data-download/>
- Current RGIS dataset: <https://rgis.unm.edu/rgis6/dataset.html?uuid=9c374cf7-70a3-434d-af2a-a7f84547315b>
- Gross Receipts overview: <https://www.tax.newmexico.gov/businesses/gross-receipts-overview/>

No A+ data was written, and no deployment, commit, or push was performed.
