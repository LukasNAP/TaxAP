import { findingDecisionKey, findingReviewEvidence, ncReviewKey } from '../app/finding-review.ts';
import { gaFindingsFromReconciliation, flatStateFindingsFromReconciliation, directMappingFindingsFromReconciliation } from '../app/dashboard-findings.ts';
import { hasRateDifference } from '../app/rate-comparison.ts';

export function reviewComparison(stateCode, raw, now = new Date()) {
  const snapshot = raw.officialSnapshot;
  const sources = stateCode === 'GA' ? [
    { url: raw.rateFileUrl, hash: raw.rateSourceHash, retrievedAt: raw.rateRetrievedAt },
    { url: raw.boundaryFileUrl, hash: raw.boundarySourceHash, retrievedAt: raw.boundaryRetrievedAt },
  ] : [{ url: snapshot?.machineReadableSourceUrl || snapshot?.sourceUrl, hash: snapshot?.sourceHash, retrievedAt: snapshot?.retrievedAt }];
  let findings;
  if (stateCode === 'NC') {
    const configured = new Map(raw.aplusSnapshot.standardRows.map(row => [row.taxBody, row]));
    findings = snapshot.rates.flatMap(row => {
      const aplus = configured.get(row.taxBody); if (!aplus) return [];
      const future = snapshot.futureChanges.filter(change => change.county === row.county);
      const type = hasRateDifference(aplus.currentRate - row.officialRate) ? 'mismatch' : future.length ? 'upcoming' : row.recentChange ? 'recent-match' : 'matched';
      return [{ stateCode, reviewFindingKey: ncReviewKey({ taxBody: row.taxBody, currentRate: aplus.currentRate, officialRate: row.officialRate, futureDate: future[0]?.effectiveDate, recentDate: row.recentEffectiveDate, effectivePeriod: snapshot.effectivePeriod }), taxBody: row.taxBody, jurisdictionLabel: `${row.county} County`, aplusRate: aplus.currentRate, officialRate: row.officialRate, comparisonStatus: type, confidence: 'confirmed', effectiveDate: future[0]?.effectiveDate ?? row.recentEffectiveDate ?? null, sourceUrl: snapshot.sourceUrl }];
    });
  } else if (stateCode === 'GA') findings = gaFindingsFromReconciliation(raw.taxBodyFindings);
  else findings = raw.findings ? directMappingFindingsFromReconciliation(raw) : flatStateFindingsFromReconciliation(raw);
  return { findings, sources, comparisonRetrievedAt: now.toISOString(), aplusRetrievedAt: stateCode === 'NC' ? raw.aplusSnapshot.retrievedAt : now.toISOString(), scope: raw.comparisonScope || 'adapter-defined' };
}

function reject(message) { throw Object.assign(new Error(message), { statusCode: 409 }); }
export async function validateApproval(input, readComparison, now = new Date()) {
  let comparison;
  try { comparison = await readComparison(input.stateCode); }
  catch { reject('Current comparison is unavailable. Refresh before approving maintenance.'); }
  const fresh = stamp => { const age = now.getTime() - Date.parse(stamp); return Number.isFinite(age) && age >= -60000 && age <= 6 * 60 * 60 * 1000; };
  if (!fresh(comparison.comparisonRetrievedAt) || !fresh(comparison.aplusRetrievedAt) || !comparison.sources?.length || comparison.sources.some(source => !fresh(source.retrievedAt) || !source.hash || !/^https:\/\//.test(source.url || ''))) reject('Current source evidence cannot be verified. Refresh before approving maintenance.');
  const finding = comparison.findings.find(row => findingDecisionKey(row) === input.findingKey);
  if (!finding || finding.confidence !== 'confirmed' || finding.evidenceStatus === 'stale' || !['mismatch','upcoming'].includes(finding.comparisonStatus)) reject('This finding is no longer a current confirmed comparison. Refresh before approving maintenance.');
  const evidence = findingReviewEvidence(finding);
  if (['stateCode','taxBody','findingType','aplusRate','officialRate','effectiveDate'].some(key => (input[key] ?? null) !== (evidence[key] ?? null)) || !Number.isFinite(evidence.aplusRate) || !Number.isFinite(evidence.officialRate)) reject('Finding evidence has changed. Refresh before approving maintenance.');
  return { evidence, verification: { verified: true, comparisonRetrievedAt: comparison.comparisonRetrievedAt, aplusRetrievedAt: comparison.aplusRetrievedAt, sources: comparison.sources, scope: comparison.scope } };
}
