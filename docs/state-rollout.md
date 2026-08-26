# TaxAP — 50-state rollout: decision procedure and status

Goal: extend TaxAP's dashboard from 2 states (NC, GA) to all 50. See `docs/roadmap-50-states.md` for the up-to-date, all-51-jurisdiction status table (source-discovery layer) — this file is the *procedure* for the deeper per-state investigation (A+ matching layer) that has to happen once a state has a real official source, plus the running log of what's actually been confirmed per state.

**Every state is its own independent set of facts about its A+ setup and its real tax law — there is no small set of "state types" to sort them into.** NC, GA, CA, OH, SC, and AL have each turned out different from one another in ways that don't reduce to a shared category: NC's numbering is a synthesized/trusted-assumption scheme; GA needs address-level boundary matching; CA has an undocumented equipment-tax variant; OH is clean at the A+ level but has county transit-authority surcharges layered on top of the base rate; SC needed address matching for a structurally different reason than CA (clean county+incorporated-place split) and had a data-quality bug (a South Dakota row inside the SC-filtered results); AL has both equipment-tax variants and a distinct "police jurisdiction" concept neither other state has shown. A few specific patterns (the equipment-tax-code suffix, the truncated-row-limit trap) have turned out to recur across states and are captured as reusable checks below — but that's different from states themselves falling into types. Don't treat one state's overall findings as predicting another's beyond the specific reusable checks below — everything else about a state is that state's own business and has to be checked on its own.

This file exists so that adding a state is a repeatable *procedure* (the same questions get asked every time), not that states are a repeatable *category* (the same answers apply across states).

## Step 0 — check current status before assuming anything

Before starting a state, check `docs/roadmap-50-states.md` for where it currently sits — that file has the authoritative, most-recently-verified status for every one of the 51 jurisdictions (official source found/verified, machine-readable or not, A+ matching built or not). Don't re-derive this from scratch, and don't trust a summary of it from memory — read the current file.

## Step 1 — does this state need ship-to address matching, or does an A+ tax-body code map directly to a jurisdiction?

This is the one genuinely reusable question, and it has to be answered per-state from real data — never assumed from a state's general reputation for tax complexity, and never inferred from what another state turned out to need. Run this against the live `XATXBD` chain for the state in question (redact nothing needed, tax-body codes aren't sensitive):

```sql
SELECT *
FROM OPENQUERY([SQL03], 'SELECT * FROM OPENQUERY(APLUS, ''SELECT TBTXBOD, TBTXNAM FROM APLUSV8FAQ.XATXBD WHERE TBTXBOD LIKE ''''<STATE_PREFIX>%'''' AND UPPER(TBTXNAM) NOT LIKE ''''%DO NOT USE%'''' AND UPPER(TBTXNAM) NOT LIKE ''''%DONT USE%'''' AND UPPER(TBTXNAM) NOT LIKE ''''%DON''''''''T USE%'''' AND UPPER(TBTXNAM) NOT LIKE ''''%INACTIVE%'''' AND UPPER(TBTXNAM) NOT LIKE ''''%OBSOLETE%'''''')')
ORDER BY TBTXBOD;
```

