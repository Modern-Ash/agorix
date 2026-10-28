import { describe, expect, it } from "vitest";
import { createOriMig04PgHostWiring } from "./oriMig04PgHostWiring.js";
import { createOriPgTransactionProvider } from "./oriMig04PgTransactionProvider.js";
import { replaceOriPgRolloutPolicy } from "./oriMig04PgPolicyAdmin.js";

/**
 * Real PostgreSQL integration suite. Requires a dedicated, disposable database
 * via ORI_MIG04_TEST_DATABASE_URL. Never points at a production database.
 * The test is opt-in until CI provisions PostgreSQL.
 */
const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 real PostgreSQL rollback across independent connections", () => {
  it("rejects a stale epoch after durable emergency disable", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    // Use dynamic import so default CI does not need pg installed.
    const pg = await import("pg");
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
    const deploymentId = `ori_test_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
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
      await pool.query(
        `insert into agorix_ori_rollout_policy
         (deployment_id, epoch, mode, human_authorized, kill_switch)
         values ($1, 1, 'pilot', true, false)`,
        [deploymentId],
      );
      await pool.query(
        "insert into agorix_ori_rollout_projects (deployment_id, project_id) values ($1, $2)",
        [deploymentId, "pilot"],
      );
      const wiring = createOriMig04PgHostWiring({
        pool: {
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
        },
        deploymentId,
      });
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
      expect(
        await replaceOriPgRolloutPolicy(provider, deploymentId, {
          mode: "pilot",
          humanAuthorized: true,
          killSwitch: false,
          approvedProjectIds: ["pilot", "pilot-2"],
        }),
      ).toBe(2);
      const allowed = await pool.query(
        "select project_id from agorix_ori_rollout_projects where deployment_id = $1 order by project_id",
        [deploymentId],
      );
      expect(allowed.rows.map((row: { project_id: string }) => row.project_id)).toEqual([
        "pilot",
        "pilot-2",
      ]);
      const deniedBeforeRevocation = await wiring.oriMig04AtomicCommit(
        "owner",
        "not-allowlisted",
        {} as never,
        1,
      );
      expect(deniedBeforeRevocation).toBe("denied");
      expect(await wiring.emergencyDisable()).toBe(3);
      expect(await wiring.oriMig04AtomicCommit("owner", "pilot", {} as never, 1)).toBe("denied");
      const result = await pool.query(
        "select epoch, kill_switch from agorix_ori_rollout_policy where deployment_id = $1",
        [deploymentId],
      );
      expect(Number(result.rows[0]?.epoch)).toBe(3);
      expect(result.rows[0]?.kill_switch).toBe(true);
      const remaining = await pool.query(
        "select project_id from agorix_ori_rollout_projects where deployment_id = $1",
        [deploymentId],
      );
      expect(remaining.rows).toEqual([]);
      expect(await wiring.oriMig04AtomicCommit("owner", "pilot-2", {} as never, 1)).toBe("denied");
    } finally {
      await pool.query("delete from agorix_ori_rollout_projects where deployment_id = $1", [
        deploymentId,
      ]);
      await pool.query("delete from agorix_ori_rollout_policy where deployment_id = $1", [
        deploymentId,
      ]);
      await pool.end();
    }
  });
});
