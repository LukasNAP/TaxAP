# Hawaii — findings

Status: **investigated 2026-08-26, not safe to build yet.** A+ carries exactly one tax-body row for the entire state, at a 0% rate, for every real HI ship-to and customer sampled. This is a fundamentally different shape of problem than any state investigated so far — not an address-matching or surcharge-layering question, but an open business-policy question about whether Atlantic currently passes Hawaii's General Excise Tax (GET) on to customers at all. Needs a human decision, not an engineering one, before any comparison logic is built.

## Structural note (pre-existing decision, carried into this investigation)

Per Lukas's explicit decision: treat HI's GET as functionally equivalent to a sales tax for the purpose of this comparison, even though legally GET taxes the *business's* gross receipts, not the buyer's purchase — Hawaii DOTAX states outright "Hawaii does not have a sales tax." Businesses may *optionally* pass GET (plus any county surcharge) on to customers, up to a capped maximum rate; they are not required to. This framing decision resolves the legal-category question flagged in `docs/roadmap-50-states.md`, but it does **not** resolve the new wrinkle this investigation found (see below) — that's a separate, still-open question.

## Official source

DOTAX "County Surcharge & Maximum GE Tax Pass-On Rates" table, linked from `https://tax.hawaii.gov/geninfo/countysurcharge/`. Current file (resolved live, not hardcoded): `https://files.hawaii.gov/tax/geninfo/info/table-of-maximum-ge-pass-on-rates_sep2023.pdf`, dated September 2023. Small, clean, plain-text-extractable (`pdftotext`, no `-table` needed) — 4 rows, one per county:

| County | Surcharge | Max pass-on rate (current) |
|---|---|---|
| Honolulu | 0.50% | 4.7120% |
| Kauai | 0.50% | 4.7120% |
| Hawaii | 0.50% (0.25% only Jan–Dec 2019, since expired) | 4.7120% |
| Maui | 0.50% | 4.7120% |

