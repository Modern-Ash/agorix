import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthService } from "@agorix/auth-service";
import type { ProjectRepository } from "@agorix/project-repository";
import { describe, expect, it } from "vitest";
import {
  commitOriProjectWithPgFence,
  type OriPgTransactionProvider,
} from "./oriMig04PostgresAtomicCas.js";
import { emergencyDisableOriPgRollout } from "./oriMig04PostgresEmergencyDisable.js";
import { createOriPgTransactionProvider } from "./oriMig04PgTransactionProvider.js";
import { createOriMig04PgPilotProjectSelector } from "./oriMig04PgPilotProjectSelector.js";
import { createOriMig04PgAuthorizedOptions } from "./oriMig04PgAuthorizedOptions.js";

const url = process.env["AGORIX_TEST_POSTGRES_URL"];

describe.runIf(url)("MIG-04 PostgreSQL transaction fence", () => {
  it("enforces project CAS and durable revocation across two connections", async () => {
    if (!url || !/^\/agorix_test(?:_[0-9a-f]{12})?$/.test(new URL(url).pathname)) {
      throw new Error("Integration tests require a dedicated disposable agorix_test database");
    }
    const schema = `fence_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const admin = new Pool({ connectionString: url });
    await admin.query(`create schema ${schema}`);
    const scopedUrl = new URL(url);
    scopedUrl.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scopedUrl.toString(), max: 3 });
    const provider: OriPgTransactionProvider = createOriPgTransactionProvider({
      async connect() {
        const client = await pool.connect();
        return {
          async query<Row extends Record<string, unknown>>(
            sql: string,
            values: readonly (string | number | boolean)[],
          ) {
            const result = await client.query(sql, [...values]);
            return { rows: result.rows as Row[] };
          },
          release: () => client.release(),
        };
      },
    });
    try {
      await pool.query(
        "create table agorix_accounts (account_id text primary key, status text not null)",
      );
      await pool.query(`create table agorix_adult_emails (
        account_id text primary key references agorix_accounts(account_id),
        email_normalized text not null, verified_at text
      )`);
      await pool.query(`create table agorix_projects (
        owner_id text not null, project_id text not null, title text not null,
        revision integer not null, created_at text not null, updated_at text not null,
        stored_project_json text not null, semantic_hash text not null,
        primary key (owner_id, project_id)
      )`);
      await pool.query(`create table agorix_ori_rollout_policy (
        deployment_id text primary key, epoch bigint not null, mode text not null,
        human_authorized boolean not null, kill_switch boolean not null,
        updated_at timestamptz not null default now()
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
      await pool.query(
        "insert into agorix_projects values ('owner', 'approved', 'Pilot', 1, 't0', 't0', '{}', 'old')",
      );
      await pool.query("insert into agorix_accounts values ('owner', 'active')");
      await pool.query(
        "insert into agorix_adult_emails values ('owner', 'owner@example.test', 't0')",
      );
      await pool.query(
        "insert into agorix_ori_rollout_policy (deployment_id, epoch, mode, human_authorized, kill_switch) values ('pilot', 1, 'pilot', true, false)",
      );
      await pool.query("insert into agorix_ori_rollout_projects values ('pilot', 'approved')");
      const selectPilot = createOriMig04PgPilotProjectSelector({
        pool,
        deploymentId: "pilot",
        allowedAdultEmail: "owner@example.test",
      });
      expect(await selectPilot({ accountId: "owner", sessionId: "session" })).toBe("approved");
      expect(await selectPilot({ accountId: "stranger", sessionId: "session" })).toBeNull();
      const authorized = createOriMig04PgAuthorizedOptions({
        pool,
        auth: {
          resolveSession: async () => ({
            account: { accountId: "owner", status: "active" },
            session: { accountId: "owner", sessionId: "session" },
            rotated: false,
          }),
        } as unknown as Pick<AuthService, "resolveSession">,
        repository: {
          get: async (owner: string, projectId: string) => ({ ownerId: owner, projectId }),
        } as unknown as ProjectRepository,
        deploymentId: "pilot",
        allowedAdultEmail: "owner@example.test",
        oriRoot: "/unused-test-root",
        world: {},
        learningContext: async () => null,
        runOriOverride: async () => ({
          status: "unavailable",
          requiresLearnerApproval: true,
          appliedChanges: false,
        }),
      });
      const request = {
        headers: { cookie: `agorix_session=${"a".repeat(48)}` },
      } as IncomingMessage;
      const response = { headersSent: false, writableEnded: false } as ServerResponse;
      expect(await authorized.options.oriReviewIdentity(request, response)).toEqual({
        ownerId: "owner",
        projectId: "approved",
        sessionId: "session",
      });
      const input = {
        deploymentId: "pilot",
        ownerId: "owner",
        projectId: "approved",
        expectedEpoch: 1,
        expectedRevision: 1,
        storedProjectJson: '{"accepted":true}',
        semanticHash: "new",
        updatedAt: "t1",
      };
      expect(await commitOriProjectWithPgFence(provider, { ...input, ownerId: "stranger" })).toBe(
        "conflict",
      );
      expect(await commitOriProjectWithPgFence(provider, input)).toBe("applied");
      expect(await commitOriProjectWithPgFence(provider, input)).toBe("conflict");
      const audit = await pool.query<{
        revision_before: number;
        revision_after: number;
        semantic_hash: string;
      }>("select revision_before, revision_after, semantic_hash from agorix_ori_commit_audit");
      expect(audit.rows).toEqual([{ revision_before: 1, revision_after: 2, semantic_hash: "new" }]);
      await pool.query(
        "update agorix_adult_emails set verified_at = null where account_id = 'owner'",
      );
      expect(
        await commitOriProjectWithPgFence(provider, {
          ...input,
          expectedRevision: 2,
          allowedAdultEmail: "owner@example.test",
        }),
      ).toBe("denied");
      await pool.query(
        "update agorix_adult_emails set verified_at = 't0' where account_id = 'owner'",
      );
      await pool.query("drop table agorix_ori_commit_audit");
      await expect(
        commitOriProjectWithPgFence(provider, {
          ...input,
          expectedRevision: 2,
          semanticHash: "must-rollback",
        }),
      ).rejects.toThrow();

      const lock = await pool.connect();
      try {
        await lock.query("begin");
        await lock.query(
          "select 1 from agorix_ori_rollout_policy where deployment_id = 'pilot' for update",
        );
        let revocationFinished = false;
        const revoke = emergencyDisableOriPgRollout(provider, "pilot").then((epoch) => {
          revocationFinished = true;
          return epoch;
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(revocationFinished).toBe(false);
        await lock.query("commit");
        expect(await revoke).toBe(2);
      } finally {
        await lock.query("rollback").catch(() => undefined);
        lock.release();
      }
      expect(
        await commitOriProjectWithPgFence(provider, {
          ...input,
          expectedEpoch: 1,
          expectedRevision: 2,
        }),
      ).toBe("denied");
      const project = await pool.query<{ revision: number; semantic_hash: string }>(
        "select revision, semantic_hash from agorix_projects where owner_id = 'owner' and project_id = 'approved'",
      );
      expect(project.rows[0]).toMatchObject({ revision: 2, semantic_hash: "new" });
      const policy = await pool.query<{ epoch: string; kill_switch: boolean }>(
        "select epoch, kill_switch from agorix_ori_rollout_policy where deployment_id = 'pilot'",
      );
      expect(policy.rows[0]).toMatchObject({ epoch: "2", kill_switch: true });
      expect(await selectPilot({ accountId: "owner", sessionId: "session" })).toBeNull();
      expect(await authorized.options.oriReviewIdentity(request, response)).toBeNull();
    } finally {
      await pool.end();
      await admin.query(`drop schema ${schema} cascade`);
      await admin.end();
    }
  });
});
