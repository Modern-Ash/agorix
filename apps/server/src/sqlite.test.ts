import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { AuthService, SqlAccountRepository, SqlSessionRepository } from "@agorix/auth-service";
import type { StoredProject } from "@agorix/persistence";
import { SqlProjectRepository } from "@agorix/project-repository";
import { openSQLiteStore } from "./sqlite.js";

const directories: string[] = [];
const PASSWORD = "correct horse battery";
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

function paths() {
  const dir = mkdtempSync(join(tmpdir(), "agorix-sqlite-test-"));
  directories.push(dir);
  return {
    db: join(dir, "data", "agorix.sqlite"),
    backup: join(dir, "backups", "snapshot.sqlite"),
  };
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("SQLite production store", () => {
  it("migrates, persists account sessions and projects, and preserves optimistic revisions", async () => {
    const { db } = paths();
    const store = openSQLiteStore(db);
    const auth = new AuthService({
      accounts: new SqlAccountRepository({ executor: store, dialect: "sqlite" }),
      sessions: new SqlSessionRepository({ executor: store, dialect: "sqlite" }),
    });
    const projects = new SqlProjectRepository({ executor: store, dialect: "sqlite" });
    const { account } = await auth.register({ username: "Ada", password: PASSWORD });
    const signed = await auth.signIn({ username: "Ada", password: PASSWORD });
    const created = await projects.create(account.accountId, "World", storedProject);
    const updated = await projects.update(account.accountId, created.projectId, 1, {
      title: "World 2",
    });
    expect(updated.revision).toBe(2);
    await expect(
      projects.update(account.accountId, created.projectId, 1, { title: "Stale" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.appliedMigrations()).toEqual([
      "001_create_agorix_projects",
      "001_create_auth_accounts_and_sessions",
    ]);
    await store.close();

    const reopened = openSQLiteStore(db);
    const reopenedAuth = new AuthService({
      accounts: new SqlAccountRepository({ executor: reopened, dialect: "sqlite" }),
      sessions: new SqlSessionRepository({ executor: reopened, dialect: "sqlite" }),
    });
    expect((await reopenedAuth.resolveSession(signed.sessionToken)).account.alias.original).toBe(
      "Ada",
    );
    const reopenedProjects = new SqlProjectRepository({ executor: reopened, dialect: "sqlite" });
    expect((await reopenedProjects.get(account.accountId, created.projectId)).title).toBe(
      "World 2",
    );
    await expect(reopenedProjects.get("other-owner", created.projectId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await reopened.close();
  });

  it("backs up a live WAL database and restores the saved snapshot", async () => {
    const { db, backup } = paths();
    const store = openSQLiteStore(db);
    const projects = new SqlProjectRepository({ executor: store, dialect: "sqlite" });
    const first = await projects.create("owner:one", "Saved", storedProject);
    await store.backup(backup);
    await projects.create("owner:one", "Later", storedProject);
    await store.close();

    const restored = openSQLiteStore(backup);
    const restoredProjects = new SqlProjectRepository({ executor: restored, dialect: "sqlite" });
    expect((await restoredProjects.list("owner:one")).items.map((item) => item.title)).toEqual([
      "Saved",
    ]);
    expect((await restoredProjects.get("owner:one", first.projectId)).revision).toBe(1);
    await restored.close();
  });

  it("allows one optimistic update and rejects a concurrent stale update", async () => {
    const { db } = paths();
    const store = openSQLiteStore(db);
    const projects = new SqlProjectRepository({ executor: store, dialect: "sqlite" });
    const created = await projects.create("owner:one", "Original", storedProject);
    const results = await Promise.allSettled([
      projects.update("owner:one", created.projectId, 1, { title: "A" }),
      projects.update("owner:one", created.projectId, 1, { title: "B" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await projects.get("owner:one", created.projectId)).revision).toBe(2);
    await store.close();
  });

  it("rolls back an interrupted transaction and rejects edited migration history", async () => {
    const { db } = paths();
    const store = openSQLiteStore(db);
    await expect(
      store.transaction(async (transaction) => {
        await transaction.execute(
          `insert into agorix_accounts
           (account_id, normalized_username, alias_original, alias_normalized, status,
            account_created_at, password_hash, password_salt, password_kdf_json, credential_created_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ["account", "temp", "Temp", "temp", "active", "now", "hash", "salt", "{}", "now"],
        );
        throw new Error("interrupted");
      }),
    ).rejects.toThrow("interrupted");
    expect((await store.execute("select account_id from agorix_accounts")).rows).toEqual([]);
    await store.close();

    const tamper = new DatabaseSync(db);
    tamper
      .prepare("update agorix_schema_migrations set sha256 = 'edited' where id = ?")
      .run("001_create_agorix_projects");
    tamper.close();
    expect(() => openSQLiteStore(db)).toThrow("SQLite migration changed");
  });

  it("reports a typed username conflict when registrations race", async () => {
    const { db } = paths();
    const store = openSQLiteStore(db);
    const accounts = new SqlAccountRepository({ executor: store, dialect: "sqlite" });
    const sessions = new SqlSessionRepository({ executor: store, dialect: "sqlite" });
    const first = new AuthService({ accounts, sessions });
    const second = new AuthService({ accounts, sessions });
    const results = await Promise.allSettled([
      first.register({ username: "same-name", password: PASSWORD }),
      second.register({ username: "same-name", password: PASSWORD }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: { code: "USERNAME_TAKEN" } });
    await store.close();
  });
});
