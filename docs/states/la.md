# Louisiana — findings

Status: **official source connected; limited assigned-name sales-tax comparison wired September 10, 2026.** The previously identified XLSX is stale, so `server/la-rates.mjs` instead reads the official filing lookup's selected current period and validates every parish table. Current matching scope is described below; earlier investigations remain historical.

## Current assigned-jurisdiction comparison

`server/la-aplus.mjs` retains the full 64-parish selector context. A parish label compares only when every official domicile row under that parish has one total rate. A base parish row alone is insufficient. Unique exact city/district names can compare; names repeated across parish contexts remain unmatched. St./Saint spelling is normalized; truncated names, LA000 and unrelated codes are never guessed.

Fresh Windows-authenticated aggregate: 220 assignments; LA000 covers 212 at 11%, LA001 covers five at 9.75%, and newly observed LA035 covers one at 10%. Two assignments are cross-state. Only St. Bernard currently compares: its [LATA parish-wide table](https://lataonline.org/for-taxpayers/city-to-parish-index/st-bernard/) independently confirms the official lookup total. Result: one compared assignment, no difference, 217 unmatched, two cross-state. The old 353-row inventory below had different filters/date and is not the current active population.

Build, lint and 247 tests passed. Tests retain duplicated domicile codes by parish context, reject partial/ambiguous sources, distinguish mixed/uniform parishes, and preserve sales-only inbox scope. No SQL changes or A+ writes. Most Louisiana assignments still lack a usable domicile; reader registration does not establish statewide assignment coverage.

## Connected official inventory

The official lookup selected September 2026 and exposed all 64 parish selectors. TaxAP performs the same server-side postback the public form uses, validates each returned table, and combines the local rates with Louisiana DOR's separately validated 5% state rate effective January 1, 2025.

The current crawl returns 439 source rows that normalize to 438 composite jurisdictions: 56 parish-base rows, 155 city/town/village rows, and 227 special domicile rows. French Quarter domicile `3601` publishes two stackable local rows in the same parish context; TaxAP validates their matching administrative rates and adds their 0.245% and 5% local components instead of dropping one. Domicile codes reused across different parishes remain separate—for example `0108` is 8.25% combined in Acadia context and 7.45% in St. Landry context.

## Step 1 — address matching: needed, but the real finding is more severe than "needed"

Ran the full unfiltered `LA%` pull against live `XATXBD` (no `FETCH FIRST`, zero exclusions applied first, per the standing rule):

```sql
SELECT * FROM OPENQUERY([SQL03], 'SELECT * FROM OPENQUERY(APLUS, ''SELECT TBTXBOD, TBTXNAM, TBCBSRT, TBCLRT1, TBCLRT2, TBCLRT3, TBCLRT4, TBCRATE FROM APLUSV8FAQ.XATXBD WHERE TBTXBOD LIKE ''''LA%'''' '')') ORDER BY TBTXBOD;
```

**Result: only 2 rows, total, for the entire state:**

| TBTXBOD | TBTXNAM | TBCBSRT | TBCLRT1 | TBCRATE |
|---|---|---|---|---|
| `LA000` | "Louisiana" | 5 | 6 | 11 |
| `LA001` | "Louisiana Jefferson Paris[h]" | 5 | 5 | 10 |

No `DO NOT USE`/inactive rows exist to exclude, and a name-search (`UPPER(TBTXNAM) LIKE '%LOUISIANA%'`, no prefix filter) returned the same 2 rows — no wrong-code-prefix Louisiana rows are hiding elsewhere, and no wrong-state contamination inside the `LA%` prefix either (unlike SC's `SC3622`/South Dakota case).

**This is not a "does address matching help" question the way GA/SC were — A+ has essentially zero jurisdiction-level granularity configured for Louisiana at all.** Two tax bodies exist against an official source describing "64 parishes plus hundreds of sub-jurisdictions, no uniform parish-wide rate." `LA000` is a flat statewide catch-all; `LA001` singles out Jefferson Parish specifically and nothing else.

### Confirmed at the ship-to level — the catch-all is doing almost all the work

```sql
SELECT LTRIM(RTRIM(a.SASTXB)) AS TaxBody, COUNT(*) AS ShipTos
FROM dbo.ADDR a
WHERE UPPER(LTRIM(RTRIM(a.SASHST))) IN ('LA', 'LOUISIANA')
GROUP BY LTRIM(RTRIM(a.SASTXB))
ORDER BY ShipTos DESC;
```

| TaxBody | ShipTos |
|---|---|
| `LA000` | 346 |
| `LA001` | 5 |
| `AL9137` | 1 |
| `HN000` | 1 |

Total ADDR rows with `SASHST = 'LA'`: 353. **346 of 353 (98%) of Louisiana ship-tos are assigned the single flat `LA000` code (11%), regardless of which parish or sub-jurisdiction they're actually in.** Only 5 ship-tos get the Jefferson-Parish-specific code. The remaining 2 (`AL9137`, `HN000`) are consistent with the already-documented `SASHST` dirty-data problem (`docs/aplus-data-findings.md`) — `HN000` in particular looks like Honduras contamination, not a real Louisiana code — and should be excluded/flagged, not treated as LA data.

**Implication:** this isn't "A+'s codes don't line up with official jurisdictions and need address matching to reconcile" (the GA/SC shape). It's "A+ isn't tracking Louisiana's jurisdictions at all" — there is no per-parish or per-domicile rate configured for 98% of Louisiana ship-tos to even compare against the official source. Building GA-style address→boundary matching would tell you what the *correct* rate should be per ship-to, but the A+ side of the comparison would be the same flat 11% for nearly every ship-to no matter what boundary matching produces — there's no real per-jurisdiction A+ number to check it against for the vast majority of accounts.

## Step 2 — is TBCRATE comparable to the official source's total?

The official side is now understood: the filing lookup's displayed `Tax Rate` is the local component, and the normalized comparison total is the current 5% state rate plus that component. A+ still cannot be meaningfully assessed automatically, for two compounding reasons:

1. **Sample size of 2** rows is nowhere near enough to tell whether `TBCRATE` (= `TBCBSRT + TBCLRT1`, both rows: `TBCLRT2-4` are 0) reflects the same total the official Domicile Rate Listing reports, or whether it's a rough/approximate figure someone typed in once. Louisiana's real local tax structure often stacks *more* than one local layer (parish sales tax, school board, law enforcement district, economic development district, etc.) inside a single domicile's total rate — a two-field `base + local1` model may not have room to represent that even if it were populated per-domicile.
2. The official source has 438 current parish-context domicile combinations, while A+ has no per-domicile row to check except the single Jefferson Parish entry. Jefferson itself contains multiple domicile combinations, so `LA001`'s single 10% figure remains an oversimplification.

## What this means for building

This state doesn't fit either of the state-rollout.md "Do instead" build patterns as-is:

- **Not NC-style** (trivial 1:1 code-to-jurisdiction) — obviously not, only 2 codes exist.
- **Not GA/SC-style either, at least not by itself** — GA/SC's address-matching problem is "the official jurisdiction is right there in enough A+ codes, we just need to route each ship-to's address to the right one." Louisiana doesn't have that starting point: even a perfect address→domicile-code matcher (Step 3, not yet attempted) only tells you the *correct* answer — it doesn't reveal what A+ actually configured, because A+ mostly didn't configure anything jurisdiction-specific. A comparison would show ~346 of 353 ship-tos "wrong" (comparing flat 11% against whatever their real domicile's rate is) by construction, not because A+ is stale on any of them specifically — that's a very different, much less actionable finding than GA's 18 real rate discrepancies or SC's clean two-tier gap.
- This looks structurally closer to Colorado's finding (57 sparse, customer-driven codes with no real naming convention) but more extreme — LA has effectively 2 codes, not 57.

## Do instead

- **Do not build automatic Louisiana comparison yet.** The official current-rate adapter is complete, but there may be nothing meaningful to compare on the A+ side for 98% of Louisiana ship-tos. Ana/Liv still need to decide whether `LA000` is an intentional flat business treatment or an unfinished configuration.
- If granular collection is required, determine whether the official interactive Sales Tax Explorer supports an approved address-to-domicile workflow, then treat this as a larger build than GA/SC: A+ needs jurisdiction granularity or TaxAP needs a separately maintained ship-to→domicile mapping.
- Exclude `AL9137` and `HN000` from any Louisiana ship-to aggregate — both are `SASHST` contamination (per the existing dead/dirty-column finding in `docs/aplus-data-findings.md`), not real Louisiana assignments.
- Re-run this Step 1 query if Atlantic's LA business grows — 2 codes may reflect "we don't have enough LA volume to justify more codes today," which could change.
