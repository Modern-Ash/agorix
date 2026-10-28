import { describe, expect, it } from "vitest";
import { POSTGRESQL_SCHEMA_SQL } from "@agorix/project-repository";
import { createOriMig04PgCanonicalInfrastructure } from "./oriMig04PgCanonicalInfrastructure.js";
import { assertOriMig04PgReadiness } from "./oriMig04PgReadiness.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 canonical shared PostgreSQL infrastructure", () => {
  it("shares a real database for project ownership and rollout readiness", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: databaseUrl });
    const infrastructure = createOriMig04PgCanonicalInfrastructure(databaseUrl);
    const deploymentId = `ori_canonical_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    try {
      // Other integration suites create a reduced agorix_projects table.
      // Restore the canonical columns required by SqlProjectRepository.
      await admin.query(POSTGRESQL_SCHEMA_SQL);
      await admin.query("alter table agorix_projects add column if not exists title text");
      await admin.query("alter table agorix_projects add column if not exists created_at text");
      await admin.query(`create table if not exists agorix_ori_rollout_policy (
        deployment_id text primary key,
        epoch bigint not null default 0,
        mode text not null,
        human_authorized boolean not null,
        kill_switch boolean not null,
        updated_at timestamptz not null default now()
      )`);
      await admin.query(
        "insert into agorix_ori_rollout_policy (deployment_id, epoch, mode, human_authorized, kill_switch) values ($1, 1, 'disabled', false, true)",
        [deploymentId],
      );
      await expect(
        assertOriMig04PgReadiness(infrastructure.pool, deploymentId),
      ).resolves.toBeUndefined();
      await expect(infrastructure.repository.get("owner", "missing")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      const result = await admin.query<{ mode: string }>(
        "select mode from agorix_ori_rollout_policy where deployment_id = $1",
        [deploymentId],
      );
      expect(result.rows[0]?.mode).toBe("disabled");
    } finally {
      await admin.query("delete from agorix_ori_rollout_policy where deployment_id = $1", [
        deploymentId,
      ]);
      await infrastructure.close();
      await admin.end();
    }
  });
});
