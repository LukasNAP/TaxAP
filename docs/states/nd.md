# North Dakota — findings

Status: **investigated live 2026-08-26, nothing to build.** A real, current SST boundary file exists, but it's irrelevant right now — A+ has no real ND tax setup at all to reconcile against.

## The finding: worse than Hawaii's zeroed rate

Live `XATXBD` query (`TBTXBOD LIKE 'ND%'`, no row-limit) returns **exactly ONE row for the entire state**: `ND000` / "North Dakota," with `TBCBSRT=0`, `TBCLRT1-4=0`, `TBCRATE=0`, and `TBNRATE=0`/`TBTXDAT=0001-01-01` (confirmed sentinel — no scheduled future rate, not a phase-in).

Cross-checked two independent ways: `ADDR` where `SASHST='ND'` grouped by `SASTXB` → **100% (38/38)** on `ND000`, zero fragmentation, zero alternate codes; `CUSMS` where `CMSTAT='ND'` grouped by `CMTXBD` → mostly `ND000` (5) but 1 customer-level row each on `NC060` and `MS000` (the already-documented `CMTXBD`/`SASTXB` cross-context pattern, sample too small to be alarming).

**This is structurally like Hawaii (one flat code for the whole state) except worse.** HI's 0% is plausibly an intentional, legally-optional business choice (GET pass-on is optional under Hawaii law). North Dakota's state sales tax (base ~5%) is **not** an optional pass-through — a 0% rate charged on 100% of real ND ship-tos looks like an unconfigured/never-built-out tax body, not a policy choice. This is inference, not confirmed intent — needs a human/Atlantic-tax-team decision, exactly like HI and `AL000`/`MN000`/`IA000` were flagged.

## Other findings

- Wrong-state contamination check (`TBTXNAM LIKE '%DAKOTA%'`, no prefix filter): 16 rows, all correctly attributable — SD has 10 real municipal codes plus a re-confirmation of the already-documented `SC3622` "South Dakota Vermillion" contamination (that's SC's problem, not ND's).
- Census gazetteer confirms FIPS 38 and exactly 53 counties live, matching prior research.
- A real, current SST boundary file exists at the Boundary directory (`NDB2026Q3MAY19.zip`, same `GAB*`/`NCB*`-style naming `ga-boundary.mjs` already knows how to discover) — so Step 3's boundary question has a genuine "yes" answer, structurally. It's just moot: there's no A+-side granularity for it to resolve anything against yet.
- Prior (pre-live) research's "352 active home-rule city rows" and "per-invoice tax cap not encoded in the rate file" wrinkles are real ND-law facts but currently moot for TaxAP — there's no A+-side granularity for them to even collide with.

## Do instead

**This is a business question, not a technical one.** Does Atlantic actually collect/remit ND sales tax at all, and if so why is A+ showing 0% for every ND ship-to? Don't build anything — including any address/boundary matching — until that's answered. The boundary file being real and available doesn't change this; there's nothing on the A+ side yet to match it against.
