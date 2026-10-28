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
});
