import assert from "node:assert/strict";
import test from "node:test";
import { parseOklahomaCopoCsv, readOklahomaAplusComparison } from "../server/ok-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";
const line = (type, code, name, rate, begin = "1/1/2020", previous = "0.00%,00/00/00,00/00/00") => `${type},${code},${name},${rate}%,${begin},00/00/00,${previous},0.00%,00/00/00,00/00/00,`;
const csv = [line("STS", "7288", "TULSA COUNTY", 0.367), line("STU", "7288", "TULSA COUNTY", 0.367), line("STS", "7281", "TULSA", 3.65), line("STU", "7281", "TULSA", 3.65)].join("\n");
const options = { asOfDate: "2026-09-08", minimumLocations: 2, expectedCounties: 1 };
test("Oklahoma combines city and county once and requires exact code/name agreement", async () => {
  const rates = parseOklahomaCopoCsv(csv, options);
  assert.equal(rates[0].totalGeneralRate, 4.867);
  assert.equal(rates[1].totalGeneralRate, 8.517);
  const taxBodies = [["OK7281", "Oklahoma Tulsa", 8], ["OK7288", "Oklahoma Tulsa Co.", 4.867], ["OK7288", "Oklahoma Tulsa", 8], ["OK000", null, null], ["OK728172", "Oklahoma Tulsa", 8]].map(([taxBody, description, currentRate]) => ({ taxBody, description, currentRate, activeShipTos: 1 }));
  const result = await readOklahomaAplusComparison({ stateCode: "OK", activeShipTos: 5, taxBodies }, { readOfficial: async () => ({ rates }) });
  assert.equal(result.totals.comparedShipTos, 2);
  assert.equal(result.totals.unmatchedShipTos, 3);
  assert.equal(directMappingFindingsFromReconciliation(result).length, 1);
});
test("Oklahoma leaves differing sales/use rates and corrupt or overlapping dates unresolved", () => {
  for (const replacement of [line("STU", "7281", "TULSA", 0), line("STU", "7281", "TULSA", 3.65, "10/1/205"), line("STU", "7281", "TULSA", 3.65, "1/1/2020", "3%,1/1/1990,00/00/00")]) {
    const rates = parseOklahomaCopoCsv(csv.replace(line("STU", "7281", "TULSA", 3.65), replacement), options);
    assert.equal(rates[1].totalGeneralRate, null);
  }
});
test("Oklahoma selects effective history and rejects partial or duplicate source data", () => {
  const future = csv.replaceAll(line("STS", "7281", "TULSA", 3.65), line("STS", "7281", "TULSA", 4, "10/1/2026", "3.65%,1/1/2020,9/30/2026"));
  assert.equal(parseOklahomaCopoCsv(future, options)[1].totalGeneralRate, 8.517);
  assert.throws(() => parseOklahomaCopoCsv(csv + "\n" + line("STS", "7281", "TULSA", 3.65), options), /duplicated/);
  assert.throws(() => parseOklahomaCopoCsv(csv.split("\n").slice(1).join("\n"), options), /incomplete/);
});
