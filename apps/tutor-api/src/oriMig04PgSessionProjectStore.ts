import type { Pool } from "pg";
import type { OriSessionProjectStore } from "./oriMig04TrustedSessionProject.js";

/**
 * Durable server-owned session-to-project mapping. The account/session pair
 * comes exclusively from verified AuthService identity, never request input.
 */
export function createOriMig04PgSessionProjectStore(
  pool: Pick<Pool, "query">,
): OriSessionProjectStore {
  return Object.freeze({
    async getActiveProject(accountId: string, sessionId: string): Promise<string | null> {
      const result = await pool.query<{ project_id: string }>(
        `select p.project_id from agorix_ori_session_projects s
         join agorix_projects p on p.owner_id = s.account_id and p.project_id = s.project_id
         where s.account_id = $1 and s.session_id = $2`,
        [accountId, sessionId],
      );
      return result.rows[0]?.project_id ?? null;
    },
  });
}

export const ORI_MIG04_SESSION_PROJECT_SCHEMA_SQL = `
create table if not exists agorix_ori_session_projects (
  account_id text not null,
  session_id text not null,
  project_id text not null,
  updated_at timestamptz not null default now(),
  primary key (account_id, session_id)
);
`;
