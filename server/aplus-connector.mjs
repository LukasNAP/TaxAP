import { DefaultAzureCredential } from "@azure/identity";
import sql from "mssql";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { validateXatxbdCsv } from "../app/aplus-import.ts";
import { isRetiredTaxBody } from "../app/tax-body-policy.ts";
import { buildWantedAddressKeys, readGeorgiaBoundaryArchive, parseBoundaryCsv, reconcileGeorgiaBoundary } from "./ga-boundary.mjs";
import { readOfficialCaRates } from "./ca-rates.mjs";
import { readOfficialFlRates } from "./fl-rates.mjs";
import { readOfficialNcRates } from "./ncdor-rates.mjs";
import { readOfficialPaRates } from "./pa-rates.mjs";
import { listOfficialSourceRegistry, officialSourceForState } from "./official-source-registry.mjs";
import { createReviewStore } from "./review-store.mjs";
import { readOfficialGaRates, readOfficialSstStateRates } from "./sst-rates.mjs";
import { readOfficialTxRates } from "./tx-rates.mjs";

const port = Number(process.env.TAXAP_CONNECTOR_PORT || 3001);
const host = process.env.TAXAP_CONNECTOR_HOST || "127.0.0.1";
const allowedOrigin = process.env.TAXAP_ALLOWED_ORIGIN || "http://localhost:3000";
let defaultReviewStore;

function reviewStore() {
  defaultReviewStore ??= createReviewStore({ filename: process.env.TAXAP_REVIEW_DB || undefined });
  return defaultReviewStore;
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 25_000) throw new Error("Review request is too large.");
  }
  if (!body) throw new Error("Review request is required.");
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Review request must be valid JSON.");
  }
}

export const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD",
  "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

