import type { Pool } from "pg";

/** Read-only readiness gate for the server-owned active-project mapping. */
export async function assertOriMig04PgSessionMappingReadiness(
  pool: Pick<Pool, "query">,
): Promise<void> {
  const result = await pool.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema = current_schema() and table_name = $1",
    ["agorix_ori_session_projects"],
  );
  const columns = new Set(result.rows.map((row) => row.column_name));
  if (
    !columns.has("account_id") ||
    !columns.has("session_id") ||
    !columns.has("project_id") ||
    !columns.has("updated_at")
  ) {
    throw new Error("Ori MIG-04 requires durable session project schema");
  }
}
