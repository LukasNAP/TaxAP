import assert from "node:assert/strict";
import test from "node:test";
import { buildIdahoSalesAreas, readIdahoSalesAreas, readIdahoAplusComparison } from "../server/id-aplus.mjs";
import { directMappingFindingsFromReconciliation } from "../app/dashboard-findings.ts";
const geography = { cities: ["nampa", "resort"], counties: ["canyon county", "resort county"], resortCities: ["resort"], resortCounties: { resort: ["resort county"] }, stateRate: 6 };

test("Idaho compares named non-resort cities and counties while retaining unknown scope", async () => {
  const source = buildIdahoSalesAreas(geography);
  const labels = ["Idaho Nampa", "Idaho Canyon Co.", "Idaho Resort", "Idaho Resort County", "Idaho Unknown", "Idaho Nampa", "Minnesota Hennepin Co."];
  const taxBodies = labels.map((description, i) => ({ description, taxBody: i === 5 ? "ID000" : i === 6 ? "MN430" : `ID${i + 1}`, currentRate: 5, activeShipTos: 1 }));
  const r = await readIdahoAplusComparison({ stateCode: "ID", activeShipTos: 7, taxBodies }, { readOfficial: async () => source });
  assert.equal(r.totals.comparedShipTos, 2);
  assert.equal(r.totals.unmatchedShipTos, 4);
  assert.equal(r.totals.crossStateShipTos, 1);
  const findings = directMappingFindingsFromReconciliation(r);
  assert.equal(findings.length, 2);
  assert.ok(findings.every((f) => f.jurisdictionLabel.endsWith("(sales tax)")));
});

test("Idaho refuses incomplete resort geography rather than assuming a county has no local tax", () => {
  for (const change of [{ resortCounties: {} }, { resortCounties: { resort: [] } }, { resortCounties: { resort: ["unknown county"] } }, { cities: ["nampa"] }, { stateRate: 7 }, { resortCities: [] }]) {
    assert.throws(() => buildIdahoSalesAreas({ ...geography, ...change }), /Idaho/);
  }
});

function sources({ truncate = false, newCity = false, failIntersection = false } = {}) {
  const cityData = { spatialReference: { wkid: 4326 }, features: Array.from({ length: 200 }, (_, i) => ({ attributes: { NAME: i === 0 || i === 199 ? "Resort" : `City ${i}` }, geometry: { rings: [[[i, 0], [i, 1], [i + 1, 1], [i, 0]]] } })) };
  const countyData = { features: Array.from({ length: 44 }, (_, i) => ({ attributes: { NAME: `County ${i}` } })) };
  let intersections = 0;
  return {
    count: () => intersections,
    readBase: async () => ({ stateRate: 6, sourceHash: "fixture", unavailableLocalJurisdictions: ["Resort"] }),
    fetchImpl: async (url, options = {}) => {
      if (options.method === "POST") {
        intersections++;
        assert.equal(options.body.get("returnGeometry"), "false");
        assert.equal(options.body.get("outFields"), "NAME");
        const geometry = JSON.parse(options.body.get("geometry"));
        assert.ok(geometry.rings);
        return { ok: true, json: async () => ({ features: failIntersection ? [] : [{ attributes: { NAME: geometry.rings[0][0][0] === 0 ? "County 0" : "County 1" } }] }) };
      }
      if (url.includes("/6/query?")) return { ok: true, json: async () => ({ ...cityData, exceededTransferLimit: truncate }) };
      if (url.includes("/7/query?")) return { ok: true, json: async () => countyData };
      return { ok: true, text: async () => `Cities with local sales taxes<ul><li>Resort &ndash; phone</li>${newCity ? "<li>New City &ndash; phone</li>" : ""}</ul>` };
    },
  };
}

test("Idaho intersects every public geometry part of a resort city and excludes both counties", async () => {
  const mock = sources();
  const r = await readIdahoSalesAreas(mock);
  assert.equal(mock.count(), 2);
  assert.deepEqual(r.unresolvedResortCounties, ["county 0", "county 1"]);
  assert.equal(r.rates.filter((r) => r.name === "resort").length, 1);
  assert.equal(r.rates.find((r) => r.name === "county 2").totalGeneralRate, 6);
});

test("Idaho fails closed on truncated geography, a new resort city, or missing intersections", async () => {
  for (const options of [{ truncate: true }, { newCity: true }, { failIntersection: true }]) {
    await assert.rejects(readIdahoSalesAreas(sources(options)), /Idaho/);
  }
});
