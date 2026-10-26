import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";
import { createOriApplyPipeline } from "./oriApplyPipeline.js";

const auth = {
  read: () => ({ author: "operator", csrf: "synthetic" }),
} as unknown as AdminAuth;

function streamRequest(): IncomingMessage & PassThrough {
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
  return stream;
}
function handler(deadline: number, apply: () => Promise<"applied">) {
  return createOriApplyPipeline({
    auth,
    trustedHosts: ["agorix.example"],
    limiter: createOriReviewRateLimiter(),
    resolvePrincipal: async () => ({ owner: "student", projectId: "project-a" }),
    apply,
    enabled: true,
    bodyDeadlineMs: deadline,
  });
}
describe("Ori apply request stream safety", () => {
  it("rejects a stalled body without calling apply", async () => {
    let calls = 0;
    const request = streamRequest();
    request.write('{"ticketId":');
    const result = await handler(20, async () => {
      calls++;
      return "applied";
    })(request);
    expect(result.status).toBe(400);
    expect(request.destroyed).toBe(true);
    expect(calls).toBe(0);
  });
  it("rejects an aborted body without calling apply", async () => {
    let calls = 0;
    const request = streamRequest();
    const pending = handler(1000, async () => {
      calls++;
      return "applied";
    })(request);
    request.write('{"ticketId":');
    request.destroy();
    expect((await pending).status).not.toBe(200);
    expect(calls).toBe(0);
  });
  it("rejects malformed JSON on a completed stream", async () => {
    let calls = 0;
    const request = streamRequest();
    request.end("{bad-json}");
    expect((await handler(1000, async () => {
      calls++;
      return "applied";
    })(request)).status).not.toBe(200);
    expect(calls).toBe(0);
  });
});
