import test from 'node:test';
import assert from 'node:assert/strict';
import { componentEvidence, aggregateComponentEvidence } from '../server/component-evidence.mjs';
import { readAlabamaAplusComparison } from '../server/al-aplus.mjs';
import { aggregateEvidence } from '../server/state-evidence.mjs';
import { assignmentGaps } from '../server/assignment-gaps.mjs';
import { comparisonHealth } from '../server/comparison-health.mjs';
import { createMatchDiagnostics } from '../server/match-diagnostic.mjs';
import { buildTaxBodyDefinitionsQuery } from '../server/aplus-connector.mjs';
import { readFloridaAplusComparison } from '../server/fl-aplus.mjs';
import { componentPolicies } from '../server/component-policy.mjs';
import { listOfficialSourceRegistry } from '../server/official-source-registry.mjs';
import { parseArkansasLocalTable } from '../server/ar-aplus.mjs';
import { parseMinnesotaMap } from '../server/mn-aplus.mjs';
import { northCarolinaComponentDiagnostics } from '../server/nc-component-evidence.mjs';
import { parseNcdorStateRate } from '../server/ncdor-rates.mjs';

const row = { taxBody:'AL9137',description:'Alabama Birmingham',activeShipTos:48,currentRate:8.5,definitionStatus:'configured',localDescriptions:['Birmingham','Shelby Co.','',''],localRates:[3.5,1,0,0] };
const cities = ['7037','7058','7237'].map(countyCode => ({name:'BIRMINGHAM',localityCode:'9137',jurisdictionCode:`AL:9137:${countyCode}:CL`,jurisdictionType:'city',componentKind:'city',componentRate:4,countyCode}));
const source = {stateCode:'AL',rates:cities,asOfDate:'2026-10-01',retrievedAt:'2026-10-06T13:04:16Z',sourceUrl:'https://www.revenue.alabama.gov/rates'};

