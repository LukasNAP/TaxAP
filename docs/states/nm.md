# New Mexico — findings

Status: **investigated live 2026-08-26, not safe to build.** A+'s `XATXBD` setup is mostly clean and 1:1, but the state rate is confirmed stale after a statutory trigger fired. Treated as functionally equivalent to a sales tax per Lukas's explicit decision (NM's Gross Receipts Tax legally taxes the seller, not the buyer).

## Address matching

**Mostly no, with one confirmed exception.** 18 real NM tax-body codes map 1:1 to a named city/county via readable `TBTXNAM` (Santa Fe, Albuquerque, Roswell, Las Cruces, etc.) — no same-ZIP jurisdiction ambiguity for those.

**Exception:** Rio Rancho genuinely straddles two counties with two different official rates (Sandoval 7.4375% vs. Bernalillo 7.8750%), and A+ has only one Rio Rancho code (Sandoval-side). If a ship-to is actually on the Bernalillo side, code-only matching silently misassigns it — the same shape as SC's and CO's straddling-county wrinkles. Touches 2 ship-tos/1 customer whose actual county side hasn't been checked.

Also confirmed: the A+ code text itself does **not** reliably encode NM's real location-code scheme (`NM1600` for Gallup, but Gallup's real code is 13-114, not 16-xxx; `NM05101` for Carlsbad, whose real code is 03-106, not 05-xxx) even when the rate value is correct. Resolve jurisdiction from `TBTXNAM` text, never by parsing `TBTXBOD` digits.

## Rate comparability — confirmed stale, needs updating

**The state rate is currently stale for all 18 real NM tax bodies.** New Mexico's GRT has a statutory "safety valve" (NMSA 7-9-4): if GRT revenue falls below 95% of the prior year's, the state rate steps up the following July 1. Multiple independent sources confirm this trigger fired and the state rate became **5.125% effective July 1, 2026** — before this investigation's date (2026-08-26). A+'s `TBCBSRT` is still 4.875% on every NM code — not a subset, all 18.

Separately, and independently of the state-rate change: the official semiannual schedule current through June 30, 2026 was fetched and diffed against all 18 real A+ rates — 15 matched exactly, Dona Ana County was off by a negligible 0.0025pt, but **Roswell was already off by 0.375pt** (A+ 7.896% vs. official 8.2708%, flagged with a `*` in the schedule meaning a real local-option change had already happened that A+ hadn't picked up) — so a local-rate update was needed even before the July 2026 state-rate bump layers on top.

The actual July-2026-onward official schedule PDF could not be located this session (only news/chamber-site corroboration that the state rate changed) — so the current per-jurisdiction gap beyond Roswell/Dona Ana is unquantified, only confirmed to exist.

## Real finding: NM000 catch-all covers ~30% of active ship-tos with no real-world equivalent

`NM000` ("New Mexico," `TBCBSRT`/`TBCLRT1`/`TBCRATE` all exactly 0) is used by 26 of 88 active NM ship-tos (19 of the state's customers). Unlike HI's optional GET pass-on, GRT has no legal "opt out" — the lowest real county-remainder rate in the official schedule is ~5.25%, so a 0% value has no defensible real-world equivalent anywhere in NM. This reads as a genuine data gap needing a human decision, not a business choice the way HI's zero rate might be.

## Other findings

- `XATXBD` itself is clean: 19 rows total (18 real + `NM000`), identical whether or not the `DO NOT USE`/`INACTIVE`/`OBSOLETE` filters are applied — nothing excluded, no wrong-state contamination like SC's `SC3622`, no E-suffixed equipment-tax variants.
- One `ADDR`-side anomaly (not the `XATXBD` master): a ship-to with `SASHST='NM'` is assigned tax body `MX000` (Mexico) — 1 ship-to, worth excluding/flagging, not investigated further.

## Do instead

- Flag the entire NM state rate as needing an A+ update to 5.125% (effective 7/1/2026) — this affects all 18 real codes, not a subset.
- Update Roswell separately once the current per-jurisdiction schedule is located.
- Resolve `NM000`'s ~30% coverage before building any comparison — needs a human decision on what it represents.
- Confirm which county side any Rio Rancho ship-to actually falls on before trusting its rate.
