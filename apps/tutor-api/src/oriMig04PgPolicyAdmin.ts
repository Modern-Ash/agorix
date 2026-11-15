import type { OriPgTransactionProvider } from "./oriMig04PostgresAtomicCas.js";

export type OriPgRolloutMode = "disabled" | "shadow" | "pilot";

export interface OriPgRolloutConfiguration {
  readonly mode: OriPgRolloutMode;
  readonly humanAuthorized: boolean;
  readonly killSwitch: boolean;
  readonly approvedProjectIds: readonly string[];
}

/**
 * Trusted operator-only policy update. This must never be exposed as a learner
 * endpoint. All changes increment the durable epoch and replace the allowlist
 * in one PostgreSQL transaction, serialized against project CAS commits.
 */
export async function replaceOriPgRolloutPolicy(
  provider: OriPgTransactionProvider,
  deploymentId: string,
  config: OriPgRolloutConfiguration,
): Promise<number> {
  if (
    !deploymentId ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(deploymentId) ||
    !["disabled", "shadow", "pilot"].includes(config.mode) ||
    typeof config.humanAuthorized !== "boolean" ||
    typeof config.killSwitch !== "boolean" ||
    !Array.isArray(config.approvedProjectIds) ||
    config.approvedProjectIds.length > 100 ||
    config.approvedProjectIds.some(
      (id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id),
    )
  ) {
    throw new Error("Invalid Ori rollout configuration");
  }

  // Disabled and shadow policies must never retain effective authorization.
  if (config.mode !== "pilot" && (config.humanAuthorized || !config.killSwitch)) {
    throw new Error("Non-pilot Ori policy must remain fail-closed");
  }

  // Pilot authorization must be explicit; never infer it from the allowlist.
  if (config.mode === "pilot" && (!config.humanAuthorized || config.killSwitch)) {
    throw new Error("Ori pilot requires explicit authorization");
  }

  return provider.transaction(async (tx) => {
    const result = await tx.query<{ epoch: string | number }>(
      `insert into agorix_ori_rollout_policy
         (deployment_id, epoch, mode, human_authorized, kill_switch)
       values ($1, 1, $2, $3, $4)
       on conflict (deployment_id) do update
       set epoch = agorix_ori_rollout_policy.epoch + 1,
           mode = excluded.mode,
           human_authorized = excluded.human_authorized,
           kill_switch = excluded.kill_switch,
           updated_at = now()
       returning epoch`,
      [deploymentId, config.mode, config.humanAuthorized, config.killSwitch],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Ori policy update not confirmed");
    await tx.query("delete from agorix_ori_rollout_projects where deployment_id = $1", [
      deploymentId,
    ]);
    if (config.mode === "pilot") {
      for (const projectId of new Set(config.approvedProjectIds)) {
        await tx.query(
          `insert into agorix_ori_rollout_projects (deployment_id, project_id)
           values ($1, $2)`,
          [deploymentId, projectId],
        );
      }
    }
    const epoch = Number(row.epoch);
    if (!Number.isSafeInteger(epoch) || epoch < 1) {
      throw new Error("Invalid Ori policy epoch");
    }
    return epoch;
  });
}
