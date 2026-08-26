# South Carolina — findings

Status: **official rate source connected (2026-08-26); the RFA boundary source was re-verified but the address matcher was intentionally not built.** `server/sc-rates.mjs` fetches and validates ST-575 live; `readOfficialScRates()` is wired into `/api/official/states/SC`. SC DOR itself publishes no address/ZIP-level data, but SC RFA's public GIS REST services (geocoder + municipal/county boundary polygons at `gis.state.sc.us`) do — see Step 3. The 2026-08-26 validation attempt found source-quality, terms-of-use, and customer-address privacy questions that must be resolved before active A+ ship-tos are sent to the geocoder. Address-matching logic against `XATXBD`'s SC0xx codes remains unbuilt and unvalidated. Investigated live on 2026-08-25–26.

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

The only identified **rate-detail** source is SC DOR's **ST-575 PDF** (`https://dor.sc.gov/sites/dor/files/forms/ST575.pdf`) — since connected (2026-08-26) via `server/sc-rates.mjs`. ST-575 gives 46 counties × their unincorporated rate plus 294 municipality rates, all keyed by **name only** — no ZIP codes, no address ranges, nothing geographic. It answers "what does Aiken charge" but not "is this ship-to inside Aiken city limits or the unincorporated county fringe next to it," which is exactly the question Step 1 found necessary. `ST-389` (Schedule for Local Taxes, `https://dor.sc.gov/sites/dor/files/forms/ST389.pdf`) was also checked and is the same shape — county/municipality names and rates, no geography. Re-confirmed 2026-08-26: SC DOR itself publishes nothing address/ZIP-level.

### A real boundary source does exist — just not from SC DOR, and not a downloadable flat file like GA's

**SC Revenue and Fiscal Affairs Office (RFA)** — a separate SC state agency from DOR, but still SC state government, not a third party — operates the public GIS platform at `gis.state.sc.us`, and it has exactly the geography ST-575 lacks. RFA's own public-facing "SC District Info" tool (an ArcGIS Instant App, item id `689fd82b343045988251f0cbad8f1620`, owned by RFA, 109k+ views) is described by RFA itself as returning, among other districts, county-level sales tax rates for an address — confirming RFA already builds address→tax-jurisdiction lookups on top of this data for public use. Traced its webmap (item `3e091943d6414f5fa5c5a1ddb759cbd9`) to the actual REST endpoints behind it, all under `gis.state.sc.us` and all confirmed publicly queryable with no auth/token in the response (verified live 2026-08-26):

- **Geocoder** — `https://gis.state.sc.us/arcgis/rest/services/Geocode/RFA_MultiRole/GeocodeServer` — a public ArcGIS `GeocodeServer` (v11.5) that takes a single-line address or address components (street/city/county/ZIP+4) and returns matched lat/lon plus a match score. Documents support for batch geocoding up to 1,000 records per call — sized for exactly this kind of bulk use, not just one-off manual lookups.
- **Municipal boundary polygons** — `https://gis.state.sc.us/arcgis/rest/services/Boundaries_Districts/Municipalities/FeatureServer/0` ("City/Town Limits"). `esriGeometryPolygon`, fields include `CITY_NAME` (uppercase, e.g. `"CHARLESTON"`), `CNAME` (title case, e.g. `"Charleston"`), `COUNTY_NAM`, `COUNTY_ID`. `maxRecordCount` 4000, `capabilities: "Query,Extract"` — meaning the full polygon set (SC has ~280 municipalities, well under the page size) can be bulk-exported and cached the way GA's CSV is, not just queried one address at a time.
- **County boundary polygons** — `https://gis.state.sc.us/arcgis/rest/services/Geodetic/County_Boundary/FeatureServer/0`. Also `Query,Extract`, fields include `County`, `FIPS`, and (notable, unvalidated) a `TaxRate` field carried directly on the county polygon — sampled live and it does vary by county (e.g. Charleston/Berkeley/Jasper 0.09, Beaufort/Greenville/Oconee 0.06), consistent with real county-level rate spread, not a placeholder constant. **Flagging, not trusting yet**: this sample came back through a summarizing fetch, not raw JSON I inspected directly, and the summarized table showed Pickens and Oconee sharing the same FIPS code (`45077`) — either a transcription artifact of the summarization step or a real data quality issue in RFA's layer; either way, `TaxRate` needs to be pulled and checked as raw JSON before being trusted, and even if clean it almost certainly reflects only the **unincorporated county** rate (ST-575's tier `01`), not the per-municipality tier `02` rates that most of SC's jurisdictional variation lives in.
- **ZIP boundary polygons** — `https://gis.state.sc.us/arcgis/rest/services/Boundaries_Districts/ZIP_Code/FeatureServer/1` — available as a coarser fallback tier, with the same caveat Step 1 already raised: ZIP boundaries don't align with SC's incorporated/unincorporated split, so this tier alone can only ever be as reliable as GA's ZIP5 tier (last resort, higher ambiguity) — never a substitute for the municipal-polygon match.

