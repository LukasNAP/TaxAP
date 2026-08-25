import assert from "node:assert/strict";
import test from "node:test";
import { parseCaliforniaRatesHtml, readOfficialCaRates } from "../server/ca-rates.mjs";
import { parseFloridaSurtaxWorkbook, readOfficialFlRates } from "../server/fl-rates.mjs";
import { parseTexasCityRatesHtml, parseTexasRateText, readOfficialTxRates } from "../server/tx-rates.mjs";

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

test("validates California's effective-dated city and county table", async () => {
  const parsed = parseCaliforniaRatesHtml(caHtml, { expectedCountyCount: 2 });
  assert.equal(parsed.effectiveDate, "2026-07-01");
  assert.equal(parsed.rates.length, 3);
  assert.equal(parsed.rates.find((row) => row.name === "Albany").totalGeneralRate, 10.75);
  assert.throws(() => parseCaliforniaRatesHtml(caHtml.replaceAll("Alpine", "Alameda"), { expectedCountyCount: 2 }), /duplicate|covers/);
  const snapshot = await readOfficialCaRates({ fetchImpl: async () => new Response(caHtml.padEnd(50_001, " ")), now: new Date("2026-08-25T12:00:00Z"), bypassCache: true }).catch((error) => error);
  assert.match(snapshot.message, /58/);
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
