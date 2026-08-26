import assert from "node:assert/strict";
import test from "node:test";
import {
  NJ_UEZ_CAVEAT,
  NJ_USE_TAX_FAQ_URL,
  NJ_RATE_CHANGE_URL,
  parseNjRateStatementHtml,
  parseNjRateChangeHtml,
  readOfficialNjRates,
} from "../server/nj-rates.mjs";

// Realistic pages are far larger than the sentence being tested (nav, boilerplate, other FAQ
// entries) - pad the fixtures so they exercise the adapter's minimum-page-size sanity check
// rather than accidentally staying under it.
const PAGE_BOILERPLATE = `<!doctype html><html><head><title>NJ Division of Taxation</title></head><body>
<nav>${"<a href=\"#\">Link</a>".repeat(40)}</nav>
<header><h1>NJ Division of Taxation</h1></header>
<main>`;
const PAGE_FOOTER = `</main><footer>${"<p>Boilerplate footer text.</p>".repeat(10)}</footer></body></html>`;

function faqFixture({ rate = "6.625", year = "2018", secondStatement } = {}) {
  const first = `<h2>What Is The Sales Tax Rate?</h2><p>The Sales Tax rate is ${rate}% on purchases made in ${year} and after.</p>`;
  const second = secondStatement
    ? `<h2>What Is The Use Tax Rate?</h2><p>The Use Tax rate is the same as our Sales Tax rate: ${secondStatement} on purchases made in ${year} and after.</p>`
    : `<h2>What Is The Use Tax Rate?</h2><p>The Use Tax rate is the same as our Sales Tax rate: ${rate}% on purchases made in ${year} and after.</p>`;
  return `${PAGE_BOILERPLATE}${first}${second}${PAGE_FOOTER}`;
}

function changeFixture({ fromRate = "6.875", toRate = "6.625", date = "January 1, 2018" } = {}) {
  return `${PAGE_BOILERPLATE}<h2>Sales and Use Tax Rate Change</h2><p>The New Jersey Sales and Use Tax rate decreased from ${fromRate}% to ${toRate}% effective ${date}.</p>${PAGE_FOOTER}`;
}

test("parseNjRateStatementHtml extracts the current flat rate and its since-year", () => {
  const statement = parseNjRateStatementHtml(faqFixture());
  assert.deepEqual(statement, { rate: 6.625, sinceYear: 2018 });
});

test("parseNjRateStatementHtml accepts two statements that agree", () => {
  const statement = parseNjRateStatementHtml(faqFixture({ secondStatement: "6.625%" }));
  assert.deepEqual(statement, { rate: 6.625, sinceYear: 2018 });
});

test("parseNjRateStatementHtml throws when the page states no recognizable rate", () => {
  assert.throws(
    () => parseNjRateStatementHtml("<html><body><p>New Jersey collects sales tax.</p></body></html>"),
    /does not contain the expected/,
  );
});

test("parseNjRateStatementHtml throws when the Sales Tax and Use Tax statements disagree", () => {
  assert.throws(
    () => parseNjRateStatementHtml(faqFixture({ secondStatement: "7%" })),
    /disagreeing rates/,
  );
});

test("parseNjRateStatementHtml refuses an implausible rate rather than trusting it", () => {
  assert.throws(() => parseNjRateStatementHtml(faqFixture({ rate: "62.5", secondStatement: "62.5%" })), /implausible/);
});

test("parseNjRateChangeHtml extracts the most recent transition and its effective date", () => {
  const change = parseNjRateChangeHtml(changeFixture());
  assert.deepEqual(change, { fromRate: 6.875, toRate: 6.625, effectiveDate: "2018-01-01" });
});

test("parseNjRateChangeHtml throws when no transition sentence is found", () => {
  assert.throws(
    () => parseNjRateChangeHtml("<html><body><p>Rates have changed over the years.</p></body></html>"),
    /does not describe a recognizable statewide rate transition/,
  );
});

test("parseNjRateChangeHtml throws on a nonsensical zero-change transition", () => {
  assert.throws(() => parseNjRateChangeHtml(changeFixture({ fromRate: "6.625", toRate: "6.625" })), /no actual rate change/);
});

test("parseNjRateChangeHtml throws on an unrecognized date format", () => {
  assert.throws(() => parseNjRateChangeHtml(changeFixture({ date: "1/1/2018" })), /does not describe a recognizable statewide rate transition/);
});

test("readOfficialNjRates wires both pages into a single flat-rate snapshot with no address matching needed", async () => {
  const fetchImpl = async (url) => {
    if (url === NJ_USE_TAX_FAQ_URL) return { ok: true, text: async () => faqFixture() };
    if (url === NJ_RATE_CHANGE_URL) return { ok: true, text: async () => changeFixture() };
    throw new Error(`Unexpected URL: ${url}`);
  };
  const snapshot = await readOfficialNjRates({ fetchImpl, now: new Date("2026-08-26T00:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateCode, "NJ");
  assert.equal(snapshot.stateRate, 6.625);
  assert.equal(snapshot.rates.length, 1);
  assert.deepEqual(snapshot.rates[0], {
    jurisdictionType: "state",
    jurisdictionCode: "NJ",
    name: "New Jersey",
    componentRate: 6.625,
    totalGeneralRate: 6.625,
    generalInterstateRate: 6.625,
    beginDate: "2018-01-01",
    endDate: null,
  });
  assert.deepEqual(snapshot.counts, { counties: 0, cities: 0, specialJurisdictions: 0 });
  assert.match(snapshot.boundaryStatus, /no county or municipal local-option sales tax/);
  assert.match(snapshot.boundaryStatus, /NJ000/);
  assert.deepEqual(snapshot.caveats, [NJ_UEZ_CAVEAT]);
  assert.match(snapshot.caveats[0], /Urban Enterprise Zone/);
});

test("readOfficialNjRates throws when the two official pages disagree on the current rate", async () => {
  const fetchImpl = async (url) => {
    if (url === NJ_USE_TAX_FAQ_URL) return { ok: true, text: async () => faqFixture({ rate: "6.625", secondStatement: "6.625%" }) };
    if (url === NJ_RATE_CHANGE_URL) return { ok: true, text: async () => changeFixture({ toRate: "7" }) };
    throw new Error(`Unexpected URL: ${url}`);
  };
  await assert.rejects(
    readOfficialNjRates({ fetchImpl, now: new Date("2026-08-26T00:00:00Z"), bypassCache: true }),
    /disagree on the current rate/,
  );
});

test("readOfficialNjRates throws when a page returns a non-OK response", async () => {
  const fetchImpl = async (url) => {
    if (url === NJ_USE_TAX_FAQ_URL) return { ok: false, status: 503, text: async () => "" };
    return { ok: true, text: async () => changeFixture() };
  };
  await assert.rejects(
    readOfficialNjRates({ fetchImpl, now: new Date("2026-08-26T00:00:00Z"), bypassCache: true }),
    /HTTP 503/,
  );
});
