import test from 'node:test';
import assert from 'node:assert/strict';
import { readAlabamaAplusComparison } from '../server/al-aplus.mjs';
import { assignmentGaps } from '../server/assignment-gaps.mjs';
import { comparisonHealth } from '../server/comparison-health.mjs';
import { aggregateEvidence, createStateEvidenceStore } from '../server/state-evidence.mjs';
import { aggregateAlMatchDiagnostic } from '../server/al-match-diagnostic.mjs';
import { alDiagnosticCopy, alSourceLink } from '../app/al-match-diagnostic.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const source = { stateCode:'AL',sourceUrl:'https://www.revenue.alabama.gov/sales-use/local-cities-and-counties-tax-rates-text-file/',machineReadableSourceUrl:'https://www.revenue.alabama.gov/wp-content/uploads/taxrates_current.csv',retrievedAt:'2026-10-05T14:00:00Z',asOfDate:'2026-09-01',sourceHash:'a'.repeat(64) };
const county = (code,name,componentRate) => ({ localityCode:code,jurisdictionCode:`AL:${code}:BASE:CL`,jurisdictionType:'county',name,componentRate,totalGeneralRate:4+componentRate });
const city = (countyCode) => ({ localityCode:'9149',jurisdictionCode:`AL:9149:${countyCode}:CL`,jurisdictionType:'city',name:'MOBILE',countyCode,countyNumber:49,componentRate:5,totalGeneralRate:9,beginDate:'2020-01-01',address:'synthetic private',customerName:'synthetic private' });
const detail = (description='Alabama Mobile',taxBody='AL9149') => ({stateCode:'AL',activeShipTos:3,taxBodies:[{taxBody,description,activeShipTos:3,currentRate:10,definitionStatus:'configured'}]});
const read = (rates, state=detail()) => readAlabamaAplusComparison(state,{readOfficialAlRates:async()=>({...source,rates})});

test('Alabama duplicate locality evidence retains distinct county-tax scopes and no selected rate',async()=>{
  const rows=[city('7749'),county('7749','MOBILE COUNTY CL PRICH & MOBIL',1),city('7049'),county('7049','MOBILE COUNTY',1.5),{...city('7049'),jurisdictionType:'special',name:'MOBILE Police Jurisdiction'}];
  const first=await read(rows),second=await read([...rows].reverse());
  const f=first.findings[0];assert.equal(f.matched,false);assert.equal(f.officialRate,null);assert.equal(f.rateDifference,null);
  assert.equal(f.matchDiagnostic.reason,'multiple_locality_rows');
  assert.deepEqual(f.matchDiagnostic,second.findings[0].matchDiagnostic);
  assert.deepEqual(f.matchDiagnostic.candidates.map(c=>c.countyCode),['7049','7749']);
  assert.equal(f.matchDiagnostic.candidates[1].countyReferences[0].name,'MOBILE COUNTY CL PRICH & MOBIL');
  assert.equal(f.matchDiagnostic.candidates[1].componentRate,5);
  assert.equal(f.matchDiagnostic.candidates[1].countyReferences[0].componentRate,1);
  assert.ok(!JSON.stringify(f.matchDiagnostic).includes('synthetic private'));
  assert.equal('totalGeneralRate' in f.matchDiagnostic.candidates[0],false);
  assert.equal(first.totals.unmatchedShipTos,3);
  assert.match(alDiagnosticCopy(f.matchDiagnostic).why,/county-tax references/);
});

test('Alabama failed code and name checks retain exact rejection evidence without a place-name guess',async()=>{
  const result=await read([county('7058','SHELBY COUNTY',1)],detail('Alabama Birmingham(Shelby','AL7058'));
  const diagnostic=result.findings[0].matchDiagnostic;
  assert.equal(diagnostic.reason,'name_mismatch');assert.equal(diagnostic.expectedName,'BIRMINGHAM');assert.equal(diagnostic.nameCheckToken,'BIRMIN');assert.equal(diagnostic.countyHint,'SHELBY');
  assert.equal(diagnostic.candidates[0].name,'SHELBY COUNTY');assert.equal(result.findings[0].officialRate,null);
  const absent=await read([],detail('Alabama Example','AL9999'));
  assert.equal(absent.findings[0].matchDiagnostic.reason,'locality_code_not_found');assert.deepEqual(absent.findings[0].matchDiagnostic.candidates,[]);
  const invalid=await read([],detail('Alabama Example','ALX'));
  assert.equal(invalid.findings[0].matchDiagnostic.reason,'unsupported_code');
});

