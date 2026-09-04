import assert from "node:assert/strict";
import test from "node:test";
import { parseMaineRateTable } from "../server/me-rates.mjs";
import { parseConnecticutRateRules } from "../server/ct-rates.mjs";
import { parseMassachusettsRateRules } from "../server/ma-rates.mjs";
import { parseMississippiGeneralRate } from "../server/ms-rates.mjs";

test("flat-state parser contracts remain available to the shared A+ reconciler", () => {
  const maine = `<table><tr><th>Rate Type</th><th>Effective 10/01/2013</th><th>Effective 01/01/2016</th><th>Effective 10/01/2019</th><th>Effective 01/01/2026</th></tr><tr><td>General Sales</td><td>5.5%</td><td>5.5%</td><td>5.5%</td><td>5.5%</td></tr><tr><td>Use Tax</td><td>5.5%</td><td>5.5%</td><td>5.5%</td><td>5.5%</td></tr></table>`;
  assert.equal(parseMaineRateTable(maine).generalRate, 5.5);

  const connecticut = `<p>The sales tax rate of 6.35% applies to the retail sale, lease, or rental of most goods.</p><p>There are no additional sales taxes imposed by local jurisdictions in Connecticut.</p>`;
  assert.equal(parseConnecticutRateRules(connecticut).generalRate, 6.35);

  const massachusetts = `<p>Updated: May 7, 2026</p><p>The Massachusetts sales tax is 6.25% of the sales price.</p><p>The Massachusetts use tax is 6.25% of the sales price.</p>`;
  assert.equal(parseMassachusettsRateRules(massachusetts).salesRate, 6.25);

  const mississippi = `<p>Sale of tangible personal property ...... 7%</p>`;
  assert.equal(parseMississippiGeneralRate(mississippi).generalRate, 7);
});
