# South Carolina — findings

Status: **official source connected (2026-08-26), A+ matching still not built.** `server/sc-rates.mjs` fetches and validates ST-575 live; `readOfficialScRates()` is wired into `/api/official/states/SC`. Address-matching logic against `XATXBD`'s SC0xx codes remains the open half. Investigated live on 2026-08-25–26.

## The parser: how ST-575 actually got read

`docs/roadmap-50-states.md` flagged SC as "blocked on tooling, not just effort" — hand-rolling a full PDF object/content-stream parser (this PDF is PDF 1.6, Adobe Distiller-generated, cross-reference *streams* not a classic xref table, FlateDecode-compressed content) was judged too high-risk for a one-off adapter; a subtle glyph/position decoding bug could silently produce a plausible-looking but wrong table, which is exactly the "confidently wrong, not ambiguous" failure this project's rules exist to prevent.

Instead, `server/sc-rates.mjs` shells out to the system **`pdftotext -table`** (poppler-utils), which is purpose-built for exactly this failure mode — plain `-layout` mode detaches a wrapped row's rate cells from its municipality name, but `-table` mode keeps them correctly glued together. Verified directly: a raw layout-mode extract left rate values floating in orphaned blocks after several unrelated rows; `-table` mode produced every row with its own rate attached, zero misattributions found across all 340 real data rows.

**Consequence: this adapter has a runtime dependency the others don't (a system binary, not an npm package).** It fails loudly and specifically (not silently) if `pdftotext` isn't installed on the host — see `extractTextWithPdftotext()`'s `ENOENT` handling. **Whoever deploys this needs poppler-utils on the connector's host**, or this endpoint returns 503 forever. This is worth flagging to Ana/Liv before SC ships, since it's the one adapter with an infra prerequisite.

The parser is defensive by construction, matching the project's "never guess" rule:
- Requires the table header to actually appear before parsing any row (drops the legal-boilerplate preamble structurally, not by pattern-matching every line of it).
- Treats any post-header line that isn't blank, a repeated header, a page number, or a real data row as a **hard failure**, not a silent skip — if SC ever changes the form's layout, this throws instead of quietly parsing a wrong or incomplete table.
- Validates all 46 `SC_COUNTIES` have exactly one `Unincorporated` row each (no missing, no duplicate, no unrecognized county name).
- Validates every rate is within a plausible range of the 6% state minimum.
- Validates no `(municipality, county)` pair repeats unexpectedly.

Result on the live document (revision 2/5/26, fetched 2026-08-26): **46/46 counties, 294 municipality rows, 340 total — all validated, zero unrecognized lines.**

## Cross-check against A+: PDF has more municipalities than A+ has codes

