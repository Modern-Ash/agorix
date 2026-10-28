import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POSTGRESQL_SCHEMA_SQL } from "@agorix/project-repository";
import { configFromEnv } from "./index.js";
import { startOriMig04PgIntegratedHost } from "./oriMig04PgIntegratedHost.js";
import { ORI_MIG04_SESSION_PROJECT_SCHEMA_SQL } from "./oriMig04PgSessionProjectStore.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 integrated HTTP host against real PostgreSQL", () => {
  it("boots with one canonical pool, denies anonymous apply and shuts down", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: databaseUrl });
    const deploymentId = `ori_integrated_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const oriRoot = mkdtempSync(join(tmpdir(), "ori-integrated-"));
    try {
      await admin.query(POSTGRESQL_SCHEMA_SQL);
      await admin.query("alter table agorix_projects add column if not exists title text");
      await admin.query("alter table agorix_projects add column if not exists created_at text");
      await admin.query(ORI_MIG04_SESSION_PROJECT_SCHEMA_SQL);
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
      const runtime = await startOriMig04PgIntegratedHost({
        connectionString: databaseUrl,
        tutor: { config: configFromEnv({}) },
        ori: {
          deploymentId,
          auth: {
            resolveSession: async () => {
              authCalls++;
              throw Error("invalid");
            },
          },
          oriRoot,
          world: {},
          learningContext: async () => null,
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
            body: JSON.stringify({ ticketId: "invalid", scriptId: "main" }),
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
  it("refuses to listen when the deployment policy is absent", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const oriRoot = mkdtempSync(join(tmpdir(), "ori-integrated-deny-"));
    try {
      await expect(
        startOriMig04PgIntegratedHost({
          connectionString: databaseUrl,
          tutor: { config: configFromEnv({}) },
          ori: {
            deploymentId: `ori_absent_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
            auth: {
              resolveSession: async () => {
                throw Error("unused");
              },
            },
            oriRoot,
            world: {},
            learningContext: async () => null,
            rolloutDecide: () => ({ learnerVisible: false }),
            runOriOverride: async () => ({ status: "rejected" }) as never,
          },
        }),
      ).rejects.toThrow();
    } finally {
      rmSync(oriRoot, { recursive: true, force: true });
    }
  });

});
