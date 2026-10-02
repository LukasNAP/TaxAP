import { ClientSecretCredential } from "@azure/identity";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { rename } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export function createOutlookSender(env = process.env, fetchImpl = fetch) {
  return async message => {
    const required = ["TAXAP_ALERT_TENANT_ID", "TAXAP_ALERT_CLIENT_ID", "TAXAP_ALERT_CLIENT_SECRET_FILE", "TAXAP_ALERT_SENDER"];
    if (required.some(key => !env[key])) throw new Error("Outlook alert configuration incomplete");
    const secret = readFileSync(env.TAXAP_ALERT_CLIENT_SECRET_FILE, "utf8").trim();
    const credential = new ClientSecretCredential(env.TAXAP_ALERT_TENANT_ID, env.TAXAP_ALERT_CLIENT_ID, secret);
    const token = await credential.getToken("https://graph.microsoft.com/.default", { abortSignal: AbortSignal.timeout(10000) });
    const response = await fetchImpl(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.TAXAP_ALERT_SENDER)}/sendMail`, {
      method: "POST", signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject: message.subject, body: { contentType: "Text", content: message.body }, toRecipients: [{ emailAddress: { address: env.TAXAP_ALERT_RECIPIENT || "lukasn@atlanticpkg.com" } }] }, saveToSentItems: true }),
    });
    // Accepted for processing; this is not a delivery receipt. Never automatically replay sendMail.
    if (response.status !== 202) throw new Error("Outlook alert request rejected");
  };
}

export function createStateAlertManager({ filename, enabled = false, send = createOutlookSender(), now = () => Date.now() }) {
  let queue = Promise.resolve();
  async function publish(batch) {
    if (!enabled) return "disabled";
    let previous = { accepted: [], attemptedAt: 0 };
    try { previous = JSON.parse(readFileSync(filename, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw new Error("Alert state storage invalid"); }
    if (!Array.isArray(previous.accepted) || !Number.isFinite(previous.attemptedAt)) throw new Error("Alert state storage invalid");
    const current = [...batch.failedStates].sort();
    const same = JSON.stringify(previous.accepted) === JSON.stringify(current);
    if (same) return "unchanged";
    const timestamp = now();
    if (previous.attemptedAt && timestamp - previous.attemptedAt < 15 * 60 * 1000) return "deferred";
    async function persist(record) {
      mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
      const temporary = `${filename}.${randomUUID()}.tmp`;
      writeFileSync(temporary, JSON.stringify(record), { mode: 0o600 });
      try {
        for (let attempt = 0; ; attempt++) {
          try { await rename(temporary, filename); break; }
          catch (error) {
            if (attempt >= 3 || !["EPERM", "EBUSY", "EACCES"].includes(error.code)) throw error;
            await delay(50 * 2 ** attempt);
          }
        }
      } finally { try { unlinkSync(temporary); } catch { /* Already renamed or inaccessible. */ } }
    }
    // Persist before sending so failed or ambiguous requests cannot create a refresh storm.
    await persist({ ...previous, attemptedAt: timestamp });
    const recovered = previous.accepted.filter(code => !current.includes(code));
    await send({ subject: current.length ? `TaxAP: ${current.length} state checks unavailable` : "TaxAP: state checks recovered", body: [
      `Observed: ${new Date(timestamp).toISOString()}`,
      `Unavailable states: ${current.join(", ") || "None"}`,
      `Recovered states: ${recovered.join(", ") || "None"}`,
      `Retained evidence: ${(batch.retainedStates || []).map(s => `${s.stateCode} (source retrieved ${s.sourceRetrievedAt})`).join(", ") || "None"}`,
      "Open TaxAP to review current coverage. Retained evidence is stale and cannot authorize maintenance. TaxAP never updates A+.",
    ].join("\n") });
    await persist({ accepted: current, attemptedAt: timestamp });
    return "accepted";
  }
  return { publish(batch) { const result = queue.then(() => publish(batch)); queue = result.catch(() => {}); return result; } };
}
