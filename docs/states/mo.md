# Missouri — findings

Status: **investigated live 2026-08-26, not safe to build.** Official XLSX source confirmed real (quarterly rate tables, dor.mo.gov). A+'s MO setup is sparse and doesn't map to Missouri's real jurisdiction-code system, so there's no clean join path today.

## Address matching

**Yes — or at minimum, no clean code-to-jurisdiction mapping exists at all.** MO's 92 real tax-body codes (94 raw rows minus 2 DO-NOT-USE) are **not** keyed to Missouri's own DOR "Jurisdiction Code" system, and they aren't FIPS codes either. `TBTXBOD` lengths/formats are wildly inconsistent within the same state: 3-digit (`MO001`, `MO031`), 4-digit (`MO0029`, `MO0229`), 5-digit (`MO02548`, `MO07660`), and 10-digit compound-looking codes (`MO10828063`, `MO23752187`, `MO51572145`, `MO69212161`, `MO72826149`, `MO75922141`, `MO78118097`) — no discoverable single convention.

Cross-checking against real MO county FIPS numbers shows they don't match either — e.g. `MO031` = "Jackson" but Jackson County MO's real FIPS is 095, and `MO095` here is used for "Kansas City" (a city spanning four counties, unrelated to that FIPS number). The name-to-code link is only trustworthy via the free-text `TBTXNAM` label, which is human-typed (inconsistent case, "CO." vs "County" vs no suffix, a truncated "Missouri Neosho (Newton C" over 25 chars) — exactly the kind of unstable key the project's "never guess" rule warns against.

Missouri's real DOR file is known (from general knowledge, not re-verified live this session) to carry on the order of 2,000+ distinct jurisdiction-code rows statewide (overlapping city/county/CID/TDD/EEZ special-district combinations), while A+ only has 92 real codes. **A+'s MO setup is a thin, sparse, customer-driven set of codes, not a comprehensive jurisdiction table waiting to be joined** — the same shape as CO's problem (57 codes, two coexisting schemes) and LA's problem (2 codes for the whole state), just with more rows. A name-based match against the official file's jurisdiction list is possible in principle but needs careful per-row human/fuzzy matching (multiple MO cities share a name across counties, e.g. "Independence" — `MO350` here), which is a real address/matching problem in substance even though it's not the classic same-ZIP-different-rate trigger seen in GA/SC/CO.

## Rate comparability

**Unclear — plausible but unverified.** `TBCBSRT` is a uniform 4.225% across every row (matches Missouri's known statewide base rate). `TBCRATE` for two jurisdictions independently corroborated from general knowledge (St. Louis City ~9.679%, Kansas City ~8.975%) lines up with commonly-cited combined rates, so `TBCRATE` does look like a fully-loaded base+local total. **This was not checked against the actual live MO DOR quarterly XLSX** — the comparison rests on general knowledge of two rates, not a live cross-check the way NC's 0/100 or SC's 46/46+294 checks were.

Missouri also has address-specific CID/TDD special-district overlays that stack on top of a city's base rate for *specific parcels only* — `TBCLRT3`/`TBCLRT4` being populated on some rows (e.g. `MO78928` West Plains: 0.5 + 1.0; `MO72826149` Thayer: 0.5+0) hints A+ can carry up to 4 local layers per ship-to, which could mean overlay taxes are already baked in per-customer. This is inference, not a checked example.

## Exclusions found

2 DO-NOT-USE placeholders (`MO000`, `MO961`, both `TBCRATE=0`), correctly excluded by the standard filter. No wrong-state contamination — every `TBTXNAM` in the 92-row result begins "Missouri"/"MISSOURI". One additional non-jurisdiction row to exclude that survives the DO-NOT-USE text filter: `MO9999` = "MISSOURI CREDITS" (`TBCBSRT`=6.975, no locals, `TBCRATE`=6.975) — a credit/adjustment code, not a real geographic jurisdiction.

## Not yet done — needed before any build decision

1. Actually fetch the current MO DOR quarterly XLSX and line up at least 5–10 of the 92 A+ codes against real Jurisdiction Codes/rates by name, to see if `TBCRATE` actually agrees (Step 2, properly closed out).
2. Determine whether `TBTXBOD`'s compound long-digit codes (e.g. `MO10828063`) secretly encode something real (county+place FIPS concatenation, or an internal customer/ship-to reference) that would make matching more tractable.
3. Check `ADDR.SASTXB` assignment patterns for MO ship-tos specifically — the sparse code count implies most MO customers may not even carry one of these 92 codes.

## Do instead

- Don't assume `TBTXBOD`'s digit patterns encode anything real — resolve jurisdiction only from `TBTXNAM` text, and validate that text carefully (abbreviation variance, truncation, city-name collisions across counties).
- Exclude `MO9999` alongside the two DO-NOT-USE rows.
- Fetch and parse the real MO DOR file before making any further comparability claim.
