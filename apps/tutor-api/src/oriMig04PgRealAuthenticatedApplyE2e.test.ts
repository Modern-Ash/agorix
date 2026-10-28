import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { POSTGRESQL_SCHEMA_SQL } from "@agorix/project-repository";
import { configFromEnv } from "./index.js";
import { createOriMig04PgCanonicalInfrastructure } from "./oriMig04PgCanonicalInfrastructure.js";
import { startOriMig04PgSharedAuthProductionHost } from "./oriMig04PgSharedAuthProductionHost.js";
import { ORI_MIG04_AUTH_ACCOUNT_SCHEMA_SQL } from "./oriMig04PgAuthAccountRepository.js";
import { ORI_MIG04_AUTH_SESSION_SCHEMA_SQL } from "./oriMig04PgAuthSessionRepository.js";
import { ORI_MIG04_SESSION_PROJECT_SCHEMA_SQL } from "./oriMig04PgSessionProjectStore.js";
import {
  createOriMig04PgLearningContext,
  ORI_MIG04_LEARNING_CONTEXT_SCHEMA_SQL,
} from "./oriMig04PgLearningContext.js";

// This acceptance suite uses the actual independent Modern-Ash/ori process.
// The workflow supplies both an ephemeral PostgreSQL service and Ori checkout.
const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const oriRoot = process.env["ORI_MIG04_REAL_ORI_ROOT"];
const run = databaseUrl && oriRoot ? describe : describe.skip;

