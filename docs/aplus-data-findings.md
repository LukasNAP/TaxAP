# TaxAP — confirmed data findings

This file exists because written schema descriptions (in `README.md`, `HANDOFF.md`, etc.) describe intended semantics, and real data in DWStage/A+ sometimes diverges from that. Each entry below was confirmed by directly querying the live database, not inferred from documentation.

**When you find a new one:** add it here with the query, the actual result, and what to do differently. Keep entries in the same shape as below so this stays scannable. This file is read by whichever AI assistant is working the project (Claude Code or ChatGPT/Codex) — see `HANDOFF.md`.

---

## `dbo.ADDR.SASUSP` — column is entirely dead

**Documented as:** ship-to-level suspended flag.

**Actual:** every row in the table (59,399 / 59,399, 100%) has `DATALENGTH(SASUSP) = 1` and the value is a single blank space. Confirmed via:

```sql
SELECT DATALENGTH(SASUSP) AS len, SASUSP, COUNT(*) AS cnt
FROM dbo.ADDR
GROUP BY DATALENGTH(SASUSP), SASUSP;
```
→ one row: `len=1, SASUSP=' ', cnt=59399`

**Implication:** there is no ship-to-level suspension signal anywhere in `ADDR`. A query filtering `WHERE SASUSP = 'N'` (the "expected" active-flag value) returns **zero rows**, silently — no error, just an empty result set, which looks like "no active ship-tos" rather than "wrong filter." This was the actual cause of two queries returning empty grids before we diagnosed it.

**Do instead:** don't filter on `SASUSP` at the `ADDR` level at all. If suspension matters for a query, use `CUSMS.CMSUSP` (below) via the join.

---

## `dbo.CUSMS.CMSUSP` — real suspension flag, inverted polarity from what the name suggests

**Documented as:** customer-level suspended flag (`CMSUSP`), joined via `CMCONO`/`CMCSNO`.

**Actual:** two-value flag, confirmed via:

```sql
SELECT CMSUSP, COUNT(*) AS cnt
FROM dbo.CUSMS
GROUP BY CMSUSP
ORDER BY cnt DESC;
```
→ `'S'`: 23,155 rows · blank: 7,866 rows

**Implication:** `'S'` = suspended, blank = active — meaning roughly **75% of rows in `CUSMS` are currently suspended**. This is easy to get backwards (treating a non-blank value as "the interesting/active one") and easy to be surprised by (a filter assuming most customers are active will silently exclude 3 out of 4 rows).

**Do instead:**
```sql
WHERE c.CMSUSP <> 'S'   -- active customers
-- or equivalently
WHERE c.CMSUSP = ''
```

---

## `dbo.ADDR.SACSUS` — the real ship-to suspension flag (SASUSP's likely replacement)

**Found by:** scanning the full `ADDR` column list (`INFORMATION_SCHEMA.COLUMNS`) — `SACSUS` (char,1) sits immediately before `SASUSP` (char,1) in column order, which is itself a clue these are a superseded/superseding pair.

**Confirmed via:**
```sql
SELECT SACSUS, COUNT(*) AS cnt
FROM dbo.ADDR
GROUP BY SACSUS
ORDER BY cnt DESC;
```
→ blank: 46,730 · `'S'`: 12,669

**Implication:** unlike `SASUSP` (100% blank, dead), `SACSUS` has real variance and the same `'S'`/blank shape as `CUSMS.CMSUSP`. This is almost certainly the actual ship-to-level suspension flag — `SASUSP` looks like a retired/replaced column that was never cleaned up.

