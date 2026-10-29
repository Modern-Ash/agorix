import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createOriMig04PgLearningEventRoutes } from "./oriMig04PgLearningEventRoutes.js";

function request(body: unknown, cookie = "__Host-agorix-session=0123456789abcdef"): IncomingMessage {
  return Object.assign(Readable.from([JSON.stringify(body)]), {
    method: "POST",
    url: "/api/tutor/ori/learning/event",
    headers: {
      host: "agorix.example",
      origin: "https://agorix.example",
      "content-type": "application/json",
      cookie,
    },
  }) as IncomingMessage;
}
function response() {
  const state = { status: 0 };
  return {
    state,
    reply: {
      writeHead: (status: number) => { state.status = status; },
      end: () => undefined,
    } as unknown as ServerResponse,
  };
}
describe("MIG-04 trusted learning event HTTP route", () => {
  it("rejects browser-supplied learning events until trusted provenance is available", async () => {
    const writes: unknown[][] = [];
    const route = createOriMig04PgLearningEventRoutes({
      auth: { resolveSession: async () => ({
        account: { accountId: "owner" },
        session: { accountId: "owner", sessionId: "session" },
        rotated: false,
      }) as never },
      activeProject: async () => "project",
      record: async (...args) => { writes.push(args); return true; },
    });
    const { state, reply } = response();
    await route(request({ kind: "attempt" }), reply);
    expect(state.status).toBe(403);
    expect(writes).toEqual([]);
  });
  it("rejects client-supplied owner and counters", async () => {
    let writes = 0;
    const route = createOriMig04PgLearningEventRoutes({
      auth: { resolveSession: async () => { throw Error("must not resolve"); } },
      activeProject: async () => null,
      record: async () => { writes++; return true; },
    });
    const { state, reply } = response();
    await route(request({ kind: "attempt", owner: "other", attempts: 100 }), reply);
    expect(state.status).toBe(403);
    expect(writes).toBe(0);
  });
  it("denies rotated sessions until cookie and project mapping are coordinated", async () => {
    let writes = 0;
    const route = createOriMig04PgLearningEventRoutes({
      auth: { resolveSession: async () => ({
        account: { accountId: "owner" },
        session: { accountId: "owner", sessionId: "new" },
        previousSessionId: "old",
        rotated: true,
      }) as never },
      activeProject: async () => "project",
      record: async () => { writes++; return true; },
    });
    const { state, reply } = response();
    await route(request({ kind: "hint" }), reply);
    expect(state.status).toBe(403);
    expect(writes).toBe(0);
  });
});
