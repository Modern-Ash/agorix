import { describe, expect, it } from "vitest";
import { commitOriProjectWithPgFence } from "./oriMig04PostgresAtomicCas.js";
import { createOriPgTransactionProvider } from "./oriMig04PgTransactionProvider.js";
import { emergencyDisableOriPgRollout } from "./oriMig04PostgresEmergencyDisable.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 real PostgreSQL fenced canonical CAS", () => {
  it("allows one concurrent writer and denies writes after durable revocation", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl, max: 3 });
    const id = `ori_fenced_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const projectId = id;
    const ownerId = "learner";
    const provider = createOriPgTransactionProvider({
      connect: async () => {
        const client = await pool.connect();
        return {
          query: async <Row extends Record<string, unknown>>(
            sql: string,
            values: readonly (string | number | boolean)[],
          ) => {
            const result = await client.query(sql, [...values]);
            return { rows: result.rows as readonly Row[] };
          },
          release: () => client.release(),
        };
      },
    });
    try {
      await pool.query(`create table if not exists agorix_ori_rollout_policy (
        deployment_id text primary key,
        epoch bigint not null default 0,
        mode text not null,
        human_authorized boolean not null,
        kill_switch boolean not null,
        updated_at timestamptz not null default now()
      )`);
      await pool.query(`create table if not exists agorix_ori_rollout_projects (
        deployment_id text not null references agorix_ori_rollout_policy(deployment_id),
        project_id text not null,
        primary key (deployment_id, project_id)
      )`);
      await pool.query(`create table if not exists agorix_projects (
        owner_id text not null,
        project_id text primary key,
        revision integer not null,
        stored_project_json text not null,
        semantic_hash text not null,
        updated_at timestamptz not null
      )`);
      await pool.query(
        "insert into agorix_ori_rollout_policy (deployment_id, epoch, mode, human_authorized, kill_switch) values ($1, 1, 'pilot', true, false)",
        [id],
      );
      await pool.query(
        "insert into agorix_ori_rollout_projects (deployment_id, project_id) values ($1, $2)",
        [id, projectId],
      );
      await pool.query(
        "insert into agorix_projects (owner_id, project_id, revision, stored_project_json, semantic_hash, updated_at) values ($1, $2, 1, '{}', 'initial', now())",
        [ownerId, projectId],
      );
      const input = {
        deploymentId: id,
        ownerId,
        projectId,
        expectedEpoch: 1,
        expectedRevision: 1,
        storedProjectJson: '{"scripts":[]}',
        semanticHash: "new-hash",
        updatedAt: new Date().toISOString(),
      };
      const outcomes = await Promise.all([
        commitOriProjectWithPgFence(provider, input),
        commitOriProjectWithPgFence(provider, input),
      ]);
      expect(outcomes.sort()).toEqual(["applied", "conflict"]);
      const before = await pool.query<{ revision: number; semantic_hash: string }>(
        "select revision, semantic_hash from agorix_projects where project_id = $1",
        [projectId],
      );
      expect(before.rows[0]).toMatchObject({ revision: 2, semantic_hash: "new-hash" });
      expect(await emergencyDisableOriPgRollout(provider, id)).toBe(2);
      expect(
        await commitOriProjectWithPgFence(provider, { ...input, expectedRevision: 2 }),
      ).toBe("denied");
      const after = await pool.query<{ revision: number }>(
        "select revision from agorix_projects where project_id = $1",
        [projectId],
      );
      expect(after.rows[0]?.revision).toBe(2);
    } finally {
      await pool.query("delete from agorix_projects where project_id = $1", [projectId]);
      await pool.query("delete from agorix_ori_rollout_projects where deployment_id = $1", [id]);
      await pool.query("delete from agorix_ori_rollout_policy where deployment_id = $1", [id]);
      await pool.end();
    }
  });
});
