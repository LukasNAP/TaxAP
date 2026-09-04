import assert from "node:assert/strict";
import test from "node:test";
import { parseCaliforniaRatesHtml, readOfficialCaRates } from "../server/ca-rates.mjs";
import { parseConnecticutRateRules, readOfficialCtRates } from "../server/ct-rates.mjs";
import { parseDistrictOfColumbiaRateSchedule, readOfficialDcRates } from "../server/dc-rates.mjs";
import { parseFloridaSurtaxWorkbook, readOfficialFlRates } from "../server/fl-rates.mjs";
import { IDAHO_LOCAL_TAX_CITIES, IDAHO_TAX_COMMISSION_CITY_TAX_URL, IDAHO_TAX_COMMISSION_RATES_URL, parseIdahoRateRules, readOfficialIdRates } from "../server/id-rates.mjs";
import { HAWAII_COUNTY_SURCHARGE_URL, HAWAII_GET_URL, HAWAII_SURCHARGE_EXEMPTIONS_URL, parseHawaiiGetRules, readOfficialHiRates } from "../server/hi-rates.mjs";
import { parseMaineRateTable, readOfficialMeRates } from "../server/me-rates.mjs";
import { parseMassachusettsRateRules, readOfficialMaRates } from "../server/ma-rates.mjs";
import { MISSISSIPPI_DOR_RATES_URL, MISSISSIPPI_JACKSON_TAX_URL, MISSISSIPPI_TUPELO_TAX_URL, parseMississippiGeneralRate, parseMississippiJacksonTax, parseMississippiTupeloTax, readOfficialMsRates } from "../server/ms-rates.mjs";
import { parseTexasCityRatesHtml, parseTexasRateText, readOfficialTxRates } from "../server/tx-rates.mjs";
import { parseVirginiaRateWorkbook } from "../server/va-rates.mjs";
import { findLatestAlaskaWorkbook, parseAlaskaPolicy, parseAlaskaRateWorkbook, readOfficialAkRates } from "../server/ak-rates.mjs";

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return ~crc >>> 0;
}

function buildStoredZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    const localEntry = Buffer.concat([local, nameBuffer, data]);
    locals.push(localEntry);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuffer]));
    offset += localEntry.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(centrals.length, 8);
  eocd.writeUInt16LE(centrals.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, eocd]);
}

const caHtml = `
  <h1>California City &amp; County Sales &amp; Use Tax Rates (effective July 1, 2026)</h1>
  <p>Data Last Updated: 4/1/2026</p>
  <table id="ratesTable"><tbody>
    <tr><td>Alameda County</td><td>10.250%</td><td>Alameda</td><td>County</td><td></td></tr>
    <tr><td>Albany</td><td>10.750%</td><td>Alameda</td><td>City</td><td></td></tr>
    <tr><td>Alpine County</td><td>7.250%</td><td>Alpine</td><td>County</td><td></td></tr>
  </tbody></table>`;

const txText = [
  "1\t20263\t202609\t2026 - 3rd\t0.0625\t0\t4",
  "20263\tq\t10/20/2026\t\t\t\t\t\t\t\t\t",
  "Abbott\t2109064\t0.015\tHill\t4109000\t0.005\tn/a\tn/a\t0\tn/a\tn/a\t0",
  "Easton\t2092090\t0.01\tRusk\tn/a\t0\tRusk ESD 1\t5201524\t0.02\tn/a\tn/a\t0",
].join("\n");

const txHtml = `<table>
  <tr><th scope="row">Abbott</th><td>2109064</td><td>.015000</td><td>.082500</td></tr>
  <tr><th scope="row" class="indent">Hill Co</th><td>4109000</td><td>.005000</td><td>&nbsp;</td></tr>
  <tr><th scope="row">Easton (Rusk Co)</th><td>2092090</td><td>.010000</td><td>.072500</td></tr>
</table>`;

