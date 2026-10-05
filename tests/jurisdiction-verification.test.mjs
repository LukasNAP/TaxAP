import test from 'node:test';
import assert from 'node:assert/strict';
import { readAlabamaAplusComparison } from '../server/al-aplus.mjs';
import { readTexasAplusComparison } from '../server/tx-aplus.mjs';
import { readVirginiaAplusComparison } from '../server/va-aplus.mjs';
import { reconcileGeorgiaBoundary, parseBoundaryCsv, buildWantedAddressKeys } from '../server/ga-boundary.mjs';
import { directMappingFindingsFromReconciliation, gaFindingsFromReconciliation } from '../app/dashboard-findings.ts';
import { findingVerification } from '../app/jurisdiction-verification.ts';
import { inventoryRows, inventoryCsv } from '../app/jurisdiction-inventory.ts';
import { aggregateEvidence } from '../server/state-evidence.mjs';
import { assignmentGaps } from '../server/assignment-gaps.mjs';
import { reviewComparison, validateApproval } from '../server/review-validation.mjs';
import { findingReviewEvidence } from '../app/finding-review.ts';

const detail = (stateCode, description) => ({ stateCode, activeShipTos: 1, taxBodies: [{ taxBody: `${stateCode}123`, description, currentRate: 7, activeShipTos: 1, definitionStatus: 'configured' }] });
const unresolved = result => {
  assert.equal(result.findings[0].matched, false);
  assert.equal(result.findings[0].officialRate, null);
  assert.equal(result.findings[0].identityStatus, 'ambiguous');
  assert.equal(result.findings[0].locationStatus, 'not_checked');
  assert.equal(assignmentGaps(result, { uncheckedShipTos: 1 })[0].reason, 'ambiguous_jurisdiction');
};

test('Alabama conflicting county prefixes remain ambiguous in either source order', async () => {
  for (const entries of [[['SAINT ALPHA', 1], ['SAINT BETA', 2]], [['SAINT BETA', 2], ['SAINT ALPHA', 1]]]) {
    unresolved(await readAlabamaAplusComparison(detail('AL', 'Alabama Example (Saint)'), { readOfficialAlRates: async () => ({
      rates: [{ localityCode: '123', name: 'Example', jurisdictionType: 'city', componentRate: 1, totalGeneralRate: 6 }], countyRatesByName: Object.fromEntries(entries),
    }) }));
  }
});

test('Alabama uses the full hint and rejects an unknown hint instead of falling back', async () => {
  const snapshot = { rates: [{ localityCode: '123', name: 'Example', jurisdictionType: 'city', componentRate: 1, totalGeneralRate: 6 }], countyRatesByName: { 'SAINT ALPHA': 1, 'SAINT BETA': 2 } };
  const matched = await readAlabamaAplusComparison(detail('AL', 'Alabama Example (Saint Beta)'), { readOfficialAlRates: async () => snapshot });
  assert.equal(matched.findings[0].officialRate, 7);
  const unknown = await readAlabamaAplusComparison(detail('AL', 'Alabama Example (Missing)'), { readOfficialAlRates: async () => snapshot });
  assert.equal(unknown.findings[0].matched, false);
  for (const description of ['Alabama Example (Saint', 'Alabama Example ()']) {
    const truncated = await readAlabamaAplusComparison(detail('AL', description), { readOfficialAlRates: async () => snapshot });
    assert.equal(truncated.findings[0].matched, false);
  }
});

test('Alabama excludes duplicate-code police-jurisdiction rows and rejects conflicting general rows', async () => {
  const base = { localityCode: '123', name: 'Example', jurisdictionType: 'city', componentRate: 1, totalGeneralRate: 6 };
  const read = rates => readAlabamaAplusComparison(detail('AL', 'Alabama Example'), { readOfficialAlRates: async () => ({ rates }) });
  assert.equal((await read([base, { ...base, jurisdictionType: 'special', totalGeneralRate: 5 }])).findings[0].officialRate, 6);
  unresolved(await read([base, { ...base, totalGeneralRate: 8 }]));
});

test('Texas same-city same-county variants cannot select the first entry even with equal rates', async () => {
  for (const secondRate of [6, 8]) {
    const rates = [{ name: 'Example (Alpha Co)', county: 'Alpha', totalGeneralRate: 6 }, { name: 'Example (district)', county: 'Alpha', totalGeneralRate: secondRate }];
    for (const ordered of [rates, [...rates].reverse()]) unresolved(await readTexasAplusComparison(detail('TX', 'Texas Example (Alpha)'), { readOfficialTxRates: async () => ({ rates: ordered }) }));
  }
});

