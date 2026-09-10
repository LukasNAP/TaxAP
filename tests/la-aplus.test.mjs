import assert from "node:assert/strict";
import test from "node:test";
import { louisianaAssignedJurisdictions, readLouisianaAplusComparison } from "../server/la-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";

function source() {
  const parishes = Array.from({ length: 64 }, (_, i) => ({ code: `${i + 1}`.padStart(4, "0"), name: i === 0 ? "St. Bernard Parish" : i === 1 ? "Jefferson Parish" : `Fixture ${i} Parish` }));
  const rates = parishes.map((p) => ({ jurisdictionCode: `LA:${p.code}:0000`, parishCode: p.code, jurisdictionType: "county", name: p.name, totalGeneralRate: 10 }));
  rates.push({ jurisdictionCode: "LA:0002:0001", parishCode: "0002", jurisdictionType: "special", name: "Jefferson special district", totalGeneralRate: 11 });
  return { stateCode: "LA", parishes, rates };
}
const row = (taxBody, description, currentRate = 9) => ({ taxBody, description, currentRate, activeShipTos: 1 });
const compare = (taxBodies, official = source()) => readLouisianaAplusComparison({ stateCode: "LA", activeShipTos: taxBodies.length, taxBodies }, { readOfficial: async () => official });

test("Louisiana distinguishes uniform parish rates from mixed parish and catch-all assignments", async () => {
  const r = await compare([row("LA035", "Louisiana St Bernard"), row("LA001", "Louisiana Jefferson Parish"), row("LA000", "Louisiana"), row("LA002", "Louisiana Jefferson Paris"), row("AL9137", "Alabama Birmingham")]);
  assert.equal(r.totals.comparedShipTos, 1);
  assert.equal(r.totals.unmatchedShipTos, 3);
  assert.equal(r.totals.crossStateShipTos, 1);
  const findings = directMappingFindingsFromReconciliation(r);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].officialRate, 10);
  assert.ok(findings[0].jurisdictionLabel.endsWith("(sales tax)"));
});

test("Louisiana keeps reused domicile codes in parish context and refuses duplicate names", async () => {
  const s = source();
  s.rates.push({ jurisdictionCode: "LA:0003:0001", parishCode: "0003", jurisdictionType: "city", name: "Example City", totalGeneralRate: 9 });
  s.rates.push({ jurisdictionCode: "LA:0004:0001", parishCode: "0004", jurisdictionType: "city", name: "Example City", totalGeneralRate: 10 });
  const r = await compare([row("LA020", "Louisiana Example City"), row("LA021", "Louisiana Jefferson special district")], s);
  assert.equal(r.findings[0].matched, false);
  assert.equal(r.findings[1].officialRate, 11);
});

test("Louisiana rejects missing parish context, duplicate domicile keys and unresolved source rates", () => {
  for (const mutate of [
    (s) => { s.parishes.pop(); },
    (s) => { s.rates.pop(); s.rates.pop(); },
    (s) => { s.rates.push(s.rates[0]); },
    (s) => { s.rates[0].totalGeneralRate = null; },
    (s) => { s.rates[0].parishCode = "9999"; },
    (s) => { s.parishes[2].name = s.parishes[1].name; },
  ]) { const s = source(); mutate(s); assert.throws(() => louisianaAssignedJurisdictions(s), /Louisiana/); }
});

test("Louisiana excludes missing rates and retired definitions and propagates source failures", async () => {
  const r = await compare([row("LA001", "Louisiana St Bernard", null), { ...row("LA002", "Louisiana St Bernard"), definitionStatus: "missing" }, row("LA003", "DO NOT USE Louisiana St Bernard")]);
  assert.equal(r.totals.comparedShipTos, 0);
  await assert.rejects(readLouisianaAplusComparison({ stateCode: "LA" }, { readOfficial: async () => { throw new Error("source failed"); } }), /source failed/);
});
