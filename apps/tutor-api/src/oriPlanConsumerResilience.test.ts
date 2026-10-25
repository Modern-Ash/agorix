import { describe, expect, it } from "vitest";
import { createOriPlanConsumer } from "./oriPlanConsumer.js";

const endpoint = "http://127.0.0.1:11485/v1/plan";
const input = { missionIndex: 1, hintLevel: 2 as const, scriptCount: 1 };
const valid = {
  schema: "ori/shadow-plan/v1",
  kind: "pedagogical-plan",
  stage: 2,
  steps: ["Predecir", "Probar", "Comparar"],
  hint: "¿Qué esperás que pase?",
  requiresLearnerApproval: false,
  appliedChanges: false,
  context: { missionStage: 1 },
};
describe("Ori plan consumer resilience", () => {
  it.each([1, 2, 5, 750, 2000])("accepts bounded timeout %i", (timeout) => {
    expect(() => createOriPlanConsumer(endpoint, fetch, timeout)).not.toThrow();
  });
  it.each([0, -1, 2001, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid timeout %s",
    (timeout) => {
      expect(() => createOriPlanConsumer(endpoint, fetch, timeout)).toThrow();
    },
  );
  it("fails closed when response body is absent", async () => {
    const mockFetch = (async () => new Response(null)) as typeof fetch;
    expect(await createOriPlanConsumer(endpoint, mockFetch).evaluate(input)).toBeNull();
  });
  it("fails closed on invalid UTF-8", async () => {
    const mockFetch = (async () => new Response(new Uint8Array([0xff, 0xfe]))) as typeof fetch;
    expect(await createOriPlanConsumer(endpoint, mockFetch).evaluate(input)).toBeNull();
  });
  it("rejects a response that is exactly one byte above limit", async () => {
    const mockFetch = (async () => new Response("x".repeat(4097))) as typeof fetch;
    expect(await createOriPlanConsumer(endpoint, mockFetch).evaluate(input)).toBeNull();
  });
  it("rejects a valid schema with mismatched mission or hint level", async () => {
    for (const payload of [
      { ...valid, stage: 1 },
      { ...valid, context: { missionStage: 0 } },
    ]) {
      const mockFetch = (async () => new Response(JSON.stringify(payload))) as typeof fetch;
      expect(await createOriPlanConsumer(endpoint, mockFetch).evaluate(input)).toBeNull();
    }
  });
  it("returns a detached immutable copy of the plan", async () => {
    const mockFetch = (async () => new Response(JSON.stringify(valid))) as typeof fetch;
    const plan = await createOriPlanConsumer(endpoint, mockFetch).evaluate(input);
    expect(plan).toEqual(valid);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan?.steps)).toBe(true);
    expect(Object.isFrozen(plan?.context)).toBe(true);
  });
  it("never returns provider errors or raw responses to the caller", async () => {
    const mockFetch = (async () => {
      throw new Error("private provider error with synthetic child data");
    }) as typeof fetch;
    expect(await createOriPlanConsumer(endpoint, mockFetch).evaluate(input)).toBeNull();
  });
});