test('Virginia duplicates stay ambiguous and its current official name shape matches without bareName', async () => {
  const rates = [{ name: 'Example County', jurisdictionType: 'county', jurisdictionCode: '51001', totalGeneralRate: 5.3 }, { name: 'Example County', jurisdictionType: 'county', jurisdictionCode: '51003', totalGeneralRate: 6 }];
  for (const ordered of [rates, [...rates].reverse()]) unresolved(await readVirginiaAplusComparison(detail('VA', 'Virginia Example'), { readOfficialVaRates: async () => ({ rates: ordered }) }));
  const unique = await readVirginiaAplusComparison(detail('VA', 'Virginia Example'), { readOfficialVaRates: async () => ({ rates: [rates[0]] }) });
  assert.equal(unique.findings[0].officialRate, 5.3);
  assert.equal(unique.findings[0].identityStatus, 'confirmed');
});

test('ambiguous rate evidence remains visible but cannot approve maintenance', async () => {
  const now = new Date();
  const raw = await readTexasAplusComparison(detail('TX', 'Texas Example'), { readOfficialTxRates: async () => ({
    rates: [{ name: 'Example (Alpha Co)', county: 'Alpha', totalGeneralRate: 8 }, { name: 'Example (Beta Co)', county: 'Beta', totalGeneralRate: 8 }],
    sourceUrl: 'https://example.gov/rates', sourceHash: 'synthetic', retrievedAt: now.toISOString(),
  }) });
  const [finding] = directMappingFindingsFromReconciliation(raw);
  assert.equal(finding.identityStatus, 'ambiguous');
  assert.equal(finding.confidence, 'unverified');
  const comparison = reviewComparison('TX', raw, now);
  await assert.rejects(validateApproval(findingReviewEvidence(finding), async () => comparison, now), /no longer a current confirmed/);
});

test('GA street, ZIP and incomplete groups have distinct location statuses', () => {
  const columns = new Array(89).fill('');
  Object.assign(columns, { 0: 'A', 1: '20220101', 2: '29991231', 3: '1', 4: '99', 7: 'MAIN', 8: 'ST', 14: 'EXAMPLE', 15: '30606', 22: '13', 24: '219' });
  const zipColumns = new Array(89).fill('');
  Object.assign(zipColumns, { 0: 'Z', 1: '20220101', 2: '29991231', 17: '30607', 19: '30607', 22: '13', 24: '219' });
  const street = { streetLine: '1 MAIN ST', city: 'EXAMPLE', zip: '30606', taxBody: 'GA219' };
  const zip = { streetLine: 'UNKNOWN', city: 'EXAMPLE', zip: '30607', taxBody: 'GA219' };
  const missing = { ...zip, zip: '99999' };
  const run = addresses => reconcileGeorgiaBoundary({ addresses, boundaryDataset: parseBoundaryCsv([columns.join(','), zipColumns.join(',')].join('\n'), { wantedAddressKeys: buildWantedAddressKeys(addresses) }), rateSnapshot: { stateRate: 4, rates: [{ jurisdictionType: 'county', jurisdictionCode: '219', componentRate: 3 }] }, taxBodyRates: new Map([['GA219', 8]]), asOfDate: '20261005' });
  assert.equal(run([street]).taxBodyFindings[0].locationStatus, 'verified');
  for (const addresses of [[zip], [street, missing], [street, zip]]) {
    const raw = run(addresses);
    assert.equal(raw.taxBodyFindings[0].locationStatus, 'partial');
    assert.equal(gaFindingsFromReconciliation(raw.taxBodyFindings)[0].locationStatus, 'partial');
  }
  assert.equal(run([missing]).taxBodyFindings[0].locationStatus, 'not_checked');
});

test('inventory, CSV and archived aggregates preserve both statuses without inventing address verification', () => {
  const finding = { taxBody: 'TX123', jurisdictionLabel: 'Example', activeShipTos: 1, matched: true, hasDifference: true, aplusRate: 7, officialRate: 8, rateDifference: 1, identityStatus: 'ambiguous', locationStatus: 'not_checked' };
  const raw = { stateCode: 'TX', findings: [finding] };
  const [row] = inventoryRows('TX', null, raw, '2026-10-05');
  assert.equal(row.identityStatus, 'ambiguous');
  assert.equal(row.locationStatus, 'not_checked');
  assert.match(inventoryCsv([row]), /Jurisdiction identity/);
  assert.match(inventoryCsv([row]), /"ambiguous","not_checked"/);
  assert.equal(aggregateEvidence('TX', raw).findings[0].identityStatus, 'ambiguous');
  assert.deepEqual(findingVerification({ confidence: 'confirmed' }), { identityStatus: 'confirmed', locationStatus: 'not_checked' });
  assert.deepEqual(findingVerification({ identityStatus: 'confirmed', locationStatus: 'verified', evidenceStatus: 'stale' }), { identityStatus: 'not_checked', locationStatus: 'not_checked' });
});
