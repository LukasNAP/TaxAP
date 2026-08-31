import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Extract text in-process so PDF-backed official adapters work on every supported TaxAP host.
// The earlier Poppler shell-out made a valid source refresh depend on a separately installed
// `pdftotext` executable, which is not present on the supported Windows development machine.
// Preserve physical lines: some official PDFs place multiple table columns on the same y-axis.
function pageTextWithPhysicalLines(items) {
  const lines = new Map();
  for (const item of items) {
    if (!item.str) continue;
    const y = Math.round(item.transform[5] * 10) / 10;
    const line = lines.get(y) ?? [];
    line.push(item);
    lines.set(y, line);
  }
  return [...lines.entries()]
    .sort(([leftY], [rightY]) => rightY - leftY)
    .map(([, line]) => line
      .sort((left, right) => left.transform[4] - right.transform[4])
      .map((item) => item.str)
      .join(" "))
    .join("\n");
}

/**
 * Extracts PDF text without a host-installed executable. `tmpPrefix` is retained for compatible
 * adapter calls, but PDF.js reads the in-memory buffer directly and creates no temporary files.
 */
export async function extractPdfTableText(pdfBuffer, { tmpPrefix: _tmpPrefix = "taxap-pdf-" } = {}) {
  // Preserve the public option for adapters written before this became in-memory only.
  void _tmpPrefix;
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  try {
    const document = await loadingTask.promise;
    try {
      const pages = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const textContent = await page.getTextContent();
        pages.push(pageTextWithPhysicalLines(textContent.items));
      }
      return pages.join("\n");
    } finally {
      await document.destroy();
    }
  } finally {
    await loadingTask.destroy();
  }
}
