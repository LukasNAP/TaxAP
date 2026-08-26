# ID — findings

Status: **Layer 2 (A+ matching) investigated 2026-08-26; not buildable yet.** No official-source adapter exists for ID (see `docs/roadmap-50-states.md`), so rate comparability cannot be live-cross-checked — this is a confirmed **Layer 1 gap**, not just a Layer 2 one: Idaho's Tax Commission publishes the flat 6% state rate but does not centrally publish the ~23 resort-city local-option rates anywhere, telling taxpayers to contact each city directly. A+'s 19 real tax-body codes are all configured at a flat 6% with no local component populated, and none of them appear to represent an actual resort-city local-option jurisdiction by name — so today's A+ config and the known Layer 1 gap don't currently overlap in a way that can be confirmed live, but the risk is real if any ship-to sits inside one of those ~23 cities.

Live A+ (`XATXBD`-backed `readStateDetail`) checked 2026-08-26: 95 active ID ship-tos, 74 active customers, 19 tax bodies (18 rate-configured + `ID000`, which has no XATXBD definition row at all). The 19 configured codes' `activeShipTos` sum to exactly 95, matching the reported total — no evidence of a hidden retired/DO-NOT-USE code silently absorbing ship-tos beyond what's already visible below.

## Address matching

**Currently moot for A+'s existing 19 codes, but only because none of them model Idaho's real local-option complexity at all — not because Idaho's jurisdictions are clean the way NC's are.**

Idaho's state sales tax rate (6%) is flat and uniform statewide — there is no county-option sales tax in Idaho, so a code named for a county (`ID001` Ada Co., `ID002` Bonneville, `ID009` Kootenai Co., etc.) carries no rate information beyond "6%, same as everywhere else in the state." The real complexity in Idaho's sales tax is the ~23 small "resort cities" state law allows to levy an additional local-option tax on top of the 6% base — and **none of A+'s 19 real codes are named after a known Idaho resort city** (no Ketchum, Sun Valley, Hailey, McCall, Driggs, Victor, Stanley, Salmon, Island Park, Sandpoint, or similar). A few of A+'s codes are named for real Idaho *cities* (`ID007` Nampa, `ID006` Twin Falls, `ID012` Mountain Home, `ID020` Rexburg, `ID021` Blackfoot) rather than counties, but none of these five are resort cities with a local-option tax — they're ordinary cities where the flat 6% is genuinely the whole answer, so tagging them by city vs. county name doesn't change the correct rate either way.

This means the address-matching question can't be answered the way it was for GA/SC/CO (no evidence one way or the other of a *city split across multiple different-rate codes*, because no code currently represents a jurisdiction where the rate would differ from 6% in the first place). The real open question is different and unresolved: **if any of Atlantic's 95 active ID ship-tos is physically located inside one of the ~23 resort-city boundaries, its correct rate is 6% + that city's local-option rate, and no existing A+ code reflects that** — those cities are typically much smaller than a ZIP code (the same "home-rule city smaller than a ZIP" caveat noted for NY), so even ZIP-level matching wouldn't reliably catch it; true address-level matching against each city's actual boundary would be needed. That boundary/rate data doesn't exist as a discoverable, central Idaho-Tax-Commission source (the confirmed Layer 1 gap) — it would have to come from contacting each resort city individually, which is out of scope for an automated adapter today.

Real-county coverage is sparse and customer-driven, consistent with other states investigated (MO/CO/UT pattern): roughly 17 of Idaho's 44 real counties are represented (directly by name, or indirectly via one of the five city codes), the rest have no A+ code at all — unsurprising for a distributor whose ID customer base doesn't span the whole state, and not evidence of a gap on its own since the flat state rate would apply anyway.

