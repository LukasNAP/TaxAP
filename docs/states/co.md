# Colorado — findings

Status: **official source connected 2026-09-03; A+ comparison remains intentionally withheld.** `server/co-rates.mjs` dynamically resolves and validates the current half-year workbook. Colorado remains the most structurally difficult state investigated so far: the address-matching need is more severe than GA/SC (a single city name can carry multiple valid state rates depending on which county/RTD/CD-district sliver an address sits in), and the saved A+ investigation found a material Denver mismatch.

## Step 0 — official source

Confirmed reachable directly (per project instructions, `tax.colorado.gov` blocks generic fetch tools with 403 — `curl` with a browser `User-Agent` works). Landing page `https://tax.colorado.gov/how-to-look-up-sales-use-tax-rates` links a combined **DR 1002 + DR 0800** workbook that reissues twice a year; the file live today is `Colorado_Jurisdiction_Codes_Rates_July-Dec2026.xlsx` (do not hardcode this filename — resolve it from the landing page each time, per the project's own instruction). Sheets present: `By Name`, `By Juris Codes`, `Exemption Codes`, `Tax Codes`, `Alternate City Rates`, `State Service Fee Rates`. `By Name` columns: `Location Code` (the place name, e.g. "AURORA"), `Jurisdiction Code` (a 6-digit numeric code, e.g. `100001`), `County`, `Self Collected Home Rule`, exemption-code columns, `Total Rate`, then repeating `Tax Type`/`Rate`/`Service Fee Rate` triples for each layer (State, County, City, RTD, CD, RTA, HSD, PSI, LID, etc. — however many layers apply to that specific place).

The connected adapter uses the project's dependency-free ZIP reader and a hardened, fail-closed OOXML parser. It validates all six expected sheets, resolves the `By Name` worksheet through workbook relationships, validates the 44-column repeating layer schema, requires one 2.9% state layer per row, and reconciles every published total to its component layers.

The current July–December 2026 workbook contains 447 unique jurisdiction codes: 65 county-only rows, 280 city-layer rows, and 102 special/state-only district rows. Ninety-two rows are explicitly marked self-collected home rule. These are source classifications, not a claim that a city name alone selects the right rate.

## Step 1 — address matching: needed, more severely than any state investigated so far

Ran the live unfiltered-by-name query (only the standard `DO NOT USE`/`INACTIVE`/`OBSOLETE` family excluded up front, per the standing rule):

```sql
SELECT * FROM OPENQUERY([SQL03], 'SELECT * FROM OPENQUERY(APLUS, ''
  SELECT TBTXBOD, TBTXNAM, TBCBSRT, TBCLRT1, TBCLRT2, TBCLRT3, TBCLRT4, TBCRATE
  FROM APLUSV8FAQ.XATXBD
  WHERE TBTXBOD LIKE ''''CO%''''
    AND UPPER(TBTXNAM) NOT LIKE ''''%DO NOT USE%''''
    AND UPPER(TBTXNAM) NOT LIKE ''''%DONT USE%''''
    AND UPPER(TBTXNAM) NOT LIKE ''''%DON''''''''T USE%''''
    AND UPPER(TBTXNAM) NOT LIKE ''''%INACTIVE%''''
    AND UPPER(TBTXNAM) NOT LIKE ''''%OBSOLETE%''''
'')') ORDER BY TBTXBOD;
```

**Result: only 57 rows.** Not a truncation artifact (no `FETCH FIRST` used, and 57 isn't a suspiciously round number) — this is genuinely all of it. This is the first state investigated where the A+ tax-body list is clearly **not** an attempt at a full jurisdiction table: Colorado has 64 counties plus 70+ independently self-collecting home-rule cities plus many more statutory cities and special districts — the state's own combined file has hundreds of `Jurisdiction Code` rows. A+'s 57 CO codes are a sparse, customer-driven subset — apparently one tax body per city Atlantic has actually shipped to, not a maintained mirror of Colorado's real jurisdiction structure. This is a different situation from NC (100/100 counties) and SC (345 rows, near-exhaustive) — don't assume CO behaves like either.

### No single discoverable code convention — two different schemes coexist

- **`CO001`–`CO045`-ish short sequential codes** (e.g. `CO001` = Aurora, `CO004` = Denver, `CO033` = Greeley) — insertion order, not alphabetical (Aurora, Colorado Springs, Commerce City, Denver, Englewood, *then* Montrose before Grand Junction — breaks alphabetical almost immediately) and not FIPS-based. No recoverable structure; `TBTXNAM` (a bare city name, `"COLORADO <CITY>"` or `"Colorado <City>"`, casing itself inconsistent) is the only identifying information.
- **A second batch with a 6-digit numeric tail** (`CO040057`, `CO060077`, `CO100040`, `CO140206`, `CO180011`, `CO340006`, `CO420004`, `CO470016`, `CO480012`) — confirmed by cross-referencing the live official file that **this numeric tail is literally the state's own `Jurisdiction Code`** (e.g. `CO100040` ↔ official Centennial, Jurisdiction Code `100040`, both show 6.75%; `CO340006` ↔ Elizabeth `340006`, both 7.9%; `CO420004` ↔ Craig `420004`, both 8.9%; `CO470016` ↔ Parker `470016`, both 8.0%; `CO060077` ↔ Timnath/Larimer `060077`, both 8.2%; `CO180011` ↔ Delta `180011`, both 9.5%). So when Atlantic *does* enter the real state code, it's directly traceable and — for these examples — currently accurate. But most of the 57 rows don't use this scheme at all, and nothing marks which rows do.

**This means TBTXBOD cannot be treated as having one convention for CO.** Any adapter has to fall back to matching by `TBTXNAM`'s city name for most rows, and can only opportunistically use the numeric-tail codes as a direct `Jurisdiction Code` join for the handful that have one.

### The real forcing case: a single city name maps to multiple official rates

This is the concrete reason CO needs address matching, not just a city-name lookup — confirmed directly against the live official file, not inferred:

- **Aurora** spans three counties and doesn't fully overlap the RTD/CD special-district boundary. The official file lists **five** distinct `(Jurisdiction Code, rate)` pairs for "Aurora": Douglas County portion `470030` (8.75%), Arapahoe County portion `100001` (8.0%), Adams County portion `120003` (8.5%), an Adams "CD only" carve-out `120062` (7.5%), and an Arapahoe "CD only" carve-out `100002` (7.0%). A+ has exactly **one** code for Aurora (`CO001`, rate 8.0 — matches only the Arapahoe variant). Any Aurora ship-to actually in the Douglas or Adams portion of the city would be compared against a wrong rate if this dashboard trusted `CO001` for every Aurora address.
- **Colorado Springs**: two official variants, plain city (8.2%, matches A+'s `CO002`) and a "Commercial Aeronautical Zone" carve-out (7.2%, no RTA layer) — A+ has no code for the second.
- **Monument**: three official variants — base (`040057`, 7.63%), "in PPRTA" (`040103`, 8.63%), and a Public Improvement Fee district (`040100`, 6.63%). A+ has the base rate under **two different `TBTXBOD` values** (`CO018` and `CO040057`, both 7.63%) — a literal duplicate of the same jurisdiction under two codes, and no coverage of the other two variants.
- **Parker**, **Timnath**, and **Broomfield** each show the same pattern (a plain variant plus one or more CD-only/LID/district carve-outs at different rates) in the official file.

This is a materially different (and harder) version of the "jurisdictions vary within a ZIP code" problem GA and SC already established needs address matching — here it's not just incorporated-vs-unincorporated, it's **county-of-record plus special-district membership**, both of which can split a single city's own boundary into multiple truly different total rates. A code-to-city-name mapping is not sufficient even as a first-pass approximation for a state where this happens on Atlantic's two biggest CO cities (Aurora, Colorado Springs) and its capital (Denver has only one variant, at least, since it's a consolidated city-county with no split).

### A concrete mislabeling: `CO140206` — named "Canon City," priced as unincorporated Fremont County

`TBTXBOD` `CO140206`, `TBTXNAM` "Colorado Canon City," `TBCRATE` = 5.4% (`TBCBSRT` 2.9 + `TBCLRT1` 2.5 + zero city layer). The official file's actual Canon City jurisdiction (`140008`) is 8.7% — state 2.9 + county 2.5 + **city 3.3**. A+'s `140206` code has no city layer at all: its rate composition is exactly the *unincorporated Fremont County* rate, not incorporated Canon City. The numeric tail (`140206`) doesn't even match Canon City's real `Jurisdiction Code` (`140008`) — it looks like an old/different code, not a typo of the same one.

The likely real explanation (consistent with the project's general "postal city ≠ tax jurisdiction" lesson from GA/SC): a ship-to whose mailing address says "Canon City, CO" can be physically outside Canon City's incorporated limits, in unincorporated Fremont County — and this A+ tax body may correctly reflect that specific ship-to's real (unincorporated) rate while being misleadingly named after the mailing city. But nothing here confirms that interpretation over "this code is simply wrong" — it hasn't been traced to which real ship-to(s) use it. Either way: **`TBTXNAM` cannot be trusted at face value as identifying a jurisdiction in Colorado** — a name can describe the postal city while the configured rate belongs to the surrounding unincorporated county. Any adapter matching by name alone would silently misjudge this row.

## Step 2 — rate comparability: internally consistent, but a real, live mismatch found on Denver

`TBCBSRT + TBCLRT1..4 = TBCRATE` held on every row checked (Aurora, Colorado Springs, Denver, Broomfield, Centennial, Delta, Elizabeth, Craig, Parker, Pagosa Springs, Timnath) — same internal-consistency pattern seen in NC/SC. That's a good sign the *arithmetic* isn't the problem.

**But comparing A+'s total against the live official file directly, one of Atlantic's largest CO markets disagrees:**

| Jurisdiction | A+ (`TBTXBOD`, `TBCRATE`) | Official file (Jurisdiction Code, Total Rate, current July–Dec 2026) |
|---|---|---|
| Denver | `CO004`, **8.81%** (2.9 + 4.81 city + 1 RTD + 0.1 CD) | `010006`, **9.15%** (2.9 + **5.15** city + 1 RTD + 0.1 CD) |

The state layer, RTD, and CD all agree — only Denver's own home-rule city rate differs (4.81% in A+ vs. 5.15% currently on file), a 0.34-point gap on the total. Denver is a **self-collected home-rule city** (flagged as such in the official file's own `Self Collected Home Rule` column), which is exactly the situation the project's pre-existing research already flagged as ambiguous rather than a hard error — a mismatch here could mean A+ is stale (hasn't picked up a real Denver rate increase), or it could reflect some other timing/definition difference not yet checked (e.g., whether Denver's various dedicated sub-taxes — parks, preschool, climate, etc. — are being aggregated the same way by both sides). **This has not been resolved — it's reported here as a live, confirmed number mismatch that needs a human or a deeper follow-up to adjudicate, not as a settled "A+ is wrong" finding.**

By contrast, every one of the numeric-tail-coded rows checked (Centennial, Delta, Elizabeth, Craig, Parker's base variant, Timnath's Larimer variant) matched the current official rate exactly — so this isn't a wholesale "A+ is out of date" problem, it's at minimum a Denver-specific gap, and possibly a broader home-rule-self-collection sync-lag issue that would need every self-collected city checked individually to characterize.

## Confirmed contamination / exclusions needed

- **`COSTA`** — `TBTXNAM` = **"Costa Rica no tax"**, `TBCRATE` = 0. Wrong-country data caught purely by the `LIKE 'CO%'` prefix, the same failure mode as SC's `SC3622` (South Dakota). Not a Colorado row at all — exclude explicitly (`TBTXBOD NOT IN ('COSTA', ...)`), don't rely on prefix alone.
- **`CO CR`** (note the embedded space, `"CO CR"` not `"COCR"`) — `TBTXNAM` = "Colorado Credits," `TBCRATE` = 7.65. A flat credit/component code, not a jurisdiction — same category as NC's `NC6.75%`/SC's `SCCR8.0`. Exclude from any jurisdiction comparison.
- **`CO042E`** — `TBTXNAM` = "Colorado Denver Equip," `TBCBSRT` = 0.001 (not 2.9), `TBCRATE` = 4.811 vs. Denver's general 8.81. This is the **`E`-suffix equipment-tax variant pattern already confirmed in CA and AL** (`docs/aplus-data-findings.md` / `docs/state-rollout.md`) — now a third state. Exclude `E`-suffixed codes from general ship-to sales-rate comparison, consistent with prior guidance.
- **`CO018` / `CO040057` duplicate** — both named a variant of "Monument," both rate 7.63%. Not wrong data, but a real duplicate of the same jurisdiction under two different codes — a naive `COUNT(DISTINCT TBTXBOD)` would overstate Colorado's real place coverage by at least one.

No literal `DO NOT USE` rows surfaced in this 57-row result (the standard exclusion filter was applied up front per the standing rule, consistent with NC's connector), but the filter was only validated against what came back — a state-name-name check independent of that filter (i.e., grep every real `TBTXNAM` for anything not saying Colorado) is what caught `COSTA`, and should always be run this way for future states too.

## Step 3 — boundary/rate-detail source

Confirmed live and reachable: `tax.colorado.gov` blocks generic HTTP clients with a 403 but not `curl` with a real browser `User-Agent`. The current file must be resolved from the landing page each run (`https://tax.colorado.gov/how-to-look-up-sales-use-tax-rates`) — the filename embeds the half-year (`Colorado_Jurisdiction_Codes_Rates_July-Dec2026.xlsx` today) and changes on a 6-month cycle; do not hardcode it. The file is a real `.xlsx` (verified by unzipping and reading the OOXML parts directly); no xlsx-parsing npm package exists in this repo yet.

## Do instead — open items before building

1. **Decide how to handle the "one city, several counties/districts" case before writing any matcher.** This can't be solved by name-to-code lookup the way NC's was; it needs a real ship-to address (or at minimum, ship-to county) resolved against the official file's per-county/per-district variants — closer in spirit to GA's boundary matching than to NC's simple join, but with a wrinkle (multi-county cities, special-district membership) neither GA nor SC's design has had to handle yet.
2. **Do not trust `TBTXNAM` as a jurisdiction identifier by itself** — the Canon City finding shows a name can label a postal city while the configured rate is actually for the surrounding unincorporated county. Any real ship-to reconciliation needs to check rate composition (which layers are present/absent), not just match on name text.
3. **The Denver mismatch (8.81% vs. current 9.15%) needs a human decision or deeper follow-up, not a default resolution** — per the project's own standing instruction, treat self-collected-home-rule-city mismatches as ambiguous/needs-verification rather than a confirmed A+ defect, but this one is concrete and material enough (Atlantic's largest CO market, a real percentage-point-scale gap) that it should be raised rather than quietly noted.
4. **Keep the hardened workbook validation current.** The official-inventory adapter now exists, but it must continue to fail closed if the six-sheet/44-column layer format or component arithmetic changes.
5. **Exclude `COSTA`, `CO CR`, and `E`-suffixed codes explicitly** in any future CO query, the same way NC/SC's connectors pre-exclude their own known-bad codes.

**The official inventory is now safe to display, but `recommendComparisonBuild = false` for CO right now.** What remains is a genuinely harder matching problem than any state built so far, plus one historical material unresolved discrepancy on Atlantic's biggest CO market. Building a matcher without a decision on the multi-variant-per-city problem risks shipping a confidently wrong comparison.
