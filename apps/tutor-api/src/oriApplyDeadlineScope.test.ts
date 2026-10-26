import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";
import { createOriApplyPipeline } from "./oriApplyPipeline.js";

const auth = {
  read: () => ({ author: "operator", csrf: "synthetic" }),
} as unknown as AdminAuth;

describe("Ori apply deadline only covers request reception", () => {
  it("does not destroy the request while an authorized slow apply is pending", async () => {
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
    let started!: () => void;
    const enteredApply = new Promise<void>((resolve) => { started = resolve; });
    let finish!: () => void;
    const releaseApply = new Promise<void>((resolve) => { finish = resolve; });
    const pipeline = createOriApplyPipeline({
      auth,
      trustedHosts: ["agorix.example"],
      limiter: createOriReviewRateLimiter(),
      resolvePrincipal: async () => ({ owner: "student", projectId: "project-a" }),
      apply: async () => {
        started();
        await releaseApply;
        return "applied";
      },
      enabled: true,
      bodyDeadlineMs: 20,
    });
    request.end(JSON.stringify({
      ticketId: "123e4567-e89b-42d3-a456-426614174000",
      scriptId: "main",
    }));
    const result = pipeline(request);
    await enteredApply;
    // Wait past the body-only deadline while the trusted write remains pending.
    await new Promise<void>((resolve) => setTimeout(resolve, 60));
    // PassThrough may mark itself destroyed after normal end-of-stream;
    // successful completion is the authoritative check that the body timer
    // did not abort the pending apply callback.
    finish();
    expect((await result).status).toBe(200);
  });
});
