import assert from "node:assert/strict";
import test from "node:test";
import { findLatestArizonaCsv, parseArizonaRetailCsv } from "../server/az-rates.mjs";

test("discovers Arizona's latest dated all-classifications CSV", () => {
  const html = `<a href="/sites/default/files/document/TPT_RATETABLE_ALL_08012026.csv">August</a><a href="/sites/default/files/document/TPT_RATETABLE_ALL_09012026.csv">September</a>`;
  assert.deepEqual(findLatestArizonaCsv(html), { url: "https://azdor.gov/sites/default/files/document/TPT_RATETABLE_ALL_09012026.csv", date: "2026-09-01" });
});

test("parses active Arizona retail rows and preserves city components", () => {
  const header = "RegionCode,RegionName,BusinessCode,BusinessCodesName,TaxRate,TaxRateType,RateStartDate,RateEndDate";
  const countyCodes = ["APA", "COH", "COC", "GLA", "GRA", "GRN", "LAP", "MAR", "MOH", "NAV", "PMA", "PNL", "STC", "YAV", "YMA"];
  const counties = countyCodes.map((code) => `${code},${code},017,RETAIL SALES,6.1,Percent,1/01/2026 0:00,12/31/9999 0:00`);
  const cities = Array.from({ length: 80 }, (_, index) => `${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + index % 26)},CITY ${index},017,RETAIL SALES,2,Percent,1/01/2026 0:00,12/31/9999 0:00`);
  const specials = Array.from({ length: 20 }, (_, index) => `X${String(index).padStart(2, "0")},TRIBE ${index},017,RETAIL SALES,6.1,Percent,1/01/2026 0:00,12/31/9999 0:00`);
  const parsed = parseArizonaRetailCsv([header, ...counties, ...cities, ...specials].join("\n"), { asOfDate: "2026-09-01" });
  assert.deepEqual(parsed.counts, { counties: 15, cities: 80, specialJurisdictions: 20 });
  assert.equal(parsed.rates.find((row) => row.jurisdictionType === "city").totalGeneralRate, null);
  assert.equal(parsed.rates.find((row) => row.jurisdictionCode === "APA").totalGeneralRate, 6.1);
});
