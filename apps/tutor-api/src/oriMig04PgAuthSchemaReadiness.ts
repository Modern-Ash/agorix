import type { Pool } from "pg";

/** Read-only startup gate for the shared AuthService PostgreSQL contract. */
export async function assertOriMig04PgAuthSchemaReadiness(
  pool: Pick<Pool, "query">,
): Promise<void> {
  const result = await pool.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = current_schema()
       and table_name in ($1, $2)`,
    ["agorix_auth_accounts", "agorix_auth_sessions"],
  );
  const columns = new Set(
    result.rows.map((row) => `${row.table_name}.${row.column_name}`),
  );
  const required = [
    "agorix_auth_accounts.account_id",
    "agorix_auth_accounts.normalized_username",
    "agorix_auth_accounts.record",
    "agorix_auth_sessions.token_hash",
    "agorix_auth_sessions.account_id",
    "agorix_auth_sessions.record",
  ];
  if (required.some((column) => !columns.has(column))) {
    throw new Error("Ori MIG-04 requires durable AuthService account and session schemas");
  }
}
