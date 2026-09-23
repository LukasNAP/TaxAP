// A lease spans a whole reader, including sequential/queued queries. Retiring a pool
// stops new leases; it must not close connections still owned by existing readers.
export function createSharedPoolManager({ create, wrapRequest = request => request, now = Date.now, marginMs = 300_000 }) {
  let current = null;
  function drain(entry) {
    if (!entry.retired || entry.users || entry.closing) return;
    entry.closing = entry.promise.then(({ pool }) => pool.close()).catch(() => {});
  }
  function retire(entry) {
    if (current === entry) current = null;
    entry.retired = true;
    drain(entry);
  }
  async function acquire() {
    if (current && current.expiresAt !== null && current.expiresAt - now() <= marginMs) retire(current);
    if (!current) {
      const entry = { users: 0, expiresAt: null, retired: false, closing: null, promise: null };
      current = entry;
      entry.promise = Promise.resolve().then(create).then(created => {
        entry.expiresAt = created.expiresAt;
        created.pool.on?.("error", () => retire(entry));
        return created;
      }, error => {
        if (current === entry) current = null;
        throw error;
      });
    }
    const entry = current;
    entry.users += 1;
    let pool;
    try { ({ pool } = await entry.promise); }
    catch (error) { entry.users -= 1; throw error; }
    let released = false;
    return {
      request() {
        if (released) throw new Error("SQL pool lease already released.");
        return wrapRequest(pool.request(), () => retire(entry));
      },
      async close() {
        if (released) return;
        released = true;
        entry.users -= 1;
        drain(entry);
        if (entry.closing) await entry.closing;
      },
    };
  }
  return { acquire };
}
