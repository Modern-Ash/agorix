import type { Pool } from "pg";

export type OriLearningEvent =
  | { readonly kind: "attempt" }
  | { readonly kind: "hint" }
  | { readonly kind: "stage"; readonly stage: "explore" | "connect" | "translate" };

/**
 * Server-only learning event recorder. The authenticated caller supplies
 * verified account identity; ownership is rechecked by PostgreSQL.
 * No client-provided counters or owner IDs are accepted.
 */
export function createOriMig04PgLearningEvents(pool: Pick<Pool, "query">) {
  return async (owner: string, projectId: string, event: OriLearningEvent): Promise<boolean> => {
    if (!owner || !projectId) return false;
    if (!event || !["attempt", "hint", "stage"].includes(event.kind)) return false;
    if (event.kind === "stage" &&
        !["explore", "connect", "translate"].includes(event.stage)) return false;
    const attempts = event.kind === "attempt" ? 1 : 0;
    const hints = event.kind === "hint" ? 1 : 0;
    const stage = event.kind === "stage" ? event.stage : "explore";
    const result = await pool.query(
      `insert into agorix_ori_learning_context
         (owner_id, project_id, attempts, hints_used, learning_stage)
       select p.owner_id, p.project_id, $3, $4, $5
       from agorix_projects p where p.owner_id = $1 and p.project_id = $2
       on conflict (owner_id, project_id) do update
       set attempts = least(100, agorix_ori_learning_context.attempts + excluded.attempts),
           hints_used = least(100, agorix_ori_learning_context.hints_used + excluded.hints_used),
           learning_stage = case when $6 then excluded.learning_stage
                                 else agorix_ori_learning_context.learning_stage end,
           updated_at = now()`,
      [owner, projectId, attempts, hints, stage, event.kind === "stage"],
    );
    return result.rowCount === 1;
  };
}
