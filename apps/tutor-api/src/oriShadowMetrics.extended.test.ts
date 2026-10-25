import { describe, expect, it } from "vitest";
import { createOriShadowMetrics } from "./oriShadowMetrics.js";
import { createOriShadowTransport } from "./oriExternalShadowTransport.js";

const endpoint = "http://127.0.0.1:11485/v1/plan";
const input = { missionIndex: 0, hintLevel: 1 as const, scriptCount: 1 };
const valid = {
  schema: "ori/shadow-plan/v1",
  kind: "pedagogical-plan",
  stage: 1,
  steps: ["Pensar", "Probar", "Reflexionar"],
  hint: "¿Qué pensás que va a pasar?",
  requiresLearnerApproval: false,
  appliedChanges: false,
  context: { missionStage: 0 },
};
function transportWith(body: string, metrics = createOriShadowMetrics()) {
  const fetchMock = (async () => new Response(body, { status: 200 })) as typeof fetch;
  return { transport: createOriShadowTransport(endpoint, fetchMock, metrics), metrics };
}
describe("Ori shadow metrics extended adversarial matrix", () => {
  const invalidCases: [string, unknown][] = [
    ["null", null],
    ["array", []],
    ["missing schema", { ...valid, schema: undefined }],
    ["wrong schema", { ...valid, schema: "ori/shadow-plan/v2" }],
    ["unexpected proposal", { ...valid, proposal: { apply: true } }],
    ["claims applied changes", { ...valid, appliedChanges: true }],
    ["asks for approval", { ...valid, requiresLearnerApproval: true }],
    ["extra identity", { ...valid, childId: "synthetic" }],
    ["wrong stage", { ...valid, stage: 6 }],
    ["zero stage", { ...valid, stage: 0 }],
    ["fractional stage", { ...valid, stage: 1.5 }],
    ["empty steps", { ...valid, steps: [] }],
    ["extra step", { ...valid, steps: ["a", "b", "c", "d"] }],
    ["empty hint", { ...valid, hint: "" }],
    ["oversized hint", { ...valid, hint: "x".repeat(181) }],
    ["wrong context", { ...valid, context: { missionStage: -1 } }],
    ["extra context", { ...valid, context: { missionStage: 0, email: "synthetic" } }],
    ["string boolean", { ...valid, appliedChanges: "false" }],
  ];
  it.each(invalidCases)("rejects %s and records one invalid-contract", async (_label, payload) => {
    const { transport, metrics } = transportWith(JSON.stringify(payload));
    await expect(transport(input)).resolves.toBeUndefined();
    expect(metrics.snapshot()["invalid-contract"]).toBe(1);
    expect(metrics.snapshot().valid).toBe(0);
  });
  it("counts invalid JSON without exposing response contents", async () => {
    const { transport, metrics } = transportWith("{broken");
    await transport(input);
    expect(metrics.snapshot()["invalid-contract"]).toBe(1);
    expect(JSON.stringify(metrics.snapshot())).not.toContain("broken");
  });
  it.each([4096, 4097, 16384])("enforces response size for %i bytes", async (bytes) => {
    const { transport, metrics } = transportWith("x".repeat(bytes));
    await transport(input);
    const snapshot = metrics.snapshot();
    expect(snapshot.oversized).toBe(bytes > 4096 ? 1 : 0);
    expect(snapshot["invalid-contract"]).toBe(bytes > 4096 ? 0 : 1);
  });
  it.each([400, 401, 403, 404, 429, 500, 503])(
    "classifies HTTP %i without parsing body",
    async (status) => {
      const metrics = createOriShadowMetrics();
      const fetchMock = (async () => new Response("untrusted", { status })) as typeof fetch;
      await createOriShadowTransport(endpoint, fetchMock, metrics)(input);
      expect(metrics.snapshot()["http-error"]).toBe(1);
      expect(metrics.snapshot()["invalid-contract"]).toBe(0);
    },
  );
  it("counts independent calls and snapshots cannot mutate internal counters", async () => {
    const { transport, metrics } = transportWith(JSON.stringify(valid));
    for (let i = 0; i < 10; i++) await transport(input);
    const snapshot = metrics.snapshot();
    expect(snapshot.valid).toBe(10);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(metrics.snapshot().valid).toBe(10);
  });
  it("does not retain learner content in counter keys or values", () => {
    const metrics = createOriShadowMetrics();
    metrics.record("valid");
    const snapshot = metrics.snapshot();
    expect(Object.keys(snapshot).sort()).toEqual([
      "http-error",
      "invalid-contract",
      "network-error",
      "oversized",
      "timeout",
      "valid",
    ]);
    expect(Object.values(snapshot).every(Number.isInteger)).toBe(true);
  });
});
