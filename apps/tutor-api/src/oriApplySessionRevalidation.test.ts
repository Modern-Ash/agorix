import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { createOriApplyPipeline } from "./oriApplyPipeline.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";

describe("Ori apply session revalidation", () => {
  it("rejects a session revoked during body reception without applying", async () => {
    let reads = 0;
    let applies = 0;
    const auth = {
      read: () => {
        reads++;
        return reads < 3 ? { author: "operator", csrf: "synthetic" } : null;
      },
    } as unknown as AdminAuth;
    const pipeline = createOriApplyPipeline({
      auth,
      trustedHosts: ["agorix.example"],
      limiter: createOriReviewRateLimiter(),
      resolvePrincipal: async () => ({ owner: "student", projectId: "p1" }),
      apply: async () => {
        applies++;
        return "applied";
      },
      enabled: true,
    });
    const request = new PassThrough() as IncomingMessage & PassThrough;
    Object.assign(request, {
      method: "POST",
      headers: {
        host: "agorix.example",
        origin: "https://agorix.example",
        "content-type": "application/json",
        "x-agorix-admin-csrf": "synthetic",
      },
    });
    request.end(JSON.stringify({
      ticketId: "123e4567-e89b-42d3-a456-426614174000",
      scriptId: "main",
    }));
    expect((await pipeline(request)).status).toBe(401);
    expect(applies).toBe(0);
  });
});
