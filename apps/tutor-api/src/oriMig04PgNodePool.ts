import { Pool } from "pg";
import type { OriPgPool } from "./oriMig04PgTransactionProvider.js";

/**
 * Real node-postgres adapter. A transaction always retains one checked-out
 * client until commit/rollback and releases it back to the pool.
 */
export function createOriMig04PgNodePool(connectionString: string) {
  if (!connectionString || !/^postgres(ql)?:\/\//.test(connectionString)) {
    throw new Error("Invalid Ori PostgreSQL connection string");
  }
  const pool = new Pool({ connectionString, max: 10 });
  const adapter: OriPgPool = {
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
  };
  return Object.freeze({ pool: adapter, close: () => pool.end() });
}
