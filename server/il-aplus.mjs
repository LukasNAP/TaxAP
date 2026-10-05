import { createMatchDiagnostics, assignmentGuardReason } from './match-diagnostic.mjs';
import { readOfficialIlRates } from "./il-rates.mjs";
import { reconcileDirectMappingAplus } from "./direct-mapping-aplus.mjs";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";

export async function readIllinoisAplusComparison(stateDetail, { readOfficial = readOfficialIlRates } = {}) {
  const officialSnapshot = await readOfficial();
  const diagnostics = createMatchDiagnostics("IL", officialSnapshot);
  const reject = diagnostics.record;
  if (!Array.isArray(officialSnapshot.addressOverrideLocationIds)) throw new Error("Illinois requires address-override identities before matching.");
  const exact = new Map();
  const prefixes = new Map();
  const add = (id, rate) => {
    if (!/^\d{3}-\d{4}-\d$/.test(id)) throw new Error("Illinois location ID is invalid.");
    const digits = id.replace(/-/g, "");
    if (exact.has(digits)) throw new Error("Illinois location ID is duplicated or conflicts with an override.");
    exact.set(digits, rate);
    const prefix = digits.slice(0, 7);
    prefixes.set(prefix, [...(prefixes.get(prefix) ?? []), digits]);
  };
  for (const rate of officialSnapshot.rates) {
    if (!Number.isFinite(rate.totalGeneralRate) || rate.addressOverride !== false) throw new Error("Illinois comparable rate is invalid or address-specific.");
    add(rate.jurisdictionCode.replace(/^IL:/, ""), rate);
  }
  for (const id of officialSnapshot.addressOverrideLocationIds) add(id, null);
  return {
    ...reconcileDirectMappingAplus({ diagnostics, officialSnapshot, stateCode: "IL", stateDetail, matchOfficialRow: (row) => {
      const digits = /^IL(\d{7,8})$/.exec(row.taxBody ?? "")?.[1];
      if (!digits || row.currentRate == null || !row.description || row.definitionStatus === "missing" || isRetiredTaxBody(row) || /\b(?:equipment|grocery|food|drug|vehicle|lodging|credit)\b/i.test(row.description)) return reject(row, assignmentGuardReason(row));
      const candidates = digits.length === 8 ? [digits] : prefixes.get(digits) ?? [];
      if (candidates.length !== 1) return reject(row, candidates.length ? "multiple_candidates" : "no_candidate", candidates.map(code => exact.get(code)).filter(Boolean), { lookup: digits });
      const rate = exact.get(candidates[0]);
      if (!rate || (rate.beginDate && rate.beginDate > officialSnapshot.asOfDate)) return reject(row, !rate ? exact.has(candidates[0]) ? "address_required" : "no_candidate" : "future_rate", rate ? [rate] : [], { lookup: digits });
      return rate;
    } }),
    officialSnapshot,
  };
}
