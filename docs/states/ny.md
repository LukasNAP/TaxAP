# New York — findings

Status: **official inventory connected 2026-09-03; automatic A+ comparison intentionally withheld.** `server/ny-rates.mjs` resolves the current Publication 718 from NY DTF's landing page, extracts and validates all 77 rate-bearing rows (57 county-area rows, 19 city rows, and the 4% state-only row), and exposes their official reporting codes and combined rates through the generic state endpoint. The parser fails closed if the reviewed row counts, state rate, reporting-code uniqueness, or document identity changes. A direct A+ comparison remains blocked by **two confirmed, material rate differences** (Suffolk County and Yonkers City), code aliases, and orphaned codes described below.

## Step 1 — address matching: not needed at the code-interpretation level

Live, unfiltered `NY%` pull from `XATXBD` (80 rows total, run 2026-08-26):

- **1 `DO NOT USE` row**, correctly excluded by the standard filter: `NY000` = `"New York - do not use"`, rate 0. No other retired/obsolete-looking rows found.
- **0 wrong-state contamination** — every one of the remaining 79 rows' `TBTXNAM` begins with `"New York "`. No SC3622/South-Dakota-style surprise here.
- **0 `E`-suffixed equipment-tax variants** and **0 police-jurisdiction-style codes** — neither of the two recurring cross-state patterns from `docs/aplus-data-findings.md` shows up in NY's set.
- All 79 real codes are named `"New York <County/City Name>"` — a human-readable convention, not a synthesized index (unlike NC) and not an opaque tier+place code (unlike SC).

Each code corresponds to one real jurisdiction (a county's unincorporated/general area, or one of NY's home-rule cities that impose their own additional local tax on top of — or, for a couple of cases, replacing — the county rate). There is no case here of a single A+ code covering multiple jurisdictions with different real-world rates, so **once a ship-to's `ADDR.SASTXB` is correctly assigned, no boundary/address matching is needed to turn that code into a rate** — the same shape of answer as NC and OH.

**Caveat worth recording:** this only answers "does one A+ code map to one jurisdiction," not "can TaxAP independently derive the correct code from a raw address/ZIP." NY's home-rule cities (Yonkers, Mount Vernon, White Plains, New Rochelle, Auburn, Ithaca, Rome, Utica, Sherrill, Olean, Salamanca, Norwich, Oneida, Gloversville, Johnstown, Corning, Hornell, Saratoga Springs, Glens Falls) are generally smaller than a ZIP code and share ZIPs with their surrounding county — Publication 718 itself explicitly warns "*Postal zones usually do not coincide with political boundaries* ... the use of ZIP codes for tax collection results in a high degree of inaccurate tax reporting." If TaxAP ever needs to validate or re-derive `SASTXB` from a raw ship-to address (rather than trust the code A+ already assigned), that would need real address-level matching, GA-style. That's a distinct, currently out-of-scope question from Step 1 as asked.

## Step 2 — rate comparability: NOT confirmed, two live mismatches found

Fetched the current Publication 718 PDF via the resolving index page (`https://www.tax.ny.gov/pubs_and_bulls/publications/sales/local_rates_current.htm` → `https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf`, confirmed "Effective March 1, 2025" / "last updated May 12, 2025" as of this investigation on 2026-08-26 — don't hardcode this URL, re-resolve from the index page). Extracted with `pdftotext -table` (same tool SC's adapter uses) and cross-checked independently with `pdftotext -layout` — both agree on every value quoted below.

**MCTD 0.375% surcharge is good news: it's already folded into `TBCRATE`, not a separate layering problem.** Pub 718 itself documents this ("*Rates in these jurisdictions include 3/8% imposed for the benefit of the Metropolitan Commuter Transportation District"), and A+ agrees for every one of the 7 MCTD counties/cities checked — Dutchess 8.125%, Orange 8.125%, Nassau 8.625%, Suffolk (rate itself wrong, see below, but the MCTD-inclusive *shape* is right), Putnam 8.375%, Rockland 8.375%, Westchester 8.375%, NYC 8.875%. Unlike Ohio's transit-surcharge finding, this is not an open comparability gap — both sides are measuring the same combined total.

**Confirmed mismatch 1 — Suffolk County, current and material.** A+ `NY4711` = 8.625% (`TBCRATE`). Publication 718 (effective 3/1/2025, the current live document) lists Suffolk at **8¾ = 8.75%**. A 0.125-point gap on one of NY's most populous counties. This is consistent with Suffolk County having passed a local rate increase since A+'s last update — i.e. A+ looks **stale**, not wrong-by-design.

**Confirmed mismatch 2 — Yonkers City, current and material.** A+ `NY6511` = 8.375% — the same rate as plain Westchester County. Publication 718 lists Yonkers at **8⅞ = 8.875%** (same as NYC), a full 0.5-point higher than the rest of Westchester. Yonkers has long had its own additional city sales tax above the county rate; A+'s `NY6511` currently carries the *county* rate instead, missing Yonkers' own increment entirely. The other three Westchester home-rule cities checked (Mount Vernon `NY5521`, New Rochelle `NY6861`, White Plains `NY5561`) all correctly show 8.375% and do **not** have this problem — this is specific to Yonkers, not a general Westchester-cluster bug.

