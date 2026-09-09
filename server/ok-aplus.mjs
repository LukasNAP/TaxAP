import { createHash } from "node:crypto";
import { readOfficialSstStateRates } from "./sst-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export const OKLAHOMA_COPO_PAGE = "https://oklahoma.gov/tax/reporting-resources/publications.html";
export const OKLAHOMA_COPO_CSV = "https://oklahoma.gov/content/dam/ok/en/tax/documents/resources/publications/businesses/csv-excel-rates/Currentcsv.csv";
function date(value, fallback) {
  if (value === "00/00/00") return fallback;
  if (/^\d{5}$/.test(value)) return new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000).toISOString().slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export function parseOklahomaCopoCsv(text, { asOfDate = new Date().toISOString().slice(0, 10), minimumLocations = 800, expectedCounties = 77 } = {}) {
  const types = { STS: new Map(), STU: new Map() };
  for (const line of text.split(/\r?\n/)) {
    if (!/^ST[SU],/.test(line)) continue;
    const cells = line.split(",");
    const [type, digits, name] = cells;
    if (cells.length !== 13 || !/^\d{1,4}$/.test(digits) || !name || line.includes('"')) throw new Error("Oklahoma COPO row format changed.");
    const code = digits.padStart(4, "0");
    if (types[type].has(code)) throw new Error("Oklahoma COPO code is duplicated.");
    let rate = null;
    let activePeriods = 0;
    let invalidDate = false;
    for (const offset of [3, 6, 9]) {
      if (!/^\d+(?:\.\d+)?%$/.test(cells[offset])) throw new Error("Oklahoma COPO rate is invalid.");
      const value = Number(cells[offset].slice(0, -1));
      if (value > 10) throw new Error("Oklahoma COPO rate exceeds supported scope.");
      // Completely empty historical slots do not establish a separate zero-rate period.
      if (offset > 3 && cells[offset + 1] === "00/00/00" && cells[offset + 2] === "00/00/00") continue;
      const begin = date(cells[offset + 1], "0001-01-01");
      const end = date(cells[offset + 2], "9999-12-31");
      if (!begin || !end) { invalidDate = true; continue; }
      if (begin <= asOfDate && asOfDate <= end) {
        activePeriods += 1;
        rate = value;
      }
    }
    types[type].set(code, { code, name, rate: !invalidDate && activePeriods === 1 ? rate : null });
  }
  for (const map of Object.values(types)) {
    if (map.size < minimumLocations || [...map.keys()].filter((code) => code !== "0088" && code.endsWith("88")).length !== expectedCounties) throw new Error("Oklahoma COPO inventory is incomplete.");
  }
  const rates = [];
  for (const [code, sales] of types.STS) {
    if (code === "0088") continue;
    const use = types.STU.get(code);
    const countyCode = `${code.slice(0, 2)}88`;
    const salesCounty = types.STS.get(countyCode);
    const useCounty = types.STU.get(countyCode);
    const isCounty = code === countyCode;
    const values = [sales.rate, use?.rate, salesCounty?.rate, useCounty?.rate];
    const comparable = values.every(Number.isFinite) && sales.name === use?.name && sales.rate === use.rate && salesCounty.rate === useCounty.rate;
    rates.push({ jurisdictionCode: code, name: sales.name, totalGeneralRate: comparable ? Number((4.5 + sales.rate + (isCounty ? 0 : salesCounty.rate)).toFixed(4)) : null });
  }
  return rates;
}

export async function readOklahomaCombinedRates({ fetchImpl = fetch, readSst = () => readOfficialSstStateRates("OK"), now = new Date() } = {}) {
  const page = await fetchImpl(OKLAHOMA_COPO_PAGE, { signal: AbortSignal.timeout(20000) });
  if (!page.ok || !(await page.text()).includes(new URL(OKLAHOMA_COPO_CSV).pathname)) throw new Error("Oklahoma COPO directory is unavailable or changed.");
  const response = await fetchImpl(OKLAHOMA_COPO_CSV, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Oklahoma COPO CSV is unavailable.");
  const text = await response.text();
  const sstSnapshot = await readSst();
  if (sstSnapshot.stateRate !== 4.5) throw new Error("Oklahoma state rate changed.");
  const rates = parseOklahomaCopoCsv(text, { asOfDate: now.toISOString().slice(0, 10) });
  return { stateCode: "OK", rates, sstSnapshot, sourceUrl: OKLAHOMA_COPO_PAGE, machineReadableSourceUrl: OKLAHOMA_COPO_CSV, retrievedAt: now.toISOString(), sourceHash: createHash("sha256").update(text).digest("hex") };
}

const normalize = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export async function readOklahomaAplusComparison(stateDetail, { readOfficial = readOklahomaCombinedRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byCode = new Map(officialSnapshot.rates.map((r) => [r.jurisdictionCode, r]));
  if (byCode.size !== officialSnapshot.rates.length) throw new Error("Oklahoma comparison codes are duplicated.");
  const result = reconcileDirectMappingAplus({ stateCode: "OK", stateDetail, matchOfficialRow: (row) => {
    const code = /^OK(\d{4})$/.exec(row.taxBody ?? "")?.[1];
    if (!code || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || isRetiredTaxBody(row) || row.definitionStatus === "missing") return null;
    const rate = byCode.get(code);
    if (!rate || !Number.isFinite(rate.totalGeneralRate)) return null;
    const name = normalize(row.description).replace(/^oklahoma[ -]+/, "").replace(/ co\.?$/, " county");
    return name === normalize(rate.name) ? rate : null;
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, officialSnapshot };
}