**Numbering-sequence note (open question, not a finding):** `ID005`, `ID011`, and `ID018` are absent from the returned list. This could mean those numbers were simply never assigned, or that a retired/DO-NOT-USE code once occupied them and has zero current active ship-tos (in which case it wouldn't surface in this ship-to-driven pull regardless of the standard retired-body text exclusion). Nothing in the data confirms either explanation — flagged as open, not asserted.

## Rate comparability

**Not yet confirmable by adapter — no ID official-source connector exists (`docs/roadmap-50-states.md` status).** Reported here is only what's directly checkable from A+'s own numbers plus the confirmed Layer 1 fact pattern, not a live cross-check:

- All 18 rate-configured codes show `baseRate` = `currentRate` = **6**, `localRates` all zero, `nextRate` = 0 (`nextEffectiveDate` = `0001-01-01`, i.e. no scheduled change queued) — internally consistent with the confirmed flat 6% Idaho state rate, and with each other (no code disagrees with any other).
- This is **trivially comparable and correct for any ship-to genuinely outside all ~23 resort cities** — there's nothing else to compare against since Idaho counties themselves don't vary.
- This is **not comparable/confirmable for a ship-to inside a resort city**, because (a) no A+ code currently represents a resort-city local-option rate at all, and (b) even if one did, there is no official centralized source to validate it against — this is the Layer 1 gap, and it means comparability for that subset is genuinely "unavailable," not a stale rate and not a confirmed match.
- No wrong-state contamination found: every non-null `description` reads "Idaho <place>" / "IDAHO <PLACE>" — none names a different state (South-Dakota-in-SC-style check performed and clean).

## Do-not-use and cross-context findings

**`ID000` — no XATXBD definition row at all (`definitionStatus: "missing"`), not an explicit text-tagged "DO NOT USE" row like AL000/MN000/ND000/NE000/UT000/WA000.** Used by **12 of 95 active ID ship-tos (~12.6%)** — a meaningful share, in the same *practical* risk category as the other states' DO-NOT-USE placeholders (ship-tos with no real rate configuration behind their assigned code) even though the mechanism is different: those other codes exist in XATXBD with an explicit retirement label that the project's standard query filters out; `ID000` doesn't exist in XATXBD at all, so there's nothing to filter — it shows up directly here as `missing` rather than being silently dropped. Because the 19 listed codes' `activeShipTos` already sum exactly to the reported 95-ship-to total, there's no sign of a *second*, hidden, text-tagged placeholder beyond `ID000` — but this should still be treated as a blocking finding requiring a human decision (what rate actually applies to these 12 ship-tos today) before any comparison is built, the same way AL000/MN000/ND000/NE000/UT000/WA000 needed one.

No customer-level (`CMTXBD`) vs. ship-to-level (`SASTXB`) divergence data was pulled in this pass — not checked, not claimed either way.

## Real live A+ codes (2026-08-26, `readStateDetail` for ID, 19 rows total)

| Code | Description | Rate | Active ship-tos | Notes |
|---|---|---|---|---|
| `ID001` | Idaho Ada Co. | 6% | 22 | county |
| `ID002` | Idaho Bonneville | 6% | 15 | county |
| `ID000` | *(none — no XATXBD row)* | — | 12 | **missing definition, see above** |
| `ID007` | IDAHO NAMPA | 6% | 9 | city (Canyon Co.) |
| `ID006` | Idaho Twin Falls | 6% | 5 | county/city (same name) |
| `ID009` | IDAHO KOOTENAI CO. | 6% | 5 | county |
| `ID004` | Idaho Jerome | 6% | 4 | county |
| `ID013` | Idaho Nez Perce Co. | 6% | 4 | county |
| `ID003` | Idaho Bannock | 6% | 3 | county |
| `ID008` | IDAHO PAYETTE CO | 6% | 3 | county |
| `ID014` | Idaho Cassia Co. | 6% | 3 | county |
| `ID012` | Idaho Mountain Home | 6% | 2 | city (Elmore Co.) |
| `ID016` | Idaho Canyon Co. | 6% | 2 | county (also covers Nampa via ID007) |
| `ID010` | Idaho Jefferson Co. | 6% | 1 | county |
| `ID015` | Idaho Bonner Co. | 6% | 1 | county |
| `ID017` | Idaho Minidoka Co. | 6% | 1 | county |
| `ID019` | Idaho Custer Co. | 6% | 1 | county — contains Stanley, a real resort city; can't tell if this ship-to is inside Stanley city limits |
| `ID020` | Idaho Rexburg | 6% | 1 | city (Madison Co.) |
| `ID021` | Idaho Blackfoot | 6% | 1 | city (Bingham Co.) |

All 19 rows' `activeShipTos` sum to 95, matching the reported total exactly.

## Open questions / do instead if building

- **Layer 1 blocker (not fixable at the A+ layer):** no central official source exists for Idaho's ~23 resort-city local-option rates. Before any ID adapter can validate comparability for resort-city ship-tos, someone would need to either contact each city directly (per the Tax Commission's own guidance) or find a usable third-party aggregator — genuinely "unavailable" today, not a gap this investigation can close.
- **Before building:** get a human decision on `ID000` (12/95 ship-tos, ~12.6%, no rate definition at all) — same shape of open question as AL000/MN000/ND000/NE000/UT000/WA000, just via a missing-row mechanism instead of a text-tagged retired row.
- **Unresolved and unresolvable without addresses:** whether any of the 95 active ID ship-tos — particularly the single ship-to on `ID019` (Custer Co., which contains the resort city of Stanley) or `ID015` (Bonner Co.) — is physically located inside a resort city's limits and therefore missing a local-option component today. Reporting this as an open question per the project's no-guessing rule, not asserting a specific ship-to is misconfigured.
- **Numbering gaps `ID005`/`ID011`/`ID018`:** unexplained from this data alone (never-assigned vs. a zero-active-ship-to retired code) — flag as open, don't assume either explanation.
- If an ID adapter is ever built: because Idaho's state rate has no county-level variation, the only thing worth validating is (a) that `currentRate` stays 6% everywhere outside resort cities, and (b) — the hard part — building or sourcing a resort-city boundary/rate list from outside the Tax Commission's own site, since none exists there.
