import type { Pool } from "pg";

const REQUIRED_PROJECT_COLUMNS = [
  "owner_id",
  "project_id",
  "title",
  "revision",
  "created_at",
  "updated_at",
  "stored_project_json",
  "semantic_hash",
] as const;

/**
 * Fail closed if the deployed project table is not the canonical schema.
 * Never mutate schema during runtime startup.
 */
export async function assertOriMig04PgCanonicalSchemaReadiness(
  pool: Pick<Pool, "query">,
): Promise<void> {
  const result = await pool.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema = current_schema() and table_name = $1",
    ["agorix_projects"],
  );
  const available = new Set(result.rows.map((row) => row.column_name));
  if (REQUIRED_PROJECT_COLUMNS.some((column) => !available.has(column))) {
    throw new Error("Ori MIG-04 requires canonical PostgreSQL project schema");
  }
}
