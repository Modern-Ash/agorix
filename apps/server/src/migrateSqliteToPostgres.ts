import { createHash } from "node:crypto";
import { createReadStream, lstatSync } from "node:fs";
import { isAbsolute } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { PostgresStore } from "./postgres.js";

// Parent rows precede rows that reference them. Schema migrations belong to the
// destination and are intentionally excluded from this data transfer.
const GROUP_TABLES = [
  "agorix_group_organizers",
  "agorix_groups",
  "agorix_group_slots",
  "agorix_group_codes",
  "agorix_group_devices",
  "agorix_group_redeem_failures",
] as const;
const TABLES = [
  "agorix_accounts",
  ...GROUP_TABLES,
  "agorix_sessions",
  "agorix_projects",
  "agorix_adult_emails",
  "agorix_email_verifications",
  "agorix_link_codes",
  "agorix_device_links",
  "agorix_device_tokens",
  "agorix_link_summaries",
  "agorix_link_redeem_failures",
] as const;

type Cell = string | number | null;
type DataRow = Record<string, Cell>;

function digest(rows: readonly DataRow[], columns: readonly string[]): string {
  const canonical = rows
    .map((row) =>
      JSON.stringify(columns.map((column) => (row[column] === null ? null : String(row[column])))),
    )
    .sort();
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/**
 * Copies a consistent, closed SQLite backup into an empty PostgreSQL database.
 * The destination remains unchanged on any error. Callers must keep the source
 * service stopped during cutover and verify the backup before invoking this.
 */
export async function importSQLiteSnapshotToPostgres(
  snapshotPath: string,
  target: PostgresStore,
): Promise<Readonly<Record<(typeof TABLES)[number], number>>> {
  if (!isAbsolute(snapshotPath) || !lstatSync(snapshotPath).isFile()) {
    throw new Error("A regular, absolute SQLite snapshot path is required");
  }
  const source = new DatabaseSync(snapshotPath, { readOnly: true });
  try {
    source.exec("PRAGMA query_only = ON");
    if (source.prepare("PRAGMA integrity_check").get()?.["integrity_check"] !== "ok") {
      throw new Error("SQLite snapshot integrity check failed");
    }
    const groupsPresent = GROUP_TABLES.map(
      (table) => source.prepare(`PRAGMA table_info(${table})`).all().length > 0,
    );
    if (groupsPresent.some(Boolean) && !groupsPresent.every(Boolean)) {
      throw new Error("SQLite snapshot has a partial closed-group schema");
    }
    const legacyWithoutGroups = !groupsPresent.some(Boolean);
    const snapshotHash = createHash("sha256");
    for await (const chunk of createReadStream(snapshotPath)) snapshotHash.update(chunk);
    return await target.transaction(async (tx) => {
      await tx.execute("lock table agorix_sqlite_imports in access exclusive mode");
      const previous = await tx.execute(
        "select import_id from agorix_sqlite_imports where import_id = $1",
        ["initial-sqlite-cutover"],
      );
      if (previous.rowCount !== 0) throw new Error("PostgreSQL target was already imported");
      const counts = {} as Record<(typeof TABLES)[number], number>;
      for (const table of TABLES) {
        const missingLegacyGroup =
          legacyWithoutGroups && (GROUP_TABLES as readonly string[]).includes(table);
        const columns = source
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .map((row) => String(row["name"]));
        if (
          (!missingLegacyGroup && !columns.length) ||
          columns.some((column) => !/^[a-z][a-z0-9_]*$/.test(column))
        ) {
          throw new Error(`Unexpected SQLite schema for ${table}`);
        }
        const destination = await tx.execute<{ column_name: string }>(
          `select column_name from information_schema.columns
           where table_schema = current_schema() and table_name = $1 order by ordinal_position`,
          [table],
        );
        if (
          (missingLegacyGroup && destination.rows.length === 0) ||
          (!missingLegacyGroup &&
            JSON.stringify(columns) !==
              JSON.stringify(destination.rows.map((row) => row.column_name)))
        ) {
          throw new Error(`PostgreSQL schema differs for ${table}`);
        }
        await tx.execute(`lock table ${table} in access exclusive mode`);
        const existing = await tx.execute<{ count: string }>(
          `select count(*) as count from ${table}`,
        );
        if (Number(existing.rows[0]?.count) !== 0) {
          throw new Error(`PostgreSQL target is not empty: ${table}`);
        }
        if (missingLegacyGroup) {
          counts[table] = 0;
          continue;
        }
        const rows = source.prepare(`select * from ${table}`).all() as DataRow[];
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        const insert = `insert into ${table} (${columns.join(", ")}) values (${placeholders})`;
        for (const row of rows) {
          await tx.execute(
            insert,
            columns.map((column) => row[column] ?? null),
          );
        }
        const copied = await tx.execute<DataRow>(`select ${columns.join(", ")} from ${table}`);
        if (
          copied.rows.length !== rows.length ||
          digest(rows, columns) !== digest(copied.rows, columns)
        ) {
          throw new Error(`PostgreSQL copy verification failed: ${table}`);
        }
        counts[table] = rows.length;
      }
      await tx.execute(
        "insert into agorix_sqlite_imports (import_id, snapshot_sha256) values ($1, $2)",
        ["initial-sqlite-cutover", snapshotHash.digest("hex")],
      );
      return counts;
    });
  } finally {
    source.close();
  }
}
