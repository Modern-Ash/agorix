import { describe, expect, it } from "vitest";
import { createOriMig04SessionRotationGuard } from "./oriMig04SessionRotationGuard.js";

describe("MIG-04 trusted session rotation reconciliation", () => {
  it("moves a mapping only between sessions of the same verified owner", async () => {
    const calls: string[][] = [];
    const guard = createOriMig04SessionRotationGuard({
      rotate: async (...args) => {
        calls.push(args);
      },
      revoke: async () => undefined,
    });
    expect(
      await guard.onResolved(
        { accountId: "owner", sessionId: "old" },
        { accountId: "owner", sessionId: "new" },
      ),
    ).toBe(true);
    expect(calls).toEqual([["owner", "old", "new"]]);
  });

  it("rejects cross-owner rotation without touching persistence", async () => {
    let calls = 0;
    const guard = createOriMig04SessionRotationGuard({
      rotate: async () => {
        calls++;
      },
      revoke: async () => {
        calls++;
      },
    });
    expect(
      await guard.onResolved(
        { accountId: "owner", sessionId: "old" },
        { accountId: "other", sessionId: "new" },
      ),
    ).toBe(false);
    expect(calls).toBe(0);
  });

  it("revokes old mapping and denies session on failed rotation", async () => {
    const calls: string[][] = [];
    const guard = createOriMig04SessionRotationGuard({
      rotate: async () => {
        throw Error("conflict");
      },
      revoke: async (...args) => {
        calls.push(args);
      },
    });
    expect(
      await guard.onResolved(
        { accountId: "owner", sessionId: "old" },
        { accountId: "owner", sessionId: "new" },
      ),
    ).toBe(false);
    expect(calls).toEqual([["owner", "old"]]);
  });
});