test('all 50 states and DC have explicit component capability and visible coverage', () => {
  const registry=listOfficialSourceRegistry();
  assert.equal(registry.length,51);
  assert.deepEqual(Object.keys(componentPolicies).sort(),registry.map(r=>r.stateCode).sort());
  for(const entry of registry) assert.match(entry.componentCoverage,/Component review:/);
});
test('complete local subtotal works for every eligible state without inventing named levies', () => {
  const configured={baseRate:6,currentRate:8,localRates:[1,1,0,0],localDescriptions:['Local 1','Local 2','','']};
  for(const [stateCode,policy] of Object.entries(componentPolicies)) {
    const result=componentEvidence(configured,[{name:'Example',jurisdictionType:'city',totalGeneralRate:7}],{stateCode,source:{stateRate:6}});
    if(policy.combined) {assert.equal(result[0].kind,'combined-local');assert.equal(result[0].officialRate,1);assert.equal(result[0].difference,-1);}
    else assert.equal(result,null,stateCode);
  }
});
test('subtotal requires a verified base, complete configured components and agreeing totals', () => {
  const configured={baseRate:6,currentRate:8,localRates:[1,1,0,0]};
  const candidates=[{name:'Example',totalGeneralRate:7}];
  const options={stateCode:'TX',source:{stateRate:6}};
  for(const change of [{baseRate:5},{currentRate:9},{localRates:[1,1]},{localRates:[1,1,null,0]},{localRates:[1,1,'0',0]}]) assert.equal(componentEvidence({...configured,...change},candidates,options),null);
  assert.equal(componentEvidence(configured,candidates,{stateCode:'TX'}),null);
  assert.equal(componentEvidence(configured,[...candidates,{totalGeneralRate:7.5}],options),null);
  assert.equal(componentEvidence(configured,[{...candidates[0],ambiguousArea:true}],options),null);
  assert.equal(componentEvidence(configured,candidates,{...options,allowCombined:false}),null);
  assert.equal(componentEvidence(configured,[{...candidates[0],stateComponentRate:6}],{stateCode:'UT'})[0].officialRate,1);
});
test('named components compare only the common exact scoped layer across candidates', () => {
  const configured={localDescriptions:['Example County','Other City'],localRates:[1,0.5]};
  const candidates=[{components:[{type:'county',name:'Example County',rate:1.5},{type:'city',name:'Other City',rate:1}]},
    {components:[{type:'county',name:'Example County',rate:1.5},{type:'city',name:'Different City',rate:1}]}];
  assert.equal(componentEvidence(configured,candidates,{stateCode:'OK'}).length,1);
  assert.equal(componentEvidence(configured,candidates,{stateCode:'OK'})[0].kind,'county');
  assert.equal(componentEvidence(configured,[{components:[{type:'city',name:'Example County',rate:1},{type:'county',name:'Example County',rate:1}]}],{stateCode:'OK'}),null);
  assert.equal(componentEvidence(configured,[{name:'Example County',jurisdictionType:'county',componentRate:1.5}],{stateCode:'NV'}),null);
  assert.equal(componentEvidence(configured,candidates,{stateCode:'TX'}),null);
});
test('Arkansas preserves published city/county layers and never invents a varied county rate', () => {
  const rows=parseArkansasLocalTable('TEST\n- CITY LIST -\nExample 01-01 01/01/26 2.000% Sample 1.000% 3.000%\nBorder 01-02 01/01/26 2.000% Sample/Other See Below Varies\n- COUNTY LIST -\nSample County 01-00 01/01/26 1.000%',{period:'TEST',stateRate:6.5,minimumCities:2,expectedCounties:1});
  assert.deepEqual(rows[0].components,[{type:'city',name:'Example',rate:2},{type:'county',name:'Sample County',rate:1}]);
  assert.equal(rows[1].totalGeneralRate,null);assert.equal(rows[1].components.length,1);
});
test('Minnesota missing layer cells remain unavailable while an explicit zero is comparable', () => {
  const attributes={NameLabel:'Example',NameFrmal:'Example',CountyName:'Sample',TotalFrmal:'6.875%',StFrmal:'6.875%',CityFrmal:null,CtyFrmal:null};
  const parse=values=>parseMinnesotaMap({features:[{attributes:values}]},{minimumRows:1})[0];
  assert.deepEqual(parse(attributes).components,[]);
  assert.deepEqual(parse({...attributes,CtyFrmal:'0%'}).components,[{type:'county',name:'Sample County',rate:0}]);
});
test('North Carolina validates current published base and retains only aggregate subtotal evidence', () => {
  const html='<table><tr><th>Effective Dates</th><th>State Rate</th></tr><tr><td>7/1/2011 – Current</td><td>4.75%</td></tr></table>';
  assert.equal(parseNcdorStateRate(html,'2026-10-06'),4.75);
  assert.equal(parseNcdorStateRate(html,'2010-01-01'),null);
  assert.equal(parseNcdorStateRate(html+html,'2026-10-06'),null);
  assert.equal(parseNcdorStateRate('', '2026-10-06'),null);
  const detail={taxBodies:[{taxBody:'NC060',baseRate:4.75,currentRate:7.25,localRates:[2,0.5,0,0],description:'North Carolina Mecklenburg'}]};
  const snapshot={stateRate:4.75,rates:[{taxBody:'NC060',county:'Mecklenburg',officialRate:8.25}]};
  const diagnostics=northCarolinaComponentDiagnostics(detail,snapshot);
  assert.equal(diagnostics.NC060.componentEvidence[0].officialRate,3.5);
  assert.equal(diagnostics.NC060.componentEvidence[0].kind,'combined-local');
  assert.deepEqual(aggregateEvidence('NC',{componentDiagnostics:diagnostics}).componentDiagnostics,diagnostics);
  assert.deepEqual(northCarolinaComponentDiagnostics(detail,{...snapshot,stateRate:null}),{});
});
test('label-supported city difference survives gaps and retained evidence without resolving the total', async () => {
  const result = await readAlabamaAplusComparison({stateCode:'AL',activeShipTos:48,taxBodies:[row]}, {readOfficialAlRates:async()=>source});
  const finding=result.findings[0];
  assert.equal(finding.matched,false);assert.equal(finding.officialRate,null);assert.equal(finding.rateDifference,null);assert.equal(finding.hasDifference,false);
  const evidence=finding.matchDiagnostic.componentEvidence;
  assert.equal(evidence[0].aplusRate,3.5);assert.equal(evidence[0].officialRate,4);assert.equal(evidence[0].difference,0.5);assert.equal(evidence[0].candidateCount,3);
  assert.deepEqual(assignmentGaps(result,comparisonHealth(result))[0].matchDiagnostic.componentEvidence,evidence);
  assert.deepEqual(aggregateEvidence('AL',result).findings[0].matchDiagnostic.componentEvidence,evidence);
  assert.equal(result.totals.unmatchedShipTos,48);
});
test('missing, duplicated or non-equivalent labels cannot establish a comparison', () => {
  for(const value of [{...row,localDescriptions:undefined},{...row,localDescriptions:['Local 1']},{...row,localDescriptions:['Birmingham','Birmingham']},{...row,localRates:[null]},{...row,localRates:['3.5']}]) assert.equal(componentEvidence(value,cities),null);
  assert.equal(componentEvidence(row,[]),null);
  for(const alteration of [{componentRate:4.1},{componentRate:null},{componentKind:undefined},{componentKind:'county'},{name:'Different city'}]) assert.equal(componentEvidence(row,[cities[0],{...cities[1],...alteration}]),null);
});
test('combined-local amounts never become city components merely because names agree', () => {
  assert.equal(componentEvidence(row,[{name:'Birmingham',jurisdictionType:'city',componentRate:4,totalGeneralRate:8}]),null);
});
test('shared diagnostics support explicitly typed county components and reject future/excluded scopes', () => {
  const diagnostics=createMatchDiagnostics('FL',{sourceUrl:'https://floridarevenue.com/rates'});
  const countyRow={taxBody:'FL001',localDescriptions:['Example Co.'],localRates:[0.5]};
  const candidates=[{name:'Example County',componentKind:'county',componentRate:1},{name:'Example County',componentKind:'county',componentRate:1}];
  diagnostics.record(countyRow,'multiple_candidates',candidates);
  assert.equal(diagnostics.get(countyRow).componentEvidence[0].difference,0.5);
  for(const reason of ['future_rate','scope_not_supported','cross_state','inconsistent_identity']) {diagnostics.record(countyRow,reason,candidates);assert.equal(diagnostics.get(countyRow).componentEvidence,undefined);}
});
test('threshold, equal rates and aggregate privacy are preserved', () => {
  const evidence=componentEvidence({...row,localRates:[4]},cities);
  assert.equal(evidence[0].hasDifference,false);
  assert.equal(componentEvidence({...row,localRates:[3.999]},cities)[0].hasDifference,true);
  assert.equal(componentEvidence({...row,localRates:[3.9999]},cities)[0].hasDifference,false);
  const clean=aggregateComponentEvidence([{...evidence[0],difference:999,hasDifference:true,address:'private synthetic',customerName:'private synthetic',token:'private synthetic'}]);
  assert.equal(clean[0].difference,0);assert.equal(clean[0].hasDifference,false);assert.ok(!JSON.stringify(clean).includes('private synthetic'));
});
test('definition query reads component descriptions and does not add a write operation', () => {
  const query=buildTaxBodyDefinitionsQuery(['AL9137']);
  for(let i=1;i<=4;i++)assert.ok(query.includes(`TBL${i}DSC AS LocalDescription${i}`));
  assert.doesNotMatch(query,/\b(?:UPDATE|INSERT|DELETE|MERGE|ALTER)\b/i);
});
test('Florida uses the shared component comparison while preserving its existing combined-rate finding', async () => {
  const result=await readFloridaAplusComparison({stateCode:'FL',activeShipTos:2,taxBodies:[{taxBody:'FL050',description:'Florida Palm Beach',activeShipTos:2,currentRate:7,localDescriptions:['Palm Beach Co.'],localRates:[1]}]}, {
    readOfficialFlRates:async()=>({stateCode:'FL',sourceUrl:'https://floridarevenue.com/rates',rates:[{county:'PALM BEACH',name:'Palm Beach County',jurisdictionType:'county',componentKind:'county',componentRate:0.5,totalGeneralRate:6.5}]}) });
  const finding=result.findings[0];assert.equal(finding.matched,true);assert.equal(finding.officialRate,6.5);assert.equal(finding.hasDifference,true);
  assert.equal(finding.matchDiagnostic.reason,'component_difference');assert.equal(finding.matchDiagnostic.componentEvidence[0].difference,-0.5);
  assert.deepEqual(aggregateEvidence('FL',result).findings[0].matchDiagnostic.componentEvidence,finding.matchDiagnostic.componentEvidence);
});
