import { describe, expect, it } from "vitest";
import { createOriShadowMetrics } from "./oriShadowMetrics.js";
import { createOriShadowTransport } from "./oriExternalShadowTransport.js";

const plan = {
  schema: "ori/shadow-plan/v1",
  kind: "pedagogical-plan",
  stage: 1,
  steps: ["Pensar qué queremos lograr", "Elegir una acción pequeña", "Probar y observar"],
  hint: "¿Qué esperás que pase?",
  requiresLearnerApproval: false,
  appliedChanges: false,
  context: { missionStage: 0 },
};
const input = { missionIndex: 0, hintLevel: 1 as const, scriptCount: 1 };
const endpoint = "http://127.0.0.1:11485/v1/plan";
describe("Ori shadow metrics", () => {
  it("counts valid, invalid and oversized plans without storing content", async () => {
    const metrics = createOriShadowMetrics();
    for (const body of [
      JSON.stringify(plan),
      JSON.stringify({ ...plan, appliedChanges: true }),
      "x".repeat(5000),
    ]) {
      const transport = createOriShadowTransport(endpoint, async () => new Response(body), metrics);
      await transport(input);
    }
    expect(metrics.snapshot()).toMatchObject({ valid: 1, "invalid-contract": 1, oversized: 1 });
    expect(JSON.stringify(metrics.snapshot())).not.toContain("Pensar");
  });
  it("counts HTTP errors and network failures", async () => {
    const metrics = createOriShadowMetrics();
    await createOriShadowTransport(
      endpoint,
      async () => new Response("no", { status: 503 }),
      metrics,
    )(input);
    await expect(
      createOriShadowTransport(
        endpoint,
        async () => {
          throw new Error("offline");
        },
        metrics,
      )(input),
    ).rejects.toThrow();
    expect(metrics.snapshot()).toMatchObject({ "http-error": 1, "network-error": 1 });
  });
  it("returns immutable counter snapshots", () => {
    const metrics = createOriShadowMetrics();
    metrics.record("valid");
    expect(metrics.snapshot().valid).toBe(1);
    expect(Object.isFrozen(metrics.snapshot())).toBe(true);
  });
});