Spot-checks that matter for the specific wrinkles `docs/states/sc.md` already documents:

- **James Island (Wrinkle 3)** exists as its own polygon in the Municipalities layer (`CITY_NAME: "JAMES ISLAND"`, `COUNTY_NAM: "CHARLESTON"`) — the special-case jurisdiction ST-575/`XATXBD` both carry as `SC071J` has a real, matchable boundary. Good sign this layer's coverage isn't limited to "real" incorporated cities only.
- **Straddling-county cities (Wrinkle 2)** are *not* handled by this layer's attributes alone: queried Charleston directly and it comes back as a **single** polygon record with one `COUNTY_NAM` (`"CHARLESTON"`, `COUNTY_ID` 10) — even though `docs/states/sc.md` documents Charleston as needing a split code (`SC057M`/`SC068`) because part of the city falls in a different county. The single feature's *geometry* may still be multi-part and genuinely span the county line even though its attribute table only names one "home" county — that's a geometry-vs-attribute distinction, not something resolvable from attributes alone. **Consequence for matching:** the county a specific address is actually in has to come from a **separate** point-in-polygon query against `County_Boundary`, not from the Municipalities layer's `COUNTY_NAM` field — then the (real city, real county) pair is what selects between a plain code and the `M`/`D`-suffixed straddling code, the same distinction Wrinkle 2 already describes. Not yet checked: whether `Municipalities` even has a second polygon feature for the Berkeley/Dorchester slice of Charleston/North Charleston at all, since only a `CITY_NAME='CHARLESTON'` exact-match query was run — worth checking with a spatial query before relying on this for the straddling cases specifically.
- Cherokee's `09011` numbering oddity (Wrinkle 1) is an `XATXBD` code-naming quirk, not a geography question — this boundary source is irrelevant to it either way; Cherokee County and Blacksburg/Gaffney would match normally by name once geocoded.

### How this differs from GA's pattern, if built

This is a real, usable, government-published (SC state agency, not DOR, not a third party) address-to-jurisdiction path — but it is **not a drop-in adaptation of `server/ga-boundary.mjs`**, because the shape of the source is different:

- GA: one downloadable flat file, address ranges and ZIP+4/ZIP5 rows all in one CSV, matched by string/range logic entirely offline once fetched. No network call per address.
- SC (if built this way): **two dependent live steps per address** — (1) geocode the ship-to street address via RFA's `GeocodeServer` to get lat/lon (batchable, up to 1,000/call), then (2) point-in-polygon that coordinate against the (locally cached, bulk-exported) `Municipalities` and `County_Boundary` layers to get the real (city, county) pair, then (3) join that pair against `server/sc-rates.mjs`'s already-parsed ST-575 municipality/county list to get the tier-01/02 rate, applying the same exclusions and wrinkle-handling `docs/states/sc.md` already documents (Cherokee's `09011` group, the six `M`/`D`-suffixed straddle codes, James Island, `SC3622`/`DO NOT USE` contamination). A geocode match below RFA's confidence/score threshold, or a point that misses every polygon (offshore/PO box/bad address), should fall back to `unmatched`/`ambiguous` exactly like GA's tiered matcher does for its own failure cases — never guess.
- This also means SC's adapter would carry a **live external dependency the boundary lookup itself doesn't have in GA's design** (a reachable `gis.state.sc.us`, geocode match-rate assumptions, and a name-matching step between RFA's `CITY_NAME`/`CNAME` spellings and ST-575's municipality-name spellings that hasn't been checked at all yet — e.g. does RFA write "North Myrtle Beach" the same way ST-575 does). None of this has been validated end-to-end; this section identifies that a real source exists and sketches the shape, it does not confirm the join actually works name-for-name.

**Bottom line: a government-published address-to-jurisdiction path for SC exists, but it is not yet approved or safe to operate.** Census TIGER/Line was not pursued further because RFA publishes the state's own municipal/county geometry. The validation attempt below confirmed complete normalized place-name coverage and the necessary two-layer geometry model, but also confirmed defective county attributes, an unresolved Charleston/Dorchester intersection, no explicit programmatic-use terms, and a new outbound customer-address flow requiring Atlantic approval. No matcher was shipped.

### 2026-08-26 matcher validation attempt — stopped safely, no matcher shipped

