import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

// VACUUM INTO includes committed WAL data; copying only the .sqlite file does not.
export function backupReviewDatabase(source, destination) {
  const sourcePath = resolve(source);
  const destinationPath = resolve(destination);
  if (!existsSync(sourcePath)) throw new Error("Review database does not exist.");
  if (existsSync(destinationPath)) throw new Error("Backup destination already exists; choose a new file.");
  mkdirSync(dirname(destinationPath), { recursive: true });
  const database = new DatabaseSync(sourcePath, { readOnly: true });
  try { database.prepare("VACUUM INTO ?").run(destinationPath); }
  finally { database.close(); }
  const backup = new DatabaseSync(destinationPath, { readOnly: true });
  try {
    if (backup.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("Backup integrity check failed.");
    backup.prepare("SELECT COUNT(*) FROM review_cases").get();
    backup.prepare("SELECT COUNT(*) FROM review_events").get();
  } finally { backup.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 4) throw new Error("Usage: node server/review-backup.mjs SOURCE DESTINATION");
  backupReviewDatabase(process.argv[2], process.argv[3]);
  console.log("Review backup created and verified. Protect it as internal review data.");
}
