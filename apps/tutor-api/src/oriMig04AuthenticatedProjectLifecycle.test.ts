import { describe, expect, it } from "vitest";
import { createOriMig04AuthenticatedProjectLifecycle } from "./oriMig04AuthenticatedProjectLifecycle.js";

describe("MIG-04 authenticated account-project lifecycle", () => {
  it("selects only for the verified account and session", async () => {
    const calls: string[][] = [];
    const lifecycle = createOriMig04AuthenticatedProjectLifecycle({
      select: async (...args: string[]) => { calls.push(args); },
      revoke: async () => undefined,
      revokeAll: async () => undefined,
    } as never);
    await lifecycle.selectProject({ accountId: "owner", sessionId: "session" }, "project");
    expect(calls).toEqual([["owner", "session", "project"]]);
  });

  it("revokes only the verified session on logout", async () => {
    const calls: string[][] = [];
    const lifecycle = createOriMig04AuthenticatedProjectLifecycle({
      select: async () => undefined,
      revoke: async (...args: string[]) => { calls.push(args); },
      revokeAll: async () => undefined,
    } as never);
    await lifecycle.logout({ accountId: "owner", sessionId: "session" });
    expect(calls).toEqual([["owner", "session"]]);
  });

  it("rejects missing identity before touching persistence", async () => {
    let calls = 0;
    const lifecycle = createOriMig04AuthenticatedProjectLifecycle({
      select: async () => { calls++; },
      revoke: async () => { calls++; },
      revokeAll: async () => { calls++; },
    } as never);
    await expect(lifecycle.selectProject({ accountId: "", sessionId: "s" }, "project")).rejects.toThrow(
      "Missing verified Ori session identity",
    );
    await expect(lifecycle.logout({ accountId: "owner", sessionId: "" })).rejects.toThrow(
      "Missing verified Ori session identity",
    );
    await expect(lifecycle.revokeAccountSessions("")).rejects.toThrow(
      "Missing verified Ori account identity",
    );
    expect(calls).toBe(0);
  });

  it("revokes all mappings after verified account deletion", async () => {
    const calls: string[] = [];
    const lifecycle = createOriMig04AuthenticatedProjectLifecycle({
      select: async () => undefined,
      revoke: async () => undefined,
      revokeAll: async (accountId: string) => { calls.push(accountId); },
    } as never);
    await lifecycle.revokeAccountSessions("owner");
    expect(calls).toEqual(["owner"]);
  });
});
