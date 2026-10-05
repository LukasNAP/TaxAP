import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentGaps } from '../server/assignment-gaps.mjs';
import { comparisonHealth } from '../server/comparison-health.mjs';
import { initialQueueFilters, matchesQueueFinding, matchesQueueGap } from '../app/review-queue.ts';
import { readAllWiredStateFindings } from '../server/aplus-connector.mjs';

test('unchecked reason groups reconcile to coverage without guessing or exposing row details',()=>{
  const result={stateCode:'FL',totals:{activeShipTos:20},findings:[
    {taxBody:'FL001',activeShipTos:5,matched:true,aplusRate:7,officialRate:7},
    {taxBody:'FL002',activeShipTos:3,matched:false,definitionStatus:'missing',customerName:'synthetic private'},
    {taxBody:'FL003',activeShipTos:4,matched:false,address:'synthetic private'},
    {taxBody:'FL004',activeShipTos:2,matched:true,aplusRate:null,officialRate:7},
  ],crossStateAssignments:[{taxBody:'NC001',activeShipTos:4}],misinputAssignments:[{taxBody:'ZTEMP',activeShipTos:2}]};
  const health=comparisonHealth(result);const gaps=assignmentGaps(result,health);
  assert.equal(gaps.reduce((sum,row)=>sum+row.shipTos,0),health.uncheckedShipTos);
  assert.equal(gaps.find(row=>row.taxBody==='FL002').reason,'missing_definition');
  assert.equal(gaps.find(row=>row.taxBody==='FL003').reason,'unresolved_jurisdiction');
  assert.equal(gaps.find(row=>row.taxBody==='FL004').reason,'missing_rate');
  assert.ok(!JSON.stringify(gaps).includes('synthetic private'));
});
test('deliberate no-tax and conflicting aggregates cannot inflate unresolved totals',()=>{
  const result={stateCode:'AK',totals:{activeShipTos:8,intentionalNoTaxShipTos:8},findings:[]};
  assert.deepEqual(assignmentGaps(result,comparisonHealth(result)),[]);
  assert.deepEqual(assignmentGaps({...result,crossStateAssignments:[{taxBody:'TEST',activeShipTos:10}]},{uncheckedShipTos:3}),[{stateCode:'AK',taxBody:null,shipTos:3,reason:'unknown'}]);
  assert.deepEqual(assignmentGaps(result,{uncheckedShipTos:null}),[]);
});
test('queue filters combine state, count, evidence and assignment reason',()=>{
  const finding={stateCode:'FL',activeShipTos:50,evidenceStatus:'stale'};
  assert.equal(matchesQueueFinding(finding,{...initialQueueFilters,state:'FL',minimum:50,evidence:'stale'}),true);
  for(const change of [{minimum:51},{state:'NC'},{evidence:'current'},{kind:'assignments'},{reason:'missing_definition'}]) assert.equal(matchesQueueFinding(finding,{...initialQueueFilters,...change}),false);
  const gap={stateCode:'NC',taxBody:'NC999',reason:'missing_definition',shipTos:12};
  assert.equal(matchesQueueGap(gap,{...initialQueueFilters,minimum:10,reason:'missing_definition'}),true);
  for(const change of [{evidence:'stale'},{state:'FL'},{kind:'rates'},{reason:'missing_rate'}]) assert.equal(matchesQueueGap(gap,{...initialQueueFilters,...change}),false);
});
test('shared batch gaps match unchecked totals and exclude unavailable states',async()=>{
  const zero=async stateCode=>({stateCode,totals:{activeShipTos:0},findings:[]});
  const base={readNc:async()=>({aplusSnapshot:{standardRows:[]},officialSnapshot:{rates:[]},stateDetail:{activeShipTos:3,taxBodies:[{taxBody:'NC999',definitionStatus:'missing',activeShipTos:3}]}}),readGa:async()=>({totals:{activeShipTos:0},taxBodyFindings:[]}),readNj:()=>zero('NJ'),readFlat:zero,readDirect:zero};
  const batch=await readAllWiredStateFindings(base);
  assert.deepEqual(batch.assignmentGaps,[{stateCode:'NC',taxBody:'NC999',shipTos:3,reason:'missing_definition'}]);
  const failed=await readAllWiredStateFindings({...base,readNc:async()=>{throw Error('unavailable');}});
  assert.deepEqual(failed.assignmentGaps,[]);assert.ok(failed.failedStates.includes('NC'));
});

import { markBatchOutage } from '../app/state-retention.ts';
import { applyFindingTreatments } from '../app/finding-treatment.ts';
test('whole-batch outages enter the stale queue and cannot reuse current treatment exclusions',()=>{
  const finding={stateCode:'FL',taxBody:'FL001',activeShipTos:50,confidence:'confirmed'};
  const stale=markBatchOutage([finding],true);
  const rows=applyFindingTreatments(stale,{taxBodies:[{taxBody:'FL001',treatments:[{treatmentCode:'0',activeShipTos:0}]}]},'ready');
  assert.equal(rows[0].rateRiskShipTos,null);
  assert.equal(matchesQueueFinding(rows[0],{...initialQueueFilters,evidence:'stale'}),true);
  assert.equal(matchesQueueFinding(rows[0],{...initialQueueFilters,evidence:'current'}),false);
  assert.equal(markBatchOutage([finding],false)[0],finding);
});
