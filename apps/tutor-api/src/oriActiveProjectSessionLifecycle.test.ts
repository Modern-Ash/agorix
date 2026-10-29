import { describe, expect, it } from "vitest";
import { openOriSqliteActiveProjectPersistence } from "./oriSqliteActiveProjectPersistence.js";
import { createOriActiveProjectSessionLifecycle } from "./oriActiveProjectSessionLifecycle.js";

const before = { accountId: "learner", sessionId: "session-old" };
const after = { accountId: "learner", sessionId: "session-new" };
describe("Ori active-project session lifecycle", () => {
  it("migrates a persisted project selection on session rotation", async () => {
    const db = openOriSqliteActiveProjectPersistence(":memory:");
    try {
      const lifecycle = createOriActiveProjectSessionLifecycle(db);
      await db.write({ ...before, projectId: "project-a", expiresAt: Date.now() + 60000 });
      expect(await lifecycle.rotated(before, after)).toBe(true);
      expect(await db.read(before.accountId, before.sessionId)).toBeNull();
      expect((await db.read(after.accountId, after.sessionId))?.projectId).toBe("project-a");
    } finally {
      db.close();
    }
  });
  it("clears the selection on sign-out", async () => {
    const db = openOriSqliteActiveProjectPersistence(":memory:");
    try {
      const lifecycle = createOriActiveProjectSessionLifecycle(db);
      await db.write({ ...before, projectId: "project-a", expiresAt: Date.now() + 60000 });
      await lifecycle.signedOut(before);
      expect(await db.read(before.accountId, before.sessionId)).toBeNull();
    } finally {
      db.close();
    }
  });
  it("rejects cross-account migration", async () => {
    const db = openOriSqliteActiveProjectPersistence(":memory:");
    try {
      const lifecycle = createOriActiveProjectSessionLifecycle(db);
      expect(await lifecycle.rotated(before, { accountId: "other", sessionId: "new" })).toBe(false);
    } finally {
      db.close();
    }
  });
  it("rejects migration collisions without overwriting the target", async () => {
    const db = openOriSqliteActiveProjectPersistence(":memory:");
    try {
      const lifecycle = createOriActiveProjectSessionLifecycle(db);
      await db.write({ ...before, projectId: "project-a", expiresAt: Date.now() + 60000 });
      await db.write({ ...after, projectId: "project-b", expiresAt: Date.now() + 60000 });
      expect(await lifecycle.rotated(before, after)).toBe(false);
      expect((await db.read(before.accountId, before.sessionId))?.projectId).toBe("project-a");
      expect((await db.read(after.accountId, after.sessionId))?.projectId).toBe("project-b");
    } finally {
      db.close();
    }
  });
  it("fails closed rather than copying selection with a nontransactional store", async () => {
    let writes = 0;
    let deletes = 0;
    const lifecycle = createOriActiveProjectSessionLifecycle({
      read: async () => ({ ...before, projectId: "project-a", expiresAt: Date.now() + 60000 }),
      write: async () => {
        writes++;
      },
      delete: async () => {
        deletes++;
      },
    });
    expect(await lifecycle.rotated(before, after)).toBe(false);
    expect(writes).toBe(0);
    expect(deletes).toBe(0);
  });
});
