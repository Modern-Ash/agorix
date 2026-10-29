import type { OriPgTransactionProvider } from "./oriMig04PostgresAtomicCas.js";

/**
 * Durable emergency rollback. Uses the same policy row lock as the CAS path.
 * Transaction provider MUST pin all statements to one PostgreSQL connection.
 * Missing deployment row fails closed; the host must not report success.
 */
export async function emergencyDisableOriPgRollout(
  provider: OriPgTransactionProvider,
  deploymentId: string,
): Promise<number> {
  if (!deploymentId || deploymentId.length > 128) {
    throw new Error("Invalid Ori rollout deployment");
  }
  return provider.transaction(async (tx) => {
    const result = await tx.query<{ epoch: string | number }>(
      `update agorix_ori_rollout_policy
       set epoch = epoch + 1, mode = 'disabled',
           human_authorized = false, kill_switch = true, updated_at = now()
       where deployment_id = $1 returning epoch`,
      [deploymentId],
    );
    if (result.rows.length !== 1) {
      throw new Error("Ori rollout policy not found; rollback unconfirmed");
    }
    await tx.query("delete from agorix_ori_rollout_projects where deployment_id = $1", [
      deploymentId,
    ]);
    const row = result.rows[0];
    if (!row) throw new Error("Ori rollback epoch missing");
    const epoch = Number(row.epoch);
    if (!Number.isSafeInteger(epoch)) {
      throw new Error("Invalid Ori rollout epoch");
    }
    return epoch;
  });
}
