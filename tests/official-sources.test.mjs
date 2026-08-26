import assert from "node:assert/strict";
import test from "node:test";
import { listOfficialSourceRegistry } from "../server/official-source-registry.mjs";
import { parsePennsylvaniaCountyNames, parsePennsylvaniaRateRules, readOfficialPaRates } from "../server/pa-rates.mjs";
import { findLatestSstCsv, parseSstRateCsv, readOfficialGaRates, readOfficialSstStateRates } from "../server/sst-rates.mjs";

test("registers every state and DC without claiming unfinished adapters are connected", () => {
  const sources = listOfficialSourceRegistry();
  assert.equal(sources.length, 51);
  assert.equal(sources.find((source) => source.stateCode === "NC").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "GA").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "CA").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "TX").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "FL").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "TN").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "OH").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "PA").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "SC").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "IL").status, "machine-readable-source");
  assert.equal(sources.find((source) => source.stateCode === "VA").status, "machine-readable-source");
  assert.equal(sources.find((source) => source.stateCode === "MD").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "NJ").status, "connected");
  assert.equal(sources.find((source) => source.stateCode === "NJ").aplusMatchingStatus, "connected");
  for (const stateCode of ["AR", "WY", "IN", "KY", "MI", "RI"]) {
    assert.equal(sources.find((source) => source.stateCode === stateCode).status, "connected", `${stateCode} should be connected`);
  }
  for (const stateCode of ["MD", "IN", "KY", "MI", "ME", "CT", "MA", "MS"]) {
    const source = sources.find((s) => s.stateCode === stateCode);
    assert.equal(source.status, "connected", `${stateCode} should be connected`);
    assert.equal(source.aplusMatchingStatus, "connected", `${stateCode} should have A+ matching connected`);
    assert.equal(source.comparisonEndpoint, `/api/official/states/${stateCode}/aplus`, `${stateCode} should expose its comparison endpoint`);
  }
  assert.equal(sources.find((source) => source.stateCode === "RI").aplusMatchingStatus, undefined, "RI's 0%-vs-7% finding is an open decision, not wired A+ matching");
  for (const stateCode of ["DE", "MT", "NH", "OR"]) {
    assert.equal(sources.find((source) => source.stateCode === stateCode).status, "no-general-sales-tax", `${stateCode} should be marked no-general-sales-tax`);
  }
});