function requiredSetting(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required setting: ${name}`);
  return value;
}

function safeIdentifier(value, settingName) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`${settingName} contains unsupported characters.`);
  return value;
}

function escapeSqlLiteral(value) {
  return value.replaceAll("'", "''");
}

export function validateStateCode(value) {
  const stateCode = String(value || "").trim().toUpperCase();
  if (!US_STATE_CODES.has(stateCode)) throw new Error("Choose a valid U.S. state code.");
  return stateCode;
}

function linkedSettings() {
  return {
    linkedServer: process.env.TAXAP_SQL_LINKED_SERVER || "SQL03",
    aplusLinkedServer: process.env.TAXAP_APLUS_LINKED_SERVER || "APLUS",
    library: process.env.TAXAP_APLUS_LIBRARY || "APLUSV8FAQ",
  };
}

function wrapDb2Query(db2Query, { linkedServer = "SQL03", aplusLinkedServer = "APLUS" } = {}) {
  const safeLinkedServer = safeIdentifier(linkedServer, "TAXAP_SQL_LINKED_SERVER");
  const safeAplusLinkedServer = safeIdentifier(aplusLinkedServer, "TAXAP_APLUS_LINKED_SERVER");
  const sql03Query = `SELECT * FROM OPENQUERY(${safeAplusLinkedServer}, '${escapeSqlLiteral(db2Query)}')`;
  return `SELECT * FROM OPENQUERY([${safeLinkedServer}], '${escapeSqlLiteral(sql03Query)}')`;
}

export function buildTaxBodyQuery({ linkedServer = "SQL03", aplusLinkedServer = "APLUS", library = "APLUSV8FAQ" } = {}) {
  const safeLibrary = safeIdentifier(library, "TAXAP_APLUS_LIBRARY");
  const db2Query = [
    "SELECT",
    "TBTXBOD AS TaxBody, TBTXNAM AS Description,",
    "TBL1DSC AS LocalDescription1, TBL2DSC AS LocalDescription2,",
    "TBL3DSC AS LocalDescription3, TBL4DSC AS LocalDescription4,",
    "TBCBSRT AS CurrentBaseRate, TBCLRT1 AS CurrentLocalRate1,",
    "TBCLRT2 AS CurrentLocalRate2, TBCLRT3 AS CurrentLocalRate3,",
    "TBCLRT4 AS CurrentLocalRate4, TBCRATE AS CurrentTotalRate,",
    "TBNBSRT AS NextBaseRate, TBNLRT1 AS NextLocalRate1,",
    "TBNLRT2 AS NextLocalRate2, TBNLRT3 AS NextLocalRate3,",
    "TBNLRT4 AS NextLocalRate4, TBNRATE AS NextTotalRate, TBTXDAT AS NextEffectiveDate",
    `FROM ${safeLibrary}.XATXBD`,
    "WHERE TBTXBOD LIKE 'NC%'",
    "AND TBTXBOD NOT IN ('NCUSE', 'NC060XXX')",
    "AND UPPER(TBTXNAM) NOT LIKE '%DO NOT USE%' AND UPPER(TBTXNAM) NOT LIKE '%DONT USE%' AND UPPER(TBTXNAM) NOT LIKE '%DON''T USE%'",
    "AND UPPER(TBTXNAM) NOT LIKE '%INACTIVE%' AND UPPER(TBTXNAM) NOT LIKE '%OBSOLETE%'",
    "ORDER BY TBTXBOD",
  ].join(" ");
  return wrapDb2Query(db2Query, { linkedServer, aplusLinkedServer });
}

export function buildTaxBodyDefinitionsQuery(taxBodies, { linkedServer = "SQL03", aplusLinkedServer = "APLUS", library = "APLUSV8FAQ" } = {}) {
  const safeLibrary = safeIdentifier(library, "TAXAP_APLUS_LIBRARY");
  const codes = [...new Set(taxBodies.map((value) => String(value || "").trim()).filter(Boolean))];
  if (codes.length === 0) return null;
  if (codes.length > 500 || codes.some((code) => code.length > 20)) throw new Error("The A+ tax-body selection is outside the supported range.");
  const values = codes.map((code) => `'${escapeSqlLiteral(code)}'`).join(", ");
  const db2Query = [
    "SELECT",
    "TBTXBOD AS TaxBody, TBTXNAM AS Description,",
    "TBCBSRT AS CurrentBaseRate, TBCLRT1 AS CurrentLocalRate1, TBCLRT2 AS CurrentLocalRate2,",
    "TBCLRT3 AS CurrentLocalRate3, TBCLRT4 AS CurrentLocalRate4, TBCRATE AS CurrentTotalRate,",
    "TBNRATE AS NextTotalRate, TBTXDAT AS NextEffectiveDate",
    `FROM ${safeLibrary}.XATXBD`,
    `WHERE TBTXBOD IN (${values})`,
    "AND TBTXBOD NOT IN ('NCUSE', 'NC060XXX')",
    "AND UPPER(TBTXNAM) NOT LIKE '%DO NOT USE%' AND UPPER(TBTXNAM) NOT LIKE '%DONT USE%' AND UPPER(TBTXNAM) NOT LIKE '%DON''T USE%'",
    "AND UPPER(TBTXNAM) NOT LIKE '%INACTIVE%' AND UPPER(TBTXNAM) NOT LIKE '%OBSOLETE%'",
    "ORDER BY TBTXBOD",
  ].join(" ");
  return wrapDb2Query(db2Query, { linkedServer, aplusLinkedServer });
}

export function buildStateCoverageQuery() {
  return `SELECT UPPER(LTRIM(RTRIM(a.SASHST))) AS StateCode,
    COUNT(*) AS ActiveShipTos,
    COUNT(DISTINCT CONCAT(a.SACONO, '|', a.SACSNO)) AS ActiveCustomers,
    COUNT(DISTINCT NULLIF(LTRIM(RTRIM(a.SASTXB)), '')) AS TaxBodyCount
  FROM dbo.ADDR AS a
  LEFT JOIN dbo.CUSMS AS c ON c.CMCONO = a.SACONO AND c.CMCSNO = a.SACSNO
  WHERE ISNULL(LTRIM(RTRIM(a.SASUSP)), '') <> 'S'
    AND ISNULL(LTRIM(RTRIM(c.CMSUSP)), '') <> 'S'
  GROUP BY UPPER(LTRIM(RTRIM(a.SASHST)))`;
}

export function buildStateTaxBodyQuery() {
  return `SELECT NULLIF(LTRIM(RTRIM(a.SASTXB)), '') AS TaxBody,
    COUNT(*) AS ActiveShipTos,
    COUNT(DISTINCT CONCAT(a.SACONO, '|', a.SACSNO)) AS ActiveCustomers
  FROM dbo.ADDR AS a
  LEFT JOIN dbo.CUSMS AS c ON c.CMCONO = a.SACONO AND c.CMCSNO = a.SACSNO
  WHERE UPPER(LTRIM(RTRIM(a.SASHST))) = @state
    AND ISNULL(LTRIM(RTRIM(a.SASUSP)), '') <> 'S'
    AND ISNULL(LTRIM(RTRIM(c.CMSUSP)), '') <> 'S'
  GROUP BY NULLIF(LTRIM(RTRIM(a.SASTXB)), '')
  ORDER BY ActiveShipTos DESC, TaxBody`;
}

function csvValue(value) {
  const normalized = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value === null || value === undefined
      ? ""
      : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

function recordsetToCsv(recordset) {
  const fields = [
    "TaxBody", "Description", "LocalDescription1", "LocalDescription2", "LocalDescription3", "LocalDescription4",
    "CurrentBaseRate", "CurrentLocalRate1", "CurrentLocalRate2", "CurrentLocalRate3", "CurrentLocalRate4", "CurrentTotalRate",
    "NextBaseRate", "NextLocalRate1", "NextLocalRate2", "NextLocalRate3", "NextLocalRate4", "NextTotalRate", "NextEffectiveDate",
  ];
  return recordset.map((row) => fields.map((field) => {
    const value = row[field] ?? row[field.toUpperCase()];
    if (field === "NextEffectiveDate" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return csvValue(value.slice(0, 10));
    }
    return csvValue(value);
  }).join(",")).join("\n");
}

async function openPool() {
  const server = requiredSetting("TAXAP_SQL_SERVER");
  const database = requiredSetting("TAXAP_SQL_DATABASE");
  const credential = new DefaultAzureCredential();
  const accessToken = await credential.getToken("https://database.windows.net/.default");
  if (!accessToken?.token) throw new Error("Microsoft Entra ID did not return an Azure SQL access token.");

  const pool = new sql.ConnectionPool({
    server,
    database,
    port: 1433,
    authentication: {
      type: "azure-active-directory-access-token",
      options: { token: accessToken.token },
    },
    options: {
      encrypt: true,
      trustServerCertificate: false,
      appName: "TaxAP read-only connector",
    },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5_000 },
    connectionTimeout: 20_000,
    requestTimeout: 60_000,
  });

  await pool.connect();
  return pool;
}

function rowValue(row, name) {
  return row[name] ?? row[name.toUpperCase()];
}

function numericValue(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizedDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (!text || /^0+$/.test(text)) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return text;
}

export async function readLiveTaxBodies() {
  const pool = await openPool();
  try {
    const result = await pool.request().query(buildTaxBodyQuery({
      ...linkedSettings(),
    }));
    const validation = validateXatxbdCsv(recordsetToCsv(result.recordset), "live A+ query");
    if (validation.errors.length > 0) {
      throw new Error(`A+ validation failed: ${validation.errors.join(" ")}`);
    }
    return {
      source: `${process.env.TAXAP_APLUS_LIBRARY || "APLUSV8FAQ"}.XATXBD`,
      retrievedAt: new Date().toISOString(),
      standardRows: validation.standardRows,
      specialRows: validation.specialRows.filter((row) => !isRetiredTaxBody(row)),
      scheduledRows: validation.scheduledRows,
      rateDistribution: validation.rateDistribution,
      warnings: validation.warnings.filter((warning) => !warning.startsWith("No header row")),
    };
  } finally {
    await pool.close();
  }
}

export async function readStateSummaries() {
  const pool = await openPool();
  try {
    const result = await pool.request().query(buildStateCoverageQuery());
    const summaries = [];
    let excludedShipTos = 0;
    for (const row of result.recordset) {
      const stateCode = String(rowValue(row, "StateCode") || "").trim().toUpperCase();
      const activeShipTos = numericValue(rowValue(row, "ActiveShipTos"));
      if (!US_STATE_CODES.has(stateCode)) {
        excludedShipTos += activeShipTos;
        continue;
      }
      summaries.push({
        stateCode,
        activeShipTos,
        activeCustomers: numericValue(rowValue(row, "ActiveCustomers")),
        taxBodyCount: numericValue(rowValue(row, "TaxBodyCount")),
      });
    }
    summaries.sort((a, b) => b.activeShipTos - a.activeShipTos || a.stateCode.localeCompare(b.stateCode));
    return { retrievedAt: new Date().toISOString(), states: summaries, excludedShipTos };
  } finally {
    await pool.close();
  }
}

export async function readStateDetail(value) {
  const stateCode = validateStateCode(value);
  const pool = await openPool();
  try {
    const assignments = await pool.request()
      .input("state", sql.Char(2), stateCode)
      .query(buildStateTaxBodyQuery());
    const assignmentRows = assignments.recordset.map((row) => ({
      taxBody: rowValue(row, "TaxBody") ? String(rowValue(row, "TaxBody")).trim() : null,
      activeShipTos: numericValue(rowValue(row, "ActiveShipTos")),
      activeCustomers: numericValue(rowValue(row, "ActiveCustomers")),
    }));
    const activeAssignmentRows = assignmentRows.filter((row) => !isRetiredTaxBody({ taxBody: row.taxBody }));
    const assignedCodes = activeAssignmentRows.map((row) => row.taxBody).filter(Boolean);
    const definitionsQuery = buildTaxBodyDefinitionsQuery(assignedCodes, linkedSettings());
    const definitionsResult = definitionsQuery ? await pool.request().query(definitionsQuery) : { recordset: [] };
    const retiredDefinitionCodes = new Set(definitionsResult.recordset
      .filter((row) => isRetiredTaxBody({ taxBody: rowValue(row, "TaxBody"), description: rowValue(row, "Description") }))
      .map((row) => String(rowValue(row, "TaxBody") || "").trim()));
    const definitions = new Map(definitionsResult.recordset
      .filter((row) => !retiredDefinitionCodes.has(String(rowValue(row, "TaxBody") || "").trim()))
      .map((row) => [String(rowValue(row, "TaxBody") || "").trim(), row]));
    const taxBodies = activeAssignmentRows.filter((assignment) => !assignment.taxBody || !retiredDefinitionCodes.has(assignment.taxBody)).map((assignment) => {
      const definition = assignment.taxBody ? definitions.get(assignment.taxBody) : undefined;
      const localRates = definition ? [1, 2, 3, 4].map((index) => numericValue(rowValue(definition, `CurrentLocalRate${index}`))) : [];
      const baseRate = definition ? numericValue(rowValue(definition, "CurrentBaseRate")) : null;
      const currentRate = definition ? numericValue(rowValue(definition, "CurrentTotalRate")) : null;
      const computedRate = definition ? numericValue(baseRate) + localRates.reduce((sum, rate) => sum + rate, 0) : null;
      return {
        ...assignment,
        description: definition ? String(rowValue(definition, "Description") || "").trim() : null,
        baseRate,
        localRates,
        currentRate,
        nextRate: definition ? numericValue(rowValue(definition, "NextTotalRate")) : null,
        nextEffectiveDate: definition ? normalizedDate(rowValue(definition, "NextEffectiveDate")) : null,
        definitionStatus: definition ? "configured" : "missing",
        rateTotalValid: definition ? Math.abs(numericValue(currentRate) - numericValue(computedRate)) < 0.001 : null,
      };
    });
    return {
      stateCode,
      retrievedAt: new Date().toISOString(),
      activeShipTos: taxBodies.reduce((sum, row) => sum + row.activeShipTos, 0),
      activeCustomerAssignments: taxBodies.reduce((sum, row) => sum + row.activeCustomers, 0),
      taxBodyCount: taxBodies.filter((row) => row.taxBody).length,
      taxBodies,
    };
  } finally {
    await pool.close();
  }
}

export function buildGeorgiaAddressQuery() {
  return `SELECT a.SASAD1 AS StreetLine, a.SASAD2 AS SecondaryLine, a.SASCTY AS City, a.SASZIP AS Zip,
    NULLIF(LTRIM(RTRIM(a.SASTXB)), '') AS TaxBody
  FROM dbo.ADDR AS a
  LEFT JOIN dbo.CUSMS AS c ON c.CMCONO = a.SACONO AND c.CMCSNO = a.SACSNO
  WHERE UPPER(LTRIM(RTRIM(a.SASHST))) = 'GA'
    AND ISNULL(LTRIM(RTRIM(a.SASUSP)), '') <> 'S'
    AND ISNULL(LTRIM(RTRIM(c.CMSUSP)), '') <> 'S'`;
}

/**
 * Reads active Georgia ship-to addresses and configured tax-body rates from A+, matches each address
 * against the official Streamlined boundary file, and returns an aggregate reconciliation. Ship-to
 * address and customer rows never leave this function; only aggregate counts and rate comparisons
 * are returned to callers.
 */
export async function readGeorgiaBoundaryReconciliation() {
  const pool = await openPool();
  let addressRows;
  let taxBodyRates;
  try {
    const addressResult = await pool.request().query(buildGeorgiaAddressQuery());
    addressRows = addressResult.recordset.map((row) => ({
      streetLine: rowValue(row, "StreetLine"),
      secondaryLine: rowValue(row, "SecondaryLine"),
      city: rowValue(row, "City"),
      zip: rowValue(row, "Zip"),
      taxBody: rowValue(row, "TaxBody") ? String(rowValue(row, "TaxBody")).trim() : null,
    }));

    const assignedCodes = [...new Set(addressRows.map((row) => row.taxBody).filter(Boolean))];
    const definitionsQuery = buildTaxBodyDefinitionsQuery(assignedCodes, linkedSettings());
    taxBodyRates = new Map();
    if (definitionsQuery) {
      const definitionsResult = await pool.request().query(definitionsQuery);
      for (const row of definitionsResult.recordset) {
        if (isRetiredTaxBody({ taxBody: rowValue(row, "TaxBody"), description: rowValue(row, "Description") })) continue;
        taxBodyRates.set(String(rowValue(row, "TaxBody") || "").trim(), numericValue(rowValue(row, "CurrentTotalRate")));
      }
    }
  } finally {
    await pool.close();
  }

  const rateSnapshot = await readOfficialGaRates();
  const boundaryFile = await readGeorgiaBoundaryArchive();
  const wantedAddressKeys = buildWantedAddressKeys(addressRows);
  const boundaryDataset = parseBoundaryCsv(boundaryFile.csvText, { wantedAddressKeys });
  const asOfDate = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const reconciliation = reconcileGeorgiaBoundary({ addresses: addressRows, boundaryDataset, rateSnapshot, taxBodyRates, asOfDate });

  return {
    retrievedAt: new Date().toISOString(),
    boundaryFileUrl: boundaryFile.boundaryFileUrl,
    boundaryRetrievedAt: boundaryFile.retrievedAt,
    boundarySourceHash: boundaryFile.sourceHash,
    rateFileUrl: rateSnapshot.machineReadableSourceUrl,
    rateSourceHash: rateSnapshot.sourceHash,
    recordTypeCounts: boundaryDataset.recordTypeCounts,
    ...reconciliation,
  };
}

function sendJson(response, status, payload, origin) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  });
  response.end(JSON.stringify(payload));
}

export function createConnectorServer({ reviews } = {}) {
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    const responseOrigin = origin === allowedOrigin ? origin : allowedOrigin;
    if (request.method === "OPTIONS") {
      if (origin !== allowedOrigin) return sendJson(response, 403, { error: "Origin not allowed." }, responseOrigin);
      return sendJson(response, 204, {}, responseOrigin);
    }

    const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname === "/health" && request.method === "GET") {
      return sendJson(response, 200, {
        status: "ready",
        configured: Boolean(process.env.TAXAP_SQL_SERVER && process.env.TAXAP_SQL_DATABASE),
        authentication: "Microsoft Entra ID",
      }, responseOrigin);
    }

    if (url.pathname === "/api/reviews" && request.method === "GET") {
      if (origin && origin !== allowedOrigin) return sendJson(response, 403, { error: "Origin not allowed." }, responseOrigin);
      try {
        const cases = (reviews ?? reviewStore()).listCases();
        return sendJson(response, 200, { cases }, responseOrigin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown review-store error";
        console.error(JSON.stringify({ event: "review_list", ok: false, message }));
        return sendJson(response, 503, { error: "TaxAP review history is temporarily unavailable." }, responseOrigin);
      }
    }

    if (url.pathname === "/api/reviews" && request.method === "POST") {
      if (origin && origin !== allowedOrigin) return sendJson(response, 403, { error: "Origin not allowed." }, responseOrigin);
      try {
        const payload = await readJsonBody(request);
        const reviewCase = (reviews ?? reviewStore()).saveDecision(payload);
        console.info(JSON.stringify({ event: "review_decision", ok: true, findingKey: reviewCase.findingKey, status: reviewCase.status, actor: reviewCase.assignedTo }));
        return sendJson(response, 200, { case: reviewCase }, responseOrigin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid review request";
        console.error(JSON.stringify({ event: "review_decision", ok: false, message }));
        return sendJson(response, 400, { error: message }, responseOrigin);
      }
    }

    if (url.pathname === "/api/aplus/tax-bodies" && (request.method === "GET" || request.method === "POST")) {
      if (origin && origin !== allowedOrigin) return sendJson(response, 403, { error: "Origin not allowed." }, responseOrigin);
      try {
        const snapshot = await readLiveTaxBodies();
        console.info(JSON.stringify({ event: "aplus_tax_body_refresh", ok: true, rows: snapshot.standardRows.length, retrievedAt: snapshot.retrievedAt }));
        return sendJson(response, 200, snapshot, responseOrigin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown connector error";
        console.error(JSON.stringify({ event: "aplus_tax_body_refresh", ok: false, message }));
        return sendJson(response, 503, { error: "The read-only A+ connection is unavailable. TaxAP is using its last validated snapshot." }, responseOrigin);
      }
    }

    if (url.pathname === "/api/aplus/states" && (request.method === "GET" || request.method === "POST")) {
      if (origin && origin !== allowedOrigin) return sendJson(response, 403, { error: "Origin not allowed." }, responseOrigin);
      try {
        const snapshot = await readStateSummaries();
        console.info(JSON.stringify({ event: "aplus_state_coverage_refresh", ok: true, states: snapshot.states.length, retrievedAt: snapshot.retrievedAt }));
        return sendJson(response, 200, snapshot, responseOrigin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown connector error";
        console.error(JSON.stringify({ event: "aplus_state_coverage_refresh", ok: false, message }));
        return sendJson(response, 503, { error: "The read-only A+ state coverage query is unavailable." }, responseOrigin);
      }
    }

    if (url.pathname === "/api/official/nc-rates" && (request.method === "GET" || request.method === "POST")) {
      if (origin && origin !== allowedOrigin) return sendJson(response, 403, { error: "Origin not allowed." }, responseOrigin);
      try {
        const snapshot = await readOfficialNcRates();
        console.info(JSON.stringify({ event: "ncdor_rate_refresh", ok: true, rows: snapshot.rates.length, futureChanges: snapshot.futureChanges.length, retrievedAt: snapshot.retrievedAt }));
        return sendJson(response, 200, snapshot, responseOrigin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown NCDOR source error";
        console.error(JSON.stringify({ event: "ncdor_rate_refresh", ok: false, message }));
        return sendJson(response, 503, { error: "The official NCDOR county-rate source is unavailable or failed validation." }, responseOrigin);
      }
    }

    if (url.pathname === "/api/official/sources" && request.method === "GET") {
      if (origin && origin !== allowedOrigin) return sendJson(response, 403, { error: "Origin not allowed." }, responseOrigin);
      return sendJson(response, 200, { sources: listOfficialSourceRegistry() }, responseOrigin);
    }

    const officialStateMatch = url.pathname.match(/^\/api\/official\/states\/([^/]+)$/);
    if (officialStateMatch && (request.method === "GET" || request.method === "POST")) {
      if (origin && origin !== allowedOrigin) return sendJson(response, 403, { error: "Origin not allowed." }, responseOrigin);
      try {
        const stateCode = validateStateCode(decodeURIComponent(officialStateMatch[1]));
        if (stateCode === "GA") {
          const snapshot = await readOfficialGaRates();
          console.info(JSON.stringify({ event: "official_state_refresh", ok: true, stateCode, rates: snapshot.rates.length, retrievedAt: snapshot.retrievedAt }));
          return sendJson(response, 200, snapshot, responseOrigin);
        }
        if (stateCode === "CA") {
          const snapshot = await readOfficialCaRates();
          console.info(JSON.stringify({ event: "official_state_refresh", ok: true, stateCode, rates: snapshot.rates.length, retrievedAt: snapshot.retrievedAt }));
          return sendJson(response, 200, snapshot, responseOrigin);
        }
        if (stateCode === "TX") {
          const snapshot = await readOfficialTxRates();
          console.info(JSON.stringify({ event: "official_state_refresh", ok: true, stateCode, rates: snapshot.rates.length, retrievedAt: snapshot.retrievedAt }));
          return sendJson(response, 200, snapshot, responseOrigin);
        }
        if (stateCode === "FL") {
          const snapshot = await readOfficialFlRates();
          console.info(JSON.stringify({ event: "official_state_refresh", ok: true, stateCode, rates: snapshot.rates.length, retrievedAt: snapshot.retrievedAt }));
          return sendJson(response, 200, snapshot, responseOrigin);
        }
        if (stateCode === "OH" || stateCode === "TN") {
          const snapshot = await readOfficialSstStateRates(stateCode);
          console.info(JSON.stringify({ event: "official_state_refresh", ok: true, stateCode, rates: snapshot.rates.length, retrievedAt: snapshot.retrievedAt }));
          return sendJson(response, 200, snapshot, responseOrigin);
        }
        if (stateCode === "PA") {
          const snapshot = await readOfficialPaRates();
          console.info(JSON.stringify({ event: "official_state_refresh", ok: true, stateCode, rates: snapshot.rates.length, retrievedAt: snapshot.retrievedAt }));
          return sendJson(response, 200, snapshot, responseOrigin);
        }
        if (stateCode === "NC") {
          const nc = await readOfficialNcRates();
          const snapshot = {
            stateCode: "NC",
            source: nc.source,
            sourceUrl: nc.sourceUrl,
            machineReadableSourceUrl: null,
            retrievedAt: nc.retrievedAt,
            asOfDate: nc.asOfDate,
            stateRate: 4.75,
            sourceHash: nc.sourceHash,
            rates: nc.rates.map((rate) => ({
              jurisdictionType: "county",
              jurisdictionCode: rate.taxBody,
              name: `${rate.county} County`,
              componentRate: Number((rate.officialRate - 4.75).toFixed(4)),
              totalGeneralRate: rate.officialRate,
              generalInterstateRate: rate.officialRate,
              beginDate: rate.recentEffectiveDate,
              endDate: null,
            })),
            counts: { counties: nc.rates.length, cities: 0, specialJurisdictions: 0 },
            boundaryStatus: "All 100 county totals are connected to the NC county comparison.",
          };
          return sendJson(response, 200, snapshot, responseOrigin);
        }
        const source = officialSourceForState(stateCode);
        return sendJson(response, 501, { error: `${stateCode} official-rate adapter is not connected yet.`, source }, responseOrigin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown official-rate source error";
        const status = /valid U\.S\. state code/.test(message) ? 400 : 503;
        console.error(JSON.stringify({ event: "official_state_refresh", ok: false, message }));
        return sendJson(response, status, { error: status === 400 ? message : "The official state rate source is unavailable or failed validation." }, responseOrigin);
      }
    }

    if (url.pathname === "/api/official/states/GA/boundary" && (request.method === "GET" || request.method === "POST")) {
      if (origin && origin !== allowedOrigin) return sendJson(response, 403, { error: "Origin not allowed." }, responseOrigin);
      try {
        const reconciliation = await readGeorgiaBoundaryReconciliation();
        console.info(JSON.stringify({
          event: "ga_boundary_reconciliation", ok: true,
          activeShipTos: reconciliation.totals.activeShipTos, matched: reconciliation.totals.matched,
          unmatched: reconciliation.totals.unmatched, ambiguous: reconciliation.totals.ambiguous,
          retrievedAt: reconciliation.retrievedAt,
        }));
        return sendJson(response, 200, reconciliation, responseOrigin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Georgia boundary error";
        console.error(JSON.stringify({ event: "ga_boundary_reconciliation", ok: false, message }));
        return sendJson(response, 503, { error: "The Georgia boundary-match reconciliation is unavailable or failed validation." }, responseOrigin);
      }
    }

    const stateDetailMatch = url.pathname.match(/^\/api\/aplus\/states\/([^/]+)$/);
    if (stateDetailMatch && (request.method === "GET" || request.method === "POST")) {
      if (origin && origin !== allowedOrigin) return sendJson(response, 403, { error: "Origin not allowed." }, responseOrigin);
      try {
        const snapshot = await readStateDetail(decodeURIComponent(stateDetailMatch[1]));
        console.info(JSON.stringify({ event: "aplus_state_detail_refresh", ok: true, stateCode: snapshot.stateCode, taxBodies: snapshot.taxBodies.length, retrievedAt: snapshot.retrievedAt }));
        return sendJson(response, 200, snapshot, responseOrigin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown connector error";
        const status = /valid U\.S\. state code/.test(message) ? 400 : 503;
        console.error(JSON.stringify({ event: "aplus_state_detail_refresh", ok: false, message }));
        return sendJson(response, status, { error: status === 400 ? message : "The read-only A+ state detail query is unavailable." }, responseOrigin);
      }
    }

    return sendJson(response, 404, { error: "Not found." }, responseOrigin);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createConnectorServer().listen(port, host, () => {
    console.info(JSON.stringify({ event: "taxap_connector_started", host, port, allowedOrigin }));
  });
}
