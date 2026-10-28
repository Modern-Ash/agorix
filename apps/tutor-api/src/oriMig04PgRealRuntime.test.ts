import { describe, expect, it } from "vitest";
import { createOriMig04PgNodePool } from "./oriMig04PgNodePool.js";
import { startOriMig04PgAuthenticatedRuntime } from "./oriMig04PgAuthenticatedRuntime.js";
import { configFromEnv } from "./index.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 real PostgreSQL authenticated runtime acceptance", () => {
  it("refuses to listen without durable disabled policy", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: databaseUrl });
    const deploymentId = `ori_runtime_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    try {
      await admin.query(`create table if not exists agorix_ori_rollout_policy (
        deployment_id text primary key,
        epoch bigint not null default 0,
        mode text not null,
        human_authorized boolean not null,
        kill_switch boolean not null,
        updated_at timestamptz not null default now()
      )`);
      const ori = {
        deploymentId,
        auth: {
          resolveSession: async () => {
            throw Error("not expected");
          },
        },
        sessionToken: () => null,
        repository: {} as never,
        oriRoot: "/unused",
        world: {},
        learningContext: async () => null,
        activeProject: async () => null,
        rolloutDecide: () => ({ learnerVisible: false }),
      };
      await expect(
        startOriMig04PgAuthenticatedRuntime({
          connectionString: databaseUrl,
          tutor: { config: configFromEnv({}) },
          ori,
        }),
      ).rejects.toThrow("durable disabled policy");
      await admin.query(
        "insert into agorix_ori_rollout_policy (deployment_id, epoch, mode, human_authorized, kill_switch) values ($1, 1, 'pilot', true, false)",
        [deploymentId],
      );
      await expect(
        startOriMig04PgAuthenticatedRuntime({
          connectionString: databaseUrl,
          tutor: { config: configFromEnv({}) },
          ori,
        }),
      ).rejects.toThrow("durable disabled policy");
    } finally {
      await admin.query("delete from agorix_ori_rollout_policy where deployment_id = $1", [
        deploymentId,
      ]);
      await admin.end();
    }
  });
  it("uses a real PostgreSQL pool and releases connections", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const database = createOriMig04PgNodePool(databaseUrl);
    try {
      const client = await database.pool.connect();
      try {
        const result = await client.query<{ answer: number }>("select 42 as answer", []);
        expect(result.rows[0]?.answer).toBe(42);
      } finally {
        client.release();
      }
    } finally {
      await database.close();
    }
  });
  it("starts a real HTTP listener only for disabled policy and denies anonymous apply", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const admin = new Pool({ connectionString: databaseUrl });
    const deploymentId = `ori_http_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const oriRoot = mkdtempSync(join(tmpdir(), "ori-runtime-http-"));
    try {
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
      let authCalls = 0;
      const runtime = await startOriMig04PgAuthenticatedRuntime({
        connectionString: databaseUrl,
        tutor: { config: configFromEnv({}) },
        ori: {
          deploymentId,
          auth: {
            resolveSession: async () => {
              authCalls++;
              throw Error("invalid session");
            },
          },
          sessionToken: () => null,
          repository: {} as never,
          oriRoot,
          world: {},
          learningContext: async () => null,
          activeProject: async () => null,
          rolloutDecide: () => ({ learnerVisible: false }),
          runOriOverride: async () => ({ status: "rejected" }) as never,
        },
      });
      try {
        expect(runtime.address.address).toBe("127.0.0.1");
        const response = await fetch(
          `http://127.0.0.1:${runtime.address.port}/api/tutor/ori/review/apply`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ projectId: "pilot", ticketId: "ticket", scriptId: "main" }),
          },
        );
        expect(response.ok).toBe(false);
        expect(authCalls).toBe(0);
      } finally {
        await runtime.close();
        await runtime.close();
      }
    } finally {
      await admin.query("delete from agorix_ori_rollout_policy where deployment_id = $1", [
        deploymentId,
      ]);
      await admin.end();
      rmSync(oriRoot, { recursive: true, force: true });
    }
  });
});
