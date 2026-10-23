import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { AuthService, SqlAccountRepository, SqlSessionRepository } from "@agorix/auth-service";
import type { StoredProject } from "@agorix/persistence";
import {
  LinkService,
  SqlLinkRepository,
  type Mailer,
  type MailMessage,
} from "@agorix/link-service";
import { SqlProjectRepository } from "@agorix/project-repository";
import { deleteSQLiteAccount } from "./deleteAccount.js";
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
      "001_create_link_service",
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

  it("runs the adult link flow on SQLite and stores only hashes (issues #505 to #508)", async () => {
    const { db } = paths();
    const store = openSQLiteStore(db);
    const auth = new AuthService({
      accounts: new SqlAccountRepository({ executor: store, dialect: "sqlite" }),
      sessions: new SqlSessionRepository({ executor: store, dialect: "sqlite" }),
    });
    const { account } = await auth.register({ username: "Ada", password: PASSWORD });
    const other = await auth.register({ username: "Bob", password: PASSWORD });
    let now = Date.parse("2026-10-23T12:00:00.000Z");
    const sent: MailMessage[] = [];
    const mailer: Mailer = { send: async (message) => void sent.push(message) };
    const link = new LinkService({
      repository: new SqlLinkRepository({ executor: store, dialect: "sqlite" }),
      secret: "k".repeat(40),
      mailer,
      clock: { now: () => new Date(now) },
    });
    const verifyToken = () => {
      const last = [...sent].reverse().find((m) => m.kind === "verify-email");
      if (last?.kind !== "verify-email") throw new Error("no mail");
      return last.token;
    };

    await link.addEmail(account.accountId, "Ada@Example.com");
    await expect(link.createLinkCode(account.accountId)).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    const mailToken = verifyToken();
    await link.verifyEmail(mailToken);
    await expect(link.verifyEmail(mailToken)).rejects.toMatchObject({ code: "INVALID_OR_EXPIRED" });
    // A second adult cannot take the address; the answer looks the same.
    await link.addEmail(other.account.accountId, "ada@example.com");
    expect(await link.emailStatus(other.account.accountId)).toEqual({
      present: false,
      verified: false,
    });

    const { code } = await link.createLinkCode(account.accountId);
    const linked = await link.redeemLinkCode(code, "src");
    await expect(link.redeemLinkCode(code, "src")).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
    const resolved = await link.resolveDevice(linked.deviceToken);
    now += 61_000;
    await link.resolveDevice(resolved.deviceToken);
    await link.putSummary(linked.linkId, {
      version: 1,
      completedMissions: 1,
      practicedConcepts: [1, 0, 0],
      decisions: { used: 0, changed: 0, rejected: 0 },
      minutesByDay: [{ day: "2026-10-23", minutes: 5 }],
      ageBand: "6-8",
      dailyLimitMinutes: 30,
    });
    expect(await link.getSummaries(account.accountId)).toHaveLength(1);

    // Only hashes reach the disk: no raw code, device token or mail token appears in any table.
    const raw = new DatabaseSync(db, { readOnly: true });
    const dump = JSON.stringify(
      [
        "agorix_adult_emails",
        "agorix_email_verifications",
        "agorix_link_codes",
        "agorix_device_links",
        "agorix_device_tokens",
        "agorix_link_summaries",
      ].map((table) => raw.prepare(`select * from ${table}`).all()),
    );
    raw.close();
    for (const secret of [code, linked.deviceToken, resolved.deviceToken, mailToken]) {
      expect(dump).not.toContain(secret);
    }

    // Unlink, then retention: day 29 readable, day 31 gone, rerun is a no-op.
    await link.unlinkLink(account.accountId, linked.linkId);
    now += 29 * 24 * 60 * 60 * 1000;
    expect(await link.purgeExpired()).toEqual({ purgedLinks: 0 });
    expect(await link.getSummaries(account.accountId)).toHaveLength(1);
    now += 2 * 24 * 60 * 60 * 1000;
    expect(await link.purgeExpired()).toEqual({ purgedLinks: 1 });
    expect(await link.purgeExpired()).toEqual({ purgedLinks: 0 });
    expect(await link.getSummaries(account.accountId)).toEqual([]);

    // Account deletion removes every row this service holds, at once.
    const again = await link.createLinkCode(account.accountId);
    const second = await link.redeemLinkCode(again.code, "src");
    await link.putSummary(second.linkId, {
      version: 1,
      completedMissions: 0,
      practicedConcepts: [0, 0, 0],
      decisions: { used: 0, changed: 0, rejected: 0 },
      minutesByDay: [],
      ageBand: "9-12",
      dailyLimitMinutes: 45,
    });
    await link.deleteAccountData(account.accountId);
    const check = new DatabaseSync(db, { readOnly: true });
    for (const table of [
      "agorix_adult_emails",
      "agorix_email_verifications",
      "agorix_link_codes",
      "agorix_device_links",
      "agorix_device_tokens",
      "agorix_link_summaries",
    ]) {
      expect(check.prepare(`select count(*) as n from ${table}`).get()?.["n"], table).toBe(0);
    }
    check.close();
    await store.close();
  });

  it("deletes an account and leaves no row anywhere on SQLite (issue #517)", async () => {
    const { db } = paths();
    const store = openSQLiteStore(db);
    const auth = new AuthService({
      accounts: new SqlAccountRepository({ executor: store, dialect: "sqlite" }),
      sessions: new SqlSessionRepository({ executor: store, dialect: "sqlite" }),
    });
    const projects = new SqlProjectRepository({ executor: store, dialect: "sqlite" });
    const link = new LinkService({
      repository: new SqlLinkRepository({ executor: store, dialect: "sqlite" }),
      secret: "k".repeat(40),
      mailer: { send: async () => undefined },
    });
    const { account } = await auth.register({ username: "Ada", password: PASSWORD });
    const keep = await auth.register({ username: "Bob", password: PASSWORD });
    await auth.signIn({ username: "Ada", password: PASSWORD });
    await auth.signIn({ username: "Bob", password: PASSWORD });
    await projects.create(account.accountId, "A1", storedProject);
    await projects.create(account.accountId, "A2", storedProject);
    await projects.create(keep.account.accountId, "B1", storedProject);
    await link.addEmail(account.accountId, "ada@example.com");

    await expect(
      deleteSQLiteAccount(store, auth, account.accountId, "wrong password here"),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await store.execute(
      "create trigger abort_account_delete before delete on agorix_accounts begin select raise(abort, 'forced delete failure'); end",
    );
    await expect(deleteSQLiteAccount(store, auth, account.accountId, PASSWORD)).rejects.toThrow(
      "forced delete failure",
    );
    expect((await projects.list(account.accountId)).items).toHaveLength(2);
    expect(await link.emailStatus(account.accountId)).toEqual({ present: true, verified: false });
    expect(await auth.signIn({ username: "Ada", password: PASSWORD })).toBeDefined();
    await store.execute("drop trigger abort_account_delete");
    await deleteSQLiteAccount(store, auth, account.accountId, PASSWORD);

    const raw = new DatabaseSync(db, { readOnly: true });
    const count = (table: string, column: string, id: string) =>
      Number(raw.prepare(`select count(*) as n from ${table} where ${column} = ?`).get(id)?.["n"]);
    for (const [table, column] of [
      ["agorix_accounts", "account_id"],
      ["agorix_sessions", "account_id"],
      ["agorix_projects", "owner_id"],
      ["agorix_adult_emails", "account_id"],
      ["agorix_email_verifications", "account_id"],
      ["agorix_link_codes", "account_id"],
      ["agorix_device_links", "account_id"],
    ] as const) {
      expect(count(table, column, account.accountId), table).toBe(0);
      expect(count(table, column, keep.account.accountId) >= 0).toBe(true);
    }
    expect(count("agorix_accounts", "account_id", keep.account.accountId)).toBe(1);
    expect(count("agorix_projects", "owner_id", keep.account.accountId)).toBe(1);
    raw.close();
    await store.close();
  });
});
