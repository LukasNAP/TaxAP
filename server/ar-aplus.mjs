import { createHash } from "node:crypto";
import { extractPdfTableText } from "./pdf-utils.mjs";
import { readOfficialSstStateRates } from "./sst-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export const ARKANSAS_RATE_PAGE = "https://www.dfa.arkansas.gov/office/taxes/excise-tax-administration/sales-use-tax/sales-use-tax-rates/city-and-county-sales-use-tax-rates/";
const quarters = [["Jan_Mar", "JANUARY - MARCH"], ["Apr_Jun", "APRIL - JUNE"], ["Jul_Sep", "JULY - SEPTEMBER"], ["Oct_Dec", "OCTOBER - DECEMBER"]];

export function parseArkansasLocalTable(text, { period, stateRate, minimumCities = 300, expectedCounties = 75 } = {}) {
  if (stateRate !== 6.5 || !period || !text.includes(period) || !text.includes("- CITY LIST -") || !text.includes("- COUNTY LIST -")) throw new Error("Arkansas table period or scope changed.");
  const rates = [];
  const seen = new Set();
  let countySection = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, " ");
    if (line === "- COUNTY LIST -") countySection = true;
    if (!/\b\d{2}-\d{2}\b/.test(line)) continue;
    const match = /^(.*?) (\d{2}-\d{2}) (\d{2}\/\d{2}\/\d{2}) (\d+\.\d+)%\s*(.*)$/.exec(line);
    if (!match || seen.has(match[2])) throw new Error("Arkansas location row is malformed or duplicated.");
    const [, name, jurisdictionCode, effectiveDate, component, tail] = match;
    seen.add(jurisdictionCode);
    let localRate = Number(component);
    let county = null;
    if (countySection) {
      if (!name.endsWith(" County") || !jurisdictionCode.endsWith("-00") || tail) throw new Error("Arkansas county row changed.");
    } else {
      const combined = /^(.*?) (\d+\.\d+)% (\d+\.\d+)%$/.exec(tail);
      if (/ See Below Varies$/.test(tail)) {
        localRate = null;
        county = tail.replace(/ See Below Varies$/, "");
      } else if (combined && !combined[1].includes("/")) {
        county = combined[1];
        localRate = Number(combined[3]);
        if (Math.abs(Number(component) + Number(combined[2]) - localRate) > 0.00001) throw new Error("Arkansas local components do not sum to the published total.");
      } else throw new Error("Arkansas city total is unresolved in an unknown format.");
    }
    if (Number(component) > 10 || (localRate !== null && (localRate < 0 || localRate > 10))) throw new Error("Arkansas local rate is invalid.");
    rates.push({ jurisdictionCode, name, county, effectiveDate, jurisdictionType: countySection ? "county" : "city", totalGeneralRate: localRate === null ? null : Number((stateRate + localRate).toFixed(4)) });
  }
  if (rates.filter((r) => r.jurisdictionType === "county").length !== expectedCounties || rates.filter((r) => r.jurisdictionType === "city").length < minimumCities) throw new Error("Arkansas local inventory is incomplete.");
  return rates;
}

export async function readArkansasCombinedRates({ fetchImpl = fetch, now = new Date(), readStateRate = () => readOfficialSstStateRates("AR") } = {}) {
  const year = now.getUTCFullYear();
  const [suffix, label] = quarters[Math.floor(now.getUTCMonth() / 3)];
  const url = `https://www.dfa.arkansas.gov/wp-content/uploads/cityCountyTaxTable_${suffix}_${year}.pdf`;
  const page = await fetchImpl(ARKANSAS_RATE_PAGE, { signal: AbortSignal.timeout(20000) });
  if (!page.ok || !(await page.text()).includes(url)) throw new Error("Arkansas current-quarter table is not published.");
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Arkansas local table is unavailable.");
  const buffer = Buffer.from(await response.arrayBuffer());
  const stateSnapshot = await readStateRate();
  const effectivePeriod = `${label} ${year}`;
  const rates = parseArkansasLocalTable(await extractPdfTableText(buffer), { period: effectivePeriod, stateRate: stateSnapshot.stateRate });
  return { stateCode: "AR", rates, stateRate: stateSnapshot.stateRate, stateSnapshot, effectivePeriod, sourceUrl: ARKANSAS_RATE_PAGE, machineReadableSourceUrl: url, sourceHash: createHash("sha256").update(buffer).digest("hex"), retrievedAt: now.toISOString() };
}

const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export async function readArkansasAplusComparison(stateDetail, { readOfficial = readArkansasCombinedRates } = {}) {
  const officialSnapshot = await readOfficial();
  const byCode = new Map();
  for (const rate of officialSnapshot.rates) {
    if (byCode.has(rate.jurisdictionCode)) throw new Error("Arkansas comparison inventory has duplicate codes.");
    byCode.set(rate.jurisdictionCode, rate);
  }
  const result = reconcileDirectMappingAplus({ stateCode: "AR", stateDetail, matchOfficialRow: (row) => {
    const code = /^AR(\d{2})(\d{2})$/.exec(row.taxBody ?? "");
    if (!code || row.currentRate == null || !Number.isFinite(Number(row.currentRate)) || isRetiredTaxBody(row) || row.definitionStatus === "missing") return null;
    const rate = byCode.get(`${code[1]}-${code[2]}`);
    if (!rate || !Number.isFinite(rate.totalGeneralRate)) return null;
    const name = normalize(row.description).replace(/^arkansas[ -]+/, "").replace(/ co\.?$/, " county");
    return name === normalize(rate.name).replace(/ \(city\)$/, "") ? rate : null;
  } });
  result.totals.comparedShipTos = result.findings.filter((r) => r.matched).reduce((sum, r) => sum + Number(r.activeShipTos || 0), 0);
  return { ...result, officialSnapshot };
}
