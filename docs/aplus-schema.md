# TaxAP — schema reference

Documented column usage across the three tables TaxAP reads. This is the "what the docs say" layer — cross-check against `docs/aplus-data-findings.md` before trusting any flag/enum column, since two entries there already contradict what's written here.

## `DWStage` (Azure SQL) — read-only

### `dbo.ADDR` — ship-to addresses

| Column | Meaning |
|---|---|
| `SACONO` / `SACSNO` | company / customer number (join key to `CUSMS`) |
| `SASHST` | ship-to state |
| `SASTXB` | assigned A+ tax-body code — **can disagree with `CUSMS.CMTXBD`, see aplus-data-findings.md** |
| `SASUSP` | documented as ship-to suspended flag — **confirmed dead (100% blank), see aplus-data-findings.md** |
| `SACSUS` | undocumented in original overview — confirmed via A+ data dictionary as the real ship-to suspension flag, see aplus-data-findings.md |
| `SASAD1` / `SASAD2` | street lines |
| `SASCTY` | city |
| `SASZIP` | ZIP |
| `SASHST` | ship-to state — **not a clean 2-letter code, see aplus-data-findings.md** |

### `dbo.CUSMS` — customer master

| Column | Meaning |
|---|---|
| `CMCONO` / `CMCSNO` | company / customer number (join key to `ADDR`) |
| `CMSUSP` | customer-level suspended flag — **confirmed live, inverted polarity, see aplus-data-findings.md** |
| `CMTXBD` / `CMTXCD` | customer-level default tax-body override — **can disagree with `ADDR.SASTXB`, see aplus-data-findings.md** |
| `CMSTAT` | customer's mailing-address state — **not a status field despite the name; same dirty free-text shape as `SASHST`, see aplus-data-findings.md** |

Join: `ADDR.SACONO = CUSMS.CMCONO AND ADDR.SACSNO = CUSMS.CMCSNO`.

Both tables have far more columns than TaxAP currently uses (91 on `ADDR`, 250+ on `CUSMS`, confirmed via `INFORMATION_SCHEMA.COLUMNS`) — the ones above are the ones relevant to tax logic; the rest are general A+ order/AR/EDI/pricing fields outside TaxAP's scope.

## `APLUSV8FAQ.XATXBD` (A+, via `SQL03`→`APLUS` linked-server chain) — read-only, tax-body master

| Column | Meaning |
|---|---|
| `TBTXBOD` | tax-body code |
| `TBTXNAM` | description — "DO NOT USE"/retired detection reads this field |
| `TBL1DSC`–`TBL4DSC` | local-component descriptions |
| `TBCBSRT` / `TBCLRT1-4` / `TBCRATE` | current base/local/total rate — **confirmed plain percentage decimals** (e.g. `6.350` = 6.35%), not basis points or a 0–1 fraction |
| `TBNBSRT` / `TBNLRT1-4` / `TBNRATE` / `TBTXDAT` | scheduled next rate + effective date — **confirmed rare (~1.4% of rows) and always paired**; unset rows use the sentinel `0.000`/`0001-01-01`, see aplus-data-findings.md |

Format of rate fields confirmed via live query: plain percentage decimals throughout, e.g. `6.350` = 6.35% (not basis points, not a 0–1 fraction). `TBTXDAT` is a genuine SQL `date` type (not an A+ packed-integer date) — see aplus-data-findings.md for a linked-server comparison gotcha this caused.

Reached only through the nested OPENQUERY chain:
```sql
Azure SQL (DWStage) → OPENQUERY([SQL03], 'SELECT * FROM OPENQUERY(APLUS, "<DB2 SQL>")')
```
This works only because DWStage's Azure SQL Server has `SQL03` configured as a linked server, and `SQL03` in turn has `APLUS` configured. A bare Azure SQL Database cannot run `OPENQUERY` at all — this was the first (wrong) theory investigated when this chain was originally debugged; the real blocker was the `az login` identity (see `HANDOFF.md`).

## Local SQLite (`.data/taxap-reviews.sqlite`) — entirely TaxAP's own, gitignored

- **`review_cases`** — one row per finding. PK `finding_key` (`{taxBody}-{date}` for NC, `GA-{taxBody}-current` for GA). Columns: state, jurisdiction, tax body, finding type, both rates, status (`new`/`in_review`/`approved`/`resolved`/`not_applicable`), assigned reviewer, latest note, timestamps.
- **`review_events`** — append-only audit log, one row per status change, FK'd to `review_cases`.
