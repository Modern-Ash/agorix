import { describe, expect, it } from "vitest";
import { createOriMig04AuthenticatedSessionActions } from "./oriMig04AuthenticatedSessionActions.js";

const identity = {
  account: { accountId: "owner" },
  session: { accountId: "owner", sessionId: "session" },
  rotated: false,
};

describe("MIG-04 trusted AuthService session actions", () => {
  it("selects a project only for verified account and session", async () => {
    const calls: string[][] = [];
    const actions = createOriMig04AuthenticatedSessionActions({
      auth: {
        resolveSession: async () => identity as never,
        signOut: async () => undefined,
        deleteAccount: async () => undefined,
      },
      projects: {
        selectProject: async (session, projectId) => {
          calls.push([session.accountId, session.sessionId, projectId]);
        },
        logout: async () => undefined,
        revokeAccountSessions: async () => undefined,
      },
    });
    await actions.selectProject("trusted-token", "project");
    expect(calls).toEqual([["owner", "session", "project"]]);
  });

  it("revokes the real token before clearing its project mapping", async () => {
    const calls: string[] = [];
    const actions = createOriMig04AuthenticatedSessionActions({
      auth: {
        resolveSession: async () => identity as never,
        signOut: async () => { calls.push("token"); },
        deleteAccount: async () => undefined,
      },
      projects: {
        selectProject: async () => undefined,
        logout: async () => { calls.push("mapping"); },
        revokeAccountSessions: async () => undefined,
      },
    });
    await actions.signOut("trusted-token");
    expect(calls).toEqual(["token", "mapping"]);
  });

  it("does not delete mappings when account deletion password fails", async () => {
    let revoked = false;
    const actions = createOriMig04AuthenticatedSessionActions({
      auth: {
        resolveSession: async () => identity as never,
        signOut: async () => undefined,
        deleteAccount: async () => { throw Error("INVALID_CREDENTIALS"); },
      },
      projects: {
        selectProject: async () => undefined,
        logout: async () => undefined,
        revokeAccountSessions: async () => { revoked = true; },
      },
    });
    await expect(actions.deleteAccount("token", "wrong")).rejects.toThrow();
    expect(revoked).toBe(false);
  });

  it("selects after rotation, clears old mapping and delivers new token", async () => {
    const calls: string[] = [];
    const actions = createOriMig04AuthenticatedSessionActions({
      auth: {
        resolveSession: async () => ({
          ...identity,
          rotated: true,
          previousSessionId: "old",
          sessionToken: "new-token",
        }) as never,
        signOut: async () => undefined,
        deleteAccount: async () => undefined,
      },
      projects: {
        selectProject: async () => { calls.push("select"); },
        logout: async (session) => { calls.push(session.sessionId); },
        revokeAccountSessions: async () => undefined,
      },
    });
    await actions.selectProject("old-token", "project", (token) => {
      calls.push(token);
    });
    expect(calls).toEqual(["old", "new-token", "select"]);
  });

  it("revokes the replacement credential on logout after rotation", async () => {
    const calls: string[] = [];
    const actions = createOriMig04AuthenticatedSessionActions({
      auth: {
        resolveSession: async () => ({
          ...identity,
          rotated: true,
          previousSessionId: "old",
          sessionToken: "replacement",
        }) as never,
        signOut: async (token) => { calls.push(token); },
        deleteAccount: async () => undefined,
      },
      projects: {
        selectProject: async () => undefined,
        logout: async (session) => { calls.push(session.sessionId); },
        revokeAccountSessions: async () => undefined,
      },
    });
    await actions.signOut("old-token");
    expect(calls).toEqual(["old", "replacement", "session"]);
  });

  it("rejects rotated identities without coordinated cookie delivery", async () => {
    const actions = createOriMig04AuthenticatedSessionActions({
      auth: {
        resolveSession: async () => ({ ...identity, rotated: true }) as never,
        signOut: async () => undefined,
        deleteAccount: async () => undefined,
      },
      projects: {
        selectProject: async () => undefined,
        logout: async () => undefined,
        revokeAccountSessions: async () => undefined,
      },
    });
    await expect(actions.selectProject("token", "project")).rejects.toThrow(
      "coordinated cookie delivery",
    );
  });
});
