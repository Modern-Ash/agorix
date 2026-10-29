import { isAbsolute } from "node:path";
import { importSQLiteSnapshotToPostgres } from "./migrateSqliteToPostgres.js";
import { openPostgresStore } from "./postgres.js";

async function main(): Promise<void> {
  const snapshotPath = process.env["AGORIX_SQLITE_SNAPSHOT_PATH"];
  const databaseUrl = process.env["AGORIX_PROJECT_DATABASE_URL"];
  if (!snapshotPath || !isAbsolute(snapshotPath) || !databaseUrl) {
    throw new Error("A closed SQLite snapshot and PostgreSQL target are required");
  }
  const target = await openPostgresStore(databaseUrl);
  try {
    const counts = await importSQLiteSnapshotToPostgres(snapshotPath, target);
    process.stdout.write(`SQLite to PostgreSQL copy verified: ${JSON.stringify(counts)}\n`);
  } finally {
    await target.close();
  }
}

main().catch(() => {
  // Connection errors can include credentials; keep operational output safe.
  process.stderr.write("SQLite to PostgreSQL copy failed; no successful import confirmed\n");
  process.exitCode = 1;
});
