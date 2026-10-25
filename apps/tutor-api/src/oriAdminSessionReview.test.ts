import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import { createAdminSessionOriReview } from "./oriAdminSessionReview.js";
import type { AdminAuth } from "./adminAuth.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";

const input = { missionIndex: 1, hintLevel: 2 as const, scriptCount: 1 };
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
const request = {} as IncomingMessage;
describe("Ori authenticated admin session gate", () => {
  it("rejects absent session without invoking Ori", async () => {
    let calls = 0;
    const auth = { read: () => null } as unknown as AdminAuth;
    const guarded = createAdminSessionOriReview(auth, async () => {
      calls++;
      return valid;
    }, true, [1]);
    expect((await guarded(request, input)).status).toBe("unavailable");
    expect(calls).toBe(0);
  });
  it("accepts existing server-validated admin session", async () => {
    const auth = { read: () => ({ author: "operator", csrf: "synthetic" }) } as unknown as AdminAuth;
    const guarded = createAdminSessionOriReview(auth, async () => valid, true, [1]);
    expect((await guarded(request, input)).status).toBe("ready");
  });
  it("rejects unauthorized mission and disabled feature", async () => {
    const auth = { read: () => ({ author: "operator", csrf: "synthetic" }) } as unknown as AdminAuth;
    const review = async () => valid;
    expect((await createAdminSessionOriReview(auth, review, true, [0])(request, input)).plan).toBeNull();
    expect((await createAdminSessionOriReview(auth, review, false, [1])(request, input)).plan).toBeNull();
  });
  it("fails closed if session reader throws", async () => {
    const auth = { read: () => { throw new Error("synthetic auth failure"); } } as unknown as AdminAuth;
    const guarded = createAdminSessionOriReview(auth, async () => valid, true, [1]);
    expect((await guarded(request, input)).status).toBe("unavailable");
  });
});
