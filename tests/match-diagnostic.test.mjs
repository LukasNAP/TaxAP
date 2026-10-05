import test from 'node:test';
import assert from 'node:assert/strict';
import { readTexasAplusComparison } from '../server/tx-aplus.mjs';
import { readVirginiaAplusComparison } from '../server/va-aplus.mjs';
import { readMinnesotaAplusComparison } from '../server/mn-aplus.mjs';
import { readIowaAplusComparison } from '../server/ia-aplus.mjs';
import { reconcileConfirmedNoTax } from '../server/no-tax-policy-aplus.mjs';
import { aggregateMatchDiagnostic } from '../server/match-diagnostic.mjs';
import { aggregateEvidence } from '../server/state-evidence.mjs';
import { assignmentGaps } from '../server/assignment-gaps.mjs';
import { comparisonHealth } from '../server/comparison-health.mjs';
import { directMappingFindingsFromReconciliation } from '../app/dashboard-findings.ts';
import { evidenceSourceLink } from '../app/match-diagnostic.ts';

const detail = (stateCode, descriptions, currentRate = 7) => ({ stateCode, activeShipTos: descriptions.length,
  taxBodies: descriptions.map((description,i) => ({ taxBody: `${stateCode}${100+i}`, description, currentRate, activeShipTos: 1 })) });
const source = rates => ({ rates, sourceUrl: 'https://example.gov/rates', retrievedAt: '2026-10-05T12:00:00Z', sourceHash: 'a'.repeat(64) });

test('Texas retains actual county candidates for conflicts, equal-rate identity ambiguity and failed hints', async () => {
  const rates = [{ name: 'Example (Alpha Co)', county: 'Alpha', totalGeneralRate: 7 }, { name: 'Example (Beta Co)', county: 'Beta', totalGeneralRate: 8 },
    { name: 'Uniform (Alpha Co)', county: 'Alpha', totalGeneralRate: 8 }, { name: 'Uniform (Beta Co)', county: 'Beta', totalGeneralRate: 8 }];
  const result = await readTexasAplusComparison(detail('TX',['Texas Example','Texas Uniform','Texas Example(MissingCo']), { readOfficialTxRates: async () => source(rates) });
  assert.deepEqual(result.findings.map(r => [r.matched,r.officialRate,r.identityStatus]), [[false,null,'ambiguous'],[true,8,'ambiguous'],[false,null,'unresolved']]);
  assert.deepEqual(result.findings.map(r => r.matchDiagnostic.reason), ['conflicting_rates','multiple_candidates','county_hint_not_found']);
  assert.deepEqual(result.findings[0].matchDiagnostic.candidates, rates.slice(0,2));
  const inbox = directMappingFindingsFromReconciliation(result);
  assert.equal(inbox[0].confidence,'unverified');
  assert.equal(inbox[0].matchDiagnostic.candidates.length,2);
  assert.equal(assignmentGaps(result,comparisonHealth(result)).length,2);
});

test('Texas bare-row discrepancy keeps its original comparison and all conflicting evidence', async () => {
  const rates = [{name:'Example',totalGeneralRate:6.75},{name:'Example (Alpha Co)',county:'Alpha',totalGeneralRate:8.25}];
  const result = await readTexasAplusComparison(detail('TX',['Texas Example'],7), {readOfficialTxRates:async()=>source(rates)});
  assert.equal(result.findings[0].matched,true);
  assert.equal(result.findings[0].officialRate,6.75);
  assert.equal(result.findings[0].rateDifference,-0.25);
  assert.equal(result.findings[0].matchDiagnostic.candidates.length,2);
});

test('Virginia evidence separates missing city scope, duplicate eligible cities and absent names', async () => {
  const rates = [{name:'Example County',bareName:'Example',jurisdictionType:'county',totalGeneralRate:5.3},
    {name:'Duplicate City',bareName:'Duplicate',jurisdictionType:'city',totalGeneralRate:6},
    {name:'Duplicate City',bareName:'Duplicate',jurisdictionType:'city',totalGeneralRate:6.3}];
  const result = await readVirginiaAplusComparison(detail('VA',['Virginia Example (city)','Virginia Duplicate (city)','Virginia Absent','Virginia Example']), {readOfficialVaRates:async()=>source(rates)});
  assert.deepEqual(result.findings.slice(0,3).map(r=>r.matchDiagnostic.reason), ['jurisdiction_type_not_found','multiple_candidates','no_candidate']);
  assert.equal(result.findings[0].matchDiagnostic.candidates[0].jurisdictionType,'county');
  assert.equal(result.findings[1].matchDiagnostic.candidates.length,2);
  assert.equal(result.findings[3].officialRate,5.3);
  assert.equal(result.findings[3].matchDiagnostic,undefined);
});

