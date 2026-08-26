# Louisiana — findings

Status: **investigated 2026-08-26 (Step 1/2 only). No official-source adapter built, no A+ matching built. Not recommended for build yet — see "Do instead" below.** Official source (Louisiana Sales and Use Tax Commission for Remote Sellers, "Domicile Rate Listing" XLSX) was identified in an earlier research pass but not yet fetched or parsed in this session.

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

Can't be meaningfully assessed yet, for two compounding reasons:

1. **Sample size of 2** rows is nowhere near enough to tell whether `TBCRATE` (= `TBCBSRT + TBCLRT1`, both rows: `TBCLRT2-4` are 0) reflects the same total the official Domicile Rate Listing reports, or whether it's a rough/approximate figure someone typed in once. Louisiana's real local tax structure often stacks *more* than one local layer (parish sales tax, school board, law enforcement district, economic development district, etc.) inside a single domicile's total rate — a two-field `base + local1` model may not have room to represent that even if it were populated per-domicile.
2. The official source's own column structure (Jurisdiction Code, Domicile Code, Tax Rate) implies domicile-level totals that may already be fully-loaded combined rates — but there's no A+ per-domicile row to check this against except the single Jefferson Parish entry, and Jefferson Parish itself likely contains multiple domicile codes with different rates in the real LDR file (the parish is not tax-uniform internally per the official-source description), so even `LA001`'s single 10% figure is probably already an oversimplification of something that varies within the parish.

**No known example jurisdiction has been checked against the official file yet** (the XLSX hasn't been fetched in this session) — this needs to happen before any comparability claim, confirmed or not.

## What this means for building

This state doesn't fit either of the state-rollout.md "Do instead" build patterns as-is:

- **Not NC-style** (trivial 1:1 code-to-jurisdiction) — obviously not, only 2 codes exist.
- **Not GA/SC-style either, at least not by itself** — GA/SC's address-matching problem is "the official jurisdiction is right there in enough A+ codes, we just need to route each ship-to's address to the right one." Louisiana doesn't have that starting point: even a perfect address→domicile-code matcher (Step 3, not yet attempted) only tells you the *correct* answer — it doesn't reveal what A+ actually configured, because A+ mostly didn't configure anything jurisdiction-specific. A comparison would show ~346 of 353 ship-tos "wrong" (comparing flat 11% against whatever their real domicile's rate is) by construction, not because of any genuine tax-body misconfiguration bug — that's a very different, much less actionable finding than GA's 18 real rate discrepancies or SC's clean two-tier gap.
- This looks structurally closer to Colorado's finding (57 sparse, customer-driven codes with no real naming convention) but more extreme — LA has effectively 2 codes, not 57.

## Do instead

- **Don't build a Louisiana adapter or comparison yet.** The finding here isn't "state needs harder matching," it's "there may be nothing meaningful to compare on the A+ side for 98% of Louisiana ship-tos" — that's a product/data question for Ana/Liv (does Atlantic actually collect/remit at the granular per-parish level for LA sales, or does `LA000`'s flat rate reflect a real, intentional business simplification?) before any engineering investment, the same way DE/MT/NH/OR's "no general sales tax" and HI/NM's GET/GRT structural questions were flagged as human decisions rather than engineering ones in `docs/roadmap-50-states.md`.
- If Ana/Liv confirm real per-parish/domicile granularity matters and should be tracked, then: (a) fetch and parse the official Domicile Rate Listing XLSX (Step 3, not done), (b) determine whether Louisiana publishes any address/ZIP-to-domicile-code boundary file (unconfirmed — LA's system is described as fragmented enough that this may not exist in a usable form, unlike GA/SC), and (c) treat this as a much bigger build than GA/SC, since it requires *adding* jurisdiction-level tax-body granularity to A+ itself or maintaining an entirely separate ship-to→domicile mapping outside A+, not just reconciling codes that already exist.
- Exclude `AL9137` and `HN000` from any Louisiana ship-to aggregate — both are `SASHST` contamination (per the existing dead/dirty-column finding in `docs/aplus-data-findings.md`), not real Louisiana assignments.
- Re-run this Step 1 query if Atlantic's LA business grows — 2 codes may reflect "we don't have enough LA volume to justify more codes today," which could change.
