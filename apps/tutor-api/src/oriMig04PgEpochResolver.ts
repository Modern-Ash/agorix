import type { OriPgTransactionProvider } from "./oriMig04PostgresAtomicCas.js";
import type { OriMig04TrustedEpoch } from "./oriMig04PgHostAtomicCommit.js";

/**
 * Reads a shared, durable rollout epoch from PostgreSQL.
 * This is a preliminary visibility check, NOT commit authorization:
 * the CAS transaction must revalidate epoch, allowlist and policy under lock.
 */
export function createOriMig04PgEpochResolver(
  provider: OriPgTransactionProvider,
  deploymentId: string,
) {
  if (!deploymentId || deploymentId.length > 128) {
    throw new Error("Invalid Ori deployment");
  }
  return async (_owner: string, projectId: string): Promise<OriMig04TrustedEpoch | null> => {
    if (!projectId) return null;
    try {
      return await provider.transaction(async (tx) => {
        const policy = await tx.query<{
          epoch: string | number;
          mode: string;
          human_authorized: boolean;
          kill_switch: boolean;
        }>(
          `select epoch, mode, human_authorized, kill_switch
           from agorix_ori_rollout_policy where deployment_id = $1`,
          [deploymentId],
        );
        const row = policy.rows[0];
        if (
          !row ||
          row.mode !== "pilot" ||
          row.human_authorized !== true ||
          row.kill_switch !== false
        ) {
          return null;
        }
        const allowed = await tx.query<{ project_id: string }>(
          `select project_id from agorix_ori_rollout_projects
           where deployment_id = $1 and project_id = $2`,
          [deploymentId, projectId],
        );
        const epoch = Number(row.epoch);
        if (allowed.rows.length !== 1 || !Number.isSafeInteger(epoch) || epoch < 0) {
          return null;
        }
        return { deploymentId, epoch };
      });
    } catch {
      return null;
    }
  };
}
