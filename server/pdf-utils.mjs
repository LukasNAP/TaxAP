import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Shells out to the system `pdftotext` (poppler-utils) with `-table` mode, which keeps a row's
 * wrapped cells glued together correctly - confirmed (server/sc-rates.mjs) to behave better than
 * `-layout` mode for government rate-table PDFs. Factored out here so more than one PDF-sourced
 * adapter (SC's ST-575, NY's Publication 718, ...) doesn't reimplement the temp-file dance.
 */
export async function extractPdfTableText(pdfBuffer, { tmpPrefix = "taxap-pdf-" } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), tmpPrefix));
  const inputPath = path.join(dir, "input.pdf");
  try {
    await writeFile(inputPath, pdfBuffer);
    return await new Promise((resolve, reject) => {
      execFile("pdftotext", ["-table", "-enc", "UTF-8", inputPath, "-"], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
          if (error.code === "ENOENT") {
            reject(new Error("pdftotext (poppler-utils) is not installed on this host; this adapter cannot run without it."));
          } else {
            reject(new Error(`pdftotext failed: ${error.message}`));
          }
          return;
        }
        resolve(stdout);
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
