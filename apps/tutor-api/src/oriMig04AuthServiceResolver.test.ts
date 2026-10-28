import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthService } from "@agorix/auth-service";
import { createOriMig04AuthServiceResolver } from "./oriMig04AuthServiceResolver.js";

const request = {} as IncomingMessage;
const resolved = {
  account: { accountId: "owner" },
  session: { accountId: "owner", sessionId: "session" },
  sessionToken: "next-token",
  rotated: false,
};

describe("MIG-04 real AuthService session adapter", () => {
  it("rejects absent trusted token without querying authentication", async () => {
    let calls = 0;
    const resolver = createOriMig04AuthServiceResolver({
      auth: {
        resolveSession: async () => {
          calls++;
          return resolved as never;
        },
      },
      sessionToken: () => null,
    });
    expect(await resolver(request)).toBeNull();
    expect(calls).toBe(0);
  });
  it("returns verified account and session from AuthService", async () => {
    const resolver = createOriMig04AuthServiceResolver({
      auth: { resolveSession: async () => resolved as never },
      sessionToken: () => "trusted-token",
    });
    expect(await resolver(request)).toEqual({ accountId: "owner", sessionId: "session" });
  });
  it("denies mismatched owner or expired session", async () => {
    const mismatched = createOriMig04AuthServiceResolver({
      auth: {
        resolveSession: async () =>
          ({
            ...resolved,
            session: { accountId: "other", sessionId: "session" },
          }) as never,
      },
      sessionToken: () => "token",
    });
    expect(await mismatched(request)).toBeNull();
    const expired = createOriMig04AuthServiceResolver({
      auth: {
        resolveSession: async () => {
          throw Error("SESSION_EXPIRED");
        },
      },
      sessionToken: () => "token",
    });
    expect(await expired(request)).toBeNull();
  });
  it("requires delivery of a rotated session token", async () => {
    const auth = {
      resolveSession: async () =>
        ({ ...resolved, rotated: true, previousSessionId: "old" }) as never,
    };
    const denied = createOriMig04AuthServiceResolver({
      auth,
      sessionToken: () => "token",
    });
    expect(await denied(request)).toBeNull();
    let rotatedToken = "";
    const allowed = createOriMig04AuthServiceResolver({
      auth,
      sessionToken: () => "token",
      onRotatedToken: (_response, token) => {
        rotatedToken = token;
      },
      onRotatedSession: async (previous, current) =>
        previous.sessionId === "old" && current.sessionId === "session",
    });
    expect(await allowed(request, {} as ServerResponse)).toEqual({
      accountId: "owner",
      sessionId: "session",
    });
    expect(rotatedToken).toBe("next-token");
  });
  it("denies rotated session when mapping migration fails", async () => {
    let cookieWrites = 0;
    const resolver = createOriMig04AuthServiceResolver({
      auth: {
        resolveSession: async () =>
          ({ ...resolved, rotated: true, previousSessionId: "old" }) as never,
      },
      sessionToken: () => "token",
      onRotatedToken: () => {
        cookieWrites++;
      },
      onRotatedSession: async () => false,
    });
    expect(await resolver(request, {} as ServerResponse)).toBeNull();
    expect(cookieWrites).toBe(0);
  });
  it("denies identity when the rotated cookie cannot be delivered", async () => {
    let migrations = 0;
    const resolver = createOriMig04AuthServiceResolver({
      auth: {
        resolveSession: async () =>
          ({ ...resolved, rotated: true, previousSessionId: "old" }) as never,
      },
      sessionToken: () => "token",
      onRotatedSession: async () => {
        migrations++;
        return true;
      },
      onRotatedToken: () => {
        throw Error("headers already sent");
      },
    });
    expect(await resolver(request, {} as ServerResponse)).toBeNull();
    expect(migrations).toBe(1);
  });

  it("rejects missing authentication dependencies", () => {
    expect(() =>
      createOriMig04AuthServiceResolver({
        auth: undefined as unknown as Pick<AuthService, "resolveSession">,
        sessionToken: () => "token",
      }),
    ).toThrow("Missing trusted Ori authentication dependencies");
  });
});
