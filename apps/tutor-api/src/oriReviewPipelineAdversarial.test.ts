import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { createOriReviewPipeline } from "./oriReviewPipeline.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";

const input = JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 });
const valid: OriPlanReviewResult = {
  status: "ready",
  appliedChanges: false,
  plan: {
    schema: "ori/shadow-plan/v1",
    kind: "pedagogical-plan",
    stage: 2,
    steps: ["Predecir", "Probar", "Comparar"],
    hint: "¿Qué pasará?",
    requiresLearnerApproval: false,
    appliedChanges: false,
    context: { missionStage: 1 },
  },
};
const auth = {
  read: () => ({ author: "operator", csrf: "synthetic" }),
} as unknown as AdminAuth;

function request(payload = input, overrides: Record<string, unknown> = {}): IncomingMessage {
  return {
    method: "POST",
    headers: {
      host: "agorix.example",
      origin: "https://agorix.example",
      "content-type": "application/json",
      "x-agorix-admin-csrf": "synthetic",
    },
    async *[Symbol.asyncIterator]() {
      yield new TextEncoder().encode(payload);
    },
    ...overrides,
  } as unknown as IncomingMessage;
}
describe("Ori review pipeline adversarial isolation", () => {
  it.each([
    ["extra proposal", { ...valid, plan: { ...valid.plan, proposal: { apply: true } } }],
    ["claimed mutation", { ...valid, appliedChanges: true }],
    ["stage mismatch", { ...valid, plan: { ...valid.plan, stage: 3 } }],
    ["mission mismatch", { ...valid, plan: { ...valid.plan, context: { missionStage: 2 } } }],
    ["no plan", { ...valid, plan: null }],
    ["wrong status", { ...valid, status: "ready-to-apply" }],
  ])("rejects %s without returning provider output", async (_label, response) => {
    const pipeline = createOriReviewPipeline(
      auth,
      ["agorix.example"],
      createOriReviewRateLimiter(),
      async () => response as unknown as OriPlanReviewResult,
      true,
    );
    expect(await pipeline(request())).toEqual({ status: 503, body: { error: "unavailable" } });
  });
  it("does not consume request body when disabled", async () => {
    let reads = 0;
    const req = request(input, {
      async *[Symbol.asyncIterator]() {
        reads++;
        yield new TextEncoder().encode(input);
      },
    });
    const pipeline = createOriReviewPipeline(
      auth,
      ["agorix.example"],
      createOriReviewRateLimiter(),
      async () => valid,
    );
    expect((await pipeline(req)).status).toBe(503);
    expect(reads).toBe(0);
  });
  it("does not consume body or call Ori when host is untrusted", async () => {
    let reads = 0;
    let calls = 0;
    const req = request(input, {
      async *[Symbol.asyncIterator]() {
        reads++;
        yield new TextEncoder().encode(input);
      },
    });
    const pipeline = createOriReviewPipeline(
      auth,
      [],
      createOriReviewRateLimiter(),
      async () => {
        calls++;
        return valid;
      },
      true,
    );
    expect((await pipeline(req)).status).toBe(403);
    expect(reads).toBe(0);
    expect(calls).toBe(0);
  });
  it("returns unavailable when Ori throws", async () => {
    const pipeline = createOriReviewPipeline(
      auth,
      ["agorix.example"],
      createOriReviewRateLimiter(),
      async () => {
        throw new Error("synthetic private provider output");
      },
      true,
    );
    expect(await pipeline(request())).toEqual({ status: 503, body: { error: "unavailable" } });
  });
});
