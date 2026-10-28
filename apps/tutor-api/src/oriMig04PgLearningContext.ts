import type { Pool } from "pg";
import type { OriLearningContext } from "./oriCanonicalReviewWorkflow.js";

/**
 * Trusted, owner-scoped pedagogical evidence. The web learning workflow must
 * persist these observations; no counters are inferred from project metadata.
 */
export function createOriMig04PgLearningContext(pool: Pick<Pool, "query">) {
  return async (owner: string, projectId: string): Promise<OriLearningContext | null> => {
    if (!owner || !projectId) return null;
    const result = await pool.query<{
      attempts: number;
      hints_used: number;
      learning_stage: string;
    }>(
      `select c.attempts, c.hints_used, c.learning_stage
       from agorix_ori_learning_context c
       join agorix_projects p on p.owner_id = c.owner_id and p.project_id = c.project_id
       where c.owner_id = $1 and c.project_id = $2`,
      [owner, projectId],
    );
    const row = result.rows[0];
    if (
      !row ||
      !Number.isSafeInteger(row.attempts) ||
      row.attempts < 0 ||
      row.attempts > 100 ||
      !Number.isSafeInteger(row.hints_used) ||
      row.hints_used < 0 ||
      row.hints_used > 100 ||
      !["explore", "connect", "translate"].includes(row.learning_stage)
    ) return null;
    return {
      attempts: row.attempts,
      hintsUsed: row.hints_used,
      learningStage: row.learning_stage as OriLearningContext["learningStage"],
    };
  };
}

export const ORI_MIG04_LEARNING_CONTEXT_SCHEMA_SQL = `
create table if not exists agorix_ori_learning_context (
  owner_id text not null,
  project_id text not null,
  attempts integer not null check (attempts between 0 and 100),
  hints_used integer not null check (hints_used between 0 and 100),
  learning_stage text not null check (learning_stage in ('explore', 'connect', 'translate')),
  updated_at timestamptz not null default now(),
  primary key (owner_id, project_id)
);
`;
