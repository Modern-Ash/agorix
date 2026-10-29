import { randomUUID } from "node:crypto";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService, SqlAccountRepository, SqlSessionRepository } from "@agorix/auth-service";
import type { StoredProject } from "@agorix/persistence";
import { SqlProjectRepository } from "@agorix/project-repository";
import { deletePostgresAccount } from "./deleteAccount.js";
import { importSQLiteSnapshotToPostgres } from "./migrateSqliteToPostgres.js";
import { openPostgresStore, type PostgresStore } from "./postgres.js";
import { openSQLiteStore } from "./sqlite.js";

const url = process.env["AGORIX_TEST_POSTGRES_URL"];
const storedProject: StoredProject = {
  schemaVersion: "agorix/program/v1",
  program: {
    schema: "agorix/program/v1",
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
  },
  metadata: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    missionProgress: 0,
    hintLevel: 0,
  },
};

describe.runIf(url)("PostgreSQL project service store", () => {
  let store: PostgresStore;
  beforeAll(async () => {
    if (!url || !/^\/agorix_test(?:_[0-9a-f]{12})?$/.test(new URL(url).pathname)) {
      throw new Error("Integration tests require a dedicated disposable agorix_test database");
    }
    store = await openPostgresStore(url);
  });
  afterAll(async () => {
    await store?.close();
  });

  it("runs durable migrations and reopens without changing their digests", async () => {
    const migrations = await store.execute<{ id: string }>(
      "select id from agorix_schema_migrations order by id",
    );
    expect(migrations.rows.map((row) => row.id)).toEqual([
      "001_create_agorix_projects",
      "001_create_auth_accounts_and_sessions",
      "001_create_group_service",
      "001_create_link_service",
      "002_persist_link_redeem_failures",
      "003_create_ori_rollout_policy",
      "004_create_sqlite_import_marker",
      "005_create_ori_commit_audit",
    ]);
    const policies = await store.execute("select deployment_id from agorix_ori_rollout_policy");
    expect(policies.rowCount).toBe(0);
    const reopened = await openPostgresStore(url!);
    await reopened.close();
  });

  it("persists accounts, sessions and project CAS through the same store", async () => {
    const auth = new AuthService({
      accounts: new SqlAccountRepository({ executor: store, dialect: "postgresql" }),
      sessions: new SqlSessionRepository({ executor: store, dialect: "postgresql" }),
    });
    const projects = new SqlProjectRepository({ executor: store, dialect: "postgresql" });
    const username = `ori-${randomUUID().slice(0, 12)}`;
    const { account } = await auth.register({ username, password: "fake-pass-1234" });
    const signed = await auth.signIn({ username, password: "fake-pass-1234" });
    expect((await auth.resolveSession(signed.sessionToken)).account.accountId).toBe(
      account.accountId,
    );
    const created = await projects.create(account.accountId, "Pilot", storedProject);
    const changed = await projects.update(account.accountId, created.projectId, 1, {
      title: "Pilot updated",
    });
    expect(changed.revision).toBe(2);
    await expect(
      projects.update(account.accountId, created.projectId, 1, { title: "Stale" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(projects.get("other-owner", created.projectId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const groupId = `group-${randomUUID()}`;
    await store.execute(
      "insert into agorix_group_organizers (account_id, granted_at) values ($1, $2)",
      [account.accountId, "2026-01-01"],
    );
    await store.execute(
      "insert into agorix_groups (group_id, organizer_id, authority_kind, authorization_ref, created_at, expires_at, locked) values ($1, $2, $3, $4, $5, $6, $7)",
      [groupId, account.accountId, "household", null, "2026-01-01", "2026-12-31", 0],
    );
    await deletePostgresAccount(store, auth, account.accountId, "fake-pass-1234");
    expect(
      (await store.execute("select group_id from agorix_groups where group_id = $1", [groupId]))
        .rowCount,
    ).toBe(0);
    await expect(projects.get(account.accountId, created.projectId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(auth.resolveSession(signed.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
  });

  it("rolls back all changes when a transaction fails", async () => {
    const marker = `rollback-${randomUUID()}`;
    await expect(
      store.transaction(async (tx) => {
        await tx.execute(
          "insert into agorix_accounts (account_id, normalized_username, alias_original, alias_normalized, status, account_created_at, password_hash, password_salt, password_kdf_json, credential_created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          [
            marker,
            marker,
            marker,
            marker,
            "active",
            "2026-01-01",
            "fake",
            "fake",
            "{}",
            "2026-01-01",
          ],
        );
        throw new Error("abort test transaction");
      }),
    ).rejects.toThrow("abort test transaction");
    const result = await store.execute(
      "select account_id from agorix_accounts where account_id = $1",
      [marker],
    );
    expect(result.rowCount).toBe(0);
  });

  it("copies a closed SQLite snapshot with row parity and refuses a second import", async () => {
    const schema = `mig_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const directory = mkdtempSync(join(tmpdir(), "agorix-pg-migration-"));
    const admin = new Pool({ connectionString: url });
    let destination: PostgresStore | undefined;
    try {
      await admin.query(`create schema ${schema}`);
      const scopedUrl = new URL(url!);
      scopedUrl.searchParams.set("options", `-c search_path=${schema}`);
      destination = await openPostgresStore(scopedUrl.toString());
      const source = openSQLiteStore(join(directory, "source.sqlite"));
      let accountId = "";
      let projectId = "";
      let token = "";
      try {
        const auth = new AuthService({
          accounts: new SqlAccountRepository({ executor: source, dialect: "sqlite" }),
          sessions: new SqlSessionRepository({ executor: source, dialect: "sqlite" }),
        });
        const projects = new SqlProjectRepository({ executor: source, dialect: "sqlite" });
        const username = `mig-${randomUUID().slice(0, 12)}`;
        accountId = (await auth.register({ username, password: "fake-pass-1234" })).account
          .accountId;
        await source.execute(
          "insert into agorix_group_organizers (account_id, granted_at) values (?, ?)",
          [accountId, "2026-01-01"],
        );
        await source.execute(
          "insert into agorix_groups (group_id, organizer_id, authority_kind, authorization_ref, created_at, expires_at, locked) values (?, ?, ?, ?, ?, ?, ?)",
          ["group-one", accountId, "household", null, "2026-01-01", "2026-12-31", 0],
        );
        await source.execute(
          "insert into agorix_group_slots (slot_id, group_id, alias, status, team, consent_attested_at, reconnects, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
          ["slot-one", "group-one", "Learner", "active", null, null, 0, "2026-01-01"],
        );
        await source.execute(
          "insert into agorix_group_codes (code_hash, group_id, slot_id, created_at, expires_at, used_at) values (?, ?, ?, ?, ?, ?)",
          ["code-one", "group-one", "slot-one", "2026-01-01", "2026-01-02", null],
        );
        await source.execute(
          "insert into agorix_group_devices (token_hash, group_id, slot_id) values (?, ?, ?)",
          ["device-one", "group-one", "slot-one"],
        );
        await source.execute(
          "insert into agorix_group_redeem_failures (scope_key, failure_count, window_start, reset_at) values (?, ?, ?, ?)",
          ["scope-one", 1, 1, 2],
        );
        token = (await auth.signIn({ username, password: "fake-pass-1234" })).sessionToken;
        projectId = (await projects.create(accountId, "Saved", storedProject)).projectId;
        await source.backup(join(directory, "snapshot.sqlite"));
      } finally {
        await source.close();
      }
      const counts = await importSQLiteSnapshotToPostgres(
        join(directory, "snapshot.sqlite"),
        destination,
      );
      expect(counts.agorix_accounts).toBe(1);
      expect(counts.agorix_projects).toBe(1);
      expect(counts.agorix_group_devices).toBe(1);
      expect(counts.agorix_group_redeem_failures).toBe(1);
      const migratedAuth = new AuthService({
        accounts: new SqlAccountRepository({ executor: destination, dialect: "postgresql" }),
        sessions: new SqlSessionRepository({ executor: destination, dialect: "postgresql" }),
      });
      expect((await migratedAuth.resolveSession(token)).account.accountId).toBe(accountId);
      const migratedProjects = new SqlProjectRepository({
        executor: destination,
        dialect: "postgresql",
      });
      expect((await migratedProjects.get(accountId, projectId)).revision).toBe(1);
      await expect(
        importSQLiteSnapshotToPostgres(join(directory, "snapshot.sqlite"), destination),
      ).rejects.toThrow("already imported");
    } finally {
      await destination?.close();
      await admin.query(`drop schema if exists ${schema} cascade`);
      await admin.end();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("records an empty snapshot and rejects a repeated cutover", async () => {
    const schema = `empty_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const directory = mkdtempSync(join(tmpdir(), "agorix-empty-migration-"));
    const admin = new Pool({ connectionString: url });
    let destination: PostgresStore | undefined;
    try {
      await admin.query(`create schema ${schema}`);
      const scopedUrl = new URL(url!);
      scopedUrl.searchParams.set("options", `-c search_path=${schema}`);
      destination = await openPostgresStore(scopedUrl.toString());
      const source = openSQLiteStore(join(directory, "source.sqlite"));
      try {
        await source.backup(join(directory, "snapshot.sqlite"));
      } finally {
        await source.close();
      }
      const counts = await importSQLiteSnapshotToPostgres(
        join(directory, "snapshot.sqlite"),
        destination,
      );
      expect(Object.values(counts).every((count) => count === 0)).toBe(true);
      const marker = await destination.execute("select import_id from agorix_sqlite_imports");
      expect(marker.rowCount).toBe(1);
      await expect(
        importSQLiteSnapshotToPostgres(join(directory, "snapshot.sqlite"), destination),
      ).rejects.toThrow("already imported");
    } finally {
      await destination?.close();
      await admin.query(`drop schema if exists ${schema} cascade`);
      await admin.end();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects partial group schemas and imports a legacy snapshot without groups", async () => {
    const schema = `legacy_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const directory = mkdtempSync(join(tmpdir(), "agorix-legacy-migration-"));
    const admin = new Pool({ connectionString: url });
    let destination: PostgresStore | undefined;
    try {
      await admin.query(`create schema ${schema}`);
      const scopedUrl = new URL(url!);
      scopedUrl.searchParams.set("options", `-c search_path=${schema}`);
      destination = await openPostgresStore(scopedUrl.toString());
      const sourcePath = join(directory, "source.sqlite");
      const source = openSQLiteStore(sourcePath);
      await source.close();
      const db = new DatabaseSync(sourcePath);
      db.exec("PRAGMA foreign_keys = OFF; DROP TABLE agorix_group_devices");
      db.close();
      const partialPath = join(directory, "partial.sqlite");
      copyFileSync(sourcePath, partialPath);
      await expect(importSQLiteSnapshotToPostgres(partialPath, destination)).rejects.toThrow(
        "partial closed-group schema",
      );
      expect(
        (await destination.execute("select import_id from agorix_sqlite_imports")).rowCount,
      ).toBe(0);
      const legacy = new DatabaseSync(sourcePath);
      legacy.exec(`PRAGMA foreign_keys = OFF;
        DROP TABLE agorix_group_codes;
        DROP TABLE agorix_group_slots;
        DROP TABLE agorix_groups;
        DROP TABLE agorix_group_organizers;
        DROP TABLE agorix_group_redeem_failures;`);
      legacy.close();
      const snapshotPath = join(directory, "snapshot.sqlite");
      copyFileSync(sourcePath, snapshotPath);
      const counts = await importSQLiteSnapshotToPostgres(snapshotPath, destination);
      expect(counts.agorix_group_organizers).toBe(0);
      expect(counts.agorix_group_devices).toBe(0);
      expect(
        (await destination.execute("select import_id from agorix_sqlite_imports")).rowCount,
      ).toBe(1);
    } finally {
      await destination?.close();
      await admin.query(`drop schema if exists ${schema} cascade`);
      await admin.end();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