function floridaWorkbook() {
  const strings = ["State of Florida", "County", "Total Surtax Rate", "ALACHUA", "1.50%", "BAKER", "1.00%", "Rates shown above are current as of 8/25/2026"];
  const shared = `<sst>${strings.map((value) => `<si><t>${value}</t></si>`).join("")}</sst>`;
  const sheet = `<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c></row>
    <row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c></row>
    <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="s"><v>4</v></c></row>
    <row r="4"><c r="A4" t="s"><v>5</v></c><c r="B4" t="s"><v>6</v></c></row>
    <row r="5"><c r="A5" t="s"><v>7</v></c></row>
  </sheetData></worksheet>`;
  return buildStoredZip({ "xl/sharedStrings.xml": shared, "xl/worksheets/sheet1.xml": sheet });
}

function virginiaWorkbook() {
  const headers = [
    "State Code (FIPS)", "County or City Code (FIPS)", "Locality Name", "Total General Sales Tax",
    "Total Food & Personal Hygiene Sales Tax", "State General Sales Tax", "State Regional Sales Tax (NVA)",
    "State Regional Sales Tax (HR)", "State Regional Sales Tax (CVA)", "State Regional Sales Tax (HT)",
    "Local Sales Tax", "Additional Local Option Sales Tax",
  ];
  const column = (index) => String.fromCharCode(65 + index);
  const textCell = (reference, value) => `<c r="${reference}" t="inlineStr"><is><t>${value.replaceAll("&", "&amp;")}</t></is></c>`;
  const numberCell = (reference, value) => `<c r="${reference}"><v>${value}</v></c>`;
  const headerRow = headers.map((value, index) => textCell(`${column(index)}3`, value)).join("");
  const county = [
    textCell("A4", "51"), textCell("B4", "001"), textCell("C4", "Alpha County"), numberCell("D4", 0.053),
    numberCell("E4", 0.01), numberCell("F4", 0.043), numberCell("K4", 0.01),
  ].join("");
  const city = [
    textCell("A5", "51"), textCell("B5", "510"), textCell("C5", "Beta City"), numberCell("D5", 0.07),
    numberCell("E5", 0.01), numberCell("F5", 0.043), numberCell("G5", 0.007), numberCell("J5", 0.01), numberCell("K5", 0.01),
  ].join("");
  const sheet = `<worksheet><sheetData><row r="3">${headerRow}</row><row r="4">${county}</row><row r="5">${city}</row></sheetData></worksheet>`;
  return buildStoredZip({ "xl/sharedStrings.xml": "<sst></sst>", "xl/worksheets/sheet1.xml": sheet });
}

