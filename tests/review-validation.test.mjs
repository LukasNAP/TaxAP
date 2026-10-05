import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewStore } from '../server/review-store.mjs';
import { createConnectorServer } from '../server/aplus-connector.mjs';
import { reviewComparison, validateApproval } from '../server/review-validation.mjs';
import { findingReviewEvidence, ncReviewKey } from '../app/finding-review.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
const now = new Date();
const raw = () => ({ stateCode:'FL', findings:[{taxBody:'FL050',jurisdictionLabel:'Synthetic County',matched:true,hasDifference:true,activeShipTos:1,aplusRate:7,officialRate:6.5,rateDifference:0.5}], officialSnapshot:{sourceUrl:'https://example.gov/rates',sourceHash:'a'.repeat(64),retrievedAt:now.toISOString()} });
const comparison = () => reviewComparison('FL',raw(),now);
const input = () => ({...findingReviewEvidence(comparison().findings[0]),status:'approved',actor:'Ana',note:'Synthetic source review'});

test('approval rejects outage, stale evidence, unknown timestamps, ambiguous jurisdiction and changed rates', async () => {
  const valid = await validateApproval(input(),async()=>comparison(),now); assert.equal(valid.verification.verified,true);
  await assert.rejects(validateApproval(input(),async()=>{throw Error('synthetic connection string');},now),/unavailable/);
  for (const patch of [ { comparisonRetrievedAt:'2020-01-01' }, { aplusRetrievedAt:null }, { sources:[{url:'https://example.gov',hash:'a',retrievedAt:'2020-01-01'}] }, { findings:comparison().findings.map(f=>({...f,confidence:'unverified'})) }, { findings:comparison().findings.map(f=>({...f,evidenceStatus:'stale'})) } ]) {
    await assert.rejects(validateApproval(input(),async()=>({...comparison(),...patch}),now));
  }
  await assert.rejects(validateApproval({...input(),officialRate:6.625},async()=>comparison(),now),/changed/);
  await assert.rejects(validateApproval({...input(),findingKey:'FL-FL050-current:a7:o6.625'},async()=>comparison(),now),/no longer/);
});

test('NC server comparison uses the same date/rate key and future-change precedence as the UI', async()=>{
  const snapshot = {retrievedAt:now.toISOString(),sourceUrl:'https://example.gov/nc',sourceHash:'a'.repeat(64),effectivePeriod:'2026-10-01',rates:[{taxBody:'NC001',county:'Alamance',officialRate:7,recentEffectiveDate:null}],futureChanges:[{county:'Alamance',effectiveDate:'2027-01-01'}]};
  const nc = reviewComparison('NC',{aplusSnapshot:{retrievedAt:now.toISOString(),standardRows:[{taxBody:'NC001',currentRate:7}]},officialSnapshot:snapshot},now);
  assert.equal(nc.findings[0].reviewFindingKey,ncReviewKey({taxBody:'NC001',currentRate:7,officialRate:7,futureDate:'2027-01-01'}));
  const result=await validateApproval({...findingReviewEvidence(nc.findings[0]),status:'approved'},async()=>nc,now);
  assert.equal(result.evidence.findingType,'upcoming');
});

test('API cannot bypass approval checks with browser verification and archives the canonical server evidence', async t=>{
  const store=createReviewStore({filename:':memory:'}); let current=comparison();
  const server=createConnectorServer({reviews:store,readComparison:async()=>current});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();});
  const url=`http://127.0.0.1:${server.address().port}/api/reviews`;
  const save=body=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3000'},body:JSON.stringify(body)});
  const approved=await save({...input(),sourceUrl:'https://untrusted.example',verification:{verified:true}});
  assert.equal(approved.status,200); const record=(await approved.json()).case;
  assert.equal(record.events[0].evidence.sourceUrl,'https://example.gov/rates');
  assert.equal(record.events[0].evidence.verification.sources[0].hash,'a'.repeat(64));
  current={...current,findings:[]};
  assert.equal((await save({...input(),verification:{verified:true}})).status,409);
  assert.equal(store.getCase(input().findingKey).events.length,1);
});

test('evidence remains immutable when a later case decision changes rates; legacy events remain explicitly empty', t=>{
  const dir=mkdtempSync(join(tmpdir(),'taxap-review-migrate-'));t.after(()=>rmSync(dir,{recursive:true}));const filename=join(dir,'reviews.sqlite');
  let store=createReviewStore({filename});const first=store.saveDecision({...input(),status:'in_review'});
  store.saveDecision({...input(),status:'resolved',officialRate:6.625});
  assert.equal(store.getCase(input().findingKey).events[1].evidence.officialRate,6.5);assert.equal(first.events[0].evidence.verification.verified,false);store.close();
  const db=new DatabaseSync(filename);
  assert.throws(()=>db.exec('UPDATE review_events SET evidence_json = NULL'),/immutable/);
  assert.throws(()=>db.exec('DELETE FROM review_events'),/immutable/);db.close();
  store=createReviewStore({filename});assert.equal(store.getCase(input().findingKey).events[1].evidence.officialRate,6.5);store.close();
});

test('existing review databases migrate without inventing evidence for earlier events', t=>{
  const dir=mkdtempSync(join(tmpdir(),'taxap-review-legacy-'));t.after(()=>rmSync(dir,{recursive:true}));const filename=join(dir,'reviews.sqlite');
  let store=createReviewStore({filename});store.saveDecision({...input(),status:'in_review'});store.close();
  const db=new DatabaseSync(filename);db.exec('DROP TRIGGER review_event_no_update; DROP TRIGGER review_event_no_delete; ALTER TABLE review_events DROP COLUMN evidence_json; ALTER TABLE review_cases DROP COLUMN evidence_json');db.close();
  store=createReviewStore({filename});assert.equal(store.getCase(input().findingKey).events[0].evidence,null);
  store.saveDecision({...input(),status:'resolved'});assert.equal(store.getCase(input().findingKey).events[1].evidence,null);assert.equal(store.getCase(input().findingKey).events[0].evidence.officialRate,6.5);store.close();
});
