import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";
import { createOriApplyComposition } from "./oriApplyComposition.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
const auth = {
  read: () => ({ author: "operator", csrf: "synthetic" }),
} as unknown as AdminAuth;

function request(payload: unknown): IncomingMessage {
  const stream = new PassThrough() as IncomingMessage & PassThrough;
  Object.assign(stream, {
    method: "POST",
    headers: {
      host: "agorix.example",
      origin: "https://agorix.example",
      "content-type": "application/json",
      "x-agorix-admin-csrf": "synthetic",
    },
  });
  stream.end(JSON.stringify(payload));
  return stream;
}
function response() {
  let status = 0;
  let body = "";
  const value = {
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    writeHead(code: number) { status = code; },
    end(payload: string) { body = payload; },
  } as unknown as ServerResponse;
  return { value, result: () => ({ status, body }) };
}
describe("Ori apply composition", () => {
  it("is disabled by default and never calls workflow", async () => {
    let calls = 0;
    const handler = createOriApplyComposition({
      auth,
      trustedHosts: ["agorix.example"],
      limiter: createOriReviewRateLimiter(),
      resolvePrincipal: async () => ({ owner: "student", projectId: "p1" }),
      workflow: { applyAccepted: async () => { calls++; return "applied"; } },
    });
    const output = response();
    await handler(request({ ticketId, scriptId: "main" }), output.value);
    expect(output.result().status).toBe(503);
    expect(calls).toBe(0);
  });
  it("delegates only trusted identity to the approved ticket workflow", async () => {
    const received: string[] = [];
    const handler = createOriApplyComposition({
      auth,
      trustedHosts: ["agorix.example"],
      limiter: createOriReviewRateLimiter(),
      resolvePrincipal: async () => ({ owner: "student", projectId: "p1" }),
      workflow: {
        applyAccepted: async (...args) => {
          received.push(...args);
          return "applied";
        },
      },
      enabled: true,
    });
    const output = response();
    await handler(request({ ticketId, scriptId: "main" }), output.value);
    expect(output.result()).toEqual({ status: 200, body: '{"status":"applied"}' });
    expect(received).toEqual(["student", "p1", ticketId, "main"]);
  });
  it("rejects forged owner before workflow invocation", async () => {
    let calls = 0;
    const handler = createOriApplyComposition({
      auth,
      trustedHosts: ["agorix.example"],
      limiter: createOriReviewRateLimiter(),
      resolvePrincipal: async () => ({ owner: "student", projectId: "p1" }),
      workflow: { applyAccepted: async () => { calls++; return "applied"; } },
      enabled: true,
    });
    const output = response();
    await handler(request({ ticketId, scriptId: "main", owner: "attacker" }), output.value);
    expect(output.result().status).toBe(400);
    expect(calls).toBe(0);
  });
});
