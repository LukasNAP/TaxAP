import {linkedSettings,buildTaxBodyQuery} from '../server/aplus-connector.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
test('direct SQL login routing omits only the outer SQL03 hop',()=>{
 const direct=buildTaxBodyQuery(linkedSettings({TAXAP_SQL_AUTHENTICATION:'sql',TAXAP_SQL_QUERY_ROUTE:'direct'}));
 assert.match(direct,/OPENQUERY\(APLUS,/);
 assert.doesNotMatch(direct,/OPENQUERY\(\[SQL03\]/);
 assert.equal(linkedSettings({TAXAP_SQL_AUTHENTICATION:'windows'}).linkedServer,null);
 assert.equal(linkedSettings({}).linkedServer,'SQL03');
 assert.throws(()=>linkedSettings({TAXAP_SQL_QUERY_ROUTE:'typo'}),/must be direct or linked/);
});

test('loading connector preserves Tedious request handling for SQL login', async()=>{
 const {default:sql}=await import('mssql');
 const p=new sql.ConnectionPool({server:'example.invalid'});
 assert.ok(p.request() instanceof sql.Request);
});
