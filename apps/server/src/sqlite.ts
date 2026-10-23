import { createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import {
  AUTH_SERVICE_MIGRATIONS,
  type AuthSqlExecutor,
  type AuthSqlRow,
  type AuthSqlValue,
} from "@agorix/auth-service";
import {
  PROJECT_REPOSITORY_MIGRATIONS,
  type SqlExecutor,
  type SqlRow,
  type SqlValue,
} from "@agorix/project-repository";

const MIGRATIONS = [...AUTH_SERVICE_MIGRATIONS, ...PROJECT_REPOSITORY_MIGRATIONS];
const MIGRATION_TABLE_SQL = `create table if not exists agorix_schema_migrations (
  id text primary key,
  sha256 text not null,
  applied_at text not null
)`;

type Value = SqlValue & AuthSqlValue;
type Row = SqlRow & AuthSqlRow;
type Result<R extends Row> = { rows: readonly R[]; rowCount: number };

/** One serialized SQLite connection shared by auth and project repositories. */
export class SQLiteStore implements SqlExecutor, AuthSqlExecutor {
  private readonly db: DatabaseSync;
  private tail: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(path: string) {
    if (!isAbsolute(path) || path === "/") throw new Error("SQLite path must be absolute");
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    try {
      chmodSync(path, 0o600);
      this.db.exec(
        "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL",
      );
      this.migrate();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  private enqueue<T>(work: () => T | Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new Error("SQLite store is closed"));
    const next = this.tail.then(work, work);
    this.tail = next.catch(() => undefined);
    return next;
  }

  private executeDirect<R extends Row>(sql: string, params: readonly Value[] = []): Result<R> {
    try {
      const statement = this.db.prepare(sql);
      if (statement.columns().length > 0) {
        const rows = statement.all(...params) as R[];
        return { rows, rowCount: rows.length };
      }
      const result = statement.run(...params);
      return { rows: [], rowCount: Number(result.changes) };
    } catch (error) {
      // node:sqlite currently reports all constraint failures as ERR_SQLITE_ERROR.
      // Match SQLite's stable constraint text for the repository's retry boundary.
      if (
        error instanceof Error &&
        /^(?:UNIQUE|PRIMARY KEY) constraint failed:/.test(error.message)
      ) {
        Object.assign(error, { code: "SQLITE_CONSTRAINT" });
      }
      throw error;
    }
  }

  execute<R extends Row = Row>(sql: string, params: readonly Value[] = []): Promise<Result<R>> {
    return this.enqueue(() => this.executeDirect<R>(sql, params));
  }

  transaction<T>(work: (executor: AuthSqlExecutor) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      this.db.exec("BEGIN IMMEDIATE");
      const transactional: AuthSqlExecutor = {
        execute: async <R extends AuthSqlRow = AuthSqlRow>(
          sql: string,
          params: readonly AuthSqlValue[] = [],
        ) => this.executeDirect<R>(sql, params),
      };
      try {
        const result = await work(transactional);
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    });
  }

  appliedMigrations(): string[] {
    return this.db
      .prepare("select id from agorix_schema_migrations order by id")
      .all()
      .map((row) => String(row["id"]));
  }

  private migrate(): void {
    this.db.exec(MIGRATION_TABLE_SQL);
    const applied = new Map(
      this.db
        .prepare("select id, sha256 from agorix_schema_migrations")
        .all()
        .map((row) => [String(row["id"]), String(row["sha256"])]),
    );
    const known = new Set<string>(MIGRATIONS.map((migration) => migration.id));
    for (const id of applied.keys()) {
      if (!known.has(id)) throw new Error(`Unknown SQLite migration ${id}`);
    }
    for (const migration of MIGRATIONS) {
      const digest = createHash("sha256").update(migration.sqlite).digest("hex");
      const existing = applied.get(migration.id);
      if (existing !== undefined) {
        if (existing !== digest) throw new Error(`SQLite migration changed: ${migration.id}`);
        continue;
      }
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec(migration.sqlite);
        this.db
          .prepare("insert into agorix_schema_migrations (id, sha256, applied_at) values (?, ?, ?)")
          .run(migration.id, digest, new Date().toISOString());
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
  }

  /** A consistent SQLite snapshot, atomically moved into the requested backup path. */
  backup(destination: string): Promise<void> {
    if (!isAbsolute(destination) || destination === "/") {
      return Promise.reject(new Error("Backup path must be absolute"));
    }
    return this.enqueue(async () => {
      mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
      const temporary = `${destination}.${randomUUID()}.tmp`;
      try {
        await backup(this.db, temporary);
        const snapshot = new DatabaseSync(temporary, { readOnly: true });
        try {
          const check = snapshot.prepare("PRAGMA integrity_check").get();
          if (check?.["integrity_check"] !== "ok")
            throw new Error("SQLite backup integrity check failed");
        } finally {
          snapshot.close();
        }
        chmodSync(temporary, 0o600);
        renameSync(temporary, destination);
      } finally {
        rmSync(temporary, { force: true });
      }
    });
  }

  async close(): Promise<void> {
    await this.tail;
    this.closed = true;
    this.db.close();
  }
}

export function openSQLiteStore(path: string): SQLiteStore {
  return new SQLiteStore(path);
}