ST-575 lists 294 municipality rows; A+'s `XATXBD` `SC 02xxx`-tier codes (Step 1 investigation, 2026-08-25) numbered 281. A 13-row gap is expected to exist for one of a few reasons — a municipality newly incorporated or newly adopting a local option tax since A+'s codes were last updated, or a real gap where no A+ ship-to currently needs that code — but this hasn't been reconciled name-by-name yet. **Do not assume this gap is an error without checking it** — the project's own experience (NC's `NCMK65` scare) shows an apparent mismatch can turn out to be nothing once the two sides are actually compared. This reconciliation is exactly what the still-unbuilt matching step needs to do.

## Step 1 — address matching: needed, and for a different reason than GA

Confirmed by pulling the full unfiltered `SC%` result from `XATXBD` (345 rows — matches the count noted previously; ran without `FETCH FIRST` this time to be sure nothing is truncated).

SC's real local-option tax structure produces a genuinely clean **two-tier split within most counties** — this isn't chaotic overlap like a home-rule state, it's a specific, discoverable pattern encoded right in `TBTXNAM`:

- **Tier `01`** — the unincorporated-county rate. 46 rows, one per SC county, in alphabetical order (`SC001` = "SC 01001 Abbeville Co" ... `SC331` = "SC 02... York"). Rate = county's base local-option layer only.
- **Tier `02`** — incorporated-municipality rates. 281 rows, one per city/town, keyed to real municipal place codes (not sequential/alphabetical — genuine GNIS-style place numbers, e.g. `SC010` = "SC 02010 Aiken"). A city's rate frequently *differs* from its own county's unincorporated rate (adopted its own local option, or is exempt from one the county has) — e.g. Greenville County unincorporated (`SC148`) is 6%, but several Greenville County cities are also 6% while others in the same county sit at 7% or 8% depending on which optional tax applies to that specific place.

This confirms address matching is required for the same underlying reason GA needed it: **jurisdictions vary within a single ZIP code** — an incorporated city and its surrounding unincorporated county fringe routinely share ZIPs, and only the specific address tells you which side of the line a ship-to is on.

### Wrinkle 1 — a third, irregular tier for at least one county

`TBTXNAM` also has 3 rows tagged `SC 09011` — Cherokee County (`SC082`), Blacksburg (`SC083`), and Gaffney (`SC084`), all at 8%. This doesn't fit the `01`/`02` two-tier pattern at all — `09011` doesn't match SC's real Census FIPS county code for Cherokee (021) either, so it looks like A+ appended Cherokee's data later under its own ad hoc numbering rather than fitting it into the original alphabetical `01`/`02` layout. **Lesson: don't hardcode an assumption that every county's rows follow the `01`/`02` prefix scheme** — Cherokee is a confirmed exception, and a parser built only against the common pattern would silently miss it (or worse, mis-tier it).

### Wrinkle 2 — municipalities that straddle a county line get their own suffixed code

Six codes carry a letter suffix and duplicate a place name already seen under a plain code: `SC057M`/`SC068` (Charleston, both listed under county group `02`), `SC067D` (Awendaw), `SC078M`, `SC122M`, `SC129M`, `SC208M`. These appear to represent **the portion of a municipality that falls in a different county** from its "home" code — several of Charleston-area's cities (Charleston, North Charleston, North Augusta, Columbia) are known to span two counties in real life. **A parser must not assume one municipality name maps to exactly one code** — matching has to be done by the suffixed code the address actually falls under, not by city name alone.

### Wrinkle 3 — a bare-name special jurisdiction outside the tier scheme entirely

`SC071J` — "James Island" (no `SC 0#0##` prefix at all in `TBTXNAM`), rate 9%, `TBCBSRT`/`TBCLRT1-3` = 6/1/1/1. James Island is a real SC special-legal-status area (a town with an unusual incorporation history near Charleston). This is a one-off, not part of either the county or municipality list — a parser keyed only on the `SC 0#0##` naming pattern would drop it silently rather than flag it as unhandled.

### Wrinkle 4 — non-uniform code width

`SC1931` ("Van Wyck," a 4-digit-tail code next to the otherwise-3-digit `SC193`) shows `TBTXBOD` isn't fixed-width. Don't parse codes by fixed character position.

## Confirmed real data contamination (still present)

`SC3622` — `TBTXNAM` = **"South Dakota Vermillion"**, `TBCRATE` = 6.2% (base 4.2 + local 2). This is real South Dakota data sitting inside a `LIKE 'SC%'` filter purely by code-prefix coincidence, and it is **not** a zero/inactive row — it carries a live-looking rate that would silently corrupt an SC aggregate if pulled in by prefix alone. Re-confirmed live on 2026-08-25 (previously flagged, still there — hasn't been cleaned up in A+). **Any SC query must sanity-check `TBTXNAM` actually says "South Carolina" or matches the `SC 0#` naming convention, never trust the `TBTXBOD` prefix alone.**

## Codes to exclude from any jurisdiction comparison

- `SC 216`, `SC 217` — literally named `"DO NOT USE"`. Note the embedded space in the code itself (`"SC 216"` vs. the real, unrelated `SC216` = South Congaree) — these are distinct strings so an exact-match lookup is safe, but a normalizer that strips internal whitespace could accidentally collide them. Don't normalize away the space.
- `SC000` — `"South Carolina DO NOT USE"`.
- `SC26` — `"DO NOT USE"`, only 2 digits (not `SC026`, which is a real code — "Anderson," rate 7%). Same collision risk as above if a parser pads/reformats codes carelessly.
- `SCCR8.0` — `"SC CREDITS ONLY"`, a fixed-rate credit/component code, not a jurisdiction (same category as NC's `NC6.75%`/`NC7%CR` etc.).
- `SC3622` — real South Dakota data ("South Dakota Vermillion"), not SC at all; see contamination note above.

Ready-to-use pre-excluded query for future SC work:

```sql
SELECT * FROM OPENQUERY([SQL03], '
  SELECT * FROM OPENQUERY(APLUS, ''
    SELECT TBTXBOD, TBTXNAM, TBCBSRT, TBCLRT1, TBCLRT2, TBCLRT3, TBCLRT4, TBCRATE
    FROM APLUSV8FAQ.XATXBD
    WHERE TBTXBOD LIKE ''''SC%''''
      AND TBTXBOD NOT IN (''''SC 216'''', ''''SC 217'''', ''''SC000'''', ''''SC26'''', ''''SCCR8.0'''', ''''SC3622'''')
      AND UPPER(TBTXNAM) NOT LIKE ''''%DO NOT USE%''''
  '')
')
ORDER BY TBTXBOD;
```

All four `DO NOT USE`/credit rows are 0% or flat non-jurisdiction rates and would already be excluded by the same `NOT LIKE '%DO NOT USE%'`-style filter pattern used in NC's query — just confirming SC needs an equivalent, not yet built since no SC query exists in code today.

## Step 2 — rate comparability: not yet confirmed, no official source connected yet

Internally, every real SC row is arithmetically consistent: `TBCBSRT + TBCLRT1 + TBCLRT2 (+ TBCLRT3/4)` sums to `TBCRATE` in every sampled row (e.g. Cherokee Co: 6 + 1 + 1 = 8). That's a good internal-consistency signal, but it is **not** the same as confirming A+'s total agrees with SC DOR's own published number — there is no live SC official-rate pull yet to check against (see Step 3), so this remains open.

Observed total-rate distribution across the 338 real jurisdiction rows: 6% (22), 7% (143), 8% (144), 9% (31) — all inside SC's plausible real-world range (6% state minimum up to 9% in a few coastal/Capital-Projects-tax counties like Charleston/Berkeley/Jasper). Nothing here looks structurally wrong, but "plausible" isn't "confirmed."

## Step 3 — boundary/rate-detail source

SC is **not** a Streamlined Sales Tax full-member state — confirmed by its absence from the `SST_RATE_STATES` set in `server/official-source-registry.mjs` (which lists AR, GA, IA, IN, KS, KY, MI, MN, NC, ND, NE, NJ, NV, OH, OK, RI, SD, TN, UT, VT, WA, WI, WV, WY — no SC). So the GA-style "just adapt the Streamlined file" shortcut doesn't apply here.

The only identified official source was SC DOR's **ST-575 PDF** (`https://dor.sc.gov/sites/dor/files/forms/ST575.pdf`) — since connected (2026-08-26) via `server/sc-rates.mjs`, which shells out to `pdftotext -table` rather than hand-rolling a PDF parser (see above).

## Do instead

- Parse `TBTXNAM`'s `SC <tier><place>` convention to get tier (unincorporated county vs. municipality) and place identity — don't rely on `TBTXBOD` numbering, which has no discoverable structure of its own (compare NC, where the code itself is index-based and meaningful; here the code is arbitrary and the name carries the structure).
- Explicitly handle the three known exceptions before trusting a "clean two-tier" model: Cherokee County's `09011` group, the six county-line-straddling `M`/`D`-suffixed codes, and James Island's bare-name special case. Expect more of these once all 345 rows are read carefully, not just sampled.
- Exclude `SC3622` (South Dakota) and the four `DO NOT USE`/credit codes explicitly, the same way NC's query filters do — SC needs its own version of that filter list since no SC query exists in `aplus-connector.mjs` yet.
- Don't attempt Step 2 (rate comparability) confidently until the ST-575 pull is cross-checked against a known example jurisdiction's rate — internal arithmetic consistency is not external validation.
