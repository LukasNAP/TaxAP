# Missouri — official source connected

Status: **official-rate inventory connected and live-validated September 4, 2026; A+ matching remains intentionally unresolved.**

## Official source

TaxAP reads the Missouri Department of Revenue's current-year Sales/Use Tax Rate Tables page and dynamically selects the XLSX period containing the retrieval date. The current workbook covers July 1 through September 30, 2026.

`server/mo-rates.mjs` validates the workbook before accepting it: one expected worksheet, the complete filing-rate header, at least 2,000 rows, unique `#####-###-###` jurisdiction codes, valid percentages, and a general sales rate no lower than Missouri's 4.225% state component. It rejects stale periods, missing columns, duplicate codes, undersized downloads, and malformed rates.

The live workbook contains 2,550 unique filing-code combinations:

- 109 county-base rows (`00000-###-000`)
- 1,538 city/county combinations without a special suffix
- 903 combinations with a special-district suffix

Each normalized row retains the official general sales, use, food sales, food use, domestic-utility, and AMJ rates. `totalGeneralRate` is the official general sales rate; `componentRate` is that total minus the separately validated 4.225% state component. The source's use-tax total is preserved separately as `generalInterstateRate` rather than assumed equal to sales tax.

## Address and A+ matching

**Address-level matching is required.** A Missouri filing code encompasses a city, county, and applicable CID/TDD/TCED/PID or other district combination. Several valid codes can therefore share the same city or county label while applying to different addresses. TaxAP never chooses a code from a ZIP, name, or rate alone.

The historical aggregate A+ investigation found 92 usable Missouri tax bodies with inconsistent internal identifiers, plus two `DO NOT USE` rows and `MO9999` (`MISSOURI CREDITS`). Those A+ identifiers do not equal Missouri DOR filing codes. This source integration does not turn that historical evidence into a guessed crosswalk and does not claim a live A+ comparison.

## Connected behavior

- `GET /api/official/states/MO` returns the current validated DOR snapshot.
- The official-source registry marks Missouri `connected` at the source layer.
- Rate retrieval is read-only and cached for six hours.
- No A+ tax body, ship-to, customer, order, or invoice record is changed.

## Still needed for comparison

1. Refresh the aggregate-only Missouri A+ assignment inventory when explicitly authorized.
2. Decide whether monitoring covers only active Atlantic destinations or every possible Missouri district combination.
3. Build a reviewed address-to-filing-code matcher or approved authoritative lookup.
4. Confirm `MO9999` is credits-only and exclude it from geographic matching.
