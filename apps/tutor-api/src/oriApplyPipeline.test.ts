import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";
import { createOriApplyPipeline } from "./oriApplyPipeline.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
const auth = {
  read: () => ({ author: "operator", csrf: "synthetic" }),
} as unknown as AdminAuth;

function request(payload: string, origin = "https://agorix.example"): IncomingMessage {
  return {
    method: "POST",
    headers: {
      host: "agorix.example",
      origin,
      "content-type": "application/json",
      "x-agorix-admin-csrf": "synthetic",
    },
    destroyed: false,
    aborted: false,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(payload);
    },
  } as unknown as IncomingMessage;
}
function pipeline(apply: () => Promise<"applied" | "rejected" | "conflict">, enabled = true) {
  return createOriApplyPipeline({
    auth,
    trustedHosts: ["agorix.example"],
    limiter: createOriReviewRateLimiter(),
    resolvePrincipal: async () => ({ owner: "student", projectId: "project-a" }),
    apply,
    enabled,
  });
}
describe("Ori apply pipeline adversarial request boundary", () => {
  it("is disabled by default", async () => {
    let calls = 0;
    const handler = pipeline(async () => {
      calls++;
      return "applied";
    }, false);
    expect((await handler(request(JSON.stringify({ ticketId, scriptId: "main" })))).status).toBe(503);
    expect(calls).toBe(0);
  });
  it("delegates a valid request to the server-owned operation", async () => {
    let calls = 0;
    const handler = pipeline(async () => {
      calls++;
      return "applied";
    });
    expect((await handler(request(JSON.stringify({ ticketId, scriptId: "main" })))).status).toBe(200);
    expect(calls).toBe(1);
  });
  it("rejects browser authority and oversized bodies before applying", async () => {
    let calls = 0;
    const handler = pipeline(async () => {
      calls++;
      return "applied";
    });
    expect((await handler(request(JSON.stringify({ ticketId, scriptId: "main", owner: "other" })))).status).toBe(400);
    expect((await handler(request("x".repeat(513)))).status).toBe(400);
    expect(calls).toBe(0);
  });
  it("rejects cross-origin requests", async () => {
    let calls = 0;
    const handler = pipeline(async () => {
      calls++;
      return "applied";
    });
    expect((await handler(request(JSON.stringify({ ticketId, scriptId: "main" }), "https://attacker.example"))).status).toBe(403);
    expect(calls).toBe(0);
  });
  it("reports revision conflicts without applying changes", async () => {
    const handler = pipeline(async () => "conflict");
    expect((await handler(request(JSON.stringify({ ticketId, scriptId: "main" })))).status).toBe(409);
  });
});
