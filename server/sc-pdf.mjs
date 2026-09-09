import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export function southCarolinaTablePage(items) {
  const cells = items.filter((x) => x.str?.trim()).map((x) => ({ text: x.str.trim(), x: x.transform[4], y: x.transform[5] }));
  const header = cells.find((x) => x.text === "Municipality" && Math.abs(x.x - 36) < 3);
  if (!header || !cells.some((x) => x.text === "County" && Math.abs(x.x - 140) < 3 && Math.abs(x.y - header.y) < 3)) throw new Error("ST-575 PDF table coordinates changed.");
  const rows = cells.filter((x) => x.y < header.y - 3 && x.y > 35 && x.x >= 360 && x.x < 405 && /^\d+(?:\.\d+)?%$/.test(x.text)).sort((a, b) => b.y - a.y).map((anchor) => ({ y: anchor.y, columns: Array.from({ length: 6 }, () => []) }));
  if (!rows.length) throw new Error("ST-575 PDF page has no rate anchors.");
  for (const cell of cells.filter((x) => x.y < header.y - 3 && x.y > 35 && x.x >= 33)) {
    const row = rows.reduce((best, row) => Math.abs(row.y - cell.y) < Math.abs(best.y - cell.y) ? row : best);
    if (Math.abs(row.y - cell.y) > 12) throw new Error("ST-575 PDF text falls outside its rate row.");
    const column = cell.x < 138 ? 0 : cell.x < 207 ? 1 : cell.x < 360 ? 2 : cell.x < 405 ? 3 : cell.x < 487 ? 4 : 5;
    row.columns[column].push(cell);
  }
  return rows.map((row) => row.columns.map((column) => column.sort((a, b) => Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x).map((x) => x.text).join(" ")).join("  ")).join("\n");
}

export async function extractSouthCarolinaPdf(buffer) {
  const task = getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false });
  try {
    const document = await task.promise;
    const pages = [];
    let revision = null;
    for (let i = 1; i <= document.numPages; i += 1) {
      const page = await document.getPage(i);
      const { items } = await page.getTextContent();
      const text = items.map((x) => x.str).join(" ");
      revision ??= text.match(/\(Rev\.\s*\d{1,2}\/\d{1,2}\/\d{2,4}\)/)?.[0];
      pages.push(southCarolinaTablePage(items));
    }
    if (!revision) throw new Error("ST-575 PDF revision is missing.");
    return `${revision}\nMunicipality  County\n${pages.join("\n")}`;
  } finally {
    await task.destroy();
  }
}
