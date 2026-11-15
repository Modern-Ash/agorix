import { describe, expect, it } from "vitest";
import { createOriMig04ActiveProjectResolver } from "./oriMig04TrustedSessionProject.js";

describe("MIG-04 trusted session project selection", () => {
  it("looks up the project only by verified account and session", async () => {
    const calls: string[][] = [];
    const resolve = createOriMig04ActiveProjectResolver({
      getActiveProject: async (accountId, sessionId) => {
        calls.push([accountId, sessionId]);
        return "project_123";
      },
    });
    expect(await resolve({ accountId: "owner", sessionId: "session_1" })).toBe("project_123");
    expect(calls).toEqual([["owner", "session_1"]]);
  });

  it("denies missing, malformed and untrusted session identifiers", async () => {
    let calls = 0;
    const resolve = createOriMig04ActiveProjectResolver({
      getActiveProject: async () => {
        calls++;
        return "project_123";
      },
    });
    expect(await resolve({ accountId: "", sessionId: "session" })).toBeNull();
    expect(await resolve({ accountId: "owner", sessionId: "../other" })).toBeNull();
    expect(calls).toBe(0);
  });

  it("denies missing, malformed or failed project lookup", async () => {
    for (const value of [null, "", "../other", "project with spaces"]) {
      const resolve = createOriMig04ActiveProjectResolver({
        getActiveProject: async () => value,
      });
      expect(await resolve({ accountId: "owner", sessionId: "session" })).toBeNull();
    }
    const failed = createOriMig04ActiveProjectResolver({
      getActiveProject: async () => {
        throw Error("store unavailable");
      },
    });
    expect(await failed({ accountId: "owner", sessionId: "session" })).toBeNull();
  });

  it("requires a trusted session project store", () => {
    expect(() => createOriMig04ActiveProjectResolver({} as never)).toThrow(
      "Missing trusted Ori session-project store",
    );
  });
});
