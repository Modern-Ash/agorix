import { createHash } from "node:crypto";
import { Pool } from "pg";
import {
  AUTH_SERVICE_MIGRATIONS,
  type AuthSqlExecutor,
  type AuthSqlRow,
  type AuthSqlValue,
} from "@agorix/auth-service";
import { LINK_SERVICE_MIGRATIONS } from "@agorix/link-service";
import { GROUP_SERVICE_MIGRATIONS } from "@agorix/group-service";
import {
  PROJECT_REPOSITORY_MIGRATIONS,
  type SqlExecutor,
  type SqlRow,
  type SqlValue,
} from "@agorix/project-repository";

const ORI_ROLLOUT_POLICY_SQL = `create table if not exists agorix_ori_rollout_policy (
  deployment_id text primary key,
  epoch bigint not null default 0 check (epoch >= 0),
  mode text not null default 'disabled' check (mode in ('disabled', 'shadow', 'pilot')),
  human_authorized boolean not null default false,
  kill_switch boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists agorix_ori_rollout_projects (
  deployment_id text not null references agorix_ori_rollout_policy(deployment_id) on delete cascade,
  project_id text not null,
  primary key (deployment_id, project_id)
);`;
const SQLITE_IMPORT_MARKER_SQL = `create table if not exists agorix_sqlite_imports (
  import_id text primary key,
  snapshot_sha256 text not null,
  imported_at timestamptz not null default now()
);`;
const ORI_COMMIT_AUDIT_SQL = `create table if not exists agorix_ori_commit_audit (
  event_id text primary key,
  deployment_id text not null references agorix_ori_rollout_policy(deployment_id),
  policy_epoch bigint not null,
  revision_before integer not null,
  revision_after integer not null,
  semantic_hash text not null,
  committed_at timestamptz not null default now(),
  check (revision_after = revision_before + 1)
);`;

const MIGRATIONS = [
  ...AUTH_SERVICE_MIGRATIONS,
  ...PROJECT_REPOSITORY_MIGRATIONS,
  ...LINK_SERVICE_MIGRATIONS,
  ...GROUP_SERVICE_MIGRATIONS,
  { id: "003_create_ori_rollout_policy", postgresql: ORI_ROLLOUT_POLICY_SQL },
  { id: "004_create_sqlite_import_marker", postgresql: SQLITE_IMPORT_MARKER_SQL },
  { id: "005_create_ori_commit_audit", postgresql: ORI_COMMIT_AUDIT_SQL },
];

type Value = SqlValue & AuthSqlValue;
type Row = SqlRow & AuthSqlRow;
type Result<R extends Row> = { rows: readonly R[]; rowCount: number };

/** A PostgreSQL executor shared by the existing account, project and link repositories. */
export class PostgresStore implements SqlExecutor, AuthSqlExecutor {
  private constructor(private readonly pool: Pool) {}

  static async open(connectionString: string): Promise<PostgresStore> {
    if (!connectionString) throw new Error("PostgreSQL connection URL is required");
    const pool = new Pool({ connectionString, max: 10 });
    const store = new PostgresStore(pool);
    try {
      await store.migrate();
      return store;
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  async execute<R extends Row = Row>(
    sql: string,
    params: readonly Value[] = [],
  ): Promise<Result<R>> {
    const result = await this.pool.query<R>(sql, [...params]);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  }

  async transaction<T>(work: (executor: AuthSqlExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const executor: AuthSqlExecutor = {
        execute: async <R extends AuthSqlRow = AuthSqlRow>(
          sql: string,
          params: readonly AuthSqlValue[] = [],
        ) => {
          const result = await client.query<R>(sql, [...params]);
          return { rows: result.rows, rowCount: result.rowCount ?? 0 };
        },
      };
      const result = await work(executor);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serializes schema checks across concurrent project-service instances.
      await client.query("select pg_advisory_xact_lock(390401)");
      await client.query(`create table if not exists agorix_schema_migrations (
        id text primary key, sha256 text not null, applied_at text not null
      )`);
      const applied = await client.query<{ id: string; sha256: string }>(
        "select id, sha256 from agorix_schema_migrations",
      );
      const hashes = new Map(applied.rows.map((row) => [row.id, row.sha256]));
      const known = new Set<string>(MIGRATIONS.map((migration) => migration.id));
      for (const id of hashes.keys()) {
        if (!known.has(id)) throw new Error(`Unknown PostgreSQL migration ${id}`);
      }
      for (const migration of MIGRATIONS) {
        const digest = createHash("sha256").update(migration.postgresql).digest("hex");
        const existing = hashes.get(migration.id);
        if (existing !== undefined) {
          if (existing !== digest) throw new Error(`PostgreSQL migration changed: ${migration.id}`);
          continue;
        }
        await client.query(migration.postgresql);
        await client.query(
          "insert into agorix_schema_migrations (id, sha256, applied_at) values ($1, $2, $3)",
          [migration.id, digest, new Date().toISOString()],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export async function openPostgresStore(connectionString: string): Promise<PostgresStore> {
  return PostgresStore.open(connectionString);
}
