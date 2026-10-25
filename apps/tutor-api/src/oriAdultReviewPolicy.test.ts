import { describe, expect, it } from "vitest";
import {
  createAuthorizedOriPlanReview,
  mayReviewOriPlan,
  type OriAdultReviewPolicy,
} from "./oriAdultReviewPolicy.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";

const input = { missionIndex: 1, hintLevel: 2 as const, scriptCount: 1 };
const allowed: OriAdultReviewPolicy = {
  enabled: true,
  role: "educator",
  authorizedMissionIndices: [1],
};
const result: OriPlanReviewResult = {
  status: "ready",
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
  appliedChanges: false,
};
describe("Ori adult review policy gate", () => {
  it.each(["learner", "anonymous"] as const)("rejects %s roles", async (role) => {
    let calls = 0;
    const review = createAuthorizedOriPlanReview(
      async () => {
        calls++;
        return result;
      },
      { ...allowed, role },
    );
    expect((await review(input)).status).toBe("unavailable");
    expect(calls).toBe(0);
  });
  it("does not call provider while disabled", async () => {
    let calls = 0;
    const review = createAuthorizedOriPlanReview(
      async () => {
        calls++;
        return result;
      },
      { ...allowed, enabled: false },
    );
    expect((await review(input)).plan).toBeNull();
    expect(calls).toBe(0);
  });
  it("restricts review to authorized missions", () => {
    expect(mayReviewOriPlan(allowed, input)).toBe(true);
    expect(mayReviewOriPlan(allowed, { ...input, missionIndex: 2 })).toBe(false);
  });
  it.each(["educator", "administrator"] as const)(
    "permits %s for an authorized mission",
    async (role) => {
      const review = createAuthorizedOriPlanReview(async () => result, { ...allowed, role });
      expect((await review(input)).status).toBe("ready");
    },
  );
  it("fails closed on unexpected review errors", async () => {
    const review = createAuthorizedOriPlanReview(async () => {
      throw new Error("synthetic failure");
    }, allowed);
    expect((await review(input)).plan).toBeNull();
  });
});

describe("Ori adult review fail-closed contract", () => {
  it.each([
    ["unexpected status", { ...result, status: "ready-to-apply" }],
    ["applied changes", { ...result, appliedChanges: true }],
    ["unexpected proposal", { ...result, plan: { ...result.plan, proposal: { apply: true } } }],
    ["mismatched stage", { ...result, plan: { ...result.plan, stage: 3 } }],
    ["mismatched mission", { ...result, plan: { ...result.plan, context: { missionStage: 2 } } }],
    ["missing plan", { ...result, plan: null }],
  ])("rejects %s", async (_case, response) => {
    const review = createAuthorizedOriPlanReview(
      async () => response as unknown as OriPlanReviewResult,
      allowed,
    );
    expect(await review(input)).toEqual({
      status: "unavailable",
      plan: null,
      appliedChanges: false,
    });
  });
  it("rejects malformed mission allowlist at runtime", () => {
    const malformed = { ...allowed, authorizedMissionIndices: null };
    expect(mayReviewOriPlan(malformed as unknown as OriAdultReviewPolicy, input)).toBe(false);
  });
});
