# Iowa — official-rate adapter status

## What is connected

TaxAP now reads the current Iowa Streamlined Sales Tax rate file, selected from the publisher's rate directory. The file has active effective-date records and validates against Iowa's real geography:

- 6% state sales/use tax.
- 99 real county rows.
- 1,013 city rows.
- 101 special rows, including the source's non-county `199` row. It is deliberately classified as special rather than being treated as a 100th Iowa county.

The Iowa Department of Revenue confirms that local option sales tax is a 1% add-on where authorized, and that city and unincorporated-county coverage can differ. TaxAP therefore does not collapse this into a single statewide 7% result.

## A+ matching: not built

An aggregate-only local A+ inventory on 2026-08-31 found 268 active Iowa ship-tos across 53 assigned tax-body groups. The common codes (`IA077`, `IA057`, `IA029`) do not directly use Iowa's odd-numbered county FIPS identifiers, and they contain values above Iowa's 99 county count (`IA101`–`IA106`). Tax-body descriptions are blank in the returned aggregate data.

There is no safe deterministic code-to-jurisdiction match yet. Do not compare these codes to the county rows, and do not use a city-name fallback or an address lookup without a separate design and privacy decision. Any future Iowa matcher must first establish the meaning of the A+ numbering scheme and report unresolved, cross-state, and `IA000` assignments as aggregate exclusions.

No A+ writes are allowed.
