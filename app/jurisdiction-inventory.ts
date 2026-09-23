import type { JurisdictionFilterRow } from "./jurisdiction-filters";

export type InventoryRow = JurisdictionFilterRow & {
  id: string;
  officialRate: number | null;
  componentRate: number | null;
  aplusRate: number | null;
  shipTos: number | null;
  effectiveDate: string | null;
  reviewKey: string | null;
};
type Rate = { jurisdictionType: string; jurisdictionCode: string; name: string; totalGeneralRate?: number | null; componentRate?: number | null; beginDate?: string | null; endDate?: string | null };
type Assignment = { taxBody: string | null; description?: string | null; activeShipTos: number; currentRate: number | null };
type Comparison = { taxBody: string; jurisdictionLabel?: string; description?: string | null; activeShipTos: number; officialRate: number | null; aplusRate: number | null; rateDifference: number | null; hasDifference: boolean; matched?: boolean; jurisdictionAssignmentConsistent?: boolean };
export type InventoryPayload = {
  rates?: Rate[];
  findings?: Comparison[];
  taxBodyFindings?: Comparison[];
  stateDetail?: { taxBodies: Assignment[] };
  expectedTaxBody?: string;
  officialRate?: number;
  aplusRate?: number | null;
  comparisonStatus?: string;
  totals?: { comparedShipTos: number };
};
const numeric = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

// Keep published jurisdictions and assigned tax bodies separate: names are not a safe join key.
export function inventoryRows(state: string, official: InventoryPayload | null, comparison: InventoryPayload | null, today: string): InventoryRow[] {
  const base = { stateCode: state, taxBody: "", comparisonStatus: "not-checked", effectiveState: "undated" as const, sourceStatus: "unavailable" as const, reviewStatus: null, officialRate: null, componentRate: null, aplusRate: null, shipTos: null, effectiveDate: null, reviewKey: null };
  const rows: InventoryRow[] = (official?.rates ?? []).filter(rate => !rate.endDate || rate.endDate >= today).map((rate, i) => ({
    ...base, id: `${state}-source-${i}`, jurisdictionName: rate.name, jurisdictionType: rate.jurisdictionType,
    officialRate: numeric(rate.totalGeneralRate), componentRate: numeric(rate.componentRate), sourceStatus: "validated",
    effectiveDate: rate.beginDate ?? null, effectiveState: rate.beginDate ? rate.beginDate > today ? "upcoming" : "current" : "undated",
  }));
  const comparisons = comparison?.findings ?? comparison?.taxBodyFindings ?? [];
  const assigned = comparison?.stateDetail?.taxBodies ?? comparisons.map(row => ({ taxBody: row.taxBody, description: row.description, activeShipTos: row.activeShipTos, currentRate: row.aplusRate }));
  for (const [i, assignment] of assigned.entries()) {
    const match = comparisons.find(row => row.taxBody === assignment.taxBody);
    const flat = !!comparison?.expectedTaxBody && assignment.taxBody === comparison.expectedTaxBody;
    const officialRate = numeric(match?.officialRate ?? (flat ? comparison?.officialRate : null));
    const aplusRate = numeric(match?.aplusRate ?? assignment.currentRate);
    const verified = officialRate !== null && aplusRate !== null && (flat
      ? ["matched", "difference"].includes(comparison?.comparisonStatus ?? "")
      : !!match && match.matched !== false && match.jurisdictionAssignmentConsistent !== false && numeric(match.rateDifference) !== null);
    rows.push({ ...base, id: `${state}-assignment-${i}`, jurisdictionType: "assignment", jurisdictionName: match?.jurisdictionLabel ?? assignment.description ?? assignment.taxBody ?? "Unassigned tax body",
      taxBody: assignment.taxBody ?? "", officialRate: verified ? officialRate : null, aplusRate, shipTos: assignment.activeShipTos,
      comparisonStatus: verified ? (flat ? comparison?.comparisonStatus === "difference" : match?.hasDifference) ? "mismatch" : "matched" : "not-checked",
      sourceStatus: verified ? "validated" : "unavailable", reviewKey: assignment.taxBody ? `${state}-${assignment.taxBody}-current` : null,
    });
  }
  return rows;
}

export function inventoryCsv(rows: InventoryRow[]): string {
  const cells = (values: unknown[]) => values.map(value => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",");
  return [cells(["State", "Jurisdiction", "Type", "Tax body", "Official total %", "Official component %", "A+ %", "Ship-tos", "Comparison", "Effective date", "Source", "Review"]),
    ...rows.map(row => cells([row.stateCode, row.jurisdictionName, row.jurisdictionType, row.taxBody, row.officialRate, row.componentRate, row.aplusRate, row.shipTos, row.comparisonStatus, row.effectiveDate, row.sourceStatus, row.reviewStatus]))].join("\n");
}
