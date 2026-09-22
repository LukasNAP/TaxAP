export function validateShipToSelection(params) {
  const taxBody = params.get("taxBody") || "";
  const state = params.get("state") || "";
  const scope = params.get("scope") || "all";
  const pageText = params.get("page") || "0";
  if (!/^[A-Z0-9][A-Z0-9 .%_-]{0,19}$/i.test(taxBody) || !/^[A-Z]{2}$/.test(state) || !["all", "rate-risk"].includes(scope) || !/^\d{1,6}$/.test(pageText)) {
    throw new Error("Invalid ship-to selection.");
  }
  return { taxBody, state, scope, page: Number(pageText) };
}

export const findingShipTosQuery = `WITH scoped AS (
  SELECT a.SACONO AS companyNumber, a.SACSNO AS customerNumber,
    RTRIM(a.[SASHP#]) AS shipToNumber
  FROM dbo.ADDR AS a
  LEFT JOIN dbo.CUSMS AS c ON c.CMCONO = a.SACONO AND c.CMCSNO = a.SACSNO
  WHERE LTRIM(RTRIM(a.SASTXB)) = @taxBody
    AND ISNULL(LTRIM(RTRIM(a.SACSUS)), '') <> 'S'
    AND ISNULL(LTRIM(RTRIM(c.CMSUSP)), '') <> 'S'
    AND ((@scope = 'rate-risk' AND LTRIM(RTRIM(a.SATXCD)) = '0')
      OR (@scope = 'all' AND UPPER(LTRIM(RTRIM(a.SASHST))) = @state))
)
SELECT totals.total, page.companyNumber, page.customerNumber, page.shipToNumber
FROM (SELECT COUNT(*) AS total FROM scoped) AS totals
OUTER APPLY (
  SELECT companyNumber, customerNumber, shipToNumber FROM scoped
  ORDER BY companyNumber, customerNumber, shipToNumber
  OFFSET @offset ROWS FETCH NEXT 50 ROWS ONLY
) AS page
ORDER BY page.companyNumber, page.customerNumber, page.shipToNumber`;

export async function readFindingShipTos(selection, { openPool, sql }) {
  const pool = await openPool();
  try {
    const result = await pool.request()
      .input("taxBody", sql.VarChar(20), selection.taxBody)
      .input("state", sql.VarChar(2), selection.state)
      .input("scope", sql.VarChar(16), selection.scope)
      .input("offset", sql.Int, selection.page * 50)
      .query(findingShipTosQuery);
    return {
      retrievedAt: new Date().toISOString(), total: Number(result.recordset[0]?.total || 0),
      page: selection.page, pageSize: 50,
      rows: result.recordset.filter(row => row.companyNumber != null).map(row => ({
        companyNumber: String(row.companyNumber), customerNumber: String(row.customerNumber), shipToNumber: String(row.shipToNumber ?? ""),
      })),
    };
  } finally { await pool.close(); }
}
