import { SqlProjectRepository } from "@agorix/project-repository";
import type { Pool } from "pg";

/**
 * Canonical Agorix SQL repository backed by the same PostgreSQL pool as
 * MIG-04 fencing. No in-memory fallback and no schema creation at runtime.
 */
export function createOriMig04PgProjectRepository(pool: Pick<Pool, "query">) {
  return new SqlProjectRepository({
    dialect: "postgresql",
    executor: {
      async execute<Row extends Record<string, unknown>>(
        sql: string,
        params: readonly (string | number | null)[] = [],
      ) {
        const result = await pool.query(sql, [...params]);
        return {
          rows: result.rows as readonly Row[],
          rowCount: result.rowCount ?? 0,
        };
      },
    },
  });
}