**Do instead:** treat `SACSUS` as the ship-to suspension flag (`WHERE SACSUS <> 'S'` for active), not `SASUSP`. **Confirmed** against the A+ data dictionary (the `aplus-erp` Claude Code skill's schema reference — see the note near the bottom of this file about that skill being Claude-only): documented as "Customer Master Suspend Code," char(1) — not just inferred from shape.

---

## `CUSMS.CMTXBD` vs `ADDR.SASTXB` — customer-level and ship-to-level tax body assignments disagree

**Found by:** joining `CUSMS` (customer-level tax body override, `CMTXBD`/`CMTXCD`) against `ADDR.SASTXB` (ship-to-level tax body) for rows where the customer-level override is populated.

```sql
SELECT TOP 20 c.CMCONO, c.CMCSNO, c.CMTXCD, c.CMTXBD, a.SASTXB
FROM dbo.CUSMS c
JOIN dbo.ADDR a ON a.SACONO = c.CMCONO AND a.SACSNO = c.CMCSNO
WHERE c.CMTXBD <> '' OR c.CMTXCD <> '';
```

**Actual:** disagreements are real and not rare edge cases — e.g. customer 11 mostly agrees (`NC041`/`NC041`) but two ship-tos show `NC041` (customer-level) vs `NC034` (ship-to-level); customer 12 shows a cross-state mismatch, `VA076` (customer-level) vs `TN3301` (ship-to-level); customer 18 has one row `NC024` vs `OK000`.

**Implication:** this is not just a data-quality footnote — it's a real open question for TaxAP's own logic, and the A+ data dictionary (`aplus-erp` skill) confirms it's a *general A+ pattern*, not an anomaly specific to these two tables. `*TXBD` ("Tax Body", char 10) and `*TXCD` ("Taxable Code", char 1) both appear repeated across many A+ tables — `ADDR.SASTXB`/`SATXCD`, `CUSMS.CMTXBD`/`CMTXCD`, `APVEN.AVTXBD`, `HSHED.OATXBD`, `HSDET.OBTXCD`, `ITBAL.IBTXCD`, `ITMST.IMTXCD`, `ORDET.ODTXCD`, `PHDET.PBTXCD`, `PODET.PDTXCD`, and at least one unidentified table (`RCTXBD`). A+ appears to deliberately let each entity (customer, ship-to, vendor, item, order line, invoice) carry its own tax-body assignment — so disagreement between `CMTXBD` and `SASTXB` isn't necessarily a data error, it may be A+ working as designed with multiple valid-but-different tax contexts. **When building or debugging a comparison for a given ship-to, the real question is which of these A+ carries as authoritative for actual invoicing** — the customer-level default (`CMTXBD`) or the ship-to-level assignment (`SASTXB`) — not which one is "wrong."

**Do instead:** treat this as an open design question, not a solved one. Whoever extends dashboard logic to a new state should explicitly decide (and document) which field TaxAP compares against the official rate, ideally by confirming which field A+ itself actually uses at invoicing time (likely `SASTXB`, ship-to-level, since tax is fundamentally about where goods ship — but confirm rather than assume).

**Resolved (2026-08):** confirmed via `grep -n "SASTXB\|CMTXBD" server/aplus-connector.mjs` — three matches, all `SASTXB` (line 132, 141, 149), zero for `CMTXBD`. Current NC/GA dashboard logic reads only the ship-to-level tax body. The disagreement documented above is real but currently inert — it isn't causing wrong output today. It becomes a live risk only if `CMTXBD` is ever introduced for a future state's logic without an explicit decision about precedence.

---

## Two local checkouts of the same repo were found out of sync — resolved 2026-08-26

**Found while investigating the `SASTXB`/`CMTXBD` code question above** — a grep for `app/dashboard-findings.ts` and `server/aplus-connector.mjs` together turned up two different local folders, not one:
- `C:\Users\lukasn\Documents\TaxAP` — the Claude Code checkout.
- `C:\Users\lukasn\Documents\ChatGPT\tax` — a separate checkout used for ChatGPT/Codex sessions, with its own OpenAI Sites hosted-preview configuration.

Both turned out to be separate git clones of the same repo (`github.com/LukasNAP/TaxAP.git`), not two different projects. At the time this was found: `Documents\TaxAP` was clean and current; `Documents\ChatGPT\tax` was 9 commits behind with a few small uncommitted local edits (a handoff-doc rename/rewrite, a one-line README tweak).

**Resolved 2026-08-26:** the ChatGPT clone was fast-forwarded to current, its uncommitted handoff-doc draft was merged into a single shared `HANDOFF.md` (see that file — it now explicitly says to update it after every session regardless of which assistant is used), and this deep-research documentation (this file, `aplus-schema.md`, `state-rollout.md`, `states/*.md`) was moved from a Claude-Code-only skill directory into this repo's `docs/` folder specifically so both tools can read it going forward.

**Do instead going forward:** before relying on any local grep/read against this repo, confirm you're in a checkout that's clean and matches `origin/main` (`git status -sb`). If a second local checkout of this repo ever appears again, treat it the same way this one was handled — sync it, and check whether it's carrying any uncommitted work worth preserving before assuming it's just stale.

---

## `dbo.ADDR.SASHST` — not a clean state-code column

**Found by:** grouping `SASHST` with counts across the full table (no suspension filter).

**Actual:** alongside real 2-letter US state codes, the column also contains full state names (`"OHIO"`, `"FLORIDA"`, `"ALABAMA"`, `"TEXAS"`, `"GEORGIA"`...), Canadian provinces spelled out (`"ONTARIO"`, `"ALBERTA"`, `"QUEBEC"`, `"MANITOBA"`), city names entered where a state should be (`"ATLANTA"`, `"BOSTON"`, `"LONDON"`, `"SAN FRANCISCO"`), a large number of foreign countries and international subdivisions (China provinces, Vietnamese provinces, Dominican Republic provinces, Honduras, etc.), a literal blank (955 rows), and outright garbage (`"13"`, `"3000"`, a phone number, a stray period).

**Implication:** any code that assumes `SASHST` is a clean 2-letter US state code — including NC's "trivial" 1:1 tax-body-to-county mapping and any future state's matching logic — needs to filter/normalize this column defensively. The NC/GA logic today apparently works despite this, likely because it filters by tax-body prefix rather than trusting `SASHST` directly, but this should be confirmed, not assumed, before extending to a new state.

**Do instead:** don't trust `SASHST` as a clean join/filter key without normalization. If extending to a new state, check how the existing NC/GA code handles (or avoids) this column before modeling new logic on it.

---

## `CUSMS.CMSTAT` — not a status field; it's the customer's state

**Documented as (assumed from name):** possibly a customer status field, distinct from `CMSUSP`.

**Actual:** confirmed via
```sql
SELECT CMSTAT, COUNT(*) AS cnt
FROM dbo.CUSMS
GROUP BY CMSTAT
ORDER BY cnt DESC;
```
→ result is the customer's mailing-address state, in the same dirty free-text shape as `ADDR.SASHST` (real 2-letter codes plus full state names, city names, foreign countries, and garbage).

**Implication:** `CMSTAT` = "customer state," not "customer status." It has nothing to do with suspension/account status. Don't confuse it with `CMSUSP`.

**Do instead:** if you need the customer's state for any reason, treat `CMSTAT` with the same caution as `SASHST` — normalize/defensively filter before trusting it as a clean 2-letter code.

---

## `XATXBD.TBNRATE`/`TBTXDAT` — scheduled rate changes are real but rare, and always paired

**Confirmed via:**
```sql
SELECT
  SUM(CASE WHEN TBNRATE <> 0 THEN 1 ELSE 0 END) AS rows_with_next_rate,
  SUM(CASE WHEN TBTXDAT > '0001-01-01' THEN 1 ELSE 0 END) AS rows_with_real_next_date,
  COUNT(*) AS total_rows
FROM OPENQUERY([SQL03], 'SELECT * FROM OPENQUERY(APLUS, ''SELECT TBNRATE, TBTXDAT FROM APLUSV8FAQ.XATXBD'')');
```
→ `rows_with_next_rate = 41`, `rows_with_real_next_date = 41`, `total_rows = 2888`.

**Actual:** only ~1.4% of tax-body rows have a scheduled future rate change. The two fields are always paired — every row with a nonzero `TBNRATE` also has a real `TBTXDAT`, and vice versa; none of the 2,888 rows has one populated without the other. Real example from a broader sample (`ORDER BY TBNRATE DESC`, 200 rows): `GA027` (Georgia Chattooga) — current rate `7.000`, next rate `9.000`, effective `2026-04-01`. Several other GA counties show similarly-dated near-term increases. Rows with no scheduled change correctly show the sentinel pair `TBNRATE = 0.000` / `TBTXDAT = '0001-01-01'` (i.e. `0001-01-01` is a "never set" sentinel, not a real date — don't treat it as one).

**Implication:** any future feature surfacing "upcoming rate change" needs to handle the fact that this is genuinely rare (most tax bodies never have one populated) rather than assume it's routine bookkeeping. The pairing being reliable (always both-or-neither) means a single `WHERE TBNRATE <> 0` check is sufficient to find scheduled changes without needing to also check `TBTXDAT`.

**A DB2-through-OPENQUERY gotcha found along the way:** `<>` doesn't reliably push down into the DB2-side SQL string inside the nested `OPENQUERY(APLUS, '...')` call — a query filtering with `WHERE TBNRATE <> 0 OR TBTXDAT <> 0` inside the inner DB2 SQL failed with `"Comparison operator ~= operands not compatible"` from the `DB2OLEDB` provider. Filtering in the *outer* T-SQL query (after the inner OPENQUERY has already returned rows to SQL Server) works fine with `<>` — the problem is specifically about pushing `<>` down into the inner DB2-dialect SQL string. If a filter needs to happen on the DB2 side (e.g. to reduce a very large result before it crosses the linked-server chain), it may need different syntax than standard T-SQL `<>`; when in doubt, pull unfiltered and filter in the outer T-SQL layer instead.

**Also confirmed: `TBTXDAT` is a genuine SQL `date` type**, not an A+-style packed integer date (unlike some other A+ date fields, per the custom-extensions convention noted in the `aplus-erp` skill). Comparing it against an integer literal (`TBTXDAT <> 0`) fails with `"Operand type clash: date is incompatible with tinyint"`. Compare against a real date literal instead (`TBTXDAT > '0001-01-01'`).

---

## Cross-referenced against the `aplus-erp` skill (Claude Code only)

The `aplus-erp` skill (installed separately, in Claude Code) carries a documented A+ data dictionary — an actual source of truth rather than inference from live data shape. Two of the findings above were confirmed against it directly:

- `SACSUS` — documented as "Customer Master Suspend Code," char(1). Confirms the ship-to suspension flag finding above.
- `SASTXB`/`CMTXBD` — both documented as "Tax Body" (char 10), part of a repeated `*TXBD`/`*TXCD` pattern across many A+ tables (customer, ship-to, vendor, item, order line, invoice all carry their own). This reframes the disagreement finding above: it's evidence of a general A+ design pattern, not a defect isolated to these two columns.

**Note for a ChatGPT/Codex session reading this file:** the `aplus-erp` skill is Claude-Code-only infrastructure, not something in this repo — you won't have access to it. If you hit a column whose semantics seem off and this file doesn't already cover it, ask Lukas rather than assuming Claude's cross-reference against that data dictionary is available to you too.

**When something here is uncertain and could plausibly be a general A+ convention rather than TaxAP-specific,** a Claude Code session should check the `aplus-erp` skill's schema/business-glossary references before assuming it needs a fresh live-data investigation — it may already be documented.

---

## `server/ncdor-rates.mjs`'s synthetic `NC001`–`NC100` codes — verified safe, but depends on an assumption worth knowing about

**Investigated because:** `ncdor-rates.mjs`'s `parseNcdorCurrentRates` assigns tax-body codes as `NC${String(index + 1).padStart(3, "0")}` — derived purely from a county's position in the file's own alphabetically-sorted `NC_COUNTIES` array, not read from any real A+ `XATXBD` data. This looked at first like it could be comparing a made-up numbering scheme against itself rather than against real A+ tax bodies, which would undermine the "all 100 NC counties match A+ exactly" claim in the project overview.

**Traced through the actual consumers** (`server/aplus-connector.mjs` → `app/dashboard-findings.ts`'s `mergeOfficialRates`/`mergeRateRows`, which join on `taxBody` directly) **and confirmed:**
- `app/tax-data.ts` builds its A+-side county coverage with the exact same alphabetical-index scheme (`countyNames.map((county, index) => ...)`, same `NC_COUNTIES`-equivalent list), and its own comment states directly: *"The A+ file contains one standard row for each NC001-NC100."*
- `aplus-import.ts` trusts the `taxBody` column verbatim from the real imported `XATXBD` data, validates it falls in the `NC001`–`NC100` range, and joins on it as-is — it doesn't regenerate the code itself.

**Conclusion:** the join is currently safe. All three places — the NCDOR scraper, the A+-side snapshot, and the real A+ import — agree that NC001 corresponds to the first county alphabetically, and so on through NC100. This isn't a coincidence or an internally-consistent-but-disconnected-from-reality scheme; `tax-data.ts` documents it as a known, real fact about how Atlantic's A+ system numbers NC tax bodies.

**But this is a trusted external fact, not a structural guarantee.** Nothing in the codebase independently re-derives or re-verifies that A+'s real NC tax-body numbering is alphabetical-by-county — it's asserted as true in a comment and the code proceeds accordingly. If Atlantic's A+ NC setup were ever changed (counties renumbered, a jurisdiction split, the source list re-sorted), this join would misalign **silently** — `mergeOfficialRates` would still produce output, just wrong, joining e.g. NCDOR's real Wake County rate against whatever A+ tax body happens to sit at that same index after the change. There's no validation step that would catch this; it would look like a normal "all counties match" or "one mismatch found" result either way.

**Do instead:** if NC ever starts showing unexpected new mismatches after a period of matching cleanly, or if Atlantic's A+ team ever mentions changing NC tax-body setup, treat that as a prompt to re-verify this alphabetical-index assumption directly against a fresh `XATXBD` pull (join `TBTXNAM` descriptions against the expected county order) rather than assuming the long-standing convention still holds. Full details in `docs/states/nc.md`.

---

## `server/ga-boundary.mjs` — defensive address parsing confirmed, matches project's own safety rules

`matchGeorgiaAddress` parses freeform `ADDR.SASAD1`/`SASAD2` ship-to address lines into structured components (house number, predir, street, suffix, postdir, secondary unit) and explicitly bails to `null` — rather than guessing — when a line doesn't parse cleanly. `reconcileGeorgiaBoundary` aggregates by A+ tax body only (never exposing ship-to-level address/customer data downstream) and excludes tax bodies with no real A+ rate configured (null/0) from findings, reporting the exclusion count rather than silently dropping them. Both match the project's stated "never guess" / "no silent caps" rules described in `HANDOFF.md` — good confirmation the code follows its own stated principles, not just an assumption that it does.

---

## Open / not yet confirmed

Nothing currently open from the A+/DWStage side. See `docs/roadmap-50-states.md` for the full open-state-source status and `docs/state-rollout.md` for open per-state investigation items (SC's PDF-vs-A+ municipality-count gap, the 11 SST states blocked on missing ZIP-extraction support, etc.) — those are tracked there, not duplicated here.
