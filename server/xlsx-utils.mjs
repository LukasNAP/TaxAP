import { readZipEntries } from "./zip-utils.mjs";

// Minimal, dependency-free .xlsx (OOXML spreadsheet) reader - same approach server/fl-rates.mjs
// already uses inline, factored out here so new adapters (VA, MO, CO, ...) don't each reimplement
// it. Reads raw cell values only (shared strings resolved); does not handle formulas, merged
// cells, or multiple sheets beyond picking one by name.

function decodeXml(value) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function sharedStrings(xml) {
  return [...String(xml).matchAll(/<si>([\s\S]*?)<\/si>/gi)].map((match) =>
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)].map((part) => decodeXml(part[1])).join(""),
  );
}

/** Parses one worksheet's raw XML into an array of rows, each a map of column letter -> cell text. */
export function workbookRows(sheetXml, strings) {
  return [...String(sheetXml).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)].map((row) => {
    const values = {};
    for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const reference = cell[1].match(/\br=["']([A-Z]+)\d+["']/i)?.[1]?.toUpperCase();
      if (!reference) continue;
      const raw = cell[2].match(/<v>([\s\S]*?)<\/v>/i)?.[1] ?? "";
      values[reference] = /\bt=["']s["']/i.test(cell[1]) ? strings[Number(raw)] ?? "" : decodeXml(raw);
    }
    return values;
  });
}

/**
 * Reads the first worksheet (or a specific one by its zip entry name, e.g. "sheet2.xml") of an
 * .xlsx buffer into an array of rows. Throws if the workbook doesn't have the expected structure -
 * never returns a partial/empty result silently.
 */
export function readXlsxRows(buffer, { sheetFile = "sheet1.xml" } = {}) {
  const entries = new Map(readZipEntries(Buffer.from(buffer)).map((entry) => [entry.name, entry.data]));
  const sheet = entries.get(`xl/worksheets/${sheetFile}`)?.toString("utf8");
  const stringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  if (!sheet) throw new Error(`The workbook is missing xl/worksheets/${sheetFile}.`);
  const strings = stringsXml ? sharedStrings(stringsXml) : [];
  return workbookRows(sheet, strings);
}

export { decodeXml };