test('Alabama county-hint failures explain zero versus multiple candidates and preserve resolved comparisons',async()=>{
  const base={...city(null),localityCode:'9137',jurisdictionCode:'9137',name:'EXAMPLE'};
  const counties=[county('7001','SAINT ALPHA COUNTY',1),county('7002','SAINT BETA COUNTY',2)];
  const conflict=await read([base,...counties],detail('Alabama Example (Saint','AL9137'));
  assert.equal(conflict.findings[0].matchDiagnostic.reason,'county_hint_ambiguous');assert.equal(conflict.findings[0].matchDiagnostic.candidateBasis,'county-hint');assert.equal(conflict.findings[0].matchDiagnostic.candidates.length,2);
  const unknown=await read([base,...counties],detail('Alabama Example (Unknown)','AL9137'));
  assert.equal(unknown.findings[0].matchDiagnostic.reason,'county_hint_not_found');assert.equal(unknown.findings[0].officialRate,null);
  const empty=await read([base,...counties],detail('Alabama Example ()','AL9137'));
  assert.equal(empty.findings[0].matchDiagnostic.reason,'empty_county_hint');
  const matched=await read([base,...counties],detail('Alabama Example (Saint Alpha)','AL9137'));
  assert.equal(matched.findings[0].officialRate,10);assert.equal(matched.findings[0].matched,true);assert.equal('matchDiagnostic' in matched.findings[0],false);
});

test('Alabama scope exclusions get explanations without entering rate comparisons',async()=>{
  for(const [taxBody,description,definitionStatus,reason] of [['AL000',null,'missing','missing_definition'],['AL7049E','Alabama Mobile Equip','configured','equipment_scope'],['AL7157','Alabama Russell Co PJ','configured','police_jurisdiction_scope']]){
    const state=detail(description,taxBody);state.taxBodies[0].definitionStatus=definitionStatus;
    const result=await read([],state);assert.equal(result.findings.length,0);assert.equal(result.totals.misinputShipTos,3);
    assert.equal(assignmentGaps(result,comparisonHealth(result))[0].matchDiagnostic.reason,reason);
  }
});

test('Alabama candidate evidence reaches the queue and survives aggregate persistence with a nested allowlist',async()=>{
  const result=await read([city('7049'),city('7749')]);
  result.findings[0].matchDiagnostic.secret='synthetic private';result.findings[0].matchDiagnostic.source.token='synthetic private';result.findings[0].matchDiagnostic.candidates[0].customerName='synthetic private';
  const gap=assignmentGaps(result,comparisonHealth(result))[0];assert.equal(gap.matchDiagnostic.candidates.length,2);
  assert.ok(!JSON.stringify(gap).includes('synthetic private'));
  assert.ok(!JSON.stringify(aggregateEvidence('AL',result).findings[0].matchDiagnostic).includes('synthetic private'));
  const dir=mkdtempSync(join(tmpdir(),'taxap-al-diag-'));
  try {createStateEvidenceStore(dir).put('AL',result,source.retrievedAt);assert.deepEqual(createStateEvidenceStore(dir).get('AL').value.findings[0].matchDiagnostic,gap.matchDiagnostic);}
  finally {rmSync(dir,{recursive:true,force:true});}
  assert.equal(aggregateAlMatchDiagnostic({...gap.matchDiagnostic,stateCode:'TX'}),null);
  assert.equal(aggregateAlMatchDiagnostic({...gap.matchDiagnostic,reason:'invented'}),null);
  assert.equal(alSourceLink('https://example.com/'),null);assert.equal(alSourceLink('javascript:alert(1)'),null);assert.equal(alSourceLink(source.sourceUrl),source.sourceUrl);
});
