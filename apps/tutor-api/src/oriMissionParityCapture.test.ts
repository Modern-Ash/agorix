import { describe, expect, it } from "vitest";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";
import { captureOriMissionParity } from "./oriMissionParityCapture.js";

describe("Ori MIG-03 mission parity capture", () => {
  it("captures matching plans and preserves missing evidence", async () => {
    let calls = 0;
    const consumer: OriPlanConsumer = {
      evaluate: async (input) => {
        calls++;
        if (input.missionIndex !== 0) return null;
        return {
          schema: "ori/shadow-plan/v1",
          kind: "pedagogical-plan",
          stage: 2,
          steps: ["Predecir", "Probar", "Comparar"],
          hint: "¿Qué esperás que pase?",
          requiresLearnerApproval: false,
          appliedChanges: false,
          context: { missionStage: 0 },
        };
      },
    };
    const result = await captureOriMissionParity(consumer);
    expect(calls).toBe(result.missions);
    expect(result.available).toBe(1);
    expect(result.missing).toBe(result.missions - 1);
    expect(result.findings[0]?.candidateAvailable).toBe(true);
  });
  it("reports all missions missing when Ori is unavailable", async () => {
    const result = await captureOriMissionParity({
      evaluate: async () => { throw Error("offline"); },
    });
    expect(result.available).toBe(0);
    expect(result.missing).toBe(result.missions);
  });
});
