import assert from "node:assert/strict";
import test from "node:test";
import { parseMaineRateTable, readOfficialMeRates } from "../server/me-rates.mjs";
import { parseCtRatePage, readOfficialCtRates } from "../server/ct-rates.mjs";
import { parseMaRatePage, readOfficialMaRates } from "../server/ma-rates.mjs";
import { parseMsRatePage, readOfficialMsRates } from "../server/ms-rates.mjs";

const MAINE_TABLE_HTML = `<!-- Maine Revenue Services sales, use, and service provider tax rates and due dates page fixture, padded to a realistic page size for the adapter's minimum-response-size check -->
<table>
  <tr><th>Rate Type</th><th>Effective 10/2013</th><th>Effective 10/1/2019</th></tr>
  <tr><td>General Sales</td><td>5.5%</td><td>5.5%</td></tr>
  <tr><td>Prepared Food</td><td>8%</td><td>8%</td></tr>
  <tr><td>Use Tax</td><td>5.5%</td><td>5.5%</td></tr>
</table>
<p>Maine Revenue Services publishes due dates for monthly, quarterly, semi-annual, and annual filers alongside these historical rate changes so businesses can confirm the currently effective rate before filing a return.</p>`;

test("parseMaineRateTable reads the most recent General Sales column", () => {
  assert.equal(parseMaineRateTable(MAINE_TABLE_HTML), 5.5);
});

test("parseMaineRateTable rejects a table with no Effective-date header", () => {
  assert.throws(() => parseMaineRateTable("<table><tr><th>Rate Type</th></tr><tr><td>General Sales</td></tr></table>"), /no longer contains an "Effective/);
});

test("parseMaineRateTable rejects when General Sales and Use Tax disagree", () => {
  const html = MAINE_TABLE_HTML.replace("<td>Use Tax</td><td>5.5%</td><td>5.5%</td>", "<td>Use Tax</td><td>5.5%</td><td>6%</td>");
  assert.throws(() => parseMaineRateTable(html), /disagree/);
});

test("readOfficialMeRates wires the parsed rate into a snapshot with no address matching needed", async () => {
  const fetchImpl = async () => new Response(MAINE_TABLE_HTML);
  const snapshot = await readOfficialMeRates({ fetchImpl, now: new Date("2026-08-26T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 5.5);
  assert.equal(snapshot.counts.counties, 0);
});

const CT_PAGE_HTML = "<!-- Connecticut DRS sales-and-use-tax information page fixture, padded to a realistic page size --><p>Report taxable purchases on Form OS-114, Connecticut Sales and Use Tax Return, for the reporting period in which the taxable purchase was made.</p><p>Tax Rates The sales tax rate of 6.35% applies to the retail sale, lease, or rental of most goods and taxable services. Canned software transferred with tangible personal property is taxable at 6.35% in all cases. However, see Special Sales Tax Rates Apply to Certain Sales for category-specific exceptions such as short-term motor vehicle rentals.</p>";

test("parseCtRatePage extracts the general rate from its specific anchor sentence", () => {
  assert.equal(parseCtRatePage(CT_PAGE_HTML), 6.35);
});

test("parseCtRatePage rejects a page missing the expected sentence", () => {
  assert.throws(() => parseCtRatePage("<p>Connecticut has a sales tax.</p>"), /does not contain the expected/);
});

test("readOfficialCtRates wires the parsed rate into a snapshot", async () => {
  const fetchImpl = async () => new Response(CT_PAGE_HTML);
  const snapshot = await readOfficialCtRates({ fetchImpl, now: new Date("2026-08-26T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6.35);
});

const MA_PAGE_HTML = "<!-- Massachusetts sales-and-use-tax guide fixture, padded to a realistic page size --><h3>Sales tax</h3><p>The Massachusetts sales tax is <strong>6.25%</strong> of the sales price or rental charge of tangible personal property or certain telecommunications services sold or rented in Massachusetts.</p><h3>Use tax</h3><p>The Massachusetts use tax is <strong>6.25%</strong> of the sales price of tangible personal property purchased outside Massachusetts and used, stored, or consumed within the Commonwealth.</p>";

test("parseMaRatePage cross-validates sales and use tax statements", () => {
  assert.equal(parseMaRatePage(MA_PAGE_HTML), 6.25);
});

test("parseMaRatePage rejects disagreeing sales and use tax statements", () => {
  const html = MA_PAGE_HTML.replace("use tax is <strong>6.25%", "use tax is <strong>6.35%");
  assert.throws(() => parseMaRatePage(html), /disagreeing/);
});

test("readOfficialMaRates wires the parsed rate into a snapshot", async () => {
  const fetchImpl = async () => new Response(MA_PAGE_HTML);
  const snapshot = await readOfficialMaRates({ fetchImpl, now: new Date("2026-08-26T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6.25);
});

const MS_PAGE_HTML = "<!-- Mississippi DOR sales-tax-rates page fixture, padded to a realistic page size --><h1>Retail Sales (Mississippi Code Annotated: Sections 27-65-17, 27-65-20 &amp; 27-65-25)</h1><p>The following are subject to sales tax equal to 7% of the gross proceeds of the retail sales of the business, unless otherwise provided:</p><ul><li>Sale of tangible personal property ...... 7%</li><li>Sales of groceries (food and drink for human consumption eligible to be purchased with Supplemental Nutrition Assistance Program benefits) ...... 5%</li><li>Farm tractors and logging equipment ...... 1.5%</li></ul><h2>Public Utilities (Mississippi Code Annotated: 27-65-19)</h2><p>Electricity and fuels-Commercial use ...... 7%</p><p>Telephone and telegraph ...... 7%</p>";

test("parseMsRatePage extracts the general retail rate, not an unrelated category rate", () => {
  assert.equal(parseMsRatePage(MS_PAGE_HTML), 7);
});

test("parseMsRatePage rejects a page without the Retail Sales line item", () => {
  assert.throws(() => parseMsRatePage("<p>Mississippi sales tax information.</p>"), /does not contain the expected/);
});

test("readOfficialMsRates carries the Jackson/Tupelo caveat", async () => {
  const fetchImpl = async () => new Response(MS_PAGE_HTML);
  const snapshot = await readOfficialMsRates({ fetchImpl, now: new Date("2026-08-26T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 7);
  assert.match(snapshot.caveats[0], /Jackson/);
});
