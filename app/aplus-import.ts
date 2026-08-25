export const XATXBD_COLUMN_COUNT = 19;

export type ImportedTaxBody = {
  taxBody: string;
  description: string;
  localDescriptions: string[];
  baseRate: number;
  localRates: number[];
  currentRate: number;
  nextBaseRate: number;
  nextLocalRates: number[];
  nextRate: number;
  nextEffectiveDate: string | null;
};

export type APlusImportResult = {
  fileName: string;
  hasHeader: boolean;
  rowCount: number;
  standardRows: ImportedTaxBody[];
  specialRows: ImportedTaxBody[];
  scheduledRows: ImportedTaxBody[];
  errors: string[];
  warnings: string[];
  rateDistribution: { rate: number; count: number }[];
};

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return { rows, unterminatedQuote: quoted };
}

function parseRate(value: string, label: string, rowNumber: number, errors: string[]) {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) {
    errors.push(`Row ${rowNumber}: ${label} is not a valid number.`);
    return 0;
  }
  if (parsed < 0 || parsed > 20) errors.push(`Row ${rowNumber}: ${label} is outside the expected 0–20% range.`);
  return parsed;
}

function ratesMatch(total: number, components: number[]) {
  return Math.abs(total - components.reduce((sum, value) => sum + value, 0)) < 0.001;
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0001-01-01" || trimmed === "00000000" || trimmed === "0") return null;
  return trimmed;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateXatxbdCsv(text: string, fileName: string): APlusImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedText = text.replace(/^\uFEFF/, "");
  const parsed = parseCsvRows(normalizedText);
  if (parsed.unterminatedQuote) errors.push("The CSV contains an unterminated quoted value.");

  const firstValue = parsed.rows[0]?.[0]?.trim() ?? "";
  const hasHeader = /^(TBTXBOD|Tax\s*Body|TaxBody|TaxBodyID)$/i.test(firstValue);
  const dataRows = hasHeader ? parsed.rows.slice(1) : parsed.rows;
  const importedRows: ImportedTaxBody[] = [];

  dataRows.forEach((values, rowIndex) => {
    const rowNumber = rowIndex + (hasHeader ? 2 : 1);
    if (values.length !== XATXBD_COLUMN_COUNT) {
      errors.push(`Row ${rowNumber}: expected ${XATXBD_COLUMN_COUNT} columns but found ${values.length}.`);
      return;
    }

    const taxBody = values[0].trim().toUpperCase();
    if (!taxBody) {
      errors.push(`Row ${rowNumber}: tax body is blank.`);
      return;
    }

    const currentComponents = [
      parseRate(values[6], "current base rate", rowNumber, errors),
      parseRate(values[7], "current local rate 1", rowNumber, errors),
      parseRate(values[8], "current local rate 2", rowNumber, errors),
      parseRate(values[9], "current local rate 3", rowNumber, errors),
      parseRate(values[10], "current local rate 4", rowNumber, errors),
    ];
    const currentRate = parseRate(values[11], "current total rate", rowNumber, errors);
    const nextComponents = [
      parseRate(values[12], "next base rate", rowNumber, errors),
      parseRate(values[13], "next local rate 1", rowNumber, errors),
      parseRate(values[14], "next local rate 2", rowNumber, errors),
      parseRate(values[15], "next local rate 3", rowNumber, errors),
      parseRate(values[16], "next local rate 4", rowNumber, errors),
    ];
    const nextRate = parseRate(values[17], "next total rate", rowNumber, errors);
    const nextEffectiveDate = normalizeDate(values[18]);

    if (!ratesMatch(currentRate, currentComponents)) {
      errors.push(`Row ${rowNumber} (${taxBody}): current total does not equal its rate components.`);
    }
    if (nextRate > 0 && !ratesMatch(nextRate, nextComponents)) {
      errors.push(`Row ${rowNumber} (${taxBody}): next total does not equal its rate components.`);
    }
    if (nextRate > 0 && !nextEffectiveDate) {
      errors.push(`Row ${rowNumber} (${taxBody}): a next rate is present without an effective date.`);
    }
    if (nextEffectiveDate && !isValidIsoDate(nextEffectiveDate)) {
      errors.push(`Row ${rowNumber} (${taxBody}): next effective date must be a valid YYYY-MM-DD date.`);
    }
    if (nextEffectiveDate && nextRate === 0) {
      errors.push(`Row ${rowNumber} (${taxBody}): a next effective date is present without a next rate.`);
    }
    if (nextComponents.some((rate) => rate !== 0) && nextRate === 0) {
      errors.push(`Row ${rowNumber} (${taxBody}): next rate components are present but the next total is zero.`);
    }

    importedRows.push({
      taxBody,
      description: values[1].trim(),
      localDescriptions: values.slice(2, 6).map((value) => value.trim()),
      baseRate: currentComponents[0],
      localRates: currentComponents.slice(1),
      currentRate,
      nextBaseRate: nextComponents[0],
      nextLocalRates: nextComponents.slice(1),
      nextRate,
      nextEffectiveDate,
    });
  });

  const standardRows = importedRows.filter((row) => {
    const match = row.taxBody.match(/^NC(\d{3})$/);
    return match ? Number(match[1]) >= 1 && Number(match[1]) <= 100 : false;
  });
  const specialRows = importedRows.filter((row) => !standardRows.includes(row));
  const byTaxBody = new Map<string, ImportedTaxBody>();
  const duplicates = new Set<string>();
  standardRows.forEach((row) => {
    if (byTaxBody.has(row.taxBody)) duplicates.add(row.taxBody);
    byTaxBody.set(row.taxBody, row);
  });
  if (duplicates.size > 0) errors.push(`Duplicate standard tax bodies: ${[...duplicates].sort().join(", ")}.`);

  const missing = Array.from({ length: 100 }, (_, index) => `NC${String(index + 1).padStart(3, "0")}`)
    .filter((taxBody) => !byTaxBody.has(taxBody));
  if (missing.length > 0) errors.push(`Missing standard county tax bodies: ${missing.join(", ")}.`);
  if (standardRows.length !== 100) errors.push(`Expected 100 standard county rows but found ${standardRows.length}.`);

  const stateBaseRates = new Set(standardRows.map((row) => row.baseRate.toFixed(3)));
  if (stateBaseRates.size > 1) warnings.push(`Standard county rows contain multiple current base rates: ${[...stateBaseRates].join(", ")}.`);
  if (!hasHeader) warnings.push("No header row was detected; TaxAP used the verified 19-column XATXBD export order.");
  warnings.push("The export has no snapshot timestamp; TaxAP will record the browser import time.");

  const scheduledRows = standardRows.filter((row) => row.nextRate > 0 || row.nextEffectiveDate !== null);
  const distribution = new Map<number, number>();
  standardRows.forEach((row) => distribution.set(row.currentRate, (distribution.get(row.currentRate) ?? 0) + 1));

  return {
    fileName,
    hasHeader,
    rowCount: importedRows.length,
    standardRows: [...standardRows].sort((left, right) => left.taxBody.localeCompare(right.taxBody)),
    specialRows,
    scheduledRows,
    errors: [...new Set(errors)],
    warnings,
    rateDistribution: [...distribution].map(([rate, count]) => ({ rate, count })).sort((left, right) => left.rate - right.rate),
  };
}
