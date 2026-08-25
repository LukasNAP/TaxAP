"use client";

import { useState } from "react";

export type ReviewStatus = "new" | "in_review" | "approved" | "resolved" | "not_applicable";

export type ReviewEvent = {
  id: number;
  findingKey: string;
  action: ReviewStatus;
  fromStatus: ReviewStatus | null;
  toStatus: ReviewStatus;
  actor: string;
  note: string | null;
  createdAt: string;
};

export type ReviewCase = {
  findingKey: string;
  stateCode: string;
  jurisdiction: string;
  taxBody: string;
  findingType: "mismatch" | "upcoming" | "recent-match";
  aplusRate: number | null;
  officialRate: number | null;
  effectiveDate: string | null;
  sourceUrl: string | null;
  status: ReviewStatus;
  assignedTo: string | null;
  latestNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  events: ReviewEvent[];
};

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  new: "New",
  in_review: "In review",
  approved: "Approved",
  resolved: "Resolved",
  not_applicable: "Not applicable",
};

export function ReviewDecisionPanel({
  reviewCase,
  onSave,
}: {
  reviewCase: ReviewCase | null;
  onSave: (status: ReviewStatus, actor: "Ana" | "Liv", note: string) => Promise<ReviewCase>;
}) {
  const [actor, setActor] = useState<"Ana" | "Liv">((reviewCase?.assignedTo === "Liv" ? "Liv" : "Ana"));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<ReviewStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (status: ReviewStatus) => {
    if ((status === "approved" || status === "resolved" || status === "not_applicable") && !note.trim()) {
      setMessage("Add a note before approving, resolving, or dismissing this finding.");
      return;
    }
    setSaving(status);
    setMessage(null);
    try {
      await onSave(status, actor, note.trim());
      setNote("");
      setMessage(`${reviewStatusLabels[status]} recorded for ${actor}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The decision could not be saved.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="review-decision" aria-labelledby="decision-title">
      <div className="review-decision-heading">
        <div><span className="section-label">TaxAP decision</span><h3 id="decision-title">Record the review</h3></div>
        <span className={`review-status review-status-${reviewCase?.status ?? "new"}`}>{reviewStatusLabels[reviewCase?.status ?? "new"]}</span>
      </div>
      <p>These actions update TaxAP&apos;s audit trail only. They never change the A+ tax body.</p>
      <div className="review-form-grid">
        <label>Reviewer<select value={actor} onChange={(event) => setActor(event.target.value as "Ana" | "Liv")}><option>Ana</option><option>Liv</option></select></label>
        <label className="review-note-field">Review note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={4} placeholder="Evidence checked, decision made, or work completed…" /></label>
      </div>
      {message && <p className="review-form-message" role="status">{message}</p>}
      <div className="review-action-grid">
        <button className="secondary-button" type="button" disabled={Boolean(saving)} onClick={() => void save("in_review")}>{saving === "in_review" ? "Saving…" : "Start review"}</button>
        <button className="primary-button" type="button" disabled={Boolean(saving)} onClick={() => void save("approved")}>{saving === "approved" ? "Saving…" : "Mark ready for A+ maintenance"}</button>
        <button className="secondary-button" type="button" disabled={Boolean(saving)} onClick={() => void save("resolved")}>{saving === "resolved" ? "Saving…" : "Record resolved"}</button>
        <button className="secondary-button" type="button" disabled={Boolean(saving)} onClick={() => void save("not_applicable")}>{saving === "not_applicable" ? "Saving…" : "Not applicable"}</button>
      </div>
      <small className="identity-note">Reviewer selection is temporary until Entra ID sign-in is added.</small>
    </section>
  );
}

export function ReviewAuditTrail({ reviewCase }: { reviewCase: ReviewCase }) {
  return (
    <section className="audit-trail" aria-labelledby="audit-title">
      <div className="review-decision-heading"><div><span className="section-label">Immutable event log</span><h3 id="audit-title">Audit history</h3></div><span className="count-pill quiet">{reviewCase.events.length}</span></div>
      <ol>
        {reviewCase.events.map((event) => (
          <li key={event.id}>
            <span className={`audit-dot review-status-${event.toStatus}`} aria-hidden="true" />
            <div><strong>{reviewStatusLabels[event.toStatus]}</strong><p>{event.note || "No note recorded."}</p><small>{event.actor} · {new Date(event.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</small></div>
          </li>
        ))}
      </ol>
    </section>
  );
}
