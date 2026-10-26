import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { createOriApplyPipeline } from "./oriApplyPipeline.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";

describe("Ori apply authentication failure boundary", () => {
  it("returns unauthorized and never applies when session lookup throws", async () => {
    let reads = 0;
    let applies = 0;
    const auth = {
      read: () => {
        reads++;
        if (reads > 1) throw new Error("session expired");
        return { author: "operator", csrf: "synthetic" };
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
    const request = {
      method: "POST",
      headers: {
        host: "agorix.example",
        origin: "https://agorix.example",
        "content-type": "application/json",
        "x-agorix-admin-csrf": "synthetic",
      },
    } as unknown as IncomingMessage;
    expect((await pipeline(request)).status).toBe(401);
    expect(applies).toBe(0);
  });
});
