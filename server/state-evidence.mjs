import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { aggregateMatchDiagnostic } from './match-diagnostic.mjs';

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));

// Explicit aggregate allowlist. Do not persist ship-to/customer or credential data.
export function aggregateEvidence(stateCode, value) {
  const result = pick(value, ["stateCode", "expectedTaxBody", "officialRate", "aplusRate", "rateDifference", "hasDifference", "comparisonStatus", "totals", "findings", "taxBodyFindings", "comparisonScope", "noTaxPolicy", "boundaryFileUrl", "boundaryRetrievedAt", "boundarySourceHash", "rateFileUrl", "rateSourceHash", "rateRetrievedAt"]);
  for (const key of ["findings", "taxBodyFindings"]) if (Array.isArray(result[key])) result[key] = result[key].map(row => pick(row, ["taxBody", "description", "activeShipTos", "jurisdictionLabel", "officialRate", "aplusRate", "rateDifference", "hasDifference", "matched", "matchedShipTos", "jurisdictionAssignmentConsistent", "identityStatus", "locationStatus"]));
  for (const key of ['findings', 'taxBodyFindings']) if (result[key]) result[key] = result[key].map((row, index) => {
    const diagnostic = aggregateMatchDiagnostic(value[key][index].matchDiagnostic);
    return diagnostic && diagnostic.stateCode === stateCode ? { ...row, matchDiagnostic: diagnostic } : row;
  });
  const official = value.officialSnapshot;
  if (official) result.officialSnapshot = pick(official, ["stateCode", "source", "sourceUrl", "machineReadableSourceUrl", "retrievedAt", "asOfDate", "sourceHash", "effectivePeriod", "rates", "futureChanges", "stateRate"]);
  if (stateCode === "NC") result.aplusSnapshot = pick(value.aplusSnapshot, ["source", "retrievedAt", "standardRows", "specialRows", "scheduledRows", "rateDistribution"]);
  if (stateCode === 'NC' && value.componentDiagnostics) result.componentDiagnostics=Object.fromEntries(Object.entries(value.componentDiagnostics)
    .flatMap(([key,value])=>{const diagnostic=aggregateMatchDiagnostic(value);return /^NC\d{3}$/.test(key)&&diagnostic?.stateCode==='NC'?[[key,diagnostic]]:[];}));
  return result;
}

export function createStateEvidenceStore(directory) {
  function path(state) {
    if (!/^[A-Z]{2}$/.test(state)) throw new Error("Invalid evidence state.");
    return resolve(directory, `${state}.json`);
  }
  function get(state) {
    const filename = path(state);
    if (!existsSync(filename)) return null;
    const record = JSON.parse(readFileSync(filename, "utf8"));
    if (record.version !== 1 || record.stateCode !== state || !Number.isFinite(Date.parse(record.validatedAt)) || hash(record.value) !== record.hash) throw new Error("Stored state evidence failed integrity validation.");
    return record;
  }
  function put(stateCode, value, validatedAt) {
    const record = { version: 1, stateCode, validatedAt, value: aggregateEvidence(stateCode, value) };
    record.hash = hash(record.value);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    // Older overlapping reads must not replace newer evidence.
    let previous; try { previous = get(stateCode); } catch { /* A new valid read repairs corrupt evidence. */ }
    if (previous && previous.validatedAt > validatedAt) return;
    const filename = path(stateCode); const temporary = `${filename}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(record), { mode: 0o600 });
    renameSync(temporary, filename);
  }
  return { get, put };
}

export function stateFailureReason(error) {
  const message = String(error?.message ?? "");
  if (/timeout|abort/i.test(message)) return "Source or comparison request timed out";
  if (/certificate|tls|ssl/i.test(message)) return "Certificate validation failed";
  if (/HTTP|fetch|unavailable|network|socket|connect/i.test(message)) return "Source or database connection unavailable";
  return "Source or comparison validation failed; adapter review required";
}
