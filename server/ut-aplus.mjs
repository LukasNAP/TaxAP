import { createHash } from "node:crypto";
import { readXlsxRows } from "./xlsx-utils.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export const UTAH_RATE_PAGE = "https://tax.utah.gov/business/sales-tax/sales/rates/";
export function parseUtahCombinedRows(rows, { minimumRows = 300 } = {}) {
  const header = rows.findIndex((row) => row.A === "Location" && row.C === "Code" && row.E === "ST*" && row.Z === "Sales Rate");
  if (header < 0) throw new Error("Utah general-rate header changed.");
  const rates = [];
  const seen = new Set();
  for (const row of rows.slice(header + 1)) {
    if (row.A === "Location") break;
    if (!/^\d{2}-\d{3}$/.test(row.C ?? "")) continue;
    const total = Number(row.Z);
    const components = ["E", ..."GHIJKLMNOPQRSTUVWXY"].map((column) => row[column] ? Number(row[column]) : 0);
    if (!row.A || !row.Z || !components.every(Number.isFinite) || total < 0.0485 || total > 0.2 || Math.abs(components.reduce((a, b) => a + b, 0) - total) > 0.000001) throw new Error("Utah general-rate row failed validation.");
    const key = `${row.C}:${row.A}`;
    if (seen.has(key)) throw new Error("Utah location/code pair is duplicated.");
    seen.add(key);
    rates.push({ jurisdictionCode: row.C, name: row.A, totalGeneralRate: Number((total * 100).toFixed(4)) });
  }
  if (rates.length < minimumRows) throw new Error("Utah general inventory is incomplete.");
  return rates;
}

export async function readUtahCombinedRates({ fetchImpl = fetch, now = new Date() } = {}) {
  const year = now.getUTCFullYear();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  const url = `https://files.tax.utah.gov/tax/salestax/rate/${String(year).slice(-2)}q${quarter}combined.xlsx`;
  const options = { signal: AbortSignal.timeout(20000) };
  const page = await fetchImpl(UTAH_RATE_PAGE, options);
  if (!page.ok) throw new Error("Utah rate directory is unavailable.");
  const html = await page.text();
  if (!html.includes(`href="${url}"`)) throw new Error("Utah current-quarter combined workbook is not published.");
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Utah combined workbook is unavailable.");
  const buffer = Buffer.from(await response.arrayBuffer());
  const rates = parseUtahCombinedRows(readXlsxRows(buffer));
  return { stateCode: "UT", rates, sourceUrl: UTAH_RATE_PAGE, machineReadableSourceUrl: url, asOfDate: now.toISOString().slice(0, 10), retrievedAt: now.toISOString(), effectivePeriod: `${year} Q${quarter}`, sourceHash: createHash("sha256").update(buffer).digest("hex") };
}

const normalize = (text) => String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export async function readUtahAplusComparison(stateDetail, { readOfficial = readUtahCombinedRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byCode = new Map();
  for (const rate of officialSnapshot.rates) byCode.set(rate.jurisdictionCode, [...(byCode.get(rate.jurisdictionCode) ?? []), rate]);
  const result = reconcileDirectMappingAplus({ stateCode: "UT", stateDetail, matchOfficialRow: (row) => {
      const digits = /^UT(\d{2})(\d{3})$/.exec(row.taxBody ?? "");
      if (!digits || row.currentRate == null || row.definitionStatus === "missing" || isRetiredTaxBody(row)) return null;
      const name = normalize(row.description).replace(/^utah[ -]+/, "");
      const candidates = (byCode.get(`${digits[1]}-${digits[2]}`) ?? []).filter((rate) => normalize(rate.name) === name);
      return candidates.length === 1 ? candidates[0] : null;
    } });
  result.totals.comparedShipTos = result.findings.filter((row) => row.matched && Number.isFinite(row.aplusRate)).reduce((sum, row) => sum + row.activeShipTos, 0);
  return { ...result, officialSnapshot };
}
