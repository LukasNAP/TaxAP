import { setTimeout as delay } from "node:timers/promises";

const transientStatus = new Set([408, 429, 500, 502, 503, 504]);
const transientCode = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"]);

export function createOfficialFetch({ fetchImpl = fetch, sleep = delay, attempts = 3 } = {}) {
  return async function officialFetch(url, options = {}) {
    // Automatic replay is limited to safe reads and the existing official download POSTs.
    for (let attempt = 0; ; attempt++) {
      options.signal?.throwIfAborted();
      let response;
      try { response = await fetchImpl(url, options); }
      catch (error) {
        if (options.signal?.aborted || attempt >= attempts - 1 || !transientCode.has(error.cause?.code ?? error.code)) throw error;
      }
      if (response && (!transientStatus.has(response.status) || attempt >= attempts - 1)) return response;
      // Do not retry a long Retry-After earlier than the publisher requested.
      const retryAfter = response?.headers.get("retry-after");
      const wait = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now()) : 250 * 2 ** attempt;
      if (retryAfter && (!Number.isFinite(wait) || wait > 2000)) return response;
      await response?.body?.cancel();
      await sleep(Math.max(0, wait), undefined, { signal: options.signal });
    }
  };
}

export const fetchOfficial = createOfficialFetch();