run("MIG-04 authenticated HTTP -> independent Ori -> fenced PostgreSQL CAS", () => {
  it("records server-originated learning, requires review, applies once and respects kill switch", async () => {
    if (!databaseUrl || !oriRoot) throw Error("Missing E2E dependencies");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: databaseUrl });
    const canonical = createOriMig04PgCanonicalInfrastructure(databaseUrl);
    const suffix = Date.now().toString(36) + "_" + Math.floor(Math.random() * 100000);
    const deploymentId = "ori_full_" + suffix;
    const username = "ori_full_" + suffix;
    const password = "VeryStrongPassword_2026!";
    let owner: string | undefined;
    let projectId: string | undefined;
    let runtime: Awaited<ReturnType<typeof startOriMig04PgSharedAuthProductionHost>> | undefined;
    let visible = false;
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [{
        id: "main",
        trigger: { type: "onStart" },
        statements: [{ type: "move", steps: 1 }],
      }],
    };
    try {
      await admin.query(POSTGRESQL_SCHEMA_SQL);
      await admin.query("alter table agorix_projects add column if not exists title text");
      await admin.query("alter table agorix_projects add column if not exists created_at text");
      await admin.query(ORI_MIG04_AUTH_ACCOUNT_SCHEMA_SQL);
      await admin.query(ORI_MIG04_AUTH_SESSION_SCHEMA_SQL);
      await admin.query(ORI_MIG04_SESSION_PROJECT_SCHEMA_SQL);
      await admin.query(ORI_MIG04_LEARNING_CONTEXT_SCHEMA_SQL);
      await admin.query(`create table if not exists agorix_ori_rollout_policy (
        deployment_id text primary key,
        epoch bigint not null default 0,
        mode text not null,
        human_authorized boolean not null,
        kill_switch boolean not null,
        updated_at timestamptz not null default now()
      )`);
      await admin.query(`create table if not exists agorix_ori_rollout_projects (
        deployment_id text not null references agorix_ori_rollout_policy(deployment_id),
        project_id text not null,
        primary key (deployment_id, project_id)
      )`);
      await admin.query(
        "insert into agorix_ori_rollout_policy (deployment_id, epoch, mode, human_authorized, kill_switch) values ($1, 1, 'disabled', false, true)",
        [deploymentId],
      );
      runtime = await startOriMig04PgSharedAuthProductionHost({
        env: {},
        connectionString: databaseUrl,
        tutor: { config: configFromEnv({}) },
        ori: {
          deploymentId,
          oriRoot,
          world: { goal: { x: 10, y: 0 } },
          // Production composition overrides this with trusted PG observations.
          learningContext: async () => null,
          rolloutDecide: () => ({ learnerVisible: visible }),
        },
      });
      const base = "http://127.0.0.1:" + runtime.address.port + "/api/tutor/ori";
      let cookie = "";
      const post = async (route: string, body: unknown, authenticated = true) => {
        const reply = await fetch(base + route, {
          method: "POST",
          headers: {
            origin: "https://127.0.0.1:" + runtime!.address.port,
            "content-type": "application/json",
            "x-agorix-request": "1",
            ...(authenticated && cookie ? { cookie } : {}),
          },
          body: JSON.stringify(body),
        });
        if (authenticated) {
          const updated = reply.headers.get("set-cookie")?.split(";")[0];
          if (updated?.startsWith("__Host-agorix-session=")) cookie = updated;
        }
        return reply;
      };
      expect((await post("/auth/register", { username, password })).status).toBe(201);
      const account = await admin.query<{ account_id: string }>(
        "select account_id from agorix_auth_accounts where normalized_username = $1",
        [username],
      );
      owner = account.rows[0]?.account_id;
      if (!owner) throw Error("Real auth account not persisted");
      expect((await post("/auth/login", { username, password })).status).toBe(200);
      expect(cookie).toContain("__Host-agorix-session=");

      const created = await canonical.repository.create(owner, "E2E canonical", {
        schemaVersion: SCHEMA_VERSION,
        program,
        metadata: {
          createdAt: "2026-10-28T00:00:00.000Z",
          updatedAt: "2026-10-28T00:00:00.000Z",
          missionProgress: 0,
          hintLevel: 1,
        },
      });
      projectId = created.projectId;
      expect((await post("/auth/project", { projectId })).status).toBe(200);
      const learning = createOriMig04PgLearningContext(admin);
      expect(await learning(owner, projectId)).toEqual({
        attempts: 0, hintsUsed: 0, learningStage: "explore",
      });

      // Operator has not approved rollout. No learner-facing route or event.
      expect((await post("/review/propose", {})).status).toBe(404);
      expect(await learning(owner, projectId)).toMatchObject({ attempts: 0, hintsUsed: 0 });
      expect((await post("/review/propose", {}, false)).status).toBe(401);

      // Simulate explicit adult/admin authorization AFTER a disabled startup.
      await admin.query(
        "insert into agorix_ori_rollout_projects (deployment_id, project_id) values ($1, $2)",
        [deploymentId, projectId],
      );
      await admin.query(
        "update agorix_ori_rollout_policy set epoch = epoch + 1, mode = 'pilot', human_authorized = true, kill_switch = false where deployment_id = $1",
        [deploymentId],
      );
      visible = true;
      const proposed = await post("/review/propose", {});
      expect(proposed.status).toBe(200);
      const pending = (await proposed.json()) as { ticketId: string; proposal: unknown; appliedChanges: boolean };
      expect(pending.ticketId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(pending.appliedChanges).toBe(false);
      expect(pending.proposal).toBeTruthy();
      const observed = await learning(owner, projectId);
      expect(observed?.attempts).toBeGreaterThanOrEqual(1);
      expect(observed?.hintsUsed).toBe(1);
      expect(observed?.learningStage).toBe("explore");
      expect((await canonical.repository.get(owner, projectId)).revision).toBe(created.revision);

      // No mutation without the learner's explicit accept.
      const applyBody = { ticketId: pending.ticketId, scriptId: "main" };
      expect((await post("/review/apply", applyBody)).status).toBe(403);
      expect((await canonical.repository.get(owner, projectId)).revision).toBe(created.revision);
      const approved = await post("/review/decision", {
        ticketId: pending.ticketId, decision: "accept",
      });
      expect(approved.status).toBe(200);
      expect((await approved.json()) as object).toMatchObject({
        status: "accepted", appliedChanges: false,
      });
      expect((await learning(owner, projectId))?.learningStage).toBe("connect");

      const applied = await post("/review/apply", applyBody);
      expect(applied.status).toBe(200);
      expect((await applied.json()) as object).toMatchObject({
        status: "applied", evidenceRecorded: true,
      });
      const updated = await canonical.repository.get(owner, projectId);
      expect(updated.revision).toBe(created.revision + 1);
      expect(updated.storedProject.program.scripts[0]?.statements).toEqual([
        { type: "move", steps: 1 },
        { type: "move", steps: 1 },
      ]);
      expect((await learning(owner, projectId))?.learningStage).toBe("translate");
      expect((await post("/review/apply", applyBody)).status).toBe(403);
      expect((await canonical.repository.get(owner, projectId)).revision).toBe(updated.revision);

      // New accepted ticket cannot commit after durable emergency revocation.
      const second = await post("/review/propose", {});
      expect(second.status).toBe(200);
      const secondTicket = (await second.json()) as { ticketId: string };
      expect((await post("/review/decision", {
        ticketId: secondTicket.ticketId, decision: "accept",
      })).status).toBe(200);
      expect(await runtime.emergencyDisable()).toBeGreaterThan(1);
      const revoked = await post("/review/apply", {
        ticketId: secondTicket.ticketId, scriptId: "main",
      });
      expect(revoked.ok).toBe(false);
      expect((await canonical.repository.get(owner, projectId)).revision).toBe(updated.revision);
    } finally {
      if (runtime) await runtime.close();
      if (owner && projectId) {
        await admin.query(
          "delete from agorix_ori_learning_context where owner_id = $1 and project_id = $2",
          [owner, projectId],
        );
        await admin.query(
          "delete from agorix_ori_session_projects where account_id = $1",
          [owner],
        );
        await admin.query(
          "delete from agorix_projects where owner_id = $1 and project_id = $2",
          [owner, projectId],
        );
      }
      if (owner) {
        await admin.query("delete from agorix_auth_sessions where account_id = $1", [owner]);
        await admin.query("delete from agorix_auth_accounts where account_id = $1", [owner]);
      }
      await admin.query("delete from agorix_ori_rollout_projects where deployment_id = $1", [deploymentId]);
      await admin.query("delete from agorix_ori_rollout_policy where deployment_id = $1", [deploymentId]);
      await canonical.close();
      await admin.end();
    }
  });
});
