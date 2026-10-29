import { describe, expect, it } from "vitest";
import {
  createOriExpiringActiveProjectStore,
  type OriActiveProjectPersistence,
  type OriActiveProjectRecord,
} from "./oriExpiringActiveProjectStore.js";

function fixture() {
  let now = 1000;
  const records = new Map<string, OriActiveProjectRecord>();
  const key = (account: string, session: string) => account + ":" + session;
  const persistence: OriActiveProjectPersistence = {
    read: async (account, session) => records.get(key(account, session)) ?? null,
    write: async (record) => {
      records.set(key(record.accountId, record.sessionId), record);
    },
    delete: async (account, session) => {
      records.delete(key(account, session));
    },
  };
  const store = createOriExpiringActiveProjectStore({ persistence, now: () => now, ttlMs: 2000 });
  return {
    store,
    records,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
describe("Ori expiring active project persistence", () => {
  it("restores a session-scoped project and expires it", async () => {
    const { store, advance } = fixture();
    await store.set("learner", "session-a", "project-a");
    expect(await store.get("learner", "session-a")).toBe("project-a");
    expect(await store.get("learner", "session-b")).toBeNull();
    advance(2000);
    expect(await store.get("learner", "session-a")).toBeNull();
  });
  it("clears the selection on explicit logout", async () => {
    const { store } = fixture();
    await store.set("learner", "session-a", "project-a");
    await store.clear("learner", "session-a");
    expect(await store.get("learner", "session-a")).toBeNull();
  });
  it("rejects records with mismatched account identity", async () => {
    const { store, records } = fixture();
    records.set("learner:session-a", {
      accountId: "other",
      sessionId: "session-a",
      projectId: "project-a",
      expiresAt: 3000,
    });
    expect(await store.get("learner", "session-a")).toBeNull();
  });
});
