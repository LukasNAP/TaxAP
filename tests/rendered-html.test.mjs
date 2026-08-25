import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the TaxAP dashboard-first MVP", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>TaxAP \| Sales and use tax rate monitoring<\/title>/i);
  assert.match(html, /Atlantic Packaging/);
  assert.match(html, /TaxAP/);
  assert.match(html, /See what changed, what matters, and what needs review\./);
  assert.match(html, /Tax rate change workspace/);
  assert.match(html, /Needs attention/);
  assert.match(html, /Upcoming changes/);
  assert.match(html, /Affected ship-tos/);
  assert.match(html, /Connected sources/);
  assert.match(html, /Last validated refresh/);
  assert.match(html, /Published changes and A\+ impact/);
  assert.match(html, /All jurisdictions/);
  assert.match(html, /Review history/);
  assert.match(html, /Mecklenburg County/);
  assert.match(html, /Admin import/);
  assert.match(html, /Supervised refresh only|Refresh now/);
  assert.doesNotMatch(html, /Coverage map|North Carolina county coverage map|United States map/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
});

test("keeps the MVP read-only and preserves verified aggregate data", async () => {
  const [page, taxData, importParser, readme, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tax-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/aplus-import.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /No A\+ records were changed by TaxAP\./);
  assert.match(page, /A\+ rate was changed and invoices that used the prior 7\.25% rate were handled/);
  assert.match(taxData, /taxableSales: "\$91,211\.53"/);
  assert.match(taxData, /activeNcShipTos: 5518/);
  assert.match(taxData, /standardCountyAssignments: 5498/);
  assert.match(taxData, /coveredCounties: 93/);
  assert.match(taxData, /rateSource: "APLUSV8FAQ\.XATXBD"/);
  assert.match(taxData, /if \(number === 60\) return 8\.25/);
  assert.match(taxData, /if \(number === 32 \|\| number === 68\) return 7\.5/);
  assert.match(taxData, /if \(number === 92\) return 7\.25/);
  assert.match(taxData, /scheduledRateChanges: 0/);
  assert.match(taxData, /specialTaxBodies: 10/);
  assert.match(page, /A\+ configured rate/);
  assert.match(page, /Active special A\+ tax bodies/);
  assert.match(page, /visibleSpecialTaxBodies = specialTaxBodies\.filter/);
  assert.match(page, /ReviewDecisionPanel/);
  assert.match(page, /View audit history/);
  assert.match(page, /Local review storage is unavailable/);
  assert.match(page, /Official rate-source rollout/);
  assert.match(page, /Machine source identified/);
  assert.match(page, /OfficialStateSourcePanel/);
  assert.match(page, /Pennsylvania Department of Revenue/);
  assert.match(page, /Illinois Department of Revenue/);
  assert.match(page, /Virginia Department of Taxation/);
  assert.match(page, /Comptroller of Maryland/);
  assert.match(page, /stateSummariesByCode\.has\(source\.stateCode\)/);
  assert.doesNotMatch(page, /connectorStatus === "live" && stateSummariesByCode\.has/);
  assert.match(page, /api\/official\/states\/\$\{encodeURIComponent\(stateCode\)\}/);
  assert.match(page, /Apply validated snapshot/);
  assert.match(page, /Session-only application/);
  assert.match(page, /Refresh now/);
  assert.match(page, /Live A\+ connected/);
  assert.match(page, /Production connection intentionally disabled/);
  assert.match(page, /Validated A\+ state snapshot/);
  assert.match(page, /api\/official\/nc-rates/);
  assert.match(page, /Matches NCDOR/);
  assert.match(page, /Recent change matched/);
  assert.match(page, /Review difference/);
  assert.match(page, /Upcoming change/);
  assert.match(page, /Open official NCDOR evidence/);
  assert.match(page, /api\/aplus\/states\/\$\{encodeURIComponent\(stateCode\)\}/);
  assert.match(page, /customer names and ship-to addresses are not returned to the browser/);
  assert.match(page, /LIVE_REFRESH_INTERVAL_MS = 6 \* 60 \* 60 \* 1000/);
  assert.match(page, /matchesJurisdictionFilters/);
  assert.match(page, /Effective date/);
  assert.match(page, /Official source/);
  assert.match(page, /Any review status/);
  assert.match(page, /New publications are not automatically treated as A\+ problems|separates newly published government rates from confirmed A\+ differences/);
  assert.match(importParser, /XATXBD_COLUMN_COUNT = 19/);
  assert.match(importParser, /Missing standard county tax bodies/);
  assert.match(importParser, /current total does not equal its rate components/);
  assert.match(readme, /No automatic A\+ changes/);
  assert.match(readme, /working local MVP/i);
  assert.match(readme, /ADDR\.SASTXB/);
  assert.match(readme, /APLUSV8FAQ\.XATXBD/);
  assert.match(readme, /current browser session/);
  assert.match(readme, /DefaultAzureCredential/);
  assert.match(readme, /SQL03.*APLUS/);
  assert.match(readme, /Atlantic branding/);
  assert.doesNotMatch(page, /TaxWatch/);
  assert.doesNotMatch(page, /geoAlbersUsa|geoMercator|countiesTopology|statesTopology/);
  assert.doesNotMatch(packageJson, /d3-geo|topojson-client|us-atlas/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
