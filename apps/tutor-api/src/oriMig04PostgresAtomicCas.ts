import { randomUUID } from "node:crypto";

/**
 * PostgreSQL-only, atomic MIG-04 rollout authorization + canonical project CAS.
 *
 * This adapter deliberately takes a transaction-bound executor rather than a
 * generic pooled query client. BEGIN/COMMIT/ROLLBACK MUST use the same connection.
 * No caller may fall back to the unfenced project update after denial.
 */
export interface OriPgTransaction {
  query<Row extends Record<string, unknown>>(
    sql: string,
    values: readonly (string | number | boolean)[],
  ): Promise<{ rows: readonly Row[] }>;
}
export interface OriPgTransactionProvider {
  transaction<T>(work: (tx: OriPgTransaction) => Promise<T>): Promise<T>;
}
export interface OriPgCommitInput {
  readonly deploymentId: string;
  readonly ownerId: string;
  readonly projectId: string;
  readonly expectedEpoch: number;
  readonly expectedRevision: number;
  readonly storedProjectJson: string;
  readonly semanticHash: string;
  readonly updatedAt: string;
  /** Private pilot: recheck the verified adult email under the commit transaction. */
  readonly allowedAdultEmail?: string;
}
export type OriPgCommitResult = "applied" | "denied" | "conflict";

/**
 * Lock policy first. The revocation transaction must lock/update the SAME
 * policy row, then increment epoch. Lock order is policy -> project.
 * A commit that wins the policy lock can finish before rollback; subsequent
 * commits are rejected once rollback commits.
 */
export async function commitOriProjectWithPgFence(
  provider: OriPgTransactionProvider,
  input: OriPgCommitInput,
): Promise<OriPgCommitResult> {
  if (
    !input.deploymentId ||
    !input.ownerId ||
    !input.projectId ||
    !Number.isSafeInteger(input.expectedEpoch) ||
    input.expectedEpoch < 0 ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1 ||
    !input.storedProjectJson ||
    !input.semanticHash ||
    !input.updatedAt
  )
    return "denied";
  if (
    input.allowedAdultEmail !== undefined &&
    (!input.allowedAdultEmail ||
      input.allowedAdultEmail !== input.allowedAdultEmail.trim().toLowerCase())
  )
    return "denied";

  return provider.transaction(async (tx) => {
    const policy = await tx.query<{
      epoch: string | number;
      mode: string;
      human_authorized: boolean;
      kill_switch: boolean;
    }>(
      `select epoch, mode, human_authorized, kill_switch
       from agorix_ori_rollout_policy where deployment_id = $1 for update`,
      [input.deploymentId],
    );
    const row = policy.rows[0];
    if (
      !row ||
      String(row.epoch) !== String(input.expectedEpoch) ||
      row.mode !== "pilot" ||
      row.human_authorized !== true ||
      row.kill_switch !== false
    )
      return "denied";

    const allowlist = await tx.query<{ project_id: string }>(
      `select project_id from agorix_ori_rollout_projects
       where deployment_id = $1 and project_id = $2`,
      [input.deploymentId, input.projectId],
    );
    if (allowlist.rows.length !== 1) return "denied";

    if (input.allowedAdultEmail !== undefined) {
      const adult = await tx.query<{ account_id: string }>(
        `select a.account_id from agorix_accounts a
         join agorix_adult_emails e on e.account_id = a.account_id
         where a.account_id = $1 and a.status = 'active'
           and e.email_normalized = $2 and e.verified_at is not null
         for share of a, e`,
        [input.ownerId, input.allowedAdultEmail],
      );
      if (adult.rows.length !== 1) return "denied";
    }

    const updated = await tx.query<{ revision: number }>(
      `update agorix_projects
       set revision = revision + 1, stored_project_json = $1,
           semantic_hash = $2, updated_at = $3
       where owner_id = $4 and project_id = $5 and revision = $6
       returning revision`,
      [
        input.storedProjectJson,
        input.semanticHash,
        input.updatedAt,
        input.ownerId,
        input.projectId,
        input.expectedRevision,
      ],
    );
    if (updated.rows.length !== 1) return "conflict";
    await tx.query(
      `insert into agorix_ori_commit_audit
       (event_id, deployment_id, policy_epoch, revision_before, revision_after, semantic_hash)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        input.deploymentId,
        input.expectedEpoch,
        input.expectedRevision,
        input.expectedRevision + 1,
        input.semanticHash,
      ],
    );
    return "applied";
  });
}
