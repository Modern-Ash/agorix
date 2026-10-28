import { describe, expect, it } from "vitest";
import { assertOriMig04PgReadiness } from "./oriMig04PgReadiness.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 real PostgreSQL startup readiness", () => {
  it("denies absent and pilot policies, then accepts explicit durable disable", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const deploymentId = `ori_readiness_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const adapter = {
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
    };
    try {
      await pool.query(`create table if not exists agorix_ori_rollout_policy (
        deployment_id text primary key,
        epoch bigint not null default 0,
        mode text not null,
        human_authorized boolean not null,
        kill_switch boolean not null,
        updated_at timestamptz not null default now()
      )`);
      await expect(assertOriMig04PgReadiness(adapter, deploymentId)).rejects.toThrow(
        "durable disabled policy",
      );
      await pool.query(
        "insert into agorix_ori_rollout_policy (deployment_id, epoch, mode, human_authorized, kill_switch) values ($1, 1, 'pilot', true, false)",
        [deploymentId],
      );
      await expect(assertOriMig04PgReadiness(adapter, deploymentId)).rejects.toThrow(
        "durable disabled policy",
      );
      await pool.query(
        "update agorix_ori_rollout_policy set epoch = epoch + 1, mode = 'disabled', human_authorized = false, kill_switch = true where deployment_id = $1",
        [deploymentId],
      );
      await expect(assertOriMig04PgReadiness(adapter, deploymentId)).resolves.toBeUndefined();
      const state = await pool.query<{ epoch: string; mode: string; kill_switch: boolean }>(
        "select epoch, mode, kill_switch from agorix_ori_rollout_policy where deployment_id = $1",
        [deploymentId],
      );
      expect(Number(state.rows[0]?.epoch)).toBe(2);
      expect(state.rows[0]?.mode).toBe("disabled");
      expect(state.rows[0]?.kill_switch).toBe(true);
    } finally {
      await pool.query("delete from agorix_ori_rollout_policy where deployment_id = $1", [
        deploymentId,
      ]);
      await pool.end();
    }
  });
});
