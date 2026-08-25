import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const REVIEW_STATUSES = new Set(["new", "in_review", "approved", "resolved", "not_applicable"]);
const REVIEWERS = new Set(["Ana", "Liv"]);
const FINDING_TYPES = new Set(["mismatch", "upcoming", "recent-match"]);

function requiredText(value, label, maxLength) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) throw new Error(`${label} is required and must be ${maxLength} characters or fewer.`);
  return text;
}

function optionalText(value, maxLength) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw new Error(`Text must be ${maxLength} characters or fewer.`);
  return text || null;
}

function optionalRate(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 20) throw new Error(`${label} must be a valid percentage.`);
  return rate;
}

function normalizeDecision(input) {
  const findingKey = requiredText(input.findingKey, "Finding key", 100);
  if (!/^[A-Za-z0-9._:-]+$/.test(findingKey)) throw new Error("Finding key contains unsupported characters.");
  const status = requiredText(input.status, "Status", 20);
  if (!REVIEW_STATUSES.has(status)) throw new Error("Choose a valid review status.");
  const actor = requiredText(input.actor, "Reviewer", 40);
  if (!REVIEWERS.has(actor)) throw new Error("Choose Ana or Liv as the reviewer.");
  const findingType = requiredText(input.findingType, "Finding type", 30);
  if (!FINDING_TYPES.has(findingType)) throw new Error("Choose a valid finding type.");
  const note = optionalText(input.note, 2000);
  if ((status === "approved" || status === "resolved" || status === "not_applicable") && !note) {
    throw new Error("Add a note before approving, resolving, or dismissing a finding.");
  }
  const stateCode = requiredText(input.stateCode, "State", 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) throw new Error("State must be a two-letter code.");
  const sourceUrl = optionalText(input.sourceUrl, 500);
  if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) throw new Error("Official source must use HTTPS.");

  return {
    findingKey,
    stateCode,
    jurisdiction: requiredText(input.jurisdiction, "Jurisdiction", 120),
    taxBody: requiredText(input.taxBody, "A+ tax body", 30),
    findingType,
    aplusRate: optionalRate(input.aplusRate, "A+ rate"),
    officialRate: optionalRate(input.officialRate, "Official rate"),
    effectiveDate: optionalText(input.effectiveDate, 80),
    sourceUrl,
    status,
    actor,
    note,
  };
}

function camelCaseRow(row) {
  if (!row) return null;
  return {
    findingKey: row.finding_key,
    stateCode: row.state_code,
    jurisdiction: row.jurisdiction,
    taxBody: row.tax_body,
    findingType: row.finding_type,
    aplusRate: row.aplus_rate,
    officialRate: row.official_rate,
    effectiveDate: row.effective_date,
    sourceUrl: row.source_url,
    status: row.status,
    assignedTo: row.assigned_to,
    latestNote: row.latest_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

function camelCaseEvent(row) {
  return {
    id: row.id,
    findingKey: row.finding_key,
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actor: row.actor,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function createReviewStore({ filename = resolve(".data", "taxap-reviews.sqlite") } = {}) {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");
  database.exec(`CREATE TABLE IF NOT EXISTS review_cases (
    finding_key TEXT PRIMARY KEY,
    state_code TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    tax_body TEXT NOT NULL,
    finding_type TEXT NOT NULL,
    aplus_rate REAL,
    official_rate REAL,
    effective_date TEXT,
    source_url TEXT,
    status TEXT NOT NULL,
    assigned_to TEXT,
    latest_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT
  )`);
  database.exec(`CREATE TABLE IF NOT EXISTS review_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_key TEXT NOT NULL REFERENCES review_cases(finding_key) ON DELETE CASCADE,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  )`);
  database.exec("CREATE INDEX IF NOT EXISTS idx_review_cases_status_updated ON review_cases(status, updated_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_review_events_finding_created ON review_events(finding_key, created_at DESC)");
  database.exec("PRAGMA optimize");

  const seedTimestamp = "2026-08-17T17:00:00.000Z";
  const seedCase = database.prepare(`INSERT OR IGNORE INTO review_cases (
    finding_key, state_code, jurisdiction, tax_body, finding_type, aplus_rate, official_rate,
    effective_date, source_url, status, assigned_to, latest_note, created_at, updated_at, resolved_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const seeded = seedCase.run(
    "NC060-2026-07-01", "NC", "Mecklenburg County", "NC060", "recent-match", 8.25, 8.25,
    "2026-07-01", "https://www.ncdor.gov/taxes-forms/sales-and-use-tax/sales-and-use-tax-rates",
    "resolved", "Ana", "A+ rate updated and prior-rate invoices handled.", seedTimestamp, seedTimestamp, seedTimestamp,
  );
  if (seeded.changes > 0) {
    database.prepare(`INSERT INTO review_events (
      finding_key, action, from_status, to_status, actor, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      "NC060-2026-07-01", "resolved", null, "resolved", "Ana",
      "A+ rate updated and prior-rate invoices handled.", seedTimestamp,
    );
  }

  const selectCase = database.prepare("SELECT * FROM review_cases WHERE finding_key = ?");
  const selectEvents = database.prepare("SELECT * FROM review_events WHERE finding_key = ? ORDER BY created_at DESC, id DESC");

  function getCase(findingKey) {
    const reviewCase = camelCaseRow(selectCase.get(findingKey));
    if (!reviewCase) return null;
    return { ...reviewCase, events: selectEvents.all(findingKey).map(camelCaseEvent) };
  }

  function listCases() {
    return database.prepare("SELECT * FROM review_cases ORDER BY updated_at DESC, finding_key").all()
      .map((row) => ({ ...camelCaseRow(row), events: selectEvents.all(row.finding_key).map(camelCaseEvent) }));
  }

  function saveDecision(input) {
    const decision = normalizeDecision(input);
    const existing = getCase(decision.findingKey);
    const now = new Date().toISOString();
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare(`INSERT INTO review_cases (
        finding_key, state_code, jurisdiction, tax_body, finding_type, aplus_rate, official_rate,
        effective_date, source_url, status, assigned_to, latest_note, created_at, updated_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(finding_key) DO UPDATE SET
        state_code = excluded.state_code,
        jurisdiction = excluded.jurisdiction,
        tax_body = excluded.tax_body,
        finding_type = excluded.finding_type,
        aplus_rate = excluded.aplus_rate,
        official_rate = excluded.official_rate,
        effective_date = excluded.effective_date,
        source_url = excluded.source_url,
        status = excluded.status,
        assigned_to = excluded.assigned_to,
        latest_note = COALESCE(excluded.latest_note, review_cases.latest_note),
        updated_at = excluded.updated_at,
        resolved_at = excluded.resolved_at`).run(
        decision.findingKey, decision.stateCode, decision.jurisdiction, decision.taxBody,
        decision.findingType, decision.aplusRate, decision.officialRate, decision.effectiveDate,
        decision.sourceUrl, decision.status, decision.actor, decision.note,
        existing?.createdAt ?? now, now, decision.status === "resolved" || decision.status === "not_applicable" ? now : null,
      );
      database.prepare(`INSERT INTO review_events (
        finding_key, action, from_status, to_status, actor, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        decision.findingKey, decision.status, existing?.status ?? null, decision.status,
        decision.actor, decision.note, now,
      );
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    return getCase(decision.findingKey);
  }

  return { getCase, listCases, saveDecision, close: () => database.close() };
}
