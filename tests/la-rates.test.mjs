import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLouisianaLookupLanding,
  parseLouisianaParishPage,
  parseLouisianaStateRate,
  readOfficialLaRates,
} from "../server/la-rates.mjs";

function rateTable(name, code, rate) {
  return `<table id="grdRates"><tr><th>Jurisdiction (Domicile Code)</th><th>Tax Rate</th></tr><tr><td>${name} (${code})</td><td>${rate}%</td><td>2.0000%</td><td>5.0000%</td><td>1.0000000%</td></tr></table>`;
}

function page({ selectedParish = "0100", table = rateTable("Acadia Parish", "0100", "4.2500") } = {}) {
  return `<form>
    <input type="hidden" name="__VIEWSTATE" value="state+value=" />
    <input type="hidden" name="__VIEWSTATEGENERATOR" value="generator" />
    <input type="hidden" name="__EVENTVALIDATION" value="validation" />
    <select id="ddlJurisdiction"><option ${selectedParish === "0100" ? 'selected="selected"' : ""} value="0100">Acadia Parish (0100)</option><option ${selectedParish === "0200" ? 'selected="selected"' : ""} value="0200">Allen Parish (0200)</option></select>
    <select id="ddlFilingPeriod"><option value="10-01-2026">Oct-2026</option><option selected="selected" value="09-01-2026">Sep-2026</option></select>
    ${table}
  </form>`;
}

test("parses Louisiana's current filing period and all parish selectors", () => {
  const landing = parseLouisianaLookupLanding(page(), { expectedParishes: 2 });
  assert.equal(landing.asOfDate, "2026-09-01");
  assert.deepEqual(landing.parishes.map((parish) => parish.code), ["0100", "0200"]);
  assert.equal(landing.hiddenFields.length, 3);
});

test("normalizes a parish domicile page without dropping local administrative fields", () => {
  const rates = parseLouisianaParishPage(page(), { parishCode: "0100", beginDate: "2026-09-01" });
  assert.equal(rates.length, 1);
  assert.equal(rates[0].jurisdictionCode, "LA:0100:0100");
  assert.equal(rates[0].componentRate, 4.25);
  assert.equal(rates[0].totalGeneralRate, 9.25);
  assert.equal(rates[0].vendorCompensationRate, 2);
  assert.throws(() => parseLouisianaParishPage(page(), { parishCode: "0200", beginDate: "2026-09-01" }), /when 0200 was requested/);
});

test("crawls each official parish table and combines it with the validated 5% state rate", async () => {
  const initial = page();
  const second = page({ selectedParish: "0200", table: rateTable("Allen Parish", "0200", "4.7000") });
  const fetchImpl = async (url, options = {}) => {
    if (String(url).includes("what-is-the-sales-tax-rate")) return new Response("Rate as of January 1, 2025 Sales Tax ; 5.00%");
    if (options.method === "POST") {
      assert.match(String(options.body), /ddlJurisdiction=0200/);
      return new Response(second);
    }
    return new Response(initial);
  };
  assert.equal(parseLouisianaStateRate("Rate as of January 1, 2025 Sales Tax ; 5.00%"), 5);
  const snapshot = await readOfficialLaRates({ fetchImpl, now: new Date("2026-09-03T12:00:00Z"), bypassCache: true, expectedParishes: 2, minimumRates: 2 });
  assert.equal(snapshot.stateRate, 5);
  assert.equal(snapshot.rates.length, 2);
  assert.equal(snapshot.rates.find((rate) => rate.parishCode === "0200").totalGeneralRate, 9.7);
  assert.match(snapshot.sourceHash, /^[a-f0-9]{64}$/);
});
