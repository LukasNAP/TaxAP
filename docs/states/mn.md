# Minnesota — findings

Status: **investigated live 2026-08-26, not safe to build.** Confirmed FIPS `27`, 87 real counties (Census 2025 Gazetteer). A real, current SST boundary file exists for MN in the same 89-column shape as GA's (`server/ga-boundary.mjs`'s parser could plausibly be adapted), so the plumbing for a GA-style build is available — but A+'s own `XATXBD`/`ADDR` data has two independent, serious problems that need a human decision before any comparison is built.

## Address matching

**Needed.** Confirmed live, not inferred from SST's "city + special-district layering" research note:

- 49 real (non-`DO NOT USE`) `MN%` tax-body codes exist. Some are counties (`MN430` "Minnesota Hennepin Co.", `MN435` "Minnesota Ramsey Co", `MN455` "Minnesota Dakota Co.", etc.), others are named cities that carry their own full combined rate (`MN320` "Minnesota Duluth", `MN300` "Minnesota Rochester", `MN380` "Minnesota St Paul", `MN375` "Minnesota Mankato", `MN550` "Minnesota Willmar", etc.) — a mixed county/city convention, not one clean level.
- **The same real city name is split across multiple different tax bodies in live `ADDR` data** — 40 of 125 distinct MN ship-to cities have ship-tos assigned to more than one tax body. Examples that are clearly wrong, not just imprecise: `WOODBURY` (actually in Washington County) has ship-tos on `MN452` (Washington Co. — correct), `MN380` (St Paul — wrong), and `MN430` (Hennepin Co. — wrong); `ROSEVILLE` (in Ramsey County) has ship-tos on `MN435` (Ramsey — correct) and `MN380` (St Paul — wrong).
- **Minneapolis has no dedicated A+ tax body at all**, despite being large enough (18 `MN000` + 12 `MN430` ship-tos, the single biggest concentration in the state) and despite Minneapolis having its own real local sales tax layered on top of Hennepin County's rate. The 12 ship-tos coded `MN430` are taxed as plain Hennepin County, with no Minneapolis-specific component — a likely real gap, not just an assignment inconsistency.
- A `TBTXBOD → SASTXB` join alone will not resolve any of this; genuine address/place-level matching (GA-style) is needed to know which real jurisdiction a ship-to sits in, since the code a ship-to already carries can't be trusted.

## The blocking finding: `MN000`

**`MN000` is the single most heavily-used MN tax body in real `ADDR` data today — 113 of 387 active MN ship-tos (29%) carry it**, more than double the next-largest code (`MN430` Hennepin, 71). `MN000`'s `TBTXNAM` is literally `"DO NOT USE"` and its `TBCRATE` is 0.

This is not a narrow or exotic case: `MN000` ship-tos are scattered across dozens of real MN cities that **do** have working codes elsewhere in the data — 18 Minneapolis, 6 Brooklyn Park, 5 each of North Mankato/Plymouth/Saint Paul, plus Eagan, Bloomington, Burnsville, Willmar, Winona, Roseville, and more, each of which also has ship-tos correctly coded to a real tax body in the same city. This is the same shape as AL's `AL000` finding (a "DO NOT USE" placeholder absorbing a large, non-random slice of real customers) and just as blocking — any comparison that includes `MN000` ship-tos as "0% correct" or silently excludes them without a visible count would misrepresent nearly a third of the state.

**Must be understood (ask Ana/Liv or whoever owns MN billing) before building anything for this state.**

## Rate comparability

**No — a real, systemic issue found, not just "unclear."** `TBCRATE = TBCBSRT + TBCLRT1..4` is arithmetically self-consistent for every row (e.g. `MN430` Hennepin: 6.875 + 0.15 + 0.5 = 7.525), and the state base (`TBCBSRT` = 6.875 for all 49 rows) correctly matches Minnesota's statewide general rate.

But a live spot-check against Hennepin County's real combined rate (via a third-party sales-tax aggregator, since `revenue.state.mn.us`'s own rate-lookup/local-tax pages 404'd on direct fetch — **this needs re-confirmation against MN DOR's own primary source before being treated as certain**) found Hennepin's current minimum combined rate cited at **8.525%**, while A+'s `MN430` totals **7.525%** — a difference of exactly **1.00 point**. That aggregator explicitly describes a **Twin Cities seven-county metro-area 0.75% Transportation + 0.25% Housing sales tax (1.00% combined)** that layers on top of each of the seven metro counties' own county-level rate (Anoka, Carver, Dakota, Hennepin, Ramsey, Scott, Washington).

