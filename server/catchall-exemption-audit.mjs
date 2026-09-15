// Read-only, aggregate-only investigation into A+ "catch-all" tax-body assignments (e.g. IA000,
// MN000, AL000) flagged as open business decisions in docs/pending-business-decisions.md. TaxAP
// cannot tell from SASTXB/rate data alone whether a ship-to on one of these codes is a documented
// tax exemption or a ship-to that never received a real jurisdiction assignment. A+ separately
// carries tax-exempt certificate number fields (ADDR.SAEXNO, CUSMS.CMEXNO) that TaxAP has not
// previously read; their presence is at least evidence toward "documented exemption" versus
// "missing setup". This module only counts certificate presence/absence per catch-all code - it
// does not read or expose certificate numbers, expiration dates, or any customer/ship-to identity,
// and it does not attempt to decode SAEXCC/SAEXDT/CMECED's expiration semantics (unconfirmed A+
// date encoding for these specific fields - see docs/aplus-data-findings.md before doing that).
// This narrows the open business decisions; it does not resolve them - a populated certificate
// number does not by itself prove the exemption is valid, current, or the right treatment.

function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

// Matches the catch-all/undefined codes named in docs/pending-business-decisions.md as of
// 2026-09-15. Deliberately excludes: DC's HN000 (cross-state code, not a catch-all), WV961
// ("Missouri Lewisburg" mislabel, a different question), and MS (cross-jurisdiction outliers,
// not a catch-all-code ambiguity) - those are distinct issues, not this one.
export const CATCH_ALL_AUDIT_ENTRIES = [
  { stateCode: "AL", taxBody: "AL000" },
  { stateCode: "DC", taxBody: "DC000" },
  { stateCode: "IA", taxBody: "IA000" },
  { stateCode: "ID", taxBody: "ID000" },
  { stateCode: "MN", taxBody: "MN000" },
  { stateCode: "ND", taxBody: "ND000" },
  { stateCode: "NE", taxBody: "NE000" },
  { stateCode: "NV", taxBody: "NV000" },
  { stateCode: "OK", taxBody: "OK000" },
  { stateCode: "SD", taxBody: "SD000" },
  { stateCode: "UT", taxBody: "UT000" },
  { stateCode: "VT", taxBody: "VT000" },
  { stateCode: "WA", taxBody: "WA000" },
  { stateCode: "WA", taxBody: "WA3500" },
  { stateCode: "WI", taxBody: "WI000" },
  { stateCode: "WV", taxBody: "WV000" },
];

export function buildCatchAllExemptionAuditQuery(entries = CATCH_ALL_AUDIT_ENTRIES) {
  const codes = [...new Set(entries.map((entry) => String(entry.taxBody || "").trim()).filter(Boolean))];
  if (codes.length === 0) throw new Error("The catch-all exemption audit requires at least one tax-body code.");
  if (codes.length > 200 || codes.some((code) => code.length > 20)) {
    throw new Error("The catch-all exemption audit code list is outside the supported range.");
  }
  const values = codes.map((code) => `'${escapeSqlLiteral(code)}'`).join(", ");
  return `SELECT
    UPPER(LTRIM(RTRIM(a.SASHST))) AS StateCode,
    NULLIF(LTRIM(RTRIM(a.SASTXB)), '') AS TaxBody,
    COUNT(*) AS ActiveShipTos,
    COUNT(DISTINCT CONCAT(a.SACONO, '|', a.SACSNO)) AS ActiveCustomers,
    SUM(CASE WHEN NULLIF(LTRIM(RTRIM(a.SAEXNO)), '') IS NOT NULL
              OR NULLIF(LTRIM(RTRIM(c.CMEXNO)), '') IS NOT NULL THEN 1 ELSE 0 END) AS WithExemptCertificateNumber
  FROM dbo.ADDR AS a
  LEFT JOIN dbo.CUSMS AS c ON c.CMCONO = a.SACONO AND c.CMCSNO = a.SACSNO
  WHERE ISNULL(LTRIM(RTRIM(a.SACSUS)), '') <> 'S'
    AND ISNULL(LTRIM(RTRIM(c.CMSUSP)), '') <> 'S'
    AND NULLIF(LTRIM(RTRIM(a.SASTXB)), '') IN (${values})
  GROUP BY UPPER(LTRIM(RTRIM(a.SASHST))), NULLIF(LTRIM(RTRIM(a.SASTXB)), '')
  ORDER BY StateCode, TaxBody`;
}

function rowValue(row, name) {
  return row[name] ?? row[name.toUpperCase()];
}

function numericValue(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

// Turns raw grouped rows into one aggregate-only summary per requested code, including entries
// that returned zero live rows (0 active ship-tos), so a missing/renamed code is visible rather
// than silently absent from the report.
export function summarizeCatchAllExemptionAudit(recordset, entries = CATCH_ALL_AUDIT_ENTRIES) {
  const byKey = new Map();
  for (const row of recordset) {
    const stateCode = String(rowValue(row, "StateCode") || "").trim().toUpperCase();
    const taxBody = String(rowValue(row, "TaxBody") || "").trim();
    if (!stateCode || !taxBody) continue;
    byKey.set(`${stateCode}:${taxBody}`, {
      stateCode,
      taxBody,
      activeShipTos: numericValue(rowValue(row, "ActiveShipTos")),
      activeCustomers: numericValue(rowValue(row, "ActiveCustomers")),
      withExemptCertificateNumber: numericValue(rowValue(row, "WithExemptCertificateNumber")),
    });
  }
  return entries.map((entry) => {
    const key = `${entry.stateCode}:${entry.taxBody}`;
    const found = byKey.get(key);
    const activeShipTos = found?.activeShipTos ?? 0;
    const withExemptCertificateNumber = found?.withExemptCertificateNumber ?? 0;
    return {
      stateCode: entry.stateCode,
      taxBody: entry.taxBody,
      activeShipTos,
      activeCustomers: found?.activeCustomers ?? 0,
      withExemptCertificateNumber,
      withoutExemptCertificateNumber: activeShipTos - withExemptCertificateNumber,
    };
  });
}

export async function readCatchAllExemptionAudit({ openPool, entries = CATCH_ALL_AUDIT_ENTRIES } = {}) {
  const pool = await openPool();
  try {
    const result = await pool.request().query(buildCatchAllExemptionAuditQuery(entries));
    return {
      retrievedAt: new Date().toISOString(),
      note: "Aggregate-only: counts whether an exempt-certificate number is on file per catch-all "
        + "tax-body code. A populated certificate narrows but does not by itself confirm the "
        + "exemption is valid or current - it still needs a documented business decision.",
      states: summarizeCatchAllExemptionAudit(result.recordset, entries),
    };
  } finally {
    await pool.close();
  }
}
