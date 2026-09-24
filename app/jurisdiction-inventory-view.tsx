"use client";

import { formatRate, formatRateText } from "./rate-format";
import { useEffect, useMemo, useState } from "react";
import { inventoryCsv, inventoryRows, type InventoryPayload, type InventoryRow } from "./jurisdiction-inventory";
import { matchesJurisdictionFilters, type JurisdictionFilters } from "./jurisdiction-filters";
import { STATE_NAME_BY_CODE } from "./tax-body-policy";

const initialFilters: JurisdictionFilters = { query: "", state: "all", jurisdictionType: "all", comparison: "all", effective: "all", source: "all", review: "all" };
const noGeneralTax = new Set(["DE", "MT", "NH", "OR"]);
const states = [...STATE_NAME_BY_CODE].sort((a, b) => a[1].localeCompare(b[1]));
const labels: Record<string, string> = { matched: "A+ matches", "recent-match": "Recent change matched", mismatch: "A+ differs", upcoming: "Upcoming change", "not-checked": "Not checked", state: "State", county: "County", city: "City", special: "Special", assignment: "A+ assignment", unreviewed: "Unreviewed", new: "New", in_review: "In review", approved: "Approved", resolved: "Resolved", not_applicable: "Not applicable", validated: "Available", unavailable: "Unavailable", current: "Current", undated: "Date unavailable" };
const rate = (value: number | null) => value === null ? "—" : formatRate(value);

