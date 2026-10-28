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
    const username = `ori_${Date.now().toString(36)}_${Math.floor(Math.random() * 100000)}`;
    const password = "VeryStrongPassword_2026!";
    let accountId: string | undefined;
    let browserAccountId: string | undefined;
    let outsiderAccountId: string | undefined;
    let ownedProjectId: string | undefined;
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
        const authBase = `http://127.0.0.1:${runtime.address.port}/api/tutor/ori/auth`;
        const browserHeaders = {
          origin: `https://127.0.0.1:${runtime.address.port}`,
          "content-type": "application/json",
        };
        const httpRegistration = await fetch(`${authBase}/register`, {
          method: "POST",
          headers: browserHeaders,
          body: JSON.stringify({
            username: `${username}_browser`,
            password,
          }),
        });
        expect(httpRegistration.status).toBe(201);
        const browserAccount = await admin.query<{ account_id: string }>(
          "select account_id from agorix_auth_accounts where normalized_username = $1",
          [`${username}_browser`],
        );
        browserAccountId = browserAccount.rows[0]?.account_id;
        const httpLogin = await fetch(`${authBase}/login`, {
          method: "POST",
          headers: browserHeaders,
          body: JSON.stringify({
            username: `${username}_browser`,
            password,
          }),
        });
        expect(httpLogin.status).toBe(200);
        expect(httpLogin.headers.get("set-cookie")).toContain("__Host-agorix-session=");
        const loginCookie = httpLogin.headers.get("set-cookie") ?? "";
        expect(loginCookie).toContain("HttpOnly");
        expect(loginCookie).toContain("Secure");
        expect(loginCookie).toContain("SameSite=Strict");
        expect(loginCookie).toContain("Path=/");
        ownedProjectId = `owned_${Date.now().toString(36)}`;
        await admin.query(
          "insert into agorix_projects (owner_id, project_id, title, created_at, revision, stored_project_json, semantic_hash, updated_at) values ($1, $2, 'Owned fixture', now(), 1, '{}', 'initial', now())",
          [browserAccountId, ownedProjectId],
        );
        const ownedSelection = await fetch(`${authBase}/project`, {
          method: "POST",
          headers: {
            ...browserHeaders,
            cookie: httpLogin.headers.get("set-cookie")?.split(";")[0] ?? "",
          },
          body: JSON.stringify({ projectId: ownedProjectId }),
        });
        expect(ownedSelection.status).toBe(200);
        const mapping = await admin.query<{ project_id: string }>(
          "select project_id from agorix_ori_session_projects where account_id = $1",
          [browserAccountId],
        );
        expect(mapping.rows[0]?.project_id).toBe(ownedProjectId);
        // A second real account cannot select the first learner's project.
        const outsiderName = `other_${Date.now().toString(36)}`;
        const outsider = await runtime.auth.register({ username: outsiderName, password });
        outsiderAccountId = outsider.account.accountId;
        const outsiderLogin = await runtime.auth.signIn({ username: outsiderName, password });
        const outsiderSelection = await fetch(`${authBase}/project`, {
          method: "POST",
          headers: {
            ...browserHeaders,
            cookie: `__Host-agorix-session=${outsiderLogin.sessionToken}`,
          },
          body: JSON.stringify({ projectId: ownedProjectId }),
        });
        expect(outsiderSelection.ok).toBe(false);
        const outsiderMapping = await admin.query(
          "select project_id from agorix_ori_session_projects where account_id = $1",
          [outsiderAccountId],
        );
        expect(outsiderMapping.rows).toHaveLength(0);
        const selectedSession = await admin.query<{ session_id: string }>(
          "select session_id from agorix_ori_session_projects where account_id = $1",
          [browserAccountId],
        );
        expect(selectedSession.rows).toHaveLength(1);
        const rotatedCookie = ownedSelection.headers.get("set-cookie")?.split(";")[0];
        expect(rotatedCookie).toContain("__Host-agorix-session=");
        const unownedProject = await fetch(`${authBase}/project`, {
          method: "POST",
          headers: {
            ...browserHeaders,
            cookie: rotatedCookie ?? "",
          },
          body: JSON.stringify({ projectId: "not-owned-by-learner" }),
        });
        expect(unownedProject.ok).toBe(false);
        const issuedCookie = unownedProject.headers.get("set-cookie")?.split(";")[0] ?? rotatedCookie;
        expect(issuedCookie).toBeTruthy();
        const httpLogout = await fetch(`${authBase}/logout`, {
          method: "POST",
          headers: {
            ...browserHeaders,
            cookie: issuedCookie ?? "",
          },
        });
        expect(httpLogout.status).toBe(200);
        expect(httpLogout.headers.get("set-cookie")).toContain("Max-Age=0");
        const remainingMappings = await admin.query<{ session_id: string }>(
          "select session_id from agorix_ori_session_projects where account_id = $1",
          [browserAccountId],
        );
        expect(remainingMappings.rows).toHaveLength(0);
        const staleSession = await admin.query<{ record: { revokedAt?: string } }>(
          "select record from agorix_auth_sessions where account_id = $1",
          [browserAccountId],
        );
        expect(staleSession.rows.every((row) => row.record.revokedAt !== undefined)).toBe(true);
        const secondLogout = await fetch(`${authBase}/logout`, {
          method: "POST",
          headers: {
            ...browserHeaders,
            cookie: issuedCookie ?? "",
          },
        });
        expect(secondLogout.ok).toBe(false);
        const deniedProject = await fetch(`${authBase}/project`, {
          method: "POST",
          headers: {
            ...browserHeaders,
            cookie: issuedCookie ?? "",
          },
          body: JSON.stringify({ projectId: "other-project" }),
        });
        expect(deniedProject.ok).toBe(false);
        const revokedToken = issuedCookie?.split("=")[1];
        if (!revokedToken) throw Error("Missing issued session token");
        await expect(runtime.auth.resolveSession(revokedToken)).rejects.toThrow();
        const badOrigin = await fetch(`${authBase}/login`, {
          method: "POST",
          headers: { ...browserHeaders, origin: "https://attacker.example" },
          body: JSON.stringify({ username, password }),
        });
        expect(badOrigin.status).toBe(403);
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
        await runtime.auth.signOut(login.sessionToken).catch(() => undefined);
      } finally {
        await runtime.close();
      }
    } finally {
      if (browserAccountId) {
        await admin.query("delete from agorix_ori_session_projects where account_id = $1", [browserAccountId]);
      }
      if (ownedProjectId) {
        await admin.query("delete from agorix_projects where project_id = $1", [ownedProjectId]);
      }
      for (const id of [accountId, browserAccountId, outsiderAccountId]) {
        if (!id) continue;
        await admin.query("delete from agorix_auth_sessions where account_id = $1", [id]);
        await admin.query("delete from agorix_auth_accounts where account_id = $1", [id]);
      }
      await admin.query("delete from agorix_ori_rollout_policy where deployment_id = $1", [
        deploymentId,
      ]);
      await admin.end();
      rmSync(oriRoot, { recursive: true, force: true });
    }
  });
});