function alaskaWorkbook() {
  const headers = [
    "Borough / Census Tract Name", "Borough Tax Rate", "Tax Filing Code", "Date adopted Remote Sellers Code",
    "Remote Sellers Tax Collection Start Date", "Tax Rate Effective Date", "City/Taxing Area",
    "City / Taxing Area Sales Tax Rate", "Tax Filing Code", "Date adopted Remote Sellers Code",
    "Remote Sellers Tax Collection Start Date", "Tax Rate Effective Date", "Sales Tax Rate Total",
  ];
  const textCell = (reference, value) => `<c r="${reference}" t="inlineStr"><is><t>${value}</t></is></c>`;
  const numberCell = (reference, value) => `<c r="${reference}"><v>${value}</v></c>`;
  const columns = "ABCDEFGHIJKLM";
  const header = headers.map((value, index) => textCell(`${columns[index]}4`, value)).join("");
  const rows = [];
  for (let index = 0; index < 10; index++) {
    const rowNumber = index + 5;
    rows.push(`<row r="${rowNumber}">${textCell(`A${rowNumber}`, `Borough ${String.fromCharCode(65 + index)}`)}${numberCell(`B${rowNumber}`, 0.03)}${numberCell(`C${rowNumber}`, 800000 + index)}${textCell(`F${rowNumber}`, "4/1/2026")}${numberCell(`M${rowNumber}`, 0.03)}</row>`);
  }
  for (let index = 0; index < 46; index++) {
    const rowNumber = index + 15;
    const borough = index === 0 ? 0.03 : 0;
    const city = index === 0 ? 0.04 : 0.05;
    rows.push(`<row r="${rowNumber}">${textCell(`A${rowNumber}`, "Test Census Area")}${numberCell(`B${rowNumber}`, borough)}${textCell(`G${rowNumber}`, `City ${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`)}${numberCell(`H${rowNumber}`, city)}${numberCell(`I${rowNumber}`, 9000 + index)}${textCell(`L${rowNumber}`, "9/1/2026")}${numberCell(`M${rowNumber}`, borough + city)}</row>`);
  }
  const note = "Note: The State of Alaska does not have a state level remote sellers sales tax.";
  const sheet = `<worksheet><sheetData><row r="1">${textCell("M1", "As of 9/1/2026")}</row><row r="3">${textCell("A3", note)}</row><row r="4">${header}</row>${rows.join("")}</sheetData></worksheet>`;
  return buildStoredZip({ "xl/sharedStrings.xml": "<sst></sst>", "xl/worksheets/sheet1.xml": sheet });
}

test("connects Alaska's current local-only ARSSTC destination rates without inventing a state tax", async () => {
  const policy = "<main>The State of Alaska does NOT levy a sales tax. Several local municipalities within the state do levy a sales tax.</main>";
  assert.deepEqual(parseAlaskaPolicy(policy), { stateRate: 0, hasLocalSalesTax: true });
  assert.throws(() => parseAlaskaPolicy(policy.replace("does NOT levy", "does levy")), /no longer confirms/);
  const latest = findLatestAlaskaWorkbook('<a href="/old/ARSSTC-Sales-Tax-Rate-Sheet-8-1-26.xlsx">old</a><a href="/new/ARSSTC-Sales-Tax-Rate-Sheet-9-1-26.xlsx">new</a>');
  assert.equal(latest.date, "2026-09-01");
  const workbook = alaskaWorkbook();
  const parsed = parseAlaskaRateWorkbook(workbook);
  assert.equal(parsed.asOfDate, "2026-09-01");
  assert.deepEqual(parsed.counts, { counties: 10, cities: 46, specialJurisdictions: 0 });
  assert.equal(parsed.rates.find((rate) => rate.jurisdictionCode === "AK:9000").totalGeneralRate, 7);
  const ratesPage = '<a href="https://arsstc.org/files/ARSSTC-Sales-Tax-Rate-Sheet-9-1-26.xlsx">current</a>';
  const snapshot = await readOfficialAkRates({
    fetchImpl: async (url) => String(url).endsWith(".xlsx") ? new Response(workbook) : new Response(ratesPage),
    now: new Date("2026-09-03T12:00:00Z"), bypassCache: true,
  });
  assert.equal(snapshot.stateRate, 0);
  assert.equal(snapshot.rates.length, 57);
  assert.match(snapshot.boundaryStatus, /does not cover every Alaska municipality/);
});

test("validates California's effective-dated city and county table", async () => {
  const parsed = parseCaliforniaRatesHtml(caHtml, { expectedCountyCount: 2 });
  assert.equal(parsed.effectiveDate, "2026-07-01");
  assert.equal(parsed.rates.length, 3);
  assert.equal(parsed.rates.find((row) => row.name === "Albany").totalGeneralRate, 10.75);
  assert.throws(() => parseCaliforniaRatesHtml(caHtml.replaceAll("Alpine", "Alameda"), { expectedCountyCount: 2 }), /duplicate|covers/);
  const snapshot = await readOfficialCaRates({ fetchImpl: async () => new Response(caHtml.padEnd(50_001, " ")), now: new Date("2026-08-25T12:00:00Z"), bypassCache: true }).catch((error) => error);
  assert.match(snapshot.message, /58/);
});

test("validates Connecticut's flat general rate and explicit absence of local sales tax", async () => {
  const officialHtml = `<main><p>The sales tax rate of 6.35% applies to the retail sale, lease, or rental of most goods.</p><p>There are no additional sales taxes imposed by local jurisdictions in Connecticut.</p></main>`.padEnd(5_001, " ");
  assert.deepEqual(parseConnecticutRateRules(officialHtml), { generalRate: 6.35, hasLocalSalesTax: false });
  assert.throws(() => parseConnecticutRateRules(officialHtml.replace("6.35%", "6.50%")), /changed from/);
  assert.throws(() => parseConnecticutRateRules(officialHtml.replace("There are no additional sales taxes", "Local sales taxes may apply")), /no longer confirms/);
  const snapshot = await readOfficialCtRates({ fetchImpl: async () => new Response(officialHtml), now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6.35);
  assert.equal(snapshot.rates.length, 1);
  assert.equal(snapshot.counts.counties, 0);
});

test("validates D.C.'s current rate and scheduled October 2026 increase", async () => {
  const officialHtml = `<main><p>Sales and Use Tax: Sales Tax Increase Delay Amendment Act of 2025: The general sales tax rate on the gross receipts from the sale of or charges for tangible personal property, digital goods and taxable services, will remain 6.0% through Sept. 30, 2026. The general sales tax rate will increase to 7.0% for periods beginning on and after Oct. 1, 2026.</p></main>`.padEnd(20_001, " ");
  assert.deepEqual(parseDistrictOfColumbiaRateSchedule(officialHtml), { currentRate: 6, currentEndDate: "2026-09-30", futureRate: 7, futureEffectiveDate: "2026-10-01" });
  assert.throws(() => parseDistrictOfColumbiaRateSchedule(officialHtml.replace("7.0%", "7.5%")), /changed from/);
  const current = await readOfficialDcRates({ fetchImpl: async () => new Response(officialHtml), now: new Date("2026-09-03T12:00:00Z"), bypassCache: true });
  assert.equal(current.stateRate, 6);
  assert.equal(current.rates[0].endDate, "2026-09-30");
  assert.equal(current.futureChanges[0].futureRate, 7);
  const future = await readOfficialDcRates({ fetchImpl: async () => new Response(officialHtml), now: new Date("2026-10-01T12:00:00Z"), bypassCache: true });
  assert.equal(future.stateRate, 7);
  assert.equal(future.rates[0].beginDate, "2026-10-01");
  assert.deepEqual(future.futureChanges, []);
});

test("validates Maine's current statewide general and use-tax rates", async () => {
  const officialHtml = `<table><tr><th>Rate Type</th><th>Effective 10/01/2013</th><th>Effective 01/01/2016</th><th>Effective 10/01/2019</th><th>Effective 01/01/2026</th></tr><tr><td>General Sales</td><td>5.5%</td><td>5.5%</td><td>5.5%</td><td>5.5%</td></tr><tr><td>Use Tax</td><td>5.5%</td><td>5.5%</td><td>5.5%</td><td>5.5%</td></tr></table>`.padEnd(5_001, " ");
  assert.deepEqual(parseMaineRateTable(officialHtml), { generalRate: 5.5, useTaxRate: 5.5, effectiveDate: "2026-01-01" });
  assert.throws(() => parseMaineRateTable(officialHtml.replaceAll("5.5%", "6%")), /changed from/);
  const snapshot = await readOfficialMeRates({ fetchImpl: async () => new Response(officialHtml), now: new Date("2026-09-02T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 5.5);
  assert.equal(snapshot.rates[0].generalInterstateRate, 5.5);
});

test("validates Massachusetts's matching statewide sales and use-tax rates", async () => {
  const officialHtml = `<main><p>Updated: May 7, 2026</p><p>The Massachusetts sales tax is <strong>6.25%</strong> of the sales price or rental charge of tangible personal property.</p><p>The Massachusetts use tax is <strong>6.25%</strong> of the sales price or rental charge on tangible personal property.</p></main>`.padEnd(20_001, " ");
  assert.deepEqual(parseMassachusettsRateRules(officialHtml), { salesRate: 6.25, useTaxRate: 6.25, updatedDate: "2026-05-07" });
  assert.throws(() => parseMassachusettsRateRules(officialHtml.replaceAll("6.25%", "6.5%")), /changed from/);
  const snapshot = await readOfficialMaRates({ fetchImpl: async () => new Response(officialHtml), now: new Date("2026-09-03T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6.25);
  assert.equal(snapshot.asOfDate, "2026-05-07");
});

test("validates Mississippi's general rate and two general-retail city levies", async () => {
  const generalHtml = `<main><p>The following are subject to sales tax equal to 7% of the gross proceeds.</p><p>Sale of tangible personal property ...... 7%</p></main>`.padEnd(20_001, " ");
  const jacksonHtml = `<main><p>A 1% tax is imposed on every person making sales of tangible personal property or services within the municipality.</p><p>Effective March 1, 2014. Repeal date July 1, 2035.</p></main>`.padEnd(20_001, " ");
  const tupeloHtml = `<main><p>A .25% tax is imposed on all retail sales and services in Tupelo which are subject to the general rate of state sales tax.</p><p>Beginning May 1, 2026, the tax applies to the general seven percent (7%) rate.</p></main>`.padEnd(20_001, " ");
  assert.deepEqual(parseMississippiGeneralRate(generalHtml), { generalRate: 7 });
  assert.deepEqual(parseMississippiJacksonTax(jacksonHtml), { componentRate: 1, beginDate: "2014-03-01", endDate: "2035-06-30" });
  assert.deepEqual(parseMississippiTupeloTax(tupeloHtml), { componentRate: 0.25, beginDate: "1989-02-01", endDate: null, scopeConfirmedDate: "2026-05-01" });
  assert.throws(() => parseMississippiGeneralRate(generalHtml.replaceAll("7%", "8%")), /changed from/);
  const pages = new Map([[MISSISSIPPI_DOR_RATES_URL, generalHtml], [MISSISSIPPI_JACKSON_TAX_URL, jacksonHtml], [MISSISSIPPI_TUPELO_TAX_URL, tupeloHtml]]);
  const snapshot = await readOfficialMsRates({ fetchImpl: async (url) => new Response(pages.get(String(url))), now: new Date("2026-09-03T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 7);
  assert.equal(snapshot.rates.find((row) => row.name === "Jackson").totalGeneralRate, 8);
  assert.equal(snapshot.rates.find((row) => row.name === "Tupelo").totalGeneralRate, 7.25);
  assert.equal(snapshot.counts.cities, 2);
});

test("validates Texas control records separately from official combined totals", async () => {
  const components = parseTexasRateText(txText);
  assert.equal(components.stateRate, 6.25);
  assert.equal(components.effectiveDate, "2026-07-01");
  assert.equal(components.rates[1].totalGeneralRate, null);
  const totals = parseTexasCityRatesHtml(txHtml, { minimumRows: 2 });
  assert.equal(totals[0].totalGeneralRate, 8.25);
  assert.equal(totals[1].totalGeneralRate, 7.25);
  const fetchImpl = async (url) => new Response(String(url).endsWith("taxrates.txt") ? txText.padEnd(100_001, "\n") : txHtml.padEnd(100_001, " "));
  const snapshot = await readOfficialTxRates({ fetchImpl, now: new Date("2026-08-25T12:00:00Z"), bypassCache: true }).catch((error) => error);
  assert.match(snapshot.message, /only 2/);
});

test("reads Florida's current 67-county download format without accepting missing counties", async () => {
  const workbook = floridaWorkbook();
  const parsed = parseFloridaSurtaxWorkbook(workbook, { expectedCounties: ["ALACHUA", "BAKER"] });
  assert.equal(parsed.asOfDate, "2026-08-25");
  assert.equal(parsed.rates.find((row) => row.county === "ALACHUA").totalGeneralRate, 7.5);
  assert.throws(() => parseFloridaSurtaxWorkbook(workbook, { expectedCounties: ["ALACHUA", "BAKER", "BAY"] }), /missing BAY/);
  const getHtml = '<input type="hidden" name="__VIEWSTATE" value="state"><input type="hidden" name="__EVENTVALIDATION" value="event">';
  const paddedWorkbook = Buffer.concat([workbook, Buffer.alloc(3_001)]);
  const fetchImpl = async (_url, options = {}) => options.method === "POST" ? new Response(paddedWorkbook) : new Response(getHtml);
  const snapshot = await readOfficialFlRates({ fetchImpl, now: new Date("2026-08-25T12:00:00Z"), bypassCache: true }).catch((error) => error);
  assert.match(snapshot.message, /missing/);
});

test("validates Idaho's statewide rate without inventing decentralized resort-city rates", async () => {
  const rateHtml = `<main><p>Idaho’s sales tax rate is 6%. Idaho’s use tax rate is also 6%.</p></main>`.padEnd(20_001, " ");
  const cityHtml = `<main><p>Some Idaho resort cities have a local sales tax in addition to the state sales tax.</p><p>Contact the following cities directly for questions about their local sales tax:</p><ul>${IDAHO_LOCAL_TAX_CITIES.map((city) => `<li>${city}</li>`).join("")}</ul></main>`.padEnd(20_001, " ");
  const parsed = parseIdahoRateRules(rateHtml, cityHtml);
  assert.equal(parsed.generalRate, 6);
  assert.equal(parsed.localTaxCities.length, 23);
  assert.throws(() => parseIdahoRateRules(rateHtml, cityHtml.replace("Victor", "Elsewhere")), /missing: Victor/);
  const pages = new Map([[IDAHO_TAX_COMMISSION_RATES_URL, rateHtml], [IDAHO_TAX_COMMISSION_CITY_TAX_URL, cityHtml]]);
  const snapshot = await readOfficialIdRates({ fetchImpl: async (url) => new Response(pages.get(String(url))), now: new Date("2026-09-03T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.stateRate, 6);
  assert.equal(snapshot.rates.length, 1);
  assert.equal(snapshot.unavailableLocalJurisdictions.length, 23);
});

test("models Hawaii GET as an optional seller-tax pass-on, not a conventional sales-tax mismatch", async () => {
  const getHtml = `<main><p>GET is NOT a sales tax. GET is a tax on the business itself.</p><table><tr><td>Selling retail goods and services</td><td>4.5%*</td></tr></table></main>`.padEnd(20_001, " ");
  const surchargeHtml = `<main><p>Businesses may choose to pass on the GET and any applicable county surcharge to its customers but are not required to do so.</p><ul><li>City and County of Honolulu: 4.7120%</li><li>County of Hawaii: 4.7120%</li><li>County of Kauai: 4.7120%</li><li>County of Maui: 4.7120%</li></ul></main>`.padEnd(20_001, " ");
  const exemptionsHtml = `<main><p>Kalawao County Sales: Sales to Kalawao county is not subject to the county surcharge.</p></main>`.padEnd(20_001, " ");
  const parsed = parseHawaiiGetRules(getHtml, surchargeHtml, exemptionsHtml);
  assert.equal(parsed.baseRate, 4);
  assert.equal(parsed.maximumPassOnRate, 4.712);
  assert.throws(() => parseHawaiiGetRules(getHtml, surchargeHtml.replace("but are not required", "and are required"), exemptionsHtml), /optional/);
  const pages = new Map([[HAWAII_GET_URL, getHtml], [HAWAII_COUNTY_SURCHARGE_URL, surchargeHtml], [HAWAII_SURCHARGE_EXEMPTIONS_URL, exemptionsHtml]]);
  const snapshot = await readOfficialHiRates({ fetchImpl: async (url) => new Response(pages.get(String(url))), now: new Date("2026-09-03T12:00:00Z"), bypassCache: true });
  assert.equal(snapshot.policyModel, "seller-side-get-optional-pass-on");
  assert.equal(snapshot.rates.length, 5);
  assert.equal(snapshot.rates.find((row) => row.jurisdictionCode === "KALAWAO").totalGeneralRate, 4);
});

test("validates Virginia's locality workbook by FIPS and reconciles every rate component", () => {
  const workbook = virginiaWorkbook();
  const parsed = parseVirginiaRateWorkbook(workbook, { expectedLocalities: 2, expectedCounties: 1, expectedCities: 1 });
  assert.deepEqual(parsed.counts, { counties: 1, cities: 1, specialJurisdictions: 0 });
  assert.equal(parsed.rates.find((row) => row.name === "Alpha County").jurisdictionCode, "51001");
  assert.equal(parsed.rates.find((row) => row.name === "Beta City").totalGeneralRate, 7);
  const broken = Buffer.from(workbook);
  assert.throws(
    () => parseVirginiaRateWorkbook(broken, { expectedLocalities: 3, expectedCounties: 1, expectedCities: 2 }),
    /2 localities instead of 3/,
  );
});
