import { describe, expect, it } from "vitest";
import { createOriPgTransactionProvider } from "./oriMig04PgTransactionProvider.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 PostgreSQL real transaction isolation", () => {
  it("releases a transaction-scoped lock after rollback on callback failure", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const key = Math.floor(Math.random() * 1_000_000_000);
    const provider = createOriPgTransactionProvider({
      connect: async () => {
        const client = await pool.connect();
        return {
          query: async <Row extends Record<string, unknown>>(
            sql: string,
            values: readonly (string | number | boolean)[],
          ) => {
            const result = await client.query(sql, [...values]);
            return { rows: result.rows as readonly Row[] };
          },
          release: () => client.release(),
        };
      },
    });
    try {
      await expect(
        provider.transaction(async (tx) => {
          await tx.query("select pg_advisory_xact_lock($1)", [key]);
          throw Error("abort operation");
        }),
      ).rejects.toThrow("abort operation");
      const second = await pool.connect();
      try {
        const result = await second.query<{ acquired: boolean }>(
          "select pg_try_advisory_xact_lock($1) as acquired",
          [key],
        );
        expect(result.rows[0]?.acquired).toBe(true);
      } finally {
        second.release();
      }
    } finally {
      await pool.end();
    }
  });
  it("serializes competing connections on the same advisory transaction lock", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const key = Math.floor(Math.random() * 1_000_000_000);
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await first.query("BEGIN");
      await first.query("select pg_advisory_xact_lock($1)", [key]);
      const attempt = await second.query<{ acquired: boolean }>(
        "select pg_try_advisory_xact_lock($1) as acquired",
        [key],
      );
      expect(attempt.rows[0]?.acquired).toBe(false);
      await first.query("COMMIT");
      const after = await second.query<{ acquired: boolean }>(
        "select pg_try_advisory_xact_lock($1) as acquired",
        [key],
      );
      expect(after.rows[0]?.acquired).toBe(true);
    } finally {
      await first.query("ROLLBACK");
      first.release();
      second.release();
      await pool.end();
    }
  });
  it("allows only one revision CAS winner across two real connections", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const projectId = `ori_cas_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    try {
      await pool.query(
        "create table if not exists agorix_ori_cas_test (id text primary key, revision integer not null)",
      );
      await pool.query("insert into agorix_ori_cas_test (id, revision) values ($1, 1)", [
        projectId,
      ]);
      const apply = () =>
        pool.query(
          "update agorix_ori_cas_test set revision = revision + 1 where id = $1 and revision = 1 returning revision",
          [projectId],
        );
      const [first, second] = await Promise.all([apply(), apply()]);
      expect([first.rowCount, second.rowCount].sort()).toEqual([0, 1]);
      const result = await pool.query<{ revision: number }>(
        "select revision from agorix_ori_cas_test where id = $1",
        [projectId],
      );
      expect(result.rows[0]?.revision).toBe(2);
    } finally {
      await pool.query("delete from agorix_ori_cas_test where id = $1", [projectId]);
      await pool.end();
    }
  });
});
