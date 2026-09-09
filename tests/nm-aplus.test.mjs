import assert from "node:assert/strict";
import test from "node:test";
import { readNewMexicoAplusComparison } from "../server/nm-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";
import { describesOtherJurisdiction } from "../app/tax-body-policy.ts";

const rate = (locationCode, name, totalGeneralRate, jurisdictionType = "city") =>
  ({ locationCode, name, totalGeneralRate, jurisdictionType });
const rates = [rate("04-101", "Roswell", 8.2708), rate("01-123", "Santa Fe (city)", 8.1875),
  rate("29-524", "Rio Rancho (Sandoval)", 7.4375), rate("07-007", "Remainder of County - Dona Ana", 6.4975, "county"),
  rate("02-999", "Isleta class 1", 0, "special")];
const row = (taxBody, description, currentRate = 8) => ({ taxBody, description, currentRate, activeShipTos: 1 });
const detail = (taxBodies) => ({ stateCode: "NM", activeShipTos: taxBodies.length, taxBodies });
const readOfficial = async () => ({ rates });

test("New Mexico is not confused with Mexico while foreign and other-state assignments remain excluded", () => {
  assert.equal(describesOtherJurisdiction(row("NM04101", "New Mexico Roswell"), "NM"), false);
  assert.equal(describesOtherJurisdiction(row("MX000", "Mexico no tax"), "NM"), true);
  assert.equal(describesOtherJurisdiction(row("NM04101", "New Mexico Mexico no tax"), "NM"), true);
  assert.equal(describesOtherJurisdiction(row("NM04101", "New Mexico Roswell"), "AZ"), true);
});

test("New Mexico compares exact code and name, retaining GRT scope and county identity", async () => {
  const result = await readNewMexicoAplusComparison(detail([
    row("NM04101", "New Mexico Roswell", 7.896), row("NM01123", "New Mexico Santa Fe", 8.188),
    row("NM29524", "New Mexico Rio Rancho (Sandoval)", 7.438),
    row("NM29524", "New Mexico Rio Rancho (Sa"), row("NM04101", "New Mexico Santa Fe"),
    row("NM000", "New Mexico", 0), row("NM1600", "New Mexico Gallup"),
    row("NM07007", "New Mexico Dona Ana Co."), row("NM02999", "New Mexico Isleta class 1", 0),
    row("NM04101", "New Mexico Roswell", null), row("NM04101", "New Mexico Roswell", "invalid"),
    row("NM04101", "New Mexico Roswell equipment"), row("AZ001", "Arizona", 0),
  ]), { readOfficial });
  assert.equal(result.totals.comparedShipTos, 3);
  assert.equal(result.totals.unmatchedShipTos, 9);
  assert.equal(result.totals.crossStateShipTos, 1);
  assert.equal(result.findings[0].rateDifference, 0.3748);
  assert.match(result.findings[0].jurisdictionLabel, /GRT/);
  assert.equal(result.findings[1].hasDifference, false);
  assert.equal(directMappingFindingsFromReconciliation(result).length, 1);
});

test("New Mexico rejects corrupt source inventory and propagates fetch failure", async () => {
  for (const invalid of [[...rates, rates[0]], [rate("bad", "Roswell", 8)], [rate("04-101", "Roswell", null)]]) {
    await assert.rejects(readNewMexicoAplusComparison(detail([]), { readOfficial: async () => ({ rates: invalid }) }), /inventory/);
  }
  await assert.rejects(readNewMexicoAplusComparison(detail([]), { readOfficial: async () => { throw new Error("unavailable"); } }), /unavailable/);
});
