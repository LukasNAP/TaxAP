# WI — findings

Status: **Layer 2 investigated (2026-08-26), not built.** A+ covers Wisconsin at the *county* level only (49 real `WI###` codes = "Wisconsin \<County\> Co.", against 72 real WI counties) and has **zero** representation of Wisconsin's Premier Resort Area (PRA) tax, a real per-municipality surtax layered inside specific counties. County-level coverage alone would be NC-style (clean 1:1 name match), but the PRA layer makes WI genuinely GA-shaped overall, matching the prior Layer-1 source-discovery note. No official-source adapter exists yet (WI is `research-needed` in `docs/roadmap-50-states.md`), so rate comparability is **not yet confirmable**. One likely, but unconfirmed, comparability gap flagged below for Milwaukee specifically (city-level sales tax layered on top of the county tax, not represented in A+'s single Milwaukee County code).

Live A+ (`XATXBD` + active `ADDR`/`CUSMS` ship-to assignments, via `readStateDetail("WI")`) checked 2026-08-26: **424 active ship-tos, 271 active customer assignments, 51 tax-body rows** (unlimited, no `FETCH FIRST` truncation risk).

## Address matching

**Mixed — the county-level component alone is NC-style, but the real WI tax structure needs address/place-level matching that A+ has no representation of at all.**

