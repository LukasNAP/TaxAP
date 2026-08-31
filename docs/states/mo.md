# Missouri — findings

Status: **re-investigated live 2026-08-28; not safe to build yet.** Missouri DOR's current July–September 2026 XLSX was fetched and parsed directly (2,536 jurisdiction rows). The earlier conclusion that every A+ code was arbitrary was too broad: many encode a real Missouri DOR county or city segment. The encoding is mixed, however, and does not carry enough information to select a unique sales/use/special-district rate for every ship-to tax body.

## Address matching

**Yes — and the code is only a partial jurisdiction key.** The current live A+ assignment snapshot has 515 Missouri-address ship-tos: 477 on 87 named Missouri tax bodies, 34 on missing `MO000`, and four on cross-state tax bodies. The 87 named Missouri bodies use several distinct conventions:

- 42 codes (366 ship-tos) end with a three-digit Missouri DOR county/equivalent segment — for example, `MO510` aligns with St. Louis City (`65000-510-000`), `MO095` with Kansas City's Jackson-County-side record (`38000-095-000`), and `MO077` with Springfield/Greene County (`70000-077-000`).
- 15 codes (17 ship-tos) are a five-digit DOR city segment, such as `MO11242` for Cape Girardeau and `MO07660` for Bowling Green.
- Five codes (six ship-tos) concatenate DOR city + county segments, including `MO23752187` = Farmington / St. Francois County (`23752-187-000`) and `MO72826149` = Thayer / Oregon County (`72826-149-000`).
- One code (six ship-tos) is a city segment with leading zeroes stripped (`MO766` / Ozark).
- 24 codes (82 ship-tos) still have no direct, safe code relationship to the current DOR table. These include `MO0029` St. Louis County (16 ship-tos), `MO656` Carthage (9), `MO416` Washington (8), `MO350` Independence (6), and other legacy-looking values.

These segments are Missouri DOR jurisdiction segments, not county FIPS. A name remains necessary to distinguish a city from its county and to resolve legacy values. The A+ labels are human-typed (inconsistent case, "CO." vs "County" vs no suffix, and a truncated "Missouri Neosho (Newton C"), so a name-only fallback must stay conservative.

Missouri's third DOR segment identifies CID/TDD/other special-district overlays, and it is absent from the A+ tax-body code. A city can therefore have multiple current official rates at different addresses. A+ does retain up to four local rate components; `MO78928` (West Plains) has 0.5% and 1.0% in its third and fourth local slots, while its code identifies only the city segment. That is concrete evidence that tax-body text/code alone cannot always identify the official DOR row.

## Rate comparability

**Partially verified, but not comparable under one universal rule.** The 4.225% A+ base component agrees with the state base rate. Live comparison with the current DOR workbook also verifies several sales-rate examples exactly: St. Louis City (`MO510`, 9.679%), Kansas City on the Jackson County side (`MO095`, 8.975%), Springfield/Greene (`MO077`, 8.1%), Joplin/Jasper (`MO097`, 8.725%), Farmington (`MO23752187`, 8.85%), and Versailles (`MO75922141`, 8.725%).

However, the same A+ field does **not** consistently represent the DOR sales-rate column. `MO0029` (St. Louis County, 16 ship-tos) is configured at 4.225%, which equals the current DOR **use** rate but not its 7.738% sales rate. `MO51572145` (Neosho/Newton County) is likewise 4.225%, equal to its DOR use rate rather than its 8.85% sales rate. `MO0229` (Wright County, two ship-tos) is 4.225%, matching neither current DOR sales nor use rate (both 6.1%). No automatic statewide comparison can label these as stale without first establishing which rate category A+ is intended to carry for each Missouri tax body.

Invoice-history validation on 2026-08-28 confirms this is live operational behavior, not just unused configuration: since 2026-01-01, `MO0029` was recorded at 4.225% on 34 invoices (through 2026-08-21), `MO0229` at 4.225% on two invoices, and `MO51572145` at 4.225% on one invoice. This proves the configured value is being charged; it does **not** by itself identify the business rule that selected sales versus use tax.

The available invoice-header tax-type fields (`HSHED.OATXT01` through `OATXT04`) were blank on all 37 of those invoice records. The database therefore provides no header-level sales/use indicator for this sample; further rate-only querying cannot establish the intended treatment.

## Exclusions found

`MO000` is a missing-definition placeholder on 34 active ship-tos and follows the project-wide misinput rule: it must remain a visible "needs correction in A+" exclusion, never a 0% comparison. Four active Missouri-address ship-tos use clearly outside-state bodies (`DR000`, `AR0403`, and `TN0501`) and must remain separately counted. Existing master definitions also contain retired `MO000`/`MO961` records and `MO9999` ("MISSOURI CREDITS"), a credit/adjustment body rather than a place; all must be excluded from any geographic comparison.

## Needed before a build decision

1. Obtain a clear business/A+ rule for Missouri: when should a TaxAP finding compare the A+ total to DOR sales tax versus DOR use tax? The live data shows both patterns; TaxAP must not decide from the numeric rate that happens to match.
2. Define whether a tax body carrying a city/county key but no CID/TDD segment can be compared only to that city/county's non-special base row, or whether TaxAP must treat every such case as address-dependent/unmatched. This matters because Missouri's special districts can change the legal rate for individual parcels.
3. Build only a conservative matcher after those answers: direct code-to-DOR matching where the full jurisdiction is explicit; visible unmatched/excluded categories for unknown legacy codes, ambiguous city/county rows, missing `MO000`, credits, and cross-state assignments. Do not use fuzzy name matching to manufacture coverage.

## Do instead

- Use the verified DOR-segment patterns only where they identify a full, unambiguous jurisdiction; do not assume every MO code uses the same format.
- Keep sales/use and special-district uncertainty visible rather than calling a difference stale or correct.
- Keep Missouri coverage scoped to Atlantic's current A+ footprint, per Lukas's existing decision; do not try to model every statewide DOR row.