Checking A+'s local components for all seven of those counties shows no uniform +1.00% anywhere — they vary from county to county (`MN472` Anoka local=0.25, `MN455` Dakota local=0.25, `MN484` Carver local=0.5, `MN447` Scott local=0.5, `MN452` Washington local=0.5, `MN435` Ramsey local=0.5, `MN430` Hennepin local=0.65) with no common +1.00% baseline visible in any of them. If the metro-wide surcharge really applies uniformly to all seven (which is what the aggregator describes), **A+ is missing it across the board for the entire Twin Cities metro** — not a one-off miss on a single county. This would affect a large share of MN's real ship-to volume, since the live sample skews heavily toward Twin Cities suburbs (Minneapolis, Bloomington, Eagan, Plymouth, Eden Prairie, Woodbury, etc. all appear repeatedly).

This is a live, material, and (if confirmed) state-wide comparability gap — closer in shape to Ohio's transit-surcharge question than a spot bug, but larger in scope and currently corroborated only by a secondary source, not MN DOR directly.

## Exclusions found

- `MN000` = `"DO NOT USE"` — see blocking finding above. Standard `NOT LIKE '%DO NOT USE%'` filter correctly excludes it from the tax-body catalog query (49 rows survive vs. 50 raw), but it's still very much live in `ADDR.SASTXB` and must be excluded from `ADDR`-side analysis explicitly, with a visible count, not silently dropped.
- No wrong-state `TBTXNAM` contamination found in the raw `MN%` pull — every name says "Minnesota" or a real MN place, other than two rows whose county names happen to share a word with other states' names (`MN452` "Minnesota Washington Co." and `MN455` "Minnesota Dakota Co." — both are real MN counties, not contamination; flagged by an automated other-state-name scan and manually confirmed as false positives, not excluded).
- One typo found: `MN351` is spelled `"Minnestota Grand Rapids"` — cosmetic, doesn't affect a `NOT LIKE '%DO NOT USE%'`-style filter, but worth knowing if any future logic ever matches on `TBTXNAM` text.
- No `E`-suffixed equipment-tax variant codes found in the MN set (0 of 50).
- Live cross-context anomalies (same shape as the general `CMTXBD`/`SASTXB` pattern already documented in `docs/aplus-data-findings.md`): one MN-state (`SASHST='MN'`) ship-to each carries tax body `IL000`, `MO067`, `WI016`, or `ZTEMP` instead of any `MN%` code — 4 of 387 active MN ship-tos total. Small in count but confirms MN needs the same "ship-to state and tax-body-code state can disagree" defensive handling GA already needed.

## Step 3 — boundary/rate-detail source

**Confirmed found and fetchable.** `https://www.streamlinedsalestax.org/ratesandboundry/Boundary/MNB2026Q3MAY20.zip` — confirmed via direct `curl` (200 OK, `Content-Type: application/x-zip-compressed`, 327,835 bytes), same naming convention as GA's `GAB2026Q3MAY19.csv`. Unzips to a single CSV, `MNB2026Q3MAY20.csv` (5,784,572 bytes, 41,528 rows), with **89 columns per row — the exact same column count `server/ga-boundary.mjs` hardcodes as `EXPECTED_COLUMN_COUNT` for Georgia's file.** This is a strong (not yet proven) signal that the Streamlined boundary-file schema is shared across states and `ga-boundary.mjs`'s parser could plausibly be adapted rather than written from scratch — but the actual per-column meaning for MN's rows (jurisdiction codes, rate fields, ZIP ranges) has not been reverse-engineered or validated in this session, only the shape (column count, sample rows) was confirmed.

## Do instead

- Resolve what `MN000` actually means before building anything — same category of blocker as AL's `AL000`, at a larger share (29% vs. ~20%).
- Get a primary-source (MN DOR, not a third-party aggregator) confirmation of the Twin Cities seven-county metro 1.00% Transportation+Housing surcharge and whether it should be layered onto every one of the seven metro counties' A+ codes — this is a human/product decision (how to treat the gap) as much as an engineering one, per Ohio's precedent in `state-rollout.md`.
- Decide how to handle cities with no dedicated A+ code at all (Minneapolis being the clearest, highest-volume example) before assuming a "county code = correct rate for every city in that county" comparison is safe.
- If/when the above are resolved, the actual boundary-matching build has a real, fetchable, GA-shaped source ready to adapt — this state is not blocked on Step 3 the way LA/MO are.
