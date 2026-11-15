import { describe, expect, it } from "vitest";
import { POSTGRESQL_SCHEMA_SQL } from "@agorix/project-repository";
import { ORI_MIG04_LEARNING_CONTEXT_SCHEMA_SQL, createOriMig04PgLearningContext } from "./oriMig04PgLearningContext.js";
import { createOriMig04PgLearningEvents } from "./oriMig04PgLearningEvents.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 real PostgreSQL pedagogical evidence", () => {
  it("persists trusted events and rejects cross-owner updates", async () => {
    if (!databaseUrl) throw Error("Missing database");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl });
    const owner = `ori_learn_${Date.now().toString(36)}`;
    const projectId = `ori_project_${Date.now().toString(36)}`;
    try {
      await pool.query(POSTGRESQL_SCHEMA_SQL);
      await pool.query("alter table agorix_projects add column if not exists title text");
      await pool.query("alter table agorix_projects add column if not exists created_at text");
      await pool.query(ORI_MIG04_LEARNING_CONTEXT_SCHEMA_SQL);
      await pool.query(
        "insert into agorix_projects (owner_id, project_id, title, created_at, revision, stored_project_json, semantic_hash, updated_at) values ($1, $2, 'Learning fixture', now(), 1, '{}', 'initial', now())",
        [owner, projectId],
      );
      const record = createOriMig04PgLearningEvents(pool);
      const read = createOriMig04PgLearningContext(pool);
      expect(await record("intruder", projectId, { kind: "attempt" })).toBe(false);
      expect(await record(owner, projectId, { kind: "attempt" })).toBe(true);
      expect(await record(owner, projectId, { kind: "hint" })).toBe(true);
      expect(await record(owner, projectId, { kind: "stage", stage: "connect" })).toBe(true);
      expect(await read(owner, projectId)).toEqual({
        attempts: 1,
        hintsUsed: 1,
        learningStage: "connect",
      });
      expect(await read("intruder", projectId)).toBeNull();
    } finally {
      await pool.query("delete from agorix_ori_learning_context where owner_id = $1 and project_id = $2", [owner, projectId]);
      await pool.query("delete from agorix_projects where owner_id = $1 and project_id = $2", [owner, projectId]);
      await pool.end();
    }
  });
});
