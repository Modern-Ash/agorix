import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";
import { createOriReviewPipeline } from "./oriReviewPipeline.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";

const valid: OriPlanReviewResult = {
  status: "ready",
  appliedChanges: false,
  plan: {
    schema: "ori/shadow-plan/v1",
    kind: "pedagogical-plan",
    stage: 2,
    steps: ["Predecir", "Probar", "Comparar"],
    hint: "¿Qué esperás que pase?",
    requiresLearnerApproval: false,
    appliedChanges: false,
    context: { missionStage: 1 },
  },
};
function request(
  options: { origin?: string; csrf?: string; payload?: string } = {},
): IncomingMessage {
  const payload =
    options.payload ?? JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 });
  const chunks = [new TextEncoder().encode(payload)];
  return {
    method: "POST",
    headers: {
      host: "agorix.example",
      origin: options.origin ?? "https://agorix.example",
      "content-type": "application/json",
      "x-agorix-admin-csrf": options.csrf ?? "synthetic",
    },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  } as unknown as IncomingMessage;
}
const auth = {
  read: () => ({ author: "operator", csrf: "synthetic" }),
} as unknown as AdminAuth;
describe("Ori internal adult review pipeline", () => {
  it("remains disabled by default without invoking Ori", async () => {
    let calls = 0;
    const pipeline = createOriReviewPipeline(
      auth,
      ["agorix.example"],
      createOriReviewRateLimiter(),
      async () => {
        calls++;
        return valid;
      },
    );
    expect((await pipeline(request())).status).toBe(503);
    expect(calls).toBe(0);
  });
  it("accepts a valid authenticated request", async () => {
    const pipeline = createOriReviewPipeline(
      auth,
      ["agorix.example"],
      createOriReviewRateLimiter(),
      async () => valid,
      true,
    );
    expect((await pipeline(request())).status).toBe(200);
  });
  it("rejects cross-origin before invoking Ori", async () => {
    let calls = 0;
    const pipeline = createOriReviewPipeline(
      auth,
      ["agorix.example"],
      createOriReviewRateLimiter(),
      async () => {
        calls++;
        return valid;
      },
      true,
    );
    expect((await pipeline(request({ origin: "https://attacker.example" }))).status).toBe(403);
    expect(calls).toBe(0);
  });
  it("rejects wrong CSRF", async () => {
    const pipeline = createOriReviewPipeline(
      auth,
      ["agorix.example"],
      createOriReviewRateLimiter(),
      async () => valid,
      true,
    );
    expect((await pipeline(request({ csrf: "wrong" }))).status).toBe(403);
  });
  it("enforces rate limit before contacting Ori", async () => {
    let calls = 0;
    const pipeline = createOriReviewPipeline(
      auth,
      ["agorix.example"],
      createOriReviewRateLimiter(1),
      async () => {
        calls++;
        return valid;
      },
      true,
    );
    expect((await pipeline(request())).status).toBe(200);
    expect((await pipeline(request())).status).toBe(429);
    expect(calls).toBe(1);
  });
  it("rejects oversized body before invoking Ori", async () => {
    let calls = 0;
    const pipeline = createOriReviewPipeline(
      auth,
      ["agorix.example"],
      createOriReviewRateLimiter(),
      async () => {
        calls++;
        return valid;
      },
      true,
    );
    expect((await pipeline(request({ payload: "x".repeat(513) }))).status).toBe(400);
    expect(calls).toBe(0);
  });
});
