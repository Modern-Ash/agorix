import type { OriPgPool } from "./oriMig04PgTransactionProvider.js";

/**
 * Verify durable rollout policy is explicitly disabled before exposing an
 * infrastructure-owned Ori host. This is a startup gate, not authorization:
 * each CAS transaction independently rechecks policy and epoch under lock.
 */
export async function assertOriMig04PgReadiness(
  pool: OriPgPool,
  deploymentId: string,
): Promise<void> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(deploymentId)) {
    throw new Error("Invalid Ori deployment identifier");
  }
  const client = await pool.connect();
  try {
    const result = await client.query<{
      mode: string;
      human_authorized: boolean;
      kill_switch: boolean;
    }>(
      "select mode, human_authorized, kill_switch from agorix_ori_rollout_policy where deployment_id = $1",
      [deploymentId],
    );
    const policy = result.rows[0];
    if (
      !policy ||
      policy.mode !== "disabled" ||
      policy.human_authorized !== false ||
      policy.kill_switch !== true
    ) {
      throw new Error("Ori MIG-04 startup requires durable disabled policy");
    }
  } finally {
    client.release();
  }
}
