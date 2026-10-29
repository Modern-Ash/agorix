import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  AUTH_SERVICE_MIGRATIONS,
  AuthService,
  SqlAccountRepository,
  SqlSessionRepository,
} from "@agorix/auth-service";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { PROJECT_REPOSITORY_MIGRATIONS, SqlProjectRepository } from "@agorix/project-repository";
import { configFromEnv } from "./index.js";
import { openOriMig04Pilot } from "./oriMig04PilotBootstrap.js";
import { createTutorServer } from "./server.js";

const url = process.env["AGORIX_TEST_POSTGRES_URL"];
const oriRoot = process.env["ORI_REPO_PATH"];

describe.runIf(url && oriRoot)("MIG-04 private pilot real-process journey", () => {
  it("keeps the project unchanged until accepted, then applies one audited CAS", async () => {
    if (!url || !oriRoot || !/^\/agorix_test(?:_[0-9a-f]{12})?$/.test(new URL(url).pathname))
      throw new Error("Requires a dedicated disposable agorix_test database and real Ori checkout");
    const schema = `pilot_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const admin = new Pool({ connectionString: url });
    await admin.query(`create schema ${schema}`);
    const scopedUrl = new URL(url);
    scopedUrl.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scopedUrl.toString() });
    let server: ReturnType<typeof createTutorServer> | undefined;
    let pilot: Awaited<ReturnType<typeof openOriMig04Pilot>> | undefined;
    try {
      for (const migration of [...AUTH_SERVICE_MIGRATIONS, ...PROJECT_REPOSITORY_MIGRATIONS])
        await pool.query(migration.postgresql);
      await pool.query(`create table agorix_adult_emails (
        account_id text primary key references agorix_accounts(account_id),
        email_normalized text not null, verified_at text
      )`);
      await pool.query(`create table agorix_ori_rollout_policy (
        deployment_id text primary key, epoch bigint not null, mode text not null,
        human_authorized boolean not null, kill_switch boolean not null
      )`);
      await pool.query(`create table agorix_ori_rollout_projects (
        deployment_id text not null references agorix_ori_rollout_policy(deployment_id),
        project_id text not null, primary key (deployment_id, project_id)
      )`);
      await pool.query(`create table agorix_ori_commit_audit (
        event_id text primary key, deployment_id text not null,
        policy_epoch bigint not null, revision_before integer not null,
        revision_after integer not null, semantic_hash text not null,
        committed_at timestamptz not null default now()
      )`);
      const executor = {
        async execute(sql: string, values: readonly (string | number | boolean | null)[] = []) {
          const result = await pool.query(sql, [...values]);
          return { rows: result.rows, rowCount: result.rowCount ?? 0 };
        },
      };
      const auth = new AuthService({
        accounts: new SqlAccountRepository({ executor, dialect: "postgresql" }),
        sessions: new SqlSessionRepository({ executor, dialect: "postgresql" }),
      });
      const credential = ["fixture", "only", "password", "12345"].join("-");
      const registered = await auth.register({ username: "pilot", password: credential });
      const signedIn = await auth.signIn({ username: "pilot", password: credential });
      await pool.query("insert into agorix_adult_emails values ($1, $2, $3)", [
        registered.account.accountId,
        "pilot@example.test",
        "2026-10-29T00:00:00.000Z",
      ]);
      const projects = new SqlProjectRepository({ executor, dialect: "postgresql" });
      const created = await projects.create(registered.account.accountId, "Kids pilot", {
        schemaVersion: SCHEMA_VERSION,
        program: {
          schema: SCHEMA_VERSION,
          scripts: [
            {
              id: "main",
              trigger: { type: "greenFlag" },
              statements: [{ type: "move", steps: 1 }],
            },
          ],
        },
        metadata: {
          createdAt: "2026-10-29T00:00:00.000Z",
          updatedAt: "2026-10-29T00:00:00.000Z",
          missionProgress: 0,
          hintLevel: 0,
          missionSpec: { goal: "kids.cell.4.2", successCheck: "touches-goal" },
        },
      });
      await pool.query(
        "insert into agorix_ori_rollout_policy values ('pilot', 1, 'pilot', true, false)",
      );
      await pool.query("insert into agorix_ori_rollout_projects values ('pilot', $1)", [
        created.projectId,
      ]);
      pilot = await openOriMig04Pilot({
        AGORIX_TUTOR_POSTGRES_URL: scopedUrl.toString(),
        AGORIX_ORI_DEPLOYMENT_ID: "pilot",
        AGORIX_ALLOWED_ADULT_EMAIL: "pilot@example.test",
        ORI_REPO_PATH: oriRoot,
      });
      server = createTutorServer({
        config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
        ...pilot.options,
      });
      await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      let cookie = `agorix_session=${signedIn.sessionToken}`;
      const post = async (path: string, body: unknown) => {
        const response = await fetch(base + path, {
          method: "POST",
          headers: {
            origin: base,
            cookie,
            "content-type": "application/json",
            "x-agorix-request": "1",
          },
          body: JSON.stringify(body),
        });
        const rotated = response.headers.get("set-cookie")?.split(";")[0];
        if (rotated) cookie = rotated;
        return response;
      };
      expect((await post("/api/tutor/ori/pilot/project", {})).status).toBe(200);
      expect((await post("/api/tutor/ori/review/propose", {})).status).toBe(409);
      expect((await post("/api/tutor/ori/evidence/run", {})).status).toBe(200);
      expect((await post("/api/tutor/ori/evidence/hint", {})).status).toBe(200);
      const proposed = await post("/api/tutor/ori/review/propose", {});
      expect(proposed.status).toBe(200);
      const { ticketId } = (await proposed.json()) as { ticketId: string };
      expect((await projects.get(registered.account.accountId, created.projectId)).revision).toBe(
        1,
      );
      expect(
        (await post("/api/tutor/ori/review/apply", { ticketId, scriptId: "main" })).status,
      ).toBe(403);
      expect(
        (await post("/api/tutor/ori/review/decision", { ticketId, decision: "accept" })).status,
      ).toBe(200);
      expect(
        (await post("/api/tutor/ori/review/apply", { ticketId, scriptId: "main" })).status,
      ).toBe(200);
      expect(
        (await post("/api/tutor/ori/review/apply", { ticketId, scriptId: "main" })).status,
      ).toBe(403);
      const updated = await projects.get(registered.account.accountId, created.projectId);
      expect(updated.revision).toBe(2);
      expect(updated.storedProject.program.scripts[0]?.statements.length).toBe(2);
      expect(
        (await pool.query("select count(*)::integer as n from agorix_ori_commit_audit")).rows[0]?.n,
      ).toBe(1);
    } finally {
      if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
      await pilot?.close();
      await pool.end();
      await admin.query(`drop schema if exists ${schema} cascade`);
      await admin.end();
    }
  }, 30000);
});
