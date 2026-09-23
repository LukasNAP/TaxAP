import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createSharedPoolManager } from "../server/shared-sql-pool.mjs";
function fakePool() {
  const pool = new EventEmitter();
  pool.closes = 0;
  pool.request = () => ({ pool });
  pool.close = async () => { pool.closes++; };
  return pool;
}
test("simultaneous readers share one connect and releases are idempotent", async () => {
  let connects = 0; const pool = fakePool();
  const manager = createSharedPoolManager({ create: async () => { connects++; return { pool, expiresAt: null }; } });
  const leases = await Promise.all(Array.from({ length: 30 }, () => manager.acquire()));
  assert.equal(connects, 1);
  await Promise.all(leases.map(async lease => { assert.equal(lease.request().pool, pool); await lease.close(); await lease.close(); }));
  assert.equal(pool.closes, 0);
  assert.throws(() => leases[0].request(), /released/);
});
test("expired token retires pool but lets existing readers finish sequential work", async () => {
  let time = 0; const pools = [];
  const manager = createSharedPoolManager({ now: () => time, marginMs: 5, create: async () => { const pool = fakePool(); pools.push(pool); return { pool, expiresAt: time + 20 }; } });
  const old = await manager.acquire(); time = 16;
  const replacement = await manager.acquire();
  assert.equal(pools.length, 2); assert.equal(pools[0].closes, 0);
  assert.equal(old.request().pool, pools[0]);
  await old.close(); assert.equal(pools[0].closes, 1);
  await replacement.close(); assert.equal(pools[1].closes, 0);
});
test("pool error replaces pool, waits for every lease and does not retire the replacement", async () => {
  const pools = [];
  const manager = createSharedPoolManager({ create: async () => { const pool = fakePool(); pools.push(pool); return { pool, expiresAt: null }; } });
  const a = await manager.acquire(), b = await manager.acquire();
  pools[0].emit("error", new Error("socket"));
  const c = await manager.acquire();
  await a.close(); assert.equal(pools[0].closes, 0);
  pools[0].emit("error", new Error("late error"));
  const d = await manager.acquire(); assert.equal(pools.length, 2);
  await b.close(); assert.equal(pools[0].closes, 1);
  await c.close(); await d.close();
});
test("failed initial connection is shared and next acquisition retries", async () => {
  let calls = 0;
  const manager = createSharedPoolManager({ create: async () => { if (++calls === 1) throw new Error("connect failed"); return { pool: fakePool(), expiresAt: null }; } });
  const failed = await Promise.allSettled([manager.acquire(), manager.acquire()]);
  assert.ok(failed.every(x => x.status === "rejected")); assert.equal(calls, 1);
  const lease = await manager.acquire(); assert.equal(calls, 2); await lease.close();
});