export function JurisdictionInventoryView({ ncRows, apiBase, offline, comparisonStates, reviews, onOpen }: {
  ncRows: InventoryRow[]; apiBase: string; offline: boolean; comparisonStates: string;
  reviews: Map<string, { status: InventoryRow["reviewStatus"] }>;
  onOpen: (row: InventoryRow) => void;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState("ship-tos");
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, { rows: InventoryRow[]; errors: string[] }>>({});
  useEffect(() => {
    if (offline) return;
    const controller = new AbortController();
    const pending = states.map(([state]) => state).filter(state => state !== "NC" && !noGeneralTax.has(state));
    const supported = new Set(comparisonStates.split(","));
    async function read(path: string): Promise<InventoryPayload> {
      const response = await fetch(`${apiBase}${path}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]) });
      if (!response.ok) throw new Error("Unavailable");
      return response.json();
    }
    async function worker() {
      while (pending.length && !controller.signal.aborted) {
        const state = pending.shift()!;
        const errors: string[] = [];
        let official: InventoryPayload | null = null;
        let comparison: InventoryPayload | null = null;
        try { official = await read(`/api/official/states/${state}`); if (!Array.isArray(official.rates)) throw new Error("Missing inventory"); }
        catch { official = null; errors.push("official inventory"); }
        if (supported.has(state) && !controller.signal.aborted) {
          try {
            comparison = await read(`/api/official/states/${state}/${state === "GA" ? "boundary" : "aplus"}`);
            if (!Array.isArray(comparison.stateDetail?.taxBodies) && !Array.isArray(comparison.taxBodyFindings)) throw new Error("Missing comparisons");
          }
          catch { comparison = null; errors.push("A+ comparison"); }
        }
        if (!controller.signal.aborted) {
          const rows = inventoryRows(state, official, comparison, new Date().toISOString().slice(0, 10));
          setLoaded(previous => ({ ...previous, [state]: { rows, errors } }));
        }
      }
    }
    void Promise.all([worker(), worker(), worker()]);
    return () => controller.abort();
  }, [apiBase, offline, comparisonStates, refresh]);
  const rows = useMemo(() => [...ncRows, ...Object.values(loaded).flatMap(value => value.rows)].map(row => ({ ...row, reviewStatus: row.reviewKey ? reviews.get(row.reviewKey)?.status ?? null : null })), [ncRows, loaded, reviews]);
  const filtered = useMemo(() => rows.filter(row => matchesJurisdictionFilters(row, filters)).sort((a, b) => sort === "ship-tos"
    ? (b.shipTos ?? -1) - (a.shipTos ?? -1) || a.jurisdictionName.localeCompare(b.jurisdictionName)
    : sort === "effective" ? (a.effectiveDate ?? "9999").localeCompare(b.effectiveDate ?? "9999")
      : a.jurisdictionName.localeCompare(b.jurisdictionName) || a.stateCode.localeCompare(b.stateCode)), [rows, filters, sort]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 100) - 1));
  const relevant = states.filter(([state]) => (filters.state === "all" || filters.state === state) && state !== "NC" && !noGeneralTax.has(state));
  const pending = relevant.filter(([state]) => !loaded[state]);
  const failures = relevant.flatMap(([state]) => loaded[state]?.errors.map(error => `${state}: ${error}`) ?? []);
  function select(key: keyof JurisdictionFilters, title: string, options: string[], all: string) {
    return <label><span>{title}</span><select value={filters[key]} onChange={event => { setFilters({ ...filters, [key]: event.target.value }); setPage(0); }}><option value="all">{all}</option>{options.map(value => <option key={value} value={value}>{labels[value] ?? value}</option>)}</select></label>;
  }
  function download() {
    const url = URL.createObjectURL(new Blob([inventoryCsv(filtered)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `taxap-jurisdictions-${filters.state}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <>
    <div className="coverage-summary inventory-summary"><div><strong>{rows.length.toLocaleString()}</strong><span>loaded inventory rows</span></div><div><strong>50 + DC</strong><span>selectable jurisdictions</span></div><p>Published jurisdictions and A+ assignments are separate rows. Component rates are not combined totals. “Not checked” does not mean a match or a zero rate. Open a row for state evidence, deliberate no-tax policies and comparison exclusions. NC uses the dashboard’s latest available evidence, which may be fallback data.</p></div>
    <div className="table-card">
      <div className="table-toolbar jurisdiction-toolbar">
        <label className="search-field"><span>Search</span><input value={filters.query} placeholder="Jurisdiction or tax body…" onChange={event => { setFilters({ ...filters, query: event.target.value }); setPage(0); }} /></label>
        <label><span>State</span><select value={filters.state} onChange={event => { setFilters({ ...filters, state: event.target.value }); setPage(0); }}><option value="all">All available</option>{states.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
        {select("jurisdictionType", "Jurisdiction", ["state", "county", "city", "special", "assignment"], "All types")}
        {select("comparison", "Comparison", ["matched", "recent-match", "mismatch", "upcoming", "not-checked"], "All comparisons")}
        {select("effective", "Effective date", ["current", "upcoming", "undated"], "Any date")}
        {select("review", "Review", ["unreviewed", "new", "in_review", "approved", "resolved", "not_applicable"], "Any review status")}
        {select("source", "Official source", ["validated", "unavailable"], "Any source status")}
        <label><span>Sort</span><select value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}><option value="ship-tos">Most ship-tos</option><option value="name">Jurisdiction A–Z</option><option value="effective">Effective date</option></select></label>
      </div>
      <div className="result-count" role="status">
        Showing {filtered.length ? currentPage * 100 + 1 : 0}–{Math.min((currentPage + 1) * 100, filtered.length)} of {filtered.length.toLocaleString()} matching loaded rows.
        {pending.length > 0 && <p>{offline ? "Offline: inventories unavailable" : "Loading inventories"} for {pending.map(([state]) => state).join(", ")}. Results are partial.</p>}
        {failures.length > 0 && <p>Unavailable: {failures.join("; ")}. Results are partial; retry with Refresh inventories.</p>}
        <p>{filters.state !== "all" && noGeneralTax.has(filters.state) ? `${STATE_NAME_BY_CODE.get(filters.state)} has no general sales tax; there is no general sales-tax rate inventory to compare.` : "DE, MT, NH and OR have no general sales tax."}</p>
        <button className="secondary-button" type="button" disabled={offline} onClick={() => { setLoaded({}); setRefresh(value => value + 1); }}>Refresh inventories</button>{" "}
        <button className="secondary-button" type="button" disabled={!filtered.length} onClick={download}>Export filtered rows CSV</button>
      </div>
      <div className="table-scroll"><table className="coverage-table jurisdiction-table"><thead><tr>{["State", "Jurisdiction", "Type", "A+ tax body", "Official total", "Official component", "A+ rate", "Ship-tos", "Effective", "Source", "Review", "Comparison"].map(title => <th key={title}>{title}</th>)}</tr></thead>
        <tbody>{filtered.slice(currentPage * 100, (currentPage + 1) * 100).map(row => <tr key={row.id}>
          <td>{row.stateCode}</td><td><button className="table-link" type="button" onClick={() => onOpen(row)}>{formatRateText(row.jurisdictionName)}</button></td><td>{labels[row.jurisdictionType] ?? row.jurisdictionType}</td><td>{row.taxBody || "—"}</td><td>{rate(row.officialRate)}</td><td>{rate(row.componentRate)}</td><td>{rate(row.aplusRate)}</td><td>{row.shipTos?.toLocaleString() ?? "—"}</td><td>{row.effectiveDate ?? labels[row.effectiveState]}</td><td>{labels[row.sourceStatus]}</td><td>{labels[row.reviewStatus ?? "unreviewed"]}</td><td>{labels[row.comparisonStatus]}</td>
        </tr>)}{!filtered.length && <tr><td colSpan={12}>No loaded rows match these filters. Check loading or unavailable states above, or clear filters.</td></tr>}</tbody>
      </table></div>
      <div className="result-count"><button className="secondary-button" type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>{" "}<button className="secondary-button" type="button" disabled={(currentPage + 1) * 100 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</button></div>
    </div>
  </>;
}
