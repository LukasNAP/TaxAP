import assert from "node:assert/strict";
import test from "node:test";
import { NC_COUNTIES, parseNcdorCurrentRates, parseNcdorFutureChanges } from "../server/ncdor-rates.mjs";

function currentRatesFixture() {
  const rows = NC_COUNTIES.map((county, index) => {
    const rate = index === 59 ? "8.25%" : index === 31 || index === 67 ? "7.50%" : "6.75%";
    const previousRate = index === 59 ? "7.25%" : rate;
    return `<tr><td>${county}</td><td>${rate}</td><td>${previousRate}</td></tr>`;
  }).join("");
  return `<table><thead><tr><th>County</th><th>7/1/2026 - Current</th><th>Prior</th></tr></thead><tbody>${rows}</tbody></table>`;
}

test("parses and validates all 100 official NCDOR county rates", () => {
  const snapshot = parseNcdorCurrentRates(currentRatesFixture());
  assert.equal(snapshot.effectivePeriod, "7/1/2026 - Current");
  assert.equal(snapshot.rates.length, 100);
  assert.deepEqual(snapshot.rates[0], { county: "Alamance", taxBody: "NC001", officialRate: 6.75, previousOfficialRate: 6.75, recentChange: false, recentEffectiveDate: null });
  assert.deepEqual(snapshot.rates[59], { county: "Mecklenburg", taxBody: "NC060", officialRate: 8.25, previousOfficialRate: 7.25, recentChange: true, recentEffectiveDate: "2026-07-01" });
});

test("rejects an incomplete or malformed official county table", () => {
  const incomplete = currentRatesFixture().replace(/<tr><td>Yancey[\s\S]*?<\/tr>/, "");
  assert.throws(() => parseNcdorCurrentRates(incomplete), /Yancey County|exactly 100/);
  assert.throws(() => parseNcdorCurrentRates("<table><tr><th>County</th></tr></table>"), /Current/);
});

test("detects only announced component changes after the comparison date", () => {
  const html = `<table><thead><tr><th>County</th><th>#</th><th>2% County Tax</th><th>2.25% County Tax</th><th>0.50% Transit Tax</th><th>1% Additional County Tax</th></tr></thead><tbody>
    <tr><td>Alamance</td><td>1</td><td>10/1/2009</td><td>10/1/2027</td><td>N/A</td><td>N/A</td></tr>
    <tr><td>Mecklenburg</td><td>60</td><td>10/1/2009</td><td>N/A</td><td>4/1/1999</td><td>7/1/2026</td></tr>
  </tbody></table>`;
  assert.deepEqual(parseNcdorFutureChanges(html, "2026-08-18"), [{
    county: "Alamance",
    effectiveDate: "2027-10-01",
    componentRate: 2.25,
    component: "2.25% County Tax",
  }]);
});
