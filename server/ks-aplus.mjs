import { createHash } from "node:crypto";
import { readXlsxRows } from "./xlsx-utils.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export const KANSAS_RATE_PAGE = "https://www.ksrevenue.gov/salesratechanges.html";
export function parseKansasCombinedRows(rows, { asOfDate, minimumRows = 700 } = {}) {
  if (!rows.some((r) => r.C === "Business Location and Delivery Sales" && r.M === "Total Tax Rate Non Food")) throw new Error("Kansas general-rate header changed.");
  const rates = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row.A || !/^[A-Z0-9]{5}$/.test(row.C ?? "")) continue;
    const values = [row.D, row.H, row.I, row.J, row.K, row.M].map((v) => v ? Number(v) : NaN);
    const [published, county, city, special, state, total] = values;
    if (!values.every(Number.isFinite) || state !== 0.065 || total < state || total > .2 || Math.abs(published - total) > .000001 || Math.abs(county + city + special + state - total) > .000001 || seen.has(row.C)) throw new Error("Kansas combined rate is invalid or duplicated.");
    const serial = Number(row.G);
    if (!Number.isFinite(serial) || serial < 20000 || serial > 100000) throw new Error("Kansas effective date is invalid.");
    const beginDate = new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
    if (beginDate > asOfDate) throw new Error("Kansas table contains future rates for this comparison.");
    seen.add(row.C);
    rates.push({ jurisdictionCode: row.C, name: row.A, totalGeneralRate: Number((total * 100).toFixed(4)), beginDate, specialDistrict: Boolean(row.O) || special !== 0 });
  }
  if (rates.length < minimumRows) throw new Error("Kansas combined inventory is incomplete.");
  return rates;
}

export async function readKansasCombinedRates({ fetchImpl = fetch, now = new Date() } = {}) {
  const month = Math.floor(now.getUTCMonth() / 3) * 3;
  const year = now.getUTCFullYear();
  const url = `https://www.ksrevenue.gov/pdf/pub1700${String(month + 1).padStart(2, "0")}${String(year).slice(-2)}.xlsx`;
  const page = await fetchImpl(KANSAS_RATE_PAGE, { signal: AbortSignal.timeout(20000) });
  if (!page.ok || !(await page.text()).includes(new URL(url).pathname.slice(1))) throw new Error("Kansas current-quarter workbook is not published.");
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Kansas workbook is unavailable.");
  const buffer = Buffer.from(await response.arrayBuffer());
  const period = `${["January", "April", "July", "October"][month / 3]} 1, ${year}`;
  if (!readXlsxRows(buffer).some((r) => Object.values(r).some((v) => v.includes(`effective ${period}`)))) throw new Error("Kansas workbook effective period changed.");
  const rates = parseKansasCombinedRows(readXlsxRows(buffer, { sheetFile: "sheet2.xml" }), { asOfDate: now.toISOString().slice(0, 10) });
  return { stateCode: "KS", rates, sourceUrl: KANSAS_RATE_PAGE, machineReadableSourceUrl: url, effectivePeriod: period, retrievedAt: now.toISOString(), sourceHash: createHash("sha256").update(buffer).digest("hex") };
}

const normalize = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export async function readKansasAplusComparison(stateDetail, { readOfficial = readKansasCombinedRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byName = new Map();
  for (const rate of officialSnapshot.rates) {
    const name = normalize(rate.name);
    byName.set(name, [...(byName.get(name) ?? []), rate]);
  }
  const result = reconcileDirectMappingAplus({ stateCode: "KS", stateDetail, matchOfficialRow: (row) => {
    const code = /^KS(\d+|[A-Z0-9]{5})$/.exec(row.taxBody ?? "")?.[1];
    if (!code || row.taxBody === "KS000" || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
    const name = normalize(row.description).replace(/^kansas[ -]+/, "").replace(/ co\.?$/, " county");
    const candidates = byName.get(name) ?? [];
    if (candidates.length !== 1) return null;
    const rate = candidates[0];
    if (!Number.isFinite(rate.totalGeneralRate) || (rate.specialDistrict && code !== rate.jurisdictionCode) || (/[^0-9]/.test(code) && code !== rate.jurisdictionCode)) return null;
    return rate;
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, officialSnapshot };
}
