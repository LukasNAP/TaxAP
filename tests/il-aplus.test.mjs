import assert from "node:assert/strict";
import test from "node:test";
import { readIllinoisAplusComparison } from "../server/il-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";

const rate = (id, value = 8) => ({ jurisdictionCode: `IL:${id}`, name: "Fixture jurisdiction", totalGeneralRate: value, addressOverride: false, beginDate: "2026-07-01" });
const source = { asOfDate: "2026-09-08", rates: [rate("022-0002-3"), rate("016-0011-7"), rate("016-0012-5")], addressOverrideLocationIds: ["060-5000-2"] };
const row = (taxBody, currentRate = 7) => ({ taxBody, currentRate, description: "Illinois fixture jurisdiction", activeShipTos: 1 });
const compare = (rows, official = source) => readIllinoisAplusComparison({ stateCode: "IL", taxBodies: rows, activeShipTos: rows.length }, { readOfficial: async () => official });

test("Illinois matches full IDs and only unique seven-digit prefixes", async () => {
  const result = await compare([row("IL02200023"), row("IL0160011"), row("IL01600125", 8)]);
  assert.ok(result.findings.every((finding) => finding.matched));
  assert.equal(directMappingFindingsFromReconciliation(result).length, 2);
});

test("Illinois never repairs an incorrect check digit or substitutes an override rate", async () => {
  const result = await compare([row("IL02200029"), row("IL06050002"), row("IL0605000"), row("IL000"), row("IL9999999")]);
  assert.equal(result.totals.unmatchedShipTos, 5);
  assert.deepEqual(directMappingFindingsFromReconciliation(result), []);
});

test("Illinois counts address overrides when checking prefix uniqueness", async () => {
  const result = await compare([row("IL0220002"), row("IL02200023")], { ...source, addressOverrideLocationIds: ["022-0002-4"] });
  assert.equal(result.findings[0].matched, false);
  assert.equal(result.findings[1].matched, true);
  const duplicated = await compare([row("IL0220002")], { ...source, rates: [...source.rates, rate("022-0002-4")] });
  assert.equal(duplicated.findings[0].matched, false);
});

test("Illinois excludes future rates, missing definitions and category-specific codes", async () => {
  const result = await compare([{ ...row("IL02200023"), description: "Illinois equipment" }, { ...row("IL0160011"), definitionStatus: "missing" }, row("IL01600125")], {
    ...source, rates: source.rates.map((item) => ({ ...item, beginDate: "2026-10-01" })),
  });
  assert.ok(result.findings.every((finding) => !finding.matched));
});

test("Illinois fails closed on missing override metadata and conflicting IDs", async () => {
  await assert.rejects(compare([], { ...source, addressOverrideLocationIds: undefined }), /override identities/);
  await assert.rejects(compare([], { ...source, addressOverrideLocationIds: ["022-0002-3"] }), /duplicated/);
});
