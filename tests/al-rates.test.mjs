import assert from "node:assert/strict";
import test from "node:test";
import {
  findCurrentAlabamaCsv,
  parseAlabamaCurrentCsv,
  parseAlabamaStateGeneralRate,
} from "../server/al-rates.mjs";

const HEADER = '"Locality Code","Locality Name","County Number","TaxType","Rate Type","Administered","Active Date","Inactive Date","Rate","Indicator","PJ","County Code","PJ_Rate"';

function row({ code, name, countyNumber, taxType = "ST", rate, pj = "", countyCode = "", pjRate = "" }) {
  return `"${code}","${name}",${countyNumber},"${taxType}","GENER","STATE","20260901",,"${rate}","RC","${pj}","${countyCode}","${pjRate}"`;
}

function fixture({ duplicate = false } = {}) {
  const rows = [
    row({ code: "7001", name: "AUTAUGA COUNTY", countyNumber: 1, rate: "2.5000" }),
    row({ code: "7001", name: "AUTAUGA COUNTY", countyNumber: 1, taxType: "SU", rate: "2.0000" }),
    row({ code: "9001", name: "ALPHA", countyNumber: 90, rate: "4.0000", pj: "Y", countyCode: "7001", pjRate: "2.0000" }),
    row({ code: "9001", name: "ALPHA", countyNumber: 90, taxType: "SU", rate: "3.0000", pj: "Y", countyCode: "7001", pjRate: "1.5000" }),
    row({ code: "9002", name: "BETA", countyNumber: 90, rate: "3.0000", pj: "N", countyCode: "7001", pjRate: "0.0000" }),
  ];
  if (duplicate) rows.push(row({ code: "9002", name: "BETA", countyNumber: 90, rate: "4.0000", pj: "N", countyCode: "7001", pjRate: "0.0000" }));
  return `${HEADER}\n${rows.join("\n")}\n`;
}

test("resolves Alabama's current monthly CSV despite nested update markup", () => {
  const html = '<a href="/wp-content/uploads/taxrates_current.csv">taxrates_current.csv</a> current, active information only <em>Updated for <em>September 202</em>6</em>';
  assert.deepEqual(findCurrentAlabamaCsv(html), {
    url: "https://www.revenue.alabama.gov/wp-content/uploads/taxrates_current.csv",
    asOfDate: "2026-09-01",
  });
  assert.throws(() => findCurrentAlabamaCsv("<main>No file</main>"), /did not link/);
});

test("validates Alabama's 4% state general rate", () => {
  assert.equal(parseAlabamaStateGeneralRate("<h1>Sales and Use Tax Rates</h1><p>General:&nbsp; 4%</p>"), 4);
  assert.throws(() => parseAlabamaStateGeneralRate("<h1>Sales and Use Tax Rates</h1><p>General: 5%</p>"), /no longer confirms/);
});

test("preserves Alabama corporate-limit, county, police-jurisdiction, and sellers-use rates", () => {
  const parsed = parseAlabamaCurrentCsv(fixture(), { asOfDate: "2026-09-01", minimumSalesRows: 3, expectedCountyNumbers: 1 });
  assert.deepEqual(parsed.counts, { counties: 1, cities: 2, specialJurisdictions: 1 });
  const county = parsed.rates.find((rate) => rate.jurisdictionCode === "AL:7001:BASE:CL");
  assert.equal(county.totalGeneralRate, 6.5);
  assert.equal(county.generalInterstateRate, 6);
  const city = parsed.rates.find((rate) => rate.jurisdictionCode === "AL:9001:7001:CL");
  assert.equal(city.totalGeneralRate, 8);
  assert.equal(city.generalInterstateRate, 7);
  const pj = parsed.rates.find((rate) => rate.jurisdictionCode === "AL:9001:7001:PJ");
  assert.equal(pj.totalGeneralRate, 6);
  assert.equal(pj.generalInterstateRate, 5.5);
  assert.throws(() => parseAlabamaCurrentCsv(fixture({ duplicate: true }), { asOfDate: "2026-09-01", minimumSalesRows: 3, expectedCountyNumbers: 1 }), /repeats general sales-tax locality/);
});
