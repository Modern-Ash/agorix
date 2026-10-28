import type { Pool } from "pg";

/**
 * Server-owned lifecycle for active project selection. Call only after the
 * AuthService has authenticated the account/session and ownership is verified.
 */
export function createOriMig04PgSessionProjectLifecycle(pool: Pick<Pool, "query">) {
  return Object.freeze({
    async select(accountId: string, sessionId: string, projectId: string): Promise<void> {
      if (!valid(accountId) || !valid(sessionId) || !valid(projectId)) {
        throw new Error("Invalid Ori session project identity");
      }
      const result = await pool.query(
        `insert into agorix_ori_session_projects (account_id, session_id, project_id)
         select $1, $2, p.project_id from agorix_projects p
         where p.owner_id = $1 and p.project_id = $3
         on conflict (account_id, session_id)
         do update set project_id = excluded.project_id, updated_at = now()`,
        [accountId, sessionId, projectId],
      );
      if (result.rowCount !== 1) {
        throw new Error("Ori session project ownership denied");
      }
    },
    async revoke(accountId: string, sessionId: string): Promise<void> {
      if (!valid(accountId) || !valid(sessionId)) {
        throw new Error("Invalid Ori session project identity");
      }
      await pool.query(
        "delete from agorix_ori_session_projects where account_id = $1 and session_id = $2",
        [accountId, sessionId],
      );
    },
    async revokeAll(accountId: string): Promise<void> {
      if (!valid(accountId)) {
        throw new Error("Invalid Ori session project identity");
      }
      await pool.query("delete from agorix_ori_session_projects where account_id = $1", [accountId]);
    },
    async rotate(accountId: string, oldSessionId: string, newSessionId: string): Promise<void> {
      if (!valid(accountId) || !valid(oldSessionId) || !valid(newSessionId)) {
        throw new Error("Invalid Ori session project identity");
      }
      await pool.query(
        `update agorix_ori_session_projects set session_id = $3, updated_at = now()
         where account_id = $1 and session_id = $2`,
        [accountId, oldSessionId, newSessionId],
      );
    },
  });
}

function valid(value: string): boolean {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
}
