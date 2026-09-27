import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { runProgram } from "@agorix/runtime";
import {
  PACKAGE_NAME,
  TUTOR_REQUEST_SCHEMA_VERSION,
  TUTOR_RESPONSE_SCHEMA_VERSION,
  TutorContractValidationError,
  assertTutorProviderContract,
  createDeterministicTutorResponse,
  createTutorRequest,
  createTutorResponse,
  parseTutorResponse,
  validateTutorRequest,
  validateTutorResponse,
  type TutorRequest,
  type TutorResponse,
} from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 10 }],
    },
  ],
};

const result = runProgram(
  program,
  { sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
  { collectObservations: true },
);

const request: TutorRequest = createTutorRequest({
  mission: {
    id: "first-mission.reach-goal",
    version: 1,
    concepts: ["sequence", "events"],
  },
  program,
  runtime: {
    outcome: result.outcome,
    stepsUsed: result.stepsUsed,
    finalWorld: result.world,
    observations: result.observations,
  },
  hintHistory: [{ level: 1, concept: "sequence", nodeId: "scripts[0]/statements[0]" }],
  learnerQuestion: "Why did it stop before the goal?",
  reading: { locale: "en-US", readingLevel: "middle-grade" },
});

const response: TutorResponse = createTutorResponse({
  hintLevel: 2,
  message: "Try comparing how far the sprite moves with how far away the goal is.",
  nodeIds: ["scripts[0]/statements[0]"],
  concepts: ["sequence"],
});

describe("tutor-contract package", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/tutor-contract");
  });
});

describe("deterministic fake tutor", () => {
  it("starts with a level 1 hint without giving the full solution", () => {
    const firstHint = createDeterministicTutorResponse(
      createTutorRequest({
        ...request,
        hintHistory: [],
      }),
    );

    expect(firstHint.hintLevel).toBe(1);
    expect(firstHint.message).toContain("What changed");
    expect(firstHint.message.toLowerCase()).not.toContain("solution");
    expect(firstHint.nodeIds).toEqual(["scripts[0]/statements[0]"]);
    expect(firstHint.concepts).toEqual(["sequence", "events"]);
  });

  it("escalates repeated hints predictably and caps at level 5", () => {
    const levels = [0, 1, 2, 3, 4, 5].map(
      (historySize) =>
        createDeterministicTutorResponse(
          createTutorRequest({
            ...request,
            hintHistory: Array.from({ length: historySize }, (_, index) => ({
              level: Math.min(index + 1, 5) as 1 | 2 | 3 | 4 | 5,
              concept: "sequence",
              nodeId: "scripts[0]/statements[0]",
            })),
          }),
        ).hintLevel,
    );

    expect(levels).toEqual([1, 2, 3, 4, 5, 5]);
  });

  it("supports the First Mission when no blocks have been added yet", () => {
    const emptyProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
    };
    const emptyResult = runProgram(
      emptyProgram,
      { sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
      { collectObservations: true },
    );

    const hint = createDeterministicTutorResponse(
      createTutorRequest({
        mission: { id: "first-mission.reach-goal", version: 1, concepts: ["sequence", "events"] },
        program: emptyProgram,
        runtime: {
          outcome: emptyResult.outcome,
          stepsUsed: emptyResult.stepsUsed,
          finalWorld: emptyResult.world,
          observations: emptyResult.observations,
        },
        hintHistory: [],
      }),
    );

    expect(hint.hintLevel).toBe(1);
    expect(hint.message).toContain("adding one movement block");
    expect(hint.nodeIds).toEqual([]);
  });

  it("does not mutate the program or return executable program changes", () => {
    const before = JSON.parse(JSON.stringify(program));
    const hint = createDeterministicTutorResponse(request);

    expect(program).toEqual(before);
    expect(hint).toEqual({
      schema: TUTOR_RESPONSE_SCHEMA_VERSION,
      hintLevel: 2,
      message:
        "The sprite moves by the number in your Move block. Compare that number with the distance to the goal.",
      nodeIds: ["scripts[0]/statements[0]"],
      concepts: ["sequence", "events"],
    });
    expect(hint).not.toHaveProperty("program");
    expect(hint).not.toHaveProperty("patch");
    expect(hint).not.toHaveProperty("mutation");
  });
});

describe("TutorRequest", () => {
  it("is JSON serializable and versioned", () => {
    const parsed = JSON.parse(JSON.stringify(validateTutorRequest(request))) as TutorRequest;

    expect(parsed.schema).toBe(TUTOR_REQUEST_SCHEMA_VERSION);
    expect(parsed).toEqual(request);
  });

  it("requires no child PII fields", () => {
    const minimal = createTutorRequest({
      mission: { id: "first-mission.reach-goal", version: 1, concepts: ["sequence"] },
      program,
      runtime: {
        outcome: result.outcome,
        stepsUsed: result.stepsUsed,
        finalWorld: result.world,
        observations: result.observations,
      },
      hintHistory: [],
    });

    expect(JSON.stringify(minimal)).not.toMatch(/email|school|address|name|age/i);
    expect(validateTutorRequest(minimal)).toEqual(minimal);
  });

  it("rejects provider-specific request fields", () => {
    const providerSpecific = { ...request, openAiThreadId: "thread-1" } as unknown as TutorRequest;

    expect(() => validateTutorRequest(providerSpecific)).toThrow(TutorContractValidationError);
  });
});

describe("TutorResponse", () => {
  it("is JSON serializable and versioned", () => {
    const parsed = JSON.parse(JSON.stringify(validateTutorResponse(response))) as TutorResponse;

    expect(parsed.schema).toBe(TUTOR_RESPONSE_SCHEMA_VERSION);
    expect(parsed).toEqual(response);
  });

  it("prevents malformed provider output from entering UI unchecked", () => {
    expect(() => parseTutorResponse({ ...response, hintLevel: 9 })).toThrow(
      TutorContractValidationError,
    );
    expect(() => parseTutorResponse({ ...response, message: "" })).toThrow(
      TutorContractValidationError,
    );
    expect(() => parseTutorResponse({ ...response, providerRaw: { unsafe: true } })).toThrow(
      TutorContractValidationError,
    );
  });

  it("keeps response provider-neutral", () => {
    expect(() =>
      validateTutorResponse({
        ...response,
        claudeStopReason: "end_turn",
      } as unknown as TutorResponse),
    ).toThrow(TutorContractValidationError);
  });

  it("provides reusable provider contract assertions for adapters", () => {
    const validated = assertTutorProviderContract("fake-local", () => response);

    expect(validated).toEqual(response);
    expect(() =>
      assertTutorProviderContract("fake-local", () => ({ message: "missing schema" })),
    ).toThrow(TutorContractValidationError);
  });
});
