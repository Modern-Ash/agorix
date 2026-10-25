import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AdminAuth, hashAdminPassword } from "./adminAuth.js";
import { createAdminSessionOriReview } from "./oriAdminSessionReview.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";

const password = "synthetic-test-password-123";
const input = { missionIndex: 1, hintLevel: 2 as const, scriptCount: 1 };
const plan: OriPlanReviewResult = {
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

function request(cookie?: string): IncomingMessage {
  return {
    headers: cookie ? { cookie } : {},
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as IncomingMessage;
}

function login(auth: AdminAuth): string {
  let cookie = "";
  const response = {
    setHeader: (_name: string, value: string) => {
      cookie = value.split(";")[0] ?? "";
    },
  } as unknown as ServerResponse;
  expect(auth.signIn(password, request(), response)).not.toBeNull();
  return cookie;
}

describe("Ori review with real AdminAuth session lifecycle", () => {
  it("denies missing and invalid cookies without contacting Ori", async () => {
    const auth = new AdminAuth(hashAdminPassword(password));
    let calls = 0;
    const guarded = createAdminSessionOriReview(
      auth,
      async () => {
        calls++;
        return plan;
      },
      true,
      [1],
    );
    expect((await guarded(request(), input)).status).toBe("unavailable");
    expect((await guarded(request("agorix_ai_admin=invalid"), input)).status).toBe("unavailable");
    expect(calls).toBe(0);
  });

  it("permits authenticated session only for allowed missions", async () => {
    const auth = new AdminAuth(hashAdminPassword(password));
    const cookie = login(auth);
    let calls = 0;
    const guarded = createAdminSessionOriReview(
      auth,
      async () => {
        calls++;
        return plan;
      },
      true,
      [1],
    );
    expect((await guarded(request(cookie), input)).status).toBe("ready");
    expect((await guarded(request(cookie), { ...input, missionIndex: 2 })).status).toBe("unavailable");
    expect(calls).toBe(1);
  });

  it("denies a signed-out session without contacting Ori", async () => {
    const auth = new AdminAuth(hashAdminPassword(password));
    const cookie = login(auth);
    const guarded = createAdminSessionOriReview(auth, async () => plan, true, [1]);
    const response = { setHeader: () => undefined } as unknown as ServerResponse;
    auth.signOut(request(cookie), response);
    expect((await guarded(request(cookie), input)).status).toBe("unavailable");
  });

  it("denies an expired session without contacting Ori", async () => {
    let now = 1_000_000;
    const auth = new AdminAuth(hashAdminPassword(password), "operator", () => now);
    const cookie = login(auth);
    let calls = 0;
    const guarded = createAdminSessionOriReview(
      auth,
      async () => {
        calls++;
        return plan;
      },
      true,
      [1],
    );
    now += 2 * 60 * 60 * 1000 + 1;
    expect((await guarded(request(cookie), input)).status).toBe("unavailable");
    expect(calls).toBe(0);
  });

  it("does not call Ori when feature is disabled even with valid session", async () => {
    const auth = new AdminAuth(hashAdminPassword(password));
    const cookie = login(auth);
    let calls = 0;
    const guarded = createAdminSessionOriReview(
      auth,
      async () => {
        calls++;
        return plan;
      },
      false,
      [1],
    );
    expect((await guarded(request(cookie), input)).status).toBe("unavailable");
    expect(calls).toBe(0);
  });
});