The four open questions above were re-checked directly against raw SC government responses. This produced enough evidence to reject a guessed implementation, but not enough to approve operational use:

- **The duplicate FIPS is real, not a summarization artifact.** A raw `County,FIPS,TaxRate` query returned 46 county features, with both Oconee and Pickens carrying `45077`. The layer therefore cannot be keyed or uniqueness-validated by its FIPS field. County names themselves were complete: all 46 ST-575 county names matched the 46 RFA county names after conservative case/punctuation normalization.
- **Do not use RFA's `TaxRate` as the official rate source.** Forty-five county totals agreed with the current ST-575 form, but Williamsburg did not: current ST-575 says 8% while the RFA polygon attribute says 7%. ST-575 remains TaxAP's rate authority; the RFA layers may only supply geography after the issues below are resolved.
- **Municipality names are complete, but county attributes are not sufficient.** ST-575 has 294 municipality/county rows representing 271 unique municipality names. RFA returned 272 features and the same 271 unique municipality names; every normalized ST-575 name found an RFA counterpart and RFA introduced no unmatched name. However, 23 ST-575 multi-county municipality/county pairs are absent from RFA's single `COUNTY_NAM` home-county attribute. A safe matcher must intersect the address point with the municipality geometry and separately with the county geometry, then join the resulting `(municipality, county)` pair to ST-575. It must never use `COUNTY_NAM` alone.
- **Charleston-area geometry is genuinely multipart, but one edge remains unresolved.** `CHARLESTON` and `NORTH CHARLESTON` each return one municipal feature, not separate county-slice features. Their polygons intersect Charleston, Berkeley, and Dorchester county polygons. ST-575 has North Charleston rows for all three counties, but Charleston rows only for Berkeley and Charleston. Before building, a spatial-area or known-address check must determine whether Charleston's Dorchester intersection is only a shared boundary/sliver or represents real addresses for which ST-575 publishes no corresponding row. Any such point must remain unmatched rather than inherit another county portion's rate.
- **Programmatic-use terms are not explicit.** The geocoder metadata links to RFA's official `Privacy Statement & Disclaimers` page. RFA describes the site as a public service providing access to public data, but publishes no explicit automated-use license, request quota, or rate-limit guidance. Its disclaimer also says to seek confirmation with the appropriate RFA section before taking action based on the information. Obtain written confirmation from RFA (the mapping page lists `analyticsmapping@rfa.sc.gov`) covering batch geocoding, caching/exporting the two polygon layers, acceptable request rate, and attribution before operational use.
- **Customer-address disclosure needs an Atlantic decision.** Unlike GA's downloaded boundary file, RFA geocoding would transmit active A+ ship-to street addresses to an external SC government service. No customer names are required, and raw addresses would still remain server-side, but this is a new outbound data flow. Atlantic IT/privacy must explicitly approve it and set retention/logging expectations before production ship-tos are submitted.
- **The current connector host lacks `pdftotext`.** The fixture suite remains valid, but the live ST-575 adapter cannot run on this machine until poppler-utils is installed or the deployment runtime provides it. This is an existing SC runtime prerequisite, not permission to replace the parser with a looser implementation.

Safe next step: obtain RFA and Atlantic approval, then build a fixture-first adapter that (1) treats ST-575 as the only rate source, (2) rejects duplicate/missing county names while ignoring the defective RFA FIPS/TaxRate fields, (3) caches validated polygon geometry, (4) batch-geocodes with a documented confidence threshold and request rate, (5) resolves municipality and county independently, and (6) reports unmatched/ambiguous/cross-state counts without exposing addresses. Only after that passes fixtures should a separately approved SC-only read-only A+ validation be run.

## Do instead

- Parse `TBTXNAM`'s `SC <tier><place>` convention to get tier (unincorporated county vs. municipality) and place identity — don't rely on `TBTXBOD` numbering, which has no discoverable structure of its own (compare NC, where the code itself is index-based and meaningful; here the code is arbitrary and the name carries the structure).
- Explicitly handle the three known exceptions before trusting a "clean two-tier" model: Cherokee County's `09011` group, the six county-line-straddling `M`/`D`-suffixed codes, and James Island's bare-name special case. Expect more of these once all 345 rows are read carefully, not just sampled.
- Exclude `SC3622` (South Dakota) and the four `DO NOT USE`/credit codes explicitly, the same way NC's query filters do — SC needs its own version of that filter list since no SC query exists in `aplus-connector.mjs` yet.
- Don't attempt Step 2 (rate comparability) confidently until the ST-575 pull is cross-checked against a known example jurisdiction's rate — internal arithmetic consistency is not external validation.
