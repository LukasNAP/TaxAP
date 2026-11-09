"use client";
import { useState, type FormEvent } from "react";

export type ManualUpload = { fileName: string; uploadedAt: string; uploadedBy: string; sha256: string };
type UploadResult = { upload: { fileName: string; beginDate: string; endDate: string; rows: number } };

const formatDate = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** States plainly that Colorado was checked against a hand-uploaded official workbook. */
export function ManualUploadNotice({ upload, effectivePeriod }: { upload: ManualUpload; effectivePeriod?: string }) {
  return <p className="official-boundary-note manual-upload-notice" role="note">
    <strong>Manual upload.</strong> Automatic retrieval from Colorado DOR is unavailable, so this check uses the official workbook <code>{upload.fileName}</code>{effectivePeriod ? ` (${effectivePeriod})` : ""}, uploaded {formatDate(upload.uploadedAt)} by {upload.uploadedBy}. Fingerprint {upload.sha256.slice(0, 12)}…
  </p>;
}

/**
 * Colorado's site blocks automated downloads, so a signed-in user downloads the official workbook in a
 * browser and uploads it unchanged. The server validates it exactly like an automatic download.
 */
export function ColoradoWorkbookUpload({ apiBase, onUploaded }: { apiBase: string; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedBy, setUploadedBy] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !uploadedBy.trim()) return;
    setStatus("uploading"); setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/official/states/CO/workbook`, {
        method: "POST", cache: "no-store", body: file,
        headers: { "Content-Type": "application/octet-stream", "X-TaxAP-File-Name": encodeURIComponent(file.name), "X-TaxAP-Uploaded-By": encodeURIComponent(uploadedBy.trim()) },
      });
      const result = await response.json().catch(() => null) as (UploadResult & { error?: string }) | null;
      if (!response.ok || !result?.upload) throw new Error(response.status === 401 ? "Your session expired. Reload TaxAP to sign in again." : result?.error || "The upload failed. Try again.");
      setStatus("done");
      setMessage(`Validated ${result.upload.rows} official jurisdiction rows for ${result.upload.beginDate} through ${result.upload.endDate}. It is used only while automatic retrieval is unavailable.`);
      onUploaded();
    } catch (reason) {
      setStatus("error");
      setMessage(reason instanceof Error ? reason.message : "The upload failed. Try again.");
    }
  }

  return <details className="colorado-upload">
    <summary>Upload the official Colorado workbook</summary>
    <form onSubmit={(event) => void submit(event)}>
      <p>Colorado DOR blocks automated downloads. Open <a href="https://tax.colorado.gov/how-to-look-up-sales-use-tax-rates" target="_blank" rel="noreferrer">How to Look Up Location Codes &amp; Tax Rates ↗</a> in your browser, download the current <code>Colorado_Jurisdiction_Codes_Rates_…xlsx</code> workbook, and upload it without renaming or editing it. TaxAP validates it like an automatic download and uses it only when automatic retrieval fails.</p>
      <label>Workbook<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setStatus("idle"); setMessage(""); }} /></label>
      <label>Uploaded by<input type="text" value={uploadedBy} maxLength={80} autoComplete="name" onChange={(event) => setUploadedBy(event.target.value)} /></label>
      <button className="secondary-button" type="submit" disabled={!file || !uploadedBy.trim() || status === "uploading"}>{status === "uploading" ? "Validating…" : "Upload and validate"}</button>
      {message && <p className={status === "error" ? "state-detail-error" : undefined} role={status === "error" ? "alert" : "status"}>{message}</p>}
    </form>
  </details>;
}
