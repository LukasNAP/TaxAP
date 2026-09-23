"use client";
import { useEffect, useState } from "react";

type Selection = { apiBase: string; taxBody: string; state: string; scope: "all" | "rate-risk"; expectedCount: number };
type Result = { total: number; page: number; pageSize: number; retrievedAt: string; rows: { companyNumber: string; customerNumber: string; shipToNumber: string; customerName: string; address: { line1: string; line2: string; city: string; state: string; postalCode: string } }[] };

export function FindingShipTos(props: Selection) {
  const [open, setOpen] = useState(false);
  return <section className="finding-ship-tos">
    <button className="secondary-button" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide ship-tos" : "View affected ship-tos"}</button>
    {open && <ShipToList {...props} key={`${props.taxBody}:${props.state}:${props.scope}`} />}
  </section>;
}

function ShipToList({ apiBase, taxBody, state, scope, expectedCount }: Selection) {
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 70000);
    let current = true;
    const query = new URLSearchParams({ taxBody, state, scope, page: String(page) });
    void fetch(`${apiBase}/api/aplus/finding-ship-tos?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Reload TaxAP to sign in again." : "The ship-to list is unavailable. Try again.");
        return response.json() as Promise<Result>;
      }).then(data => { if (current) setResult(data); })
      .catch(reason => { if (current) setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message : "The request timed out. Try again."); })
      .finally(() => clearTimeout(timeout));
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [apiBase, taxBody, state, scope, page, attempt]);
  const changePage = (next: number) => { setResult(null); setError(""); setPage(next); };
  return <div>
    <p>{scope === "rate-risk" ? "Active ship-tos assigned to this tax body with tax treatment 0, across all states, matching the finding's rate-risk count." : `Active ship-tos assigned to this tax body in ${state}.`} Use the company, customer and ship-to numbers to locate records in A+.</p>
    {error ? <div role="alert"><p>{error}</p><button className="secondary-button" type="button" onClick={() => { setError(""); setResult(null); setAttempt(attempt + 1); }}>Retry</button></div> : !result ? <p role="status">Loading ship-tos…</p> : <>
      <p role="status">{result.total.toLocaleString()} current assignments · Retrieved {new Date(result.retrievedAt).toLocaleString()}</p>
      {result.total !== expectedCount && <p className="queue-storage-warning">The finding showed {expectedCount.toLocaleString()}; this current list contains {result.total.toLocaleString()}. Assignments may have changed, or the comparison may cover a narrower jurisdiction. This list shows assignments, not confirmation that each ship-to has an incorrect rate.</p>}
      {result.rows.length === 0 ? <p>No assignments on this page. {page > 0 && "Return to the first page to refresh the list."}</p> : <div className="table-scroll"><table className="coverage-table ship-to-detail-table"><caption>Ship-tos assigned to {taxBody}</caption><thead><tr><th scope="col">Company</th><th scope="col">Customer</th><th scope="col">Customer #</th><th scope="col">Ship-to address</th><th scope="col">Ship-to #</th></tr></thead><tbody>{result.rows.map((row, index) => <tr key={`${row.companyNumber}:${row.customerNumber}:${row.shipToNumber}:${index}`}><td data-label="Company">{row.companyNumber}</td><td data-label="Customer">{row.customerName || "Name unavailable"}</td><td data-label="Customer #">{row.customerNumber}</td><td data-label="Ship-to address">{[row.address.line1, row.address.line2, [row.address.city, row.address.state, row.address.postalCode].filter(Boolean).join(" ")].filter(Boolean).map((line, i) => <div key={i}>{line}</div>)}{!Object.values(row.address).some(Boolean) && "Address unavailable"}</td><td data-label="Ship-to #">{row.shipToNumber || "(blank)"}</td></tr>)}</tbody></table></div>}
      <div className="drawer-actions"><button type="button" className="secondary-button" disabled={page === 0} onClick={() => changePage(0)}>First page</button><button type="button" className="secondary-button" disabled={page === 0} onClick={() => changePage(page - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(result.total / 50))}</span><button type="button" className="secondary-button" disabled={(page + 1) * 50 >= result.total} onClick={() => changePage(page + 1)}>Next</button></div>
    </>}
  </div>;
}