test('Minnesota evidence distinguishes conflicting totals, inconsistent identity and unavailable totals', async () => {
  const rates = [{name:'Example',county:'A',totalGeneralRate:7},{name:'Example',county:'B',totalGeneralRate:8},
    {name:'Inconsistent',totalGeneralRate:8,ambiguousArea:true},{name:'Unavailable',totalGeneralRate:null},
    {name:'Uniform',county:'A',totalGeneralRate:8},{name:'Uniform',county:'B',totalGeneralRate:8}];
  const result = await readMinnesotaAplusComparison(detail('MN',['Minnesota Example','Minnesota Inconsistent','Minnesota Unavailable','Minnesota Uniform']), {readOfficial:async()=>source(rates)});
  assert.deepEqual(result.findings.map(r=>r.matchDiagnostic.reason),['conflicting_rates','inconsistent_identity','official_rate_unavailable','multiple_candidates']);
  assert.equal(result.findings[3].matched,true);
  assert.equal(result.findings[3].identityStatus,'ambiguous');
  assert.equal(result.findings[3].officialRate,8);
});

test('Iowa retains mixed county constituents and same-named cities without changing sales-only outcomes', async () => {
  const rates = [{name:'Example unincorporated',county:'example',jurisdictionType:'county',totalGeneralRate:6},
    {name:'Shared',county:'example',jurisdictionType:'city',totalGeneralRate:7},
    {name:'Shared',county:'other',jurisdictionType:'city',totalGeneralRate:6}];
  const result = await readIowaAplusComparison(detail('IA',['Iowa Example County','Iowa Shared','Iowa Absent']), {readOfficial:async()=>source(rates)});
  assert.deepEqual(result.findings.map(r=>r.matchDiagnostic.reason), ['conflicting_rates','conflicting_rates','no_candidate']);
  assert.equal(result.findings.every(r=>!r.matched),true);
  assert.equal(result.findings[0].matchDiagnostic.candidates.length,2);
  assert.equal(result.comparisonScope,'sales');
});

test('shared evidence survives retained aggregate storage and strips nested private data', async () => {
  const result = await readMinnesotaAplusComparison(detail('MN',['Minnesota Example']), {readOfficial:async()=>source([{name:'Example',totalGeneralRate:7,ambiguousArea:true,address:'private'}])});
  result.findings[0].matchDiagnostic.inputs.customerName='private';
  result.findings[0].matchDiagnostic.source.token='private';
  result.findings[0].matchDiagnostic.candidates[0].address='private';
  const saved = aggregateEvidence('MN',result);
  assert.equal(JSON.stringify(saved.findings).includes('private'),false);
  assert.equal(saved.findings[0].matchDiagnostic.source.sourceHash,'a'.repeat(64));
  assert.deepEqual(assignmentGaps(saved,comparisonHealth(saved))[0].matchDiagnostic,saved.findings[0].matchDiagnostic);
  assert.equal(aggregateMatchDiagnostic({version:1,stateCode:'ZZ',reason:'no_candidate'}),null);
});

test('statewide exclusions, cross-state assignments and deliberate no-tax failures carry honest noncandidate evidence', () => {
  const gaps = assignmentGaps({stateCode:'MD',expectedTaxBody:'MD000',officialRate:6,aplusRate:6,
    unclassifiedAssignments:[{taxBody:'MD999',activeShipTos:2}],crossStateAssignments:[{taxBody:'NC001',activeShipTos:1}]}, {uncheckedShipTos:3});
  assert.deepEqual(gaps.map(r=>r.matchDiagnostic.reason),['cross_state','expected_code']);
  assert.ok(gaps.every(r=>r.matchDiagnostic.candidates.length===0));
  const result = reconcileConfirmedNoTax('AK',{stateCode:'AK',activeShipTos:2,taxBodies:[
    {taxBody:'AK000',description:'Alaska',definitionStatus:'configured',currentRate:0,activeShipTos:1},
    {taxBody:'AK999',description:'Alaska',definitionStatus:'configured',currentRate:1,activeShipTos:1}]});
  assert.equal(result.totals.intentionalNoTaxShipTos,1);
  assert.equal(result.findings[0].matchDiagnostic.reason,'policy_not_met');
  assert.equal(result.findings[0].officialRate,null);
});

test('Georgia aggregate reasons are bounded public categories, without ZIP values or invented candidates', () => {
  const [gap] = assignmentGaps({stateCode:'GA',totals:{unmatched:3},unmatchedReasons:[{reason:'missing ZIP code',count:2},{reason:'private address',count:1}]},{uncheckedShipTos:3});
  assert.deepEqual(gap.matchDiagnostic.reasonCounts,[{reason:'missing ZIP code',count:2}]);
  assert.deepEqual(gap.matchDiagnostic.candidates,[]);
});

test('source links reject credentials and executable or insecure URLs', () => {
  for (const value of ['javascript:alert(1)','http://example.gov','https://user:password@example.gov']) assert.equal(evidenceSourceLink(value),null);
  assert.equal(evidenceSourceLink('https://example.gov/rates'),'https://example.gov/rates');
});
