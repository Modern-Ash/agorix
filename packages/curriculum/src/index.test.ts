import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram, type RunResult } from "@agorix/runtime";
import {
  FIRST_MISSION,
  MISSION_SCHEMA_VERSION,
  MissionValidationError,
  PACKAGE_NAME,
  createMissionRunFeedback,
  evaluateMission,
  validateMission,
  type MissionDefinition,
} from "./index.js";

const starterProject: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [],
    },
  ],
};

const mission: MissionDefinition = {
  schema: MISSION_SCHEMA_VERSION,
  id: "first-mission.reach-goal",
  version: 1,
  title: "Reach the Goal",
  goal: {
    title: "Get your sprite to the goal",
    learnerFacing: "Use blocks to move the sprite until it reaches the goal.",
  },
  concepts: ["sequence", "events"],
  starterProject,
  starterStage: {
    sprite: { x: 0, y: 0, heading: 0 },
    goal: { x: 20, y: 0 },
  },
  completion: { type: "spriteTouchingGoal" },
  constraints: [
    {
      id: "runtime-only",
      description: "Completion is evaluated from runtime observations, not tutor output.",
    },
  ],
  hintLadder: [
    { level: 1, text: "What changed after you pressed Run?" },
    { level: 2, text: "Move blocks change the sprite position." },
    { level: 3, text: "Look at the distance between the sprite and the goal." },
  ],
  reflectionPrompt: "What made the sprite reach the goal?",
};

const programFor = (steps: number): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps }],
    },
  ],
});

const run = (steps: number): RunResult =>
  runProgram(programFor(steps), createWorldState(mission.starterStage), {
    collectObservations: true,
  });

describe("curriculum package", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/curriculum");
  });
});

describe("First Mission", () => {
  it("is the canonical POC learner challenge and is solvable with POC blocks", () => {
    const validated = validateMission(FIRST_MISSION);
    const result = runProgram(programFor(160), createWorldState(FIRST_MISSION.starterStage), {
      collectObservations: true,
    });
    const evaluation = evaluateMission({ mission: FIRST_MISSION, result });

    expect(validated.id).toBe("first-mission.reach-goal");
    expect(validated.concepts).toContain("movement");
    expect(validated.hintLadder).toHaveLength(5);
    expect(evaluation.completed).toBe(true);
  });

  it("gives deterministic behavior feedback for a reasonable incorrect attempt", () => {
    const result = runProgram(programFor(10), createWorldState(FIRST_MISSION.starterStage), {
      collectObservations: true,
    });

    expect(evaluateMission({ mission: FIRST_MISSION, result }).completed).toBe(false);
    expect(createMissionRunFeedback({ mission: FIRST_MISSION, result })).toEqual({
      completed: false,
      message: "Not there yet: the sprite moved toward the goal but stopped short. Try more steps.",
    });
  });

  it("returns the reflection prompt only after runtime completion", () => {
    const result = runProgram(programFor(160), createWorldState(FIRST_MISSION.starterStage), {
      collectObservations: true,
    });

    expect(createMissionRunFeedback({ mission: FIRST_MISSION, result })).toEqual({
      completed: true,
      message: "Mission complete: your sprite reached the goal.",
      reflectionPrompt: FIRST_MISSION.reflectionPrompt,
    });
  });
});

describe("mission contract", () => {
  it("is serializable as canonical mission data", () => {
    const serialized = JSON.stringify(validateMission(mission));
    const parsed = JSON.parse(serialized) as MissionDefinition;

    expect(parsed).toEqual(mission);
    expect(parsed).not.toHaveProperty("evaluate");
    expect(parsed.starterProject).toEqual(starterProject);
  });

  it("rejects invalid missions", () => {
    const invalid = { ...mission, schema: "agorix/mission/v99" } as unknown as MissionDefinition;

    expect(() => validateMission(invalid)).toThrow(MissionValidationError);
    expect(() =>
      validateMission({ ...mission, hintLadder: [{ level: 2, text: "too high first" }] }),
    ).not.toThrow();
    expect(() =>
      validateMission({
        ...mission,
        hintLadder: [
          { level: 2, text: "first" },
          { level: 2, text: "duplicate" },
        ],
      }),
    ).toThrow(MissionValidationError);
  });
});

describe("mission evaluator", () => {
  it("deterministically distinguishes incomplete and complete runtime results", () => {
    const incomplete = evaluateMission({ mission, result: run(10) });
    const complete = evaluateMission({ mission, result: run(20) });
    const repeated = evaluateMission({ mission, result: run(20) });

    expect(incomplete.completed).toBe(false);
    expect(complete.completed).toBe(true);
    expect(repeated).toEqual(complete);
  });

  it("uses runtime observations and final world without requiring a browser DOM", () => {
    const result = run(20);
    const evaluation = evaluateMission({ mission, result });

    expect(globalThis.document).toBeUndefined();
    expect(evaluation.finalWorld).toEqual(result.world);
    expect(evaluation.observations.at(-1)).toMatchObject({
      kind: "run-complete",
      outcome: "completed",
    });
  });

  it("supports compound predicates for runtime outcome plus stage state", () => {
    const compoundMission: MissionDefinition = {
      ...mission,
      completion: {
        type: "all",
        predicates: [
          { type: "runtimeOutcome", outcome: "completed" },
          { type: "spriteTouchingGoal" },
        ],
      },
    };

    expect(evaluateMission({ mission: compoundMission, result: run(20) }).completed).toBe(true);
    expect(evaluateMission({ mission: compoundMission, result: run(10) }).completed).toBe(false);
  });
});
