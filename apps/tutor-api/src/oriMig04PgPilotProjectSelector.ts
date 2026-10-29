import type { Pool } from "pg";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";

/**
 * Selects the single reviewed pilot project from server-owned PostgreSQL state.
 * The browser cannot choose an owner or project through this resolver.
 */
export function createOriMig04PgPilotProjectSelector({
  pool,
  deploymentId,
  allowedAdultEmail,
}: {
  readonly pool: Pick<Pool, "query">;
  readonly deploymentId: string;
  readonly allowedAdultEmail: string;
}) {
  if (!deploymentId || deploymentId.length > 128) throw new Error("Invalid Ori deployment");
  const email = allowedAdultEmail.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A private pilot adult email is required");
  }
  return async (session: OriAuthenticatedSession): Promise<string | null> => {
    if (!session.accountId || session.accountId.length > 128 || !session.sessionId) return null;
    try {
      const result = await pool.query<{ project_id: string }>(
        `select p.project_id
         from agorix_ori_rollout_policy policy
         join agorix_ori_rollout_projects allowed
           on allowed.deployment_id = policy.deployment_id
         join agorix_projects p on p.project_id = allowed.project_id
         join agorix_accounts a on a.account_id = p.owner_id
         join agorix_adult_emails e on e.account_id = a.account_id
         where policy.deployment_id = $1 and policy.mode = 'pilot'
           and policy.human_authorized = true and policy.kill_switch = false
           and a.account_id = $2 and a.status = 'active'
           and e.email_normalized = $3 and e.verified_at is not null
         limit 2`,
        [deploymentId, session.accountId, email],
      );
      return result.rows.length === 1 ? (result.rows[0]?.project_id ?? null) : null;
    } catch {
      return null;
    }
  };
}
