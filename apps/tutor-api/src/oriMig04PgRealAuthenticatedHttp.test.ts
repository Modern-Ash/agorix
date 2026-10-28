import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POSTGRESQL_SCHEMA_SQL } from "@agorix/project-repository";
import { configFromEnv } from "./index.js";
import { startOriMig04PgSharedAuthProductionHost } from "./oriMig04PgSharedAuthProductionHost.js";
import { ORI_MIG04_AUTH_ACCOUNT_SCHEMA_SQL } from "./oriMig04PgAuthAccountRepository.js";
import { ORI_MIG04_AUTH_SESSION_SCHEMA_SQL } from "./oriMig04PgAuthSessionRepository.js";
import { ORI_MIG04_SESSION_PROJECT_SCHEMA_SQL } from "./oriMig04PgSessionProjectStore.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 real authenticated HTTP cookie boundary", () => {
  it("authenticates a real session and denies Ori apply under disabled rollout", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: databaseUrl });
    const oriRoot = mkdtempSync(join(tmpdir(), "ori-auth-http-"));
    const deploymentId = `ori_auth_http_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const username = `ori_http_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const password = "VeryStrongPassword_2026!";
    let accountId: string | undefined;
    try {
      await admin.query(POSTGRESQL_SCHEMA_SQL);
      await admin.query("alter table agorix_projects add column if not exists title text");
      await admin.query("alter table agorix_projects add column if not exists created_at text");
      await admin.query(ORI_MIG04_AUTH_ACCOUNT_SCHEMA_SQL);
      await admin.query(ORI_MIG04_AUTH_SESSION_SCHEMA_SQL);
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
      const runtime = await startOriMig04PgSharedAuthProductionHost({
        env: {},
        connectionString: databaseUrl,
        tutor: { config: configFromEnv({}) },
        ori: {
          deploymentId,
          oriRoot,
          world: {},
          learningContext: async () => null,
          rolloutDecide: () => ({ learnerVisible: false }),
          runOriOverride: async () => ({ status: "rejected" }) as never,
        },
      });
      try {
        const registered = await runtime.auth.register({ username, password });
        accountId = registered.account.accountId;
        const login = await runtime.auth.signIn({ username, password });
        const endpoint = `http://127.0.0.1:${runtime.address.port}/api/tutor/ori/review/apply`;
        const payload = JSON.stringify({ ticketId: "missing", scriptId: "main" });
        const anonymous = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
        });
        expect(anonymous.ok).toBe(false);
        const authenticated = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `__Host-agorix-session=${login.sessionToken}`,
          },
          body: payload,
        });
        expect(authenticated.ok).toBe(false);
        const forged = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-owner-id": accountId,
            "x-project-id": "other_project",
            authorization: "Bearer forged",
          },
          body: payload,
        });
        expect(forged.ok).toBe(false);
        const invalidCookie = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "__Host-agorix-session=invalid",
          },
          body: payload,
        });
        expect(invalidCookie.ok).toBe(false);
        const duplicateCookie = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `__Host-agorix-session=${login.sessionToken}; __Host-agorix-session=${login.sessionToken}`,
          },
          body: payload,
        });
        expect(duplicateCookie.ok).toBe(false);
        await runtime.auth.signOut(login.sessionToken);
        const revoked = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `__Host-agorix-session=${login.sessionToken}`,
          },
          body: payload,
        });
        expect(revoked.ok).toBe(false);
      } finally {
        await runtime.close();
      }
    } finally {
      if (accountId) {
        await admin.query("delete from agorix_auth_sessions where account_id = $1", [accountId]);
        await admin.query("delete from agorix_auth_accounts where account_id = $1", [accountId]);
      }
      await admin.query("delete from agorix_ori_rollout_policy where deployment_id = $1", [
        deploymentId,
      ]);
      await admin.end();
      rmSync(oriRoot, { recursive: true, force: true });
    }
  });
});