test("builds Pennsylvania's 67 county totals only after validating the official rate rules", async () => {
  const officialHtml = "<main>The sales and use tax rate is 6 percent. Allegheny County has a 1 percent local sales tax. Philadelphia has a 2 percent local sales tax.</main>";
  const countyNames = [
    "USPS|GEOID|NAME",
    "PA|42003|Allegheny County",
    "PA|42101|Philadelphia County",
    ...Array.from({ length: 65 }, (_, index) => `PA|42${String(index + 200).padStart(3, "0")}|County ${index + 1} County`),
  ].join("\n");
  assert.deepEqual(parsePennsylvaniaRateRules(officialHtml), { stateRate: 6, alleghenyLocalRate: 1, philadelphiaLocalRate: 2 });
  assert.equal(parsePennsylvaniaCountyNames(countyNames).length, 67);
  const fetchImpl = async (url) => new Response(String(url).includes("gaz_counties") ? countyNames : officialHtml);
  const snapshot = await readOfficialPaRates({ fetchImpl, now: new Date("2026-08-25T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.counts.counties, 67);
  assert.equal(snapshot.rates.find((rate) => rate.name === "Allegheny").totalGeneralRate, 7);
  assert.equal(snapshot.rates.find((rate) => rate.name === "Philadelphia").totalGeneralRate, 8);
  assert.equal(snapshot.rates.find((rate) => rate.name === "County 1").totalGeneralRate, 6);
  assert.throws(() => parsePennsylvaniaRateRules("Pennsylvania sales tax information"), /did not contain/);
});

test("parses active SST rate components and rejects malformed files", () => {
  const csv = [
    "13,45,13,0.04,0.04,0,0,20110101,29991231",
    "13,00,001,0.04,0.04,0.04,0.04,20220701,29991231",
    "13,01,04000,0.02,0.02,0.02,0.02,20221001,29991231",
    "13,00,003,0.03,0.03,0.03,0.03,20100101,20260630",
  ].join("\n");
  const result = parseSstRateCsv(csv, { stateFips: "13", asOfDate: "2026-08-18" });
  assert.equal(result.activeRows.length, 3);
  assert.equal(result.stateRate, 4);
  assert.equal(result.activeRows.find((row) => row.jurisdictionCode === "001").generalIntrastateRate, 4);
  assert.throws(() => parseSstRateCsv(`${csv}\n13,00,001,0.04,0.04,0.04,0.04,20220701,29991231`, { stateFips: "13", asOfDate: "2026-08-18" }), /duplicate active jurisdiction/);
});

test("discovers and validates the current Georgia machine-readable rate file", async () => {
  const countyRows = Array.from({ length: 159 }, (_, index) => `13,00,${String(index + 1).padStart(3, "0")},0.04,0.04,0.04,0.04,20220701,29991231`);
  const csv = ["13,45,13,0.04,0.04,0,0,20110101,29991231", ...countyRows, "13,01,04000,0.02,0.02,0.02,0.02,20221001,29991231"].join("\n");
  const countyNames = ["USPS|GEOID|NAME", ...Array.from({ length: 159 }, (_, index) => `GA|13${String(index + 1).padStart(3, "0")}|County ${index + 1}`)].join("\n");
  const placeNames = "USPS|GEOID|NAME\nGA|1304000|Alpha city";
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="GAR2026Q3JUN05.csv">GA</a>');
    if (value.endsWith("GAR2026Q3JUN05.csv")) return new Response(csv);
    if (value.includes("gaz_counties")) return new Response(countyNames);
    if (value.includes("gaz_place")) return new Response(placeNames);
    return new Response("Not found", { status: 404 });
  };
  assert.match(findLatestSstCsv('<a href="GAR2026Q3JUN05.csv">GA</a>', "GA"), /GAR2026Q3JUN05\.csv$/);
  const snapshot = await readOfficialGaRates({ fetchImpl, now: new Date("2026-08-18T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 4);
  assert.equal(snapshot.counts.counties, 159);
  assert.equal(snapshot.counts.cities, 1);
  assert.equal(snapshot.rates.find((rate) => rate.jurisdictionType === "county").totalGeneralRate, 8);
  assert.match(snapshot.sourceHash, /^[a-f0-9]{64}$/);
});

test("reuses the validated SST contract for Ohio without guessing county coverage", async () => {
  const countyRows = Array.from({ length: 88 }, (_, index) => `39,00,${String(index + 1).padStart(3, "0")},0.01,0.01,0.01,0.01,20260101,29991231`);
  const csv = ["39,45,39,0.0575,0.0575,0,0,20260101,29991231", ...countyRows].join("\n");
  const countyNames = ["USPS|GEOID|NAME", ...Array.from({ length: 88 }, (_, index) => `OH|39${String(index + 1).padStart(3, "0")}|County ${index + 1}`)].join("\n");
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.endsWith("/Rates/")) return new Response('<a href="OHR2026Q3JUN01.csv">OH</a>');
    if (value.endsWith("OHR2026Q3JUN01.csv")) return new Response(csv);
    if (value.includes("gaz_counties_39")) return new Response(countyNames);
    if (value.includes("gaz_place_39")) return new Response("USPS|GEOID|NAME\n");
    return new Response("Not found", { status: 404 });
  };
  const snapshot = await readOfficialSstStateRates("OH", { fetchImpl, now: new Date("2026-08-25T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 5.75);
  assert.equal(snapshot.counts.counties, 88);
  assert.equal(snapshot.rates.length, 89);
});
