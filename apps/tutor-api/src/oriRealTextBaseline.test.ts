import { describe, expect, it } from "vitest";
import { getKidsMission } from "@agorix/curriculum";
import { createWorldState, runProgram } from "@agorix/runtime";
import { createTutorRequest } from "@agorix/tutor-contract";
import { captureOriRealTextBaseline } from "./oriRealTextBaseline.js";

const mission = getKidsMission("kids.m1.straight", "es");
const program = mission.starterProject;
const run = runProgram(program, createWorldState(mission.starterStage), {
  collectObservations: true,
});
const request = createTutorRequest({
  mission: {
    id: mission.id,
    version: mission.version,
    concepts: mission.concepts,
  },
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
describe("real deterministic text tutor baseline", () => {
  it("returns authentic reproducible text from the existing tutor contract", () => {
    const first = captureOriRealTextBaseline(request);
    expect(first.source).toBe("agorix-deterministic-text");
    expect(first.message.length).toBeGreaterThan(8);
    expect(first).toEqual(captureOriRealTextBaseline(request));
  });
  it("never invents a next step or changes the program", () => {
    const result = captureOriRealTextBaseline(request);
    expect(result.nextStepAvailable).toBe(false);
    expect(result.programUnchanged).toBe(true);
    expect("nextStep" in result).toBe(false);
  });
  it("rejects an invalid request rather than producing fake evidence", () => {
    expect(() => captureOriRealTextBaseline({
      ...request, mission: { ...request.mission, id: "" },
    })).toThrow();
  });
});