**All four counties currently carry the identical 4.7120% max pass-on rate** (base 4% GET + 0.5% surcharge, converted to a pyramided pass-on rate) — Hawaii County's lower 0.25%-surcharge period ended 2019-12-31. As of today (2026-08-26) HI's real-world maximum is a uniform statewide figure, not a county-varying one, even though the surcharge is nominally county-level. (Hawaii has only 4 populated counties in this table; Kalawao, the 5th, is a state-administered settlement with no independent tax administration and doesn't appear.)

## Step 1 — address matching: not needed, and structurally moot

Query run (no `FETCH FIRST` limit, unfiltered by name first per procedure):

```sql
SELECT * FROM OPENQUERY([SQL03], 'SELECT * FROM OPENQUERY(APLUS, ''SELECT TBTXBOD, TBTXNAM, TBCBSRT, TBCLRT1, TBCLRT2, TBCLRT3, TBCLRT4, TBCRATE FROM APLUSV8FAQ.XATXBD WHERE TBTXBOD LIKE ''''HI%'''' '')') ORDER BY TBTXBOD;
```

**Result: exactly one row.**

```json
{ "TBTXBOD": "HI000", "TBTXNAM": "Hawaii", "TBCBSRT": 0, "TBCLRT1": 0, "TBCLRT2": 0, "TBCLRT3": 0, "TBCLRT4": 0, "TBCRATE": 0 }
```

No `DO NOT USE` rows, no wrong-state contamination, no `E`-suffix equipment variant, no truncation risk (one row can't be truncated) — the smallest, cleanest result set of any state investigated so far, but only because there's almost nothing there. Cross-checked from the other direction too:

- `dbo.ADDR` rows where `SASHST` (dirty free-text column, per `docs/aplus-data-findings.md`) reads `'HI'`: **29 rows, all 29 use `SASTXB = 'HI000'`.** No other tax body appears for any Hawaii ship-to.
- `dbo.CUSMS` rows where `CMSTAT` reads `'HI'`: **9 rows, all 9 use `CMTXBD = 'HI000'`.**
- Full-database search of `XATXBD.TBTXNAM` for `%HAWAII%`, `%HONOLULU%`, `%KAUAI%`, `%MAUI%` (i.e., not trusting the `HI%` prefix at all, in case Hawaii's codes were named some other way the way SC's James Island was) — same single `HI000` row, nothing else.

**Conclusion: address/place matching is not needed for HI, and would not accomplish anything if built.** A+ has no per-county granularity to match a ship-to *into* — there is exactly one bucket for the entire state. This isn't "a code maps directly to a jurisdiction" in the useful NC/NY sense (one code per real jurisdiction); it's "the whole state is one undifferentiated bucket." Given the official rate is *also* currently uniform across all 4 counties, building GA/SC-style address matching would add real engineering cost for zero present-day benefit — even a full ZIP-level match today would resolve to the same 4.7120% figure for any HI address. (Watch this if Hawaii County's surcharge ever reverts to a lower rate again, or if a 5th county-level rate is ever introduced — the uniformity is a fact about current law, not a structural guarantee.)

## Step 2 — rate comparability: NOT confirmed, and not a simple surcharge-layering question

This is the actual finding that matters. `TBCRATE = 0` for `HI000` isn't a subset-layering mismatch like Ohio's transit surcharge (where the question is "is the extra piece baked in or not") — it's a **complete absence of any configured rate**, uniform across every one of the 29 real HI ship-to records and 9 customer records sampled. `TBCBSRT`, `TBCLRT1-4`, and `TBCRATE` are all zero; there's no base amount partially there and a missing layer, it's nothing at all.

Two very different explanations are consistent with this data, and the query alone cannot distinguish them:

1. **A+ is correctly configured, and Atlantic simply doesn't pass GET on to Hawaii customers as a matter of business policy.** GET pass-on is legally optional in Hawaii — DOTAX's own page says businesses "may choose to pass on the GET and any applicable county surcharge to its customers but are not required to do so." If that's Atlantic's practice, 0% is the *correct* configured rate, not a gap, and a dashboard flagging "100% of HI ship-tos mismatched (0% vs. 4.712%)" would be a **confidently wrong finding**, not an honest "ambiguous" one — the entire premise of the comparison (that there's a correct nonzero rate every ship-to should carry) would be false for this state.
2. **A+ never had HI's GET/pass-on rate populated at all — a genuine setup gap**, and Atlantic may in fact intend to (or already does, through some other mechanism) charge the pass-on rate on HI invoices without it running through the same tax-body rate engine used for NC/GA/SC/etc.

Either way, this surfaces a mechanism question the other investigated states didn't raise: **for a legally-optional, business-gross-receipts-based tax like GET, does the standard `XATXBD`-driven sales-tax-rate engine even apply the same way?** It's plausible Atlantic's actual GET pass-on practice (if any) is captured as a manual invoice line item elsewhere in A+, not through `TBCRATE` — in which case comparing `TBCRATE` against DOTAX's table is checking the wrong field entirely, not just checking a field that happens to read zero.

**This has to be resolved by a human (Ana/Liv, or whoever owns Atlantic's HI billing practice) before building anything:** is 0% intentional (no pass-on charged) or a gap? If intentional, what does "monitoring HI tax accuracy" even mean for a voluntary ceiling rather than a mandatory floor — the NC/GA/SC/NY notion of "mismatch = wrong" doesn't transfer cleanly to a tax that's compliant at any rate from 0% up to the cap.

## Do instead

- Don't build a rate comparison for HI yet. Treat `TBCRATE = 0` as an open question, not a confirmed gap or a confirmed non-issue.
- Before any adapter work: get an explicit answer on whether Atlantic passes GET on to HI customers today, and if so, where that shows up in A+ (confirm it's actually `XATXBD`/`TBCRATE`-driven before assuming the same mechanism NC/GA/SC use applies).
- If the answer turns out to be "yes, pass it on, and it should be tracked like a normal sales tax at the max rate" — note that address/place matching still isn't needed (see Step 1); the fix would be as simple as A+ carrying `4.7120%` (or the correct county figure, though all four are currently identical) on `HI000` instead of `0`. No boundary source, no per-county mapping work required — this would be one of the structurally simplest states to finish, once the business question is answered.
- If the answer is "no, GET pass-on isn't charged and that's intentional" — HI likely needs to be modeled differently from every other state in the rollout (a "compliant range" rather than a "correct value" concept), not force-fit into the existing mismatch-detection framing. Flag this to whoever owns the dashboard's product design, not just the engineering backlog.
