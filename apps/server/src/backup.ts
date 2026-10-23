import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { openSQLiteStore } from "./sqlite.js";

const databasePath = process.env["AGORIX_PROJECT_DB_PATH"];
const backupDir = process.env["AGORIX_PROJECT_BACKUP_DIR"];
if (!databasePath || !isAbsolute(databasePath) || !existsSync(databasePath)) {
  throw new Error("An existing absolute AGORIX_PROJECT_DB_PATH is required for backup");
}
if (!backupDir || !isAbsolute(backupDir)) {
  throw new Error("An absolute AGORIX_PROJECT_BACKUP_DIR is required for backup");
}

const store = openSQLiteStore(databasePath);
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const destination = join(backupDir, `agorix-${stamp}.sqlite`);
try {
  await store.backup(destination);
  process.stdout.write(`SQLite backup complete: ${destination}\n`);
} finally {
  await store.close();
}