**Code-numbering inconsistencies (rate correct, code doesn't match Pub 718's current reporting code):**
- White Plains: A+ uses `NY5561`; Pub 718's current reporting code for White Plains is `6513`. Rate agrees (8.375% both sides). No code `NY6513` exists in A+ at all.
- The Oneida County cluster: A+'s `NY3081` (Oneida County), `NY3091` (Rome City), `NY3016` (Utica City) all have rates that agree with Pub 718 (8.75% each), but Pub 718's printed reporting codes for the same three jurisdictions are `3010`, `3015`, `3018` respectively — different numbers, not a simple digit transposition of each other, confirmed the same both in `-table` and `-layout` extraction (so not a PDF-extraction artifact).

**Orphaned codes — present on one side, absent on the other:**
- A+ has `NY3014` = "Sherrill City" at **9%**. Sherrill (NY's smallest city, inside Oneida County) does not appear anywhere in the current Pub 718 document at all — not folded into the county line, not listed separately. A+'s 9% figure for it cannot currently be checked against anything official.
- A+ has `NY3551` = "Fulton City" at 8% (Fulton, NY sits in Oswego County, distinct from the separate real Fulton *County* upstate, which is also in this dataset as `NY1791`). Pub 718's Oswego County section only lists "Oswego – except" and "Oswego (city)" — no separate Fulton-city line. Rate coincidentally matches the county's 8%, so this one is likely harmless, but it's still an A+ code with no current official counterpart.
- Conversely, Pub 718 lists **Ogdensburg (city)**, in St. Lawrence County, as its own reporting code (`4012`, 8%) — but A+ has no `NY4012` or any other Ogdensburg-specific code at all; only the plain `NY4091` St. Lawrence County code exists. Since the rate is identical (8% both), this looks harmless too, but it means the two sides' *code inventories* don't line up cleanly even where dollar amounts wouldn't be affected.

**Everything else checked matched cleanly on both code and rate** — spot-verified in detail: Albany, Allegany, Broome, Cattaraugus/Olean/Salamanca, Cayuga/Auburn, Chemung, Chenango/Norwich, Dutchess, Erie, Fulton County/Gloversville/Johnstown, Genesee, Madison/Oneida-city, Monroe, Montgomery, Nassau, Onondaga, Ontario, Orange, Orleans, Oswego County/Oswego city, Putnam, Rockland, St. Lawrence, Saratoga/Saratoga Springs, Schenectady–Yates (each individually), Tompkins/Ithaca, Warren/Glens Falls, Washington, Wayne, Westchester/Mount Vernon/New Rochelle, Wyoming, NYC. That's roughly 70 of the 79 real rows with no issue found — the mismatches above are real but a minority.

## Current application behavior and next decision

- **The official-source adapter is now built, but do not build a naive A+ code join.** A straight join on "A+ code number = Pub 718 reporting code number" would silently mis-join at least 4 rows (White Plains, and the 3-row Oneida cluster), and a straight rate comparison would flag Suffolk/Yonkers as the only two real discrepancies only if the join itself is right first.
- **Get a decision from Ana/Liv (or whoever owns the A+ tax-body master) on Suffolk and Yonkers specifically** before shipping any comparison — these look like genuine stale-data bugs in A+ that a live customer could be paying the wrong tax rate on, not TaxAP data-quality noise. This is a stronger finding than most other states' investigations and probably worth surfacing regardless of when/whether the NY adapter gets built.
- When A+ comparison proceeds, match by reviewed name/place aliases first (the way SC's adapter reads structure from `TBTXNAM` rather than trusting `TBTXBOD` numbering), not by assuming the numeric suffix equals Pub 718's reporting code — the Oneida cluster and White Plains prove that assumption breaks down in at least a few cases.
- Re-verify Sherrill's 9% and Fulton-city's 8% against Publication 718-A (prior-year rates) or NY's online Jurisdiction/Rate Lookup Service before deciding whether they're stale, retired, or simply not printed in the summary PDF for some legitimate reason — this investigation didn't chase that down.
- The `pdftotext -table` approach (SC's pattern) worked cleanly here — single-page, 3-column table, no multi-page continuation issues, cross-validated against `-layout` with identical results. No new PDF-tooling risk beyond what SC already surfaced.

## Ready-to-use query (no exclusions currently needed beyond the standard DO-NOT-USE filter)

```sql
SELECT * FROM OPENQUERY([SQL03], 'SELECT * FROM OPENQUERY(APLUS, ''SELECT TBTXBOD, TBTXNAM, TBCBSRT, TBCLRT1, TBCLRT2, TBCLRT3, TBCLRT4, TBCRATE FROM APLUSV8FAQ.XATXBD WHERE TBTXBOD LIKE ''''NY%'''' AND UPPER(TBTXNAM) NOT LIKE ''''%DO NOT USE%'''' '')') ORDER BY TBTXBOD;
```

Only exclusion found necessary so far: `NY000` ("New York - do not use"), already caught by the standard `NOT LIKE '%DO NOT USE%'` filter — no separate `NOT IN (...)` list needed, unlike NC/SC.
