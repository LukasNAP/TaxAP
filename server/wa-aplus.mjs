import { createHash } from "node:crypto";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export const WA_GENERAL_RATE_URL = "https://dor.wa.gov/taxes-rates/sales-use-tax-rates/local-sales-use-tax/local-sales-use-tax-rate-table?items_per_page=All";
const clean = (text) => text.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function parseWashingtonGeneralRates(html, { now = new Date(), minimumRows = 400 } = {}) {
  const period = clean(html).match(/Quarter ([1-4]) - Effective (\w+) (\d+) through (\w+) (\d+), (\d{4})/);
  if (!period) throw new Error("Washington general table has no recognized effective period.");
  const [, quarter, startMonth, startDay, endMonth, endDay, year] = period;
  const q = Number(quarter);
  const start = `${year}-${String(q * 3 - 2).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(Number(year), q * 3, 0)).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  if (startMonth !== months[q * 3 - 3] || endMonth !== months[q * 3 - 1] || Number(startDay) !== 1 || Number(endDay) !== Number(end.slice(-2)) || today < start || today > end) {
    throw new Error("Washington general table is stale, future-dated, or has an invalid quarter.");
  }
  if (/class=["'][^"']*pager__item--next/.test(html)) throw new Error("Washington table is paginated; complete inventory required.");
  const rates = [];
  const codes = new Set();
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => clean(cell[1]));
    if (!cells.length) continue;
    if (cells.length !== 7) throw new Error("Washington general table row schema changed.");
    const [, county, name, code, local, state, total] = cells;
    if (!county || !name || !/^\d{4}$/.test(code) || codes.has(code) || ![local, state, total].every((rate) => /^0?\.\d+$/.test(rate))) {
      throw new Error("Washington general table contains an invalid or duplicate location.");
    }
    if (Number(state) !== 0.065 || Number(local) < 0 || Number(total) > 0.2 || Math.abs(Number(state) + Number(local) - Number(total)) > 0.000001) {
      throw new Error("Washington general rate components failed validation.");
    }
    codes.add(code);
    rates.push({ jurisdictionCode: code, jurisdictionType: "special", name: `${name} (${county} County)`, totalGeneralRate: Number((Number(total) * 100).toFixed(4)), beginDate: start, endDate: end });
  }
  if (rates.length < minimumRows) throw new Error("Washington general table is incomplete.");
  return { stateCode: "WA", stateRate: 6.5, rates, sourceUrl: WA_GENERAL_RATE_URL, retrievedAt: now.toISOString(), asOfDate: today, effectivePeriod: `${start} through ${end}`, sourceHash: createHash("sha256").update(html).digest("hex") };
}

export async function readWashingtonGeneralRates({ fetchImpl = fetch, now = new Date() } = {}) {
  const response = await fetchImpl(WA_GENERAL_RATE_URL, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "TaxAP/0.1 official-rate monitor" } });
  if (!response.ok) throw new Error(`Washington DOR returned HTTP ${response.status}.`);
  return parseWashingtonGeneralRates(await response.text(), { now });
}

export async function readWashingtonAplusComparison(stateDetail, { readOfficial = readWashingtonGeneralRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byCode = new Map(officialSnapshot.rates.map((rate) => [rate.jurisdictionCode, rate]));
  if (byCode.size !== officialSnapshot.rates.length) throw new Error("Washington official location codes are duplicated.");
  return {
    ...reconcileDirectMappingAplus({ stateCode: "WA", stateDetail, matchOfficialRow: (row) => {
      const code = /^WA(\d{4})$/.exec(row.taxBody ?? "")?.[1];
      if (!code || !row.description || row.currentRate == null || row.definitionStatus === "missing" || isRetiredTaxBody(row) || /\b(?:motor|vehicle|lodging|hotel|rental|food|equipment|credit)\b/i.test(row.description)) return null;
      return byCode.get(code) ?? null;
    } }),
    officialSnapshot,
  };
}
