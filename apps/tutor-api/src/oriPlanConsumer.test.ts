import { describe, expect, it } from "vitest";
import { createOriPlanConsumer } from "./oriPlanConsumer.js";

const input = { missionIndex: 1, hintLevel: 2 as const, scriptCount: 1 };
const valid = {
  schema: "ori/shadow-plan/v1",
  kind: "pedagogical-plan",
  stage: 2,
  steps: ["Predecir", "Probar", "Comparar"],
  hint: "¿Qué pensás que va a pasar?",
  requiresLearnerApproval: false,
  appliedChanges: false,
  context: { missionStage: 1 },
};
const endpoint = "http://127.0.0.1:11485/v1/plan";
function consumer(body: unknown, status = 200) {
  return createOriPlanConsumer(endpoint, (async () => new Response(
    typeof body === "string" ? body : JSON.stringify(body), { status },
  )) as typeof fetch);
}
describe("Ori plan read-only consumer", () => {
  it("accepts a valid matching plan without allowing edits", async () => {
    const result = await consumer(valid).evaluate(input);
    expect(result).toEqual(valid);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.steps)).toBe(true);
  });
  it.each([
    ["invalid schema", { ...valid, schema: "ori/shadow-plan/v2" }],
    ["extra proposal", { ...valid, proposal: { apply: true } }],
    ["claims execution", { ...valid, appliedChanges: true }],
    ["wrong stage", { ...valid, stage: 3 }],
    ["wrong mission", { ...valid, context: { missionStage: 2 } }],
    ["wrong approval", { ...valid, requiresLearnerApproval: true }],
    ["child identifier", { ...valid, childId: "synthetic" }],
    ["invalid JSON", "{broken"],
    ["oversized", "x".repeat(5000)],
  ])("fails closed for %s", async (_label, body) => {
    expect(await consumer(body).evaluate(input)).toBeNull();
  });
  it.each([400, 401, 403, 429, 500, 503])("fails closed on HTTP %i", async (status) => {
    expect(await consumer(valid, status).evaluate(input)).toBeNull();
  });
  it("sends only bounded metadata", async () => {
    let payload = "";
    const fetchMock = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      payload = String(init?.body);
      return new Response(JSON.stringify(valid));
    }) as typeof fetch;
    await createOriPlanConsumer(endpoint, fetchMock).evaluate(input);
    expect(JSON.parse(payload)).toEqual(input);
  });
  it("rejects remote endpoints and credentials", () => {
    for (const url of ["https://example.com/v1/plan", "http://10.0.0.1/v1/plan", "http://user:pass@localhost/v1/plan"]) {
      expect(() => createOriPlanConsumer(url)).toThrow();
    }
  });
  it("does not propagate provider failures", async () => {
    const failing = createOriPlanConsumer(endpoint, (async () => { throw new Error("offline"); }) as typeof fetch);
    expect(await failing.evaluate(input)).toBeNull();
  });
});
