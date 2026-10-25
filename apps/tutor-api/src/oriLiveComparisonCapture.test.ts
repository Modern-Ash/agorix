import { describe, expect, it } from "vitest";
import { getKidsMission } from "@agorix/curriculum";
import { createWorldState, runProgram } from "@agorix/runtime";
import { createTutorRequest } from "@agorix/tutor-contract";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";
import { captureOriLiveComparison } from "./oriLiveComparisonCapture.js";

const mission = getKidsMission("kids.m1.straight", "es");
const program = mission.starterProject;
const run = runProgram(program, createWorldState(mission.starterStage), {
  collectObservations: true,
});
const tutorRequest = createTutorRequest({
  mission: { id: mission.id, version: mission.version, concepts: mission.concepts },
  program,
  runtime: {
    outcome: run.outcome,
    stepsUsed: run.stepsUsed,
    finalWorld: run.world,
    observations: run.observations,
  },
  hintHistory: [],
  reading: { locale: "es-AR", readingLevel: "middle-grade" },
});
const oriInput = { missionIndex: 0, hintLevel: 1 as const, scriptCount: program.scripts.length };
const consumer: OriPlanConsumer = {
  evaluate: async (input) => ({
    schema: "ori/shadow-plan/v1",
    kind: "pedagogical-plan",
    stage: input.hintLevel,
    steps: ["Pensá en un movimiento", "Probá una opción", "Observá el resultado"],
    hint: "¿Qué bloque podrías probar para llegar a la meta?",
    requiresLearnerApproval: false,
    appliedChanges: false,
    context: { missionStage: input.missionIndex },
  }),
};
describe("Ori offline live comparison capture", () => {
  it("combines real deterministic text with injected Ori plan without leaking source mapping", async () => {
    const result = await captureOriLiveComparison(tutorRequest, oriInput, consumer, true);
    expect(result?.educator.A).toBe("¿Qué bloque podrías probar para llegar a la meta?");
    expect(result?.educator.B.length).toBeGreaterThan(8);
    expect(result?.coordinator.oriCandidate).toBe("A");
    expect(JSON.stringify(result?.educator)).not.toContain("oriCandidate");
    expect(result?.educator.equalInputContextProven).toBe(false);
    expect(result?.educator.eligibleForEfficacyClaim).toBe(false);
  });
  it("reverses A/B ordering", async () => {
    const result = await captureOriLiveComparison(tutorRequest, oriInput, consumer, false);
    expect(result?.coordinator.oriCandidate).toBe("B");
  });
  it("fails closed if Ori is unavailable", async () => {
    expect(await captureOriLiveComparison(tutorRequest, oriInput, {
      evaluate: async () => null,
    }, true)).toBeNull();
  });
  it("fails closed on provider exceptions", async () => {
    expect(await captureOriLiveComparison(tutorRequest, oriInput, {
      evaluate: async () => { throw new Error("synthetic failure"); },
    }, true)).toBeNull();
  });
  it("rejects invalid tutor input", async () => {
    expect(await captureOriLiveComparison({
      ...tutorRequest, mission: { ...tutorRequest.mission, id: "" },
    }, oriInput, consumer, true)).toBeNull();
  });
});