(Replace `<STATE_PREFIX>` with the state's likely code prefix — e.g. `CA`, `TX`. If nothing comes back, the prefix guess may be wrong; check a broader sample or search `TBTXNAM` for the state name instead.)

**Standing rule: never hand back or run a query whose result set can include a `DO NOT USE`/retired row or a row that actually names a different state, without excluding it first.** The `NOT LIKE '%DO NOT USE%'` family above (same phrasing `server/aplus-connector.mjs`'s NC query already filters on) is a static filter, safe to include in every state's query up front. Wrong-state contamination is different — it can't be predicted before you've seen the state's real `TBTXNAM` values, so:

1. Run the query with no state-name filter first, and eyeball every `TBTXNAM` for a state name that doesn't match.
2. The moment you find one (like South Carolina's `SC3622` = "South Dakota Vermillion"), add it to an explicit `AND TBTXBOD NOT IN ('<code>', ...)` exclusion — same pattern NC's connector uses for `NCUSE`/`NC060XXX` — before running or sharing that query again for that state.
3. Record the excluded code in that state's `docs/states/<code>.md` file so the next query for that state is written pre-excluded, not rediscovered from scratch.

**Don't trust a `FETCH FIRST 300 ROWS ONLY` limit to be complete for a full-state pull** — South Carolina's real result is 345 rows; an earlier 300-row-limited run silently truncated the tail end of the alphabet and would have produced an incomplete picture if not caught. Run unlimited (drop the `FETCH FIRST` clause entirely) or with a generous limit and confirm the returned row count isn't suspiciously round before treating a state's data as fully seen.

**Also check `TBTXNAM` against the code prefix, not just the code itself** — South Carolina's `SC%`-filtered results included one row (`SC3622`) whose `TBTXNAM` says "South Dakota Vermillion." A naive filter that trusts the `TBTXBOD` prefix alone will silently pull in a wrong-state row. Always sanity-check that `TBTXNAM` actually names the expected state for every row before treating a `LIKE '<PREFIX>%'` result as clean.

Look at what comes back and ask:

- **Does the count of distinct tax-body codes roughly match the number of real jurisdictions that actually vary in rate** for this state specifically (counties, cities, special districts — whatever that state's actual sales-tax structure is, which you have to know or look up, not assume)? Does `TBTXNAM` reveal a usable, discoverable convention?
- **Or can jurisdictions vary *within* a single ZIP code** in this state (common with home-rule cities, county option taxes, or dense special-district overlap)? If so, a code-to-jurisdiction mapping alone won't work — real address/ZIP-level matching is needed, the way GA's `ga-boundary.mjs` does it.

This tells you whether address matching is needed. **It does not tell you anything else about the state** — not whether the rate itself is simple, not whether special surcharges exist, not whether the official source has hidden rows. Those are separate, unrelated questions that happen to each have their own answer per state (see the Ohio transit-surcharge finding below for a concrete example of a state that needed no address matching at all and still had a real rate-comparability problem).

**Check for `E`-suffixed equipment-tax variant codes — a confirmed recurring A+ convention, not a one-off.** First seen in California (`CA1034`/`CA1034E`), then confirmed widespread in Alabama (at least four pairs, e.g. `AL7049`/`AL7049E`, `AL7051`/`AL7051E`, `AL9680`/`AL9680E`) — each `E`-suffixed code sits alongside a base code for the same jurisdiction but carries a different (often much lower) rate, presumably for equipment/machinery sales rather than general goods. Before treating a state's full `TBTXBOD` list as "one code per jurisdiction," check for this pattern and decide explicitly how to handle it (most likely: exclude `E`-suffixed codes from general ship-to sales-rate comparison, since they're a different tax category, not a competing rate for the same sale).

**Check for jurisdiction-type variants beyond the basic county/city split — Alabama's "police jurisdiction" (PJ) codes are a concrete example.** Alabama law lets a municipality tax a zone just outside its city limits (a "police jurisdiction," typically at a reduced rate) separately from both the plain unincorporated-county rate and the full in-city rate — a three-way split, not two. Other states may have their own equivalent structural wrinkles that don't show up anywhere else; the lesson isn't "check for PJ specifically," it's "don't assume a state's jurisdiction model only has the two levels (county, city) seen in earlier states — read `TBTXNAM` carefully for anything indicating a third category."

## Step 2 — is A+'s rate actually comparable to the official source's rate?

This is a distinct question from Step 1 and can fail independently of it — a state can be simple on the address-matching question and still be wrong to compare naively, if the two sides aren't measuring the same thing. Ohio is the concrete example: no address matching needed at all, but ~16 counties have a transit-authority surcharge in the real-world rate that may or may not already be baked into A+'s `TBCRATE`. Before building a comparison for any state, ask:

- Does the state have any surcharge, district, or special-category tax that applies to a *subset* of its jurisdictions, layered on top of the base rate?
- If so, does A+'s `TBCRATE`/`TBCLRT1-4` already include that layer, or does the official source's total include something A+'s number doesn't (or vice versa)? This has to be checked with a real query against a known example jurisdiction — there's no way to infer it from the code structure alone.

If A+'s number and the official number aren't measuring the same total, comparing them directly produces a confidently wrong finding, not an "ambiguous" one — the app has no way to know it's comparing apples to oranges unless someone checks this first.

## Step 3 — does a usable boundary/rate-detail source exist, if address matching is needed?

If Step 1 concluded a state needs address matching, check `docs/roadmap-50-states.md` for whether Streamlined Sales Tax already publishes a usable file for it (most states there do, but many of those files turned out to be ZIP archives the current adapter can't read yet — check the actual current status, don't assume "SST member" means "drop-in ready"). If Streamlined doesn't cover the state, check whether that state's own DOR publishes something address/ZIP-level (the way FL publishes XLSX, TX publishes text/HTML, etc.) that could be adapted instead.

## Step 4 — build, following whatever was actually confirmed for this specific state

- **If no address matching is needed:** adapt `server/ncdor-rates.mjs`'s pattern — fetch the official per-jurisdiction rate table, map tax-body codes to jurisdictions using the *confirmed* convention from Step 1 (don't synthesize and trust a numbering scheme the way NC's adapter does, unless there's no other option — read real codes directly when they're available, the way OH's are), validate all expected jurisdictions are present with a plausible rate range for that state.
- **If address matching is needed:** adapt `server/ga-boundary.mjs`'s tiered-matching pattern (exact address → ZIP+4 → ZIP5 → ZIP+4-sub-ranges-in-agreement) against whatever boundary source Step 3 found. Keep the same defensive posture: bail to null/ambiguous rather than guessing when parsing or matching is unclear.
- **If Step 2 found a surcharge/comparability issue:** decide explicitly how to handle it — bake it into the comparison, exclude the affected jurisdictions from findings with an honest exclusion count, or flag them ambiguous. Don't ship a silent apples-to-oranges comparison.
- Either way: aggregate findings by A+ tax body only (never exposing ship-to-level address/customer identity downstream), and report exclusion counts for anything filtered out rather than silently dropping it.

## Investigated so far

Each state's full findings live in their own file under `docs/states/` — don't read one state's file as implying anything about another beyond the reusable Step 1/Step 2 questions above.

| State | Address matching needed? | Rate comparability confirmed? | File |
|---|---|---|---|
| NC | No | Yes — confirmed 0/100 county mismatches live (2026-08-25); earlier `NCMK65` vs `NC060` question resolved (unrelated credit-memo code, not a rate conflict) | `docs/states/nc.md` |
| GA | Yes (fully built) | Yes | — (see `HANDOFF.md`; already fully wired) |
| SC | Yes — clean unincorporated-county vs. incorporated-municipality split, plus a straddling-county-line wrinkle | Official source now connected (`server/sc-rates.mjs`, validated 46/46 counties + 294 municipalities); A+ tax-body matching still not built | `docs/states/sc.md` |
| OH, CA, AL, FL | Partially investigated in earlier sessions (OH: no address matching but an open transit-surcharge comparability question; CA: address matching needed, equipment-tax variant found; AL: address matching needed, police-jurisdiction + equipment-tax variants found, no official source identified until the 2026-08-26 pass found one — see `docs/roadmap-50-states.md`; FL: likely no address matching needed, cleanest state found so far) | See `docs/roadmap-50-states.md` for current source status | **No dedicated file yet — write one before relying on these summaries for real work.** These bullet points are a carried-over summary from an earlier investigation whose detailed write-up was never actually saved; treat them as a lead to re-verify, not a citable finding. |
| All others | Not yet investigated at the A+-matching level | Sources verified 2026-08-26, see `docs/roadmap-50-states.md` | — |

When investigating a new state, create `docs/states/<code>.md` following the same structure as the existing files (address matching, rate comparability, boundary source if needed, open questions, do-instead) and add a row to the table above.
