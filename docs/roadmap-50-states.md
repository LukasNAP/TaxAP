# Roadmap: all 50 states + DC in the dashboard

Last updated: August 25, 2026, based on a live run against real A+/DWStage data (`lukasn@atlanticpkg.com` credentials) and a read of `server/official-source-registry.mjs` and `server/ga-boundary.mjs`.

## Where we actually stand

Getting all 51 jurisdictions into the "Needs attention" dashboard is not one task — it's three separable layers, and today's coverage is uneven across all three:

| Layer | What it means | Current coverage |
|---|---|---|
| **1. Official source** | A validated, machine-readable feed of that state's current rates | 8 connected, 22 identified-but-unbuilt, 21 not yet found |
| **2. A+ jurisdiction matching** | Mapping A+'s `XATXBD` tax-body codes to the *same* jurisdictions the official source uses | Only NC (trivial 1:1) and GA (address/ZIP boundary matching) actually do this |
| **3. Dashboard integration** | Feeding a state's comparison into the shared "Needs attention" / "Upcoming" tiles | Only NC feeds it today — **GA's live reconciliation already finds real discrepancies and still isn't wired in** |

That last point matters: layer 3 isn't "trivially" behind layer 2. We proved today that Georgia's matching engine works end-to-end against production data (18 confirmed rate discrepancies, 228 unmatched ship-tos, 59 tax bodies with inconsistent jurisdiction assignment) — none of it visible on the dashboard, because the UI only reads NC's result shape.

## Layer 1: official-source status, all 51 (per `official-source-registry.mjs`)

**Connected (8):** NC, GA, CA, TX, FL, PA, OH, TN

**Machine-readable source already known, adapter not yet built (22)** — this is the cheapest tier to close, because 20 of them share the *same* Streamlined Sales Tax (SST) rate-file format the GA/OH/TN adapter already parses (`server/sst-rates.mjs`); extending to these is mostly per-state validation (county/jurisdiction counts), not new parsing logic:

- **SST format, adapter reusable (20):** AR, IA, IN, KS, KY, MI, MN, ND, NE, NJ, NV, OK, RI, SD, UT, VT, WA, WI, WV, WY
- **Machine-readable but non-SST, needs bespoke adapter (2):** IL (official machine-readable files), VA (locality lookup + workbook)

**Official document identified, parser/model not validated (2):**
- SC — ST-575 PDF; needs a reliable PDF-table parser (harder — this is the one place we're blocked on tooling, not just effort)
- MD — official guidance identified; no locality rate model yet

**Not yet identified at all (19):** AL, AK, AZ, CO, CT, DE, DC, HI, ID, LA, ME, MA, MS, MO, MT, NH, NM, NY, OR — these need the research step (find each state's DOR machine-readable source) before anything else can start.

## Layer 2: A+ jurisdiction matching — the part with no shortcut

Every state may need a *different* matching strategy, and we won't know which until we look at that state's actual `XATXBD` tax-body naming for A+:

- **NC-style (cheap):** tax-body code encodes the county directly, 1:1 with the official source. Zero ambiguity.
- **GA-style (expensive):** tax-body codes don't correspond cleanly to jurisdictions; matching requires reading actual ship-to addresses and running them through an address→ZIP+4→ZIP-5 boundary-file cascade. This is real engineering per state, and even GA's version has open gaps today (9.5% of ship-tos unmatched, ~44% of tax bodies with inconsistent jurisdiction grouping).

Before committing to a build order for layer 1, it's worth spot-checking a handful of the 8 connected states' tax-body naming conventions to find out which pattern (NC-style or GA-style) each needs — that answer changes the actual cost of "adding" a state far more than the source adapter does.

## Layer 3: dashboard integration

The dashboard's rate-change inbox currently only understands NC's result shape. Generalizing it to accept any state's findings (a shared `{jurisdiction, officialRate, aplusRate, difference, shipTos, confidence}` shape) is a one-time investment that unblocks GA immediately and every future state after it — this is likely the highest-leverage single piece of work available right now, since it's needed regardless of how many more states get added.

## Suggested phase order

1. **Generalize the dashboard inbox** to accept any state's comparison output (unblocks GA today, no new data work).
2. **Fix Georgia's known gaps** — investigate the 228 unmatched ship-tos and 59 `jurisdictionAssignmentConsistent: false` tax bodies before treating its 33 raw rate differences as final. (18 of 33 are already trustworthy as-is.)
3. **Determine matching strategy (NC-style vs GA-style) for the other 6 connected-but-unmatched states** (CA, TX, FL, PA, OH, TN) — this is discovery, not yet build.
4. **Build matching + wire in whichever of those 6 turn out NC-style** (cheap wins first).
5. **Extend the SST adapter to the 20 already-identified SST states** — reuses existing, validated parsing code; mostly per-state count validation with fixtures first, per the existing project convention.
6. **Build IL and VA's bespoke adapters** (source already identified).
7. **Solve SC's PDF parsing and MD's locality model** — the two genuinely blocked-on-tooling cases.
8. **Research + validate sources for the remaining 19 states**, then repeat steps 3–4 for each as they come online.
9. **Matching work (layer 2) runs in parallel with 5–8** for every state as its source lands, since it's independent of which source format is used.

## What this is not

This is a plan, not a commitment to a timeline — per the handoff doc's own rule, nothing here should be read as claiming a source is validated, a rate is current, or a state is "done" until it's actually been captured and tested the way NC and GA were. Several of the tiers above (SC, MD, the 19 unresearched states) are explicitly *not* ready to show any number, confirmed or not, until that work happens.
