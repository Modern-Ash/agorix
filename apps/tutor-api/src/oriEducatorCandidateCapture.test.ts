import { describe, expect, it } from "vitest";
import { captureOriEducatorCandidates } from "./oriEducatorCandidateCapture.js";
import { oriPedagogicalFixtures } from "./oriPedagogicalFixtures.js";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";

const baseline = oriPedagogicalFixtures.map((fixture) => ({
  fixtureId: fixture.id,
  hint: "¿Qué podrías probar primero para avanzar?",
  nextStep: "Elegí una opción y observá qué sucede.",
}));
const consumer: OriPlanConsumer = {
  evaluate: async (input) => ({
    schema: "ori/shadow-plan/v1",
    kind: "pedagogical-plan",
    stage: input.hintLevel,
    steps: ["Pensá en una alternativa", "Probá una idea", "Compará resultados"],
    hint: "¿Qué podrías cambiar para probar tu idea?",
    requiresLearnerApproval: false,
    appliedChanges: false,
    context: { missionStage: input.missionIndex },
  }),
};
describe("Ori educator candidate capture", () => {
  it("captures five paired scenarios without fabricating baseline output", async () => {
    const result = await captureOriEducatorCandidates(consumer, baseline);
    expect(result?.batch.pairs).toHaveLength(5);
    expect(result?.batch.keys.map((key) => key.oriCandidate)).toEqual(["A", "B", "A", "B", "A"]);
    expect(result?.capturedFixtureIds).toEqual(oriPedagogicalFixtures.map((fixture) => fixture.id));
    expect(result?.batch.pairs[0]?.B.hint).toBe(baseline[0]?.hint);
  });
  it("rejects missing deterministic responses", async () => {
    expect(await captureOriEducatorCandidates(consumer, baseline.slice(0, 4))).toBeNull();
  });
  it("rejects duplicate fixture IDs", async () => {
    expect(
      await captureOriEducatorCandidates(consumer, [...baseline.slice(0, 4), baseline[0]!]),
    ).toBeNull();
  });
  it("rejects unavailable Ori output without emitting partial batches", async () => {
    const unavailable: OriPlanConsumer = { evaluate: async () => null };
    expect(await captureOriEducatorCandidates(unavailable, baseline)).toBeNull();
  });
  it("rejects a mismatched Ori mission", async () => {
    const mismatched: OriPlanConsumer = {
      evaluate: async (input) => ({
        schema: "ori/shadow-plan/v1",
        kind: "pedagogical-plan",
        stage: input.hintLevel,
        steps: ["Pensá una opción", "Probá una opción", "Compará resultados"],
        hint: "¿Qué podrías intentar para avanzar?",
        requiresLearnerApproval: false,
        appliedChanges: false,
        context: { missionStage: input.missionIndex + 1 },
      }),
    };
    expect(await captureOriEducatorCandidates(mismatched, baseline)).toBeNull();
  });
});