- 49 of the 51 returned rows are real, cleanly-named Wisconsin counties: `TBTXNAM` literally reads `"Wisconsin <County> Co."` for every one (one cosmetic typo, `WI033` = "Wisonsin Lafayette Co.", same class of harmless naming slip as NV's "Esmaralda"/"Esmeralda"). Every named county is a real WI county — no wrong-state contamination found in this group.
- Wisconsin has **72 real counties** (well-established fact, not from a live source here). A+ configures only 49 of them (~68%) — a sparse, customer-driven subset consistent with the pattern already seen in NE/NM/UT/CO (A+ only carries a code where Atlantic actually has a ship-to), not evidence of a data problem by itself.
- **The real gap: Wisconsin's Premier Resort Area (PRA) tax adds 0.5%–1.25% on top of the state+county total, but only within specific municipality boundaries** (per the task's own framing note; not independently re-verified here since no adapter/boundary file was fetched in this pass). A+ has **no PRA-level codes whatsoever** — all 49 real codes are plain county rows with no city/place-level variant. If any active Atlantic ship-to sits physically inside a PRA municipality, a flat county-level lookup has no way to add that surtax; it would be silently entirely absent, not just approximate.
- **Open scope question worth a human decision before treating this as urgent**: Wisconsin's Premier Resort Area tax (Wis. Stat. § 66.1113) is understood, from general tax-law background rather than a live source checked in this pass, to apply only to a defined list of tourism-classified "premier resort area retailers" (lodging, food/beverage, recreation, gift/tourist-retail SIC-type categories) — not as a general sales-tax addition on every retail transaction inside the municipality. If Atlantic's WI ship-tos are ordinary commercial/industrial customers rather than businesses in those classifications, the PRA layer may not actually apply to their purchases regardless of address. **This needs confirmation against an official source, not an assumption either way** — it changes whether the missing PRA layer is a live comparability gap or a non-issue for this specific customer base.
- Because PRA boundaries are municipal (some, like Wisconsin Dells, straddle two counties — Sauk and Columbia, per the task's context note), a boundary lookup finer than ZIP/county would be needed if this layer does turn out to matter for real ship-tos — the same GA-style tiered address-matching shape as `ga-boundary.mjs`, not a code-naming convention fix.

## Rate comparability

**Not yet confirmable — no official-source adapter exists for WI** (`research-needed` per `docs/roadmap-50-states.md`; the SST bare-CSV source has been located but not built into a WI adapter). No live cross-check was run in this pass.

What can be said from the A+ data alone, pending that adapter:

- All 49 real county rows pass internal consistency (`TBCBSRT` + `TBCLRT1-4` == `TBCRATE`, `rateTotalValid: true`) — no internal arithmetic problem in A+'s own numbers.
- Most counties carry a `0.5` local component on top of a `5` base (`5.5%` total) — consistent with Wisconsin's standard 0.5% county sales tax, which most (not all) of the state's 72 counties have adopted. Two counties in A+ show `0` local component (`WI067` Waukesha, `WI070` Winnebago, plus `WI072` Menominee), i.e. state rate only (`5%`) — plausible for counties that haven't adopted the county tax, but **not verified against a current official list in this pass**; treat as unconfirmed rather than assumed correct.
- **`WI040` (Milwaukee Co.) shows `5.9%`** (`5%` state + `0.9%` local) — this is *higher* than the standard `0.5%` county rate every other county shows, and is consistent with Milwaukee County's real rate increase to 0.9% effective January 2024. That much looks like a genuinely current number, not stale.
- **But a likely, unconfirmed comparability gap exists specifically for Milwaukee**: the same 2024 legislative change (2023 Wisconsin Act 12) that raised Milwaukee County's rate also authorized a separate City of Milwaukee sales tax (commonly cited as 2%), which — per general background knowledge, not a live source checked here — applies only to ship-tos physically inside city limits, not the rest of the county. A+ has exactly one Milwaukee-area code (`WI040`, 47 active ship-tos, largest county bucket in the state); it cannot distinguish a ship-to inside the City of Milwaukee (state + county + city, potentially ~7.9% combined) from one elsewhere in Milwaukee County (state + county only, 5.9%). Since Milwaukee city holds a large share of the county's population, it's plausible a meaningful number of the 47 `WI040` ship-tos are actually inside city limits and undertaxed by this comparison today. **This is flagged as a needs-updating candidate, not asserted as confirmed** — it needs an official-source check (does the City of Milwaukee tax exist and at what rate, does A+ need a second code) before treating it as a finding, exactly the same caution NY's Suffolk/Yonkers and OK's stale-rate findings required before being treated as real.

## Do-not-use and cross-context findings

**`WI000` — no usable definition ("missing"), used by 42 of 424 active WI ship-tos (~9.9%), 14 of 271 active customer assignments.** `readStateDetail` returns this row with `description: null`, `baseRate: null`, `currentRate: null` — either the code has no `XATXBD` row at all, or its only row is retired-flagged (DO NOT USE/INACTIVE/OBSOLETE) and excluded from the definitions set the same way AL000/MN000/ND000/NE000/UT000/WA000 were. Which of those two it is could not be distinguished from this tool alone (the retired-tax-body exclusion is silent by design). **This is the same blocking-placeholder shape as every other state's `<ST>000` finding** — needs a human decision on what actually governs tax for these 42 ship-tos before any comparison is built, same as AL/MN/NE/UT/WA.

**1 of 424 active WI ship-tos carries a non-Wisconsin tax body (`NC023`, "North Carolina Cleveland," 6.75%).** This is the already-documented `SASTXB` cross-context pattern (a ship-to physically in one state can carry another state's tax body) — same shape as GA's NC060/NC041/SC126/CA1163/PA000 outliers and NV's DR000/NCPRST outliers, not new WI-specific contamination. `NC023`'s description was eyeballed and correctly names North Carolina, not Wisconsin — excluded from the WI-specific table below and from any future WI comparison, the same way GA's and NV's outliers were excluded.

No other description mismatches found — every one of the 49 real `WIxxx` rows names an actual Wisconsin county.

## Real live A+ codes (2026-08-26, ship-to state = WI, unfiltered, no row limit — 51 rows total)

| Code | Name | Rate | Active ship-tos | Notes |
|---|---|---|---|---|
| `WI040` | Wisconsin Milwaukee Co. | 5.9% | 47 | largest bucket; likely undercounts City-of-Milwaukee ship-tos, see above |
| `WI000` | *(none — missing definition)* | — | 42 | placeholder pattern, see above |
| `WI005` | Wisconsin Brown Co. | 5.5% | 39 | |
| `WI067` | Wisconsin Waukesha Co. | 5.0% | 36 | no local component in A+ — unconfirmed vs. current official |
| `WI070` | Wisconsin Winnebago Co. | 5.0% | 35 | no local component in A+ — unconfirmed vs. current official |
| `WI013` | Wisconsin Dane Co. | 5.5% | 31 | |
| `WI030` | Wisconsin Kenosha Co. | 5.5% | 23 | |
| `WI044` | Wisconsin Outagamie Co. | 5.5% | 20 | |
| `WI037` | Wisconsin Marathon Co. | 5.5% | 13 | |
| `WI059` | Wisconsin Sheboygan Co. | 5.5% | 11 | |
| `WI051` | Wisconsin Racine Co. | 5.5% | 9 | |
| ... 38 more counties | 1–8 active ship-tos each | mostly 5.5%, `WI072` Menominee at 5.0% | | see raw script output for the full list |
| `NC023` | North Carolina Cleveland | 6.75% | 1 | cross-context outlier — not a WI code, exclude |

## Open questions / do instead if building

- **Before anything else:** find or build a WI official-source adapter (SST bare-CSV source already located per `docs/roadmap-50-states.md`, not yet wired) — no rate comparison is possible until then.
- **Get a human decision on `WI000`** (42/424, ~9.9% of active ship-tos) — same open question every other `<ST>000` placeholder state needed; don't compare or silently drop these ship-tos.
- **Confirm whether the Premier Resort Area tax's SIC/business-classification restriction actually excludes Atlantic's WI customer base** before treating the missing PRA layer as a live comparability gap — if Atlantic's ship-tos aren't in the taxed retail categories, this may be a non-issue rather than a needs-updating finding. Don't assume either way.
- **Confirm the City-of-Milwaukee sales-tax layering question against a live official source** before flagging `WI040` as stale — this write-up notes it as a plausible, unconfirmed gap from general background knowledge only, not a verified finding.
- **Confirm whether `WI067` (Waukesha), `WI070` (Winnebago), and `WI072` (Menominee) genuinely have no county-level option tax today** against a current official list — A+ showing `0` local component for them is consistent with (but not proof of) that being correct.
- If PRA-level matching does turn out to be needed, treat it the same way VT's town-level and SC's incorporated-municipality builds were approached — a boundary/place lookup finer than ZIP, not a code-naming-convention fix — and confirm the Wisconsin Dells Sauk/Columbia county-line straddle explicitly, the same way SC's Charleston/Dorchester and NM's Rio Rancho straddles were called out rather than assumed clean.
- Exclude `NC023` (1/424) from any WI-specific comparison, the same way GA's and NV's cross-context outliers are excluded.
- Use `SASTXB` (ship-to level), not `CMTXBD` (customer level) — same established reason as NC/GA/NV; not independently re-checked for WI in this pass, but no evidence of `CMTXBD`/`SASTXB` disagreement was surfaced either way since this tool reads ship-to-level assignments only.
