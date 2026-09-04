#!/usr/bin/env node
// Read-only follow-up investigation helper: for a given A+ tax body, prints the aggregate
// city + ZIP-5 breakdown (never full street addresses, never customer identity) of its active
// ship-tos, so a "is this code's real geography what we assume" question (e.g. is VA076's
// ship-to volume really in Richmond County vs. the City of Richmond) can be answered without
// exposing anything beyond what TaxAP already treats as safe aggregate data.
//
// Usage: node --experimental-strip-types --env-file-if-exists=.env.local scripts/inspect-tax-body-geography.mjs <TAX_BODY_CODE>
import sql from "mssql";
import { openPool } from "../server/aplus-connector.mjs";

const taxBody = process.argv[2];
if (!taxBody) {
  console.error("Usage: inspect-tax-body-geography.mjs <TAX_BODY_CODE>");
  process.exit(1);
}

const pool = await openPool();
try {
  const result = await pool.request()
    .input("taxBody", sql.Char(10), taxBody)
    .query(`SELECT LTRIM(RTRIM(a.SASCTY)) AS City, LEFT(LTRIM(RTRIM(a.SASZIP)), 5) AS Zip5, COUNT(*) AS ShipTos
      FROM dbo.ADDR AS a
      LEFT JOIN dbo.CUSMS AS c ON c.CMCONO = a.SACONO AND c.CMCSNO = a.SACSNO
      WHERE LTRIM(RTRIM(a.SASTXB)) = LTRIM(RTRIM(@taxBody))
        AND ISNULL(LTRIM(RTRIM(a.SACSUS)), '') <> 'S'
        AND ISNULL(LTRIM(RTRIM(c.CMSUSP)), '') <> 'S'
      GROUP BY LTRIM(RTRIM(a.SASCTY)), LEFT(LTRIM(RTRIM(a.SASZIP)), 5)
      ORDER BY ShipTos DESC`);
  console.log(JSON.stringify(result.recordset, null, 2));
} finally {
  await pool.close();
}
