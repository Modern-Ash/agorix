import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
} from "@agorix/auth-service";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { createOriAuthServiceSessionResolver } from "./oriAuthServiceSessionResolver.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
});
const ticketId = "123e4567-e89b-42d3-a456-426614174000";
describe("real rotating session through Ori HTTP route", () => {
  it("rotates cookie, denies old token and authorizes subsequent request", async () => {
    const auth = new AuthService({
      accounts: new InMemoryAccountRepository(),
      sessions: new InMemorySessionRepository(),
    });
    await auth.register({ username: "review-learner", password: "long-secure-passphrase-123" });
    const login = await auth.signIn({
      username: "review-learner",
      password: "long-secure-passphrase-123",
    });
    const resolve = createOriAuthServiceSessionResolver(auth);
    let decisions = 0;
    const server = createTutorServer({
      config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
      oriReviewEnabled: true,
      oriReviewIdentity: async (request, response) => {
        const identity = await resolve(request, response);
        return identity ? { ownerId: identity.accountId, projectId: "project-a" } : null;
      },
      oriReviewDecision: async (owner, project, id, decision) => {
        if (
          owner !== login.account.accountId ||
          project !== "project-a" ||
          id !== ticketId ||
          decision !== "reject"
        )
          return null;
        decisions++;
        return {
          id,
          status: "rejected",
          proposal: null,
          appliedChanges: false,
        } satisfies OriReviewTicket;
      },
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (token: string) =>
      fetch(base + "/api/tutor/ori/review/decision", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-agorix-request": "1",
          origin: base,
          cookie: "agorix_session=" + token,
        },
        body: JSON.stringify({ ticketId, decision: "reject" }),
      });
    const first = await post(login.sessionToken);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ status: "rejected", appliedChanges: false });
    const cookie = first.headers.get("set-cookie");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    const rotated = cookie!.split(";")[0]!.split("=")[1]!;
    expect(rotated).not.toBe(login.sessionToken);
    expect((await post(login.sessionToken)).status).toBe(401);
    expect((await post(rotated)).status).toBe(200);
    expect(decisions).toBe(2);
  }, 20000);
});
