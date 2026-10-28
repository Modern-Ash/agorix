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
      resolveSession: async () => ({ ...resolved, rotated: true }) as never,
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
    });
    expect(await allowed(request, {} as ServerResponse)).toEqual({
      accountId: "owner",
      sessionId: "session",
    });
    expect(rotatedToken).toBe("next-token");
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
