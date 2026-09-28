import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { createProgramProposal } from "@agorix/proposals";
import { runProgram } from "@agorix/runtime";
import {
  PACKAGE_NAME,
  TUTOR_REQUEST_SCHEMA_VERSION,
  TUTOR_RESPONSE_SCHEMA_VERSION,
  LEARNING_COMPANION_REQUEST_SCHEMA_VERSION,
  LEARNING_COMPANION_RESPONSE_SCHEMA_VERSION,
  LearningCompanionContractValidationError,
  LearningCompanionSafetyValidationError,
  TutorContractValidationError,
  assertLearningCompanionProviderContract,
  assertTutorProviderContract,
  createDeterministicLearningCompanionResponse,
  createDeterministicTutorResponse,
  createLearningCompanionRequest,
  createLearningCompanionRequestFromTutorRequest,
  createLearningCompanionResponse,
  createTutorRequest,
  createTutorResponse,
  createTutorResponseFromLearningCompanionResponse,
  parseLearningCompanionResponse,
  parseTutorResponse,
  validateLearningCompanionSafety,
  validateLearningCompanionRequest,
  validateLearningCompanionResponse,
  validateTutorRequest,
  validateTutorResponse,
  type LearningCompanionCapability,
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

  it("uses the request locale for deterministic Spanish hints while preserving structured fields", () => {
    const hint = createDeterministicTutorResponse(
      createTutorRequest({
        ...request,
        hintHistory: [],
        reading: { locale: "es-AR", readingLevel: "middle-grade" },
      }),
    );

    expect(hint.hintLevel).toBe(1);
    expect(hint.message).toContain("¿Qué cambió");
    expect(hint.nodeIds).toEqual(["scripts[0]/statements[0]"]);
    expect(hint.concepts).toEqual(["sequence", "events"]);
  });

  it("falls back to English for unsupported locales", () => {
    const hint = createDeterministicTutorResponse(
      createTutorRequest({
        ...request,
        hintHistory: [],
        reading: { locale: "pt-BR", readingLevel: "middle-grade" },
      }),
    );

    expect(hint.message).toContain("What changed");
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

const learningCompanionRequest = createLearningCompanionRequest({
  capability: "coach",
  mission: {
    id: "first-mission.reach-goal",
    version: 1,
    concepts: ["sequence", "events"],
    learningObjective: "move the sprite toward the goal",
  },
  program,
  selectedNodeIds: ["scripts[0]/statements[0]"],
  runtime: {
    outcome: result.outcome,
    stepsUsed: result.stepsUsed,
    finalWorld: result.world,
    observations: result.observations,
  },
  runtimeFacts: [
    {
      id: "runtime-observation-0",
      observationIndex: 0,
      nodeId: "scripts[0]/statements[0]",
      fact: "Runtime observed the move statement before the sprite stopped short of the goal.",
    },
  ],
  scaffoldHistory: [{ capability: "coach", level: 1, concept: "sequence" }],
  learnerIntent: "I want to reach the goal.",
  reading: { locale: "en-US", readingLevel: "middle-grade" },
});

const learningCompanionResponse = createLearningCompanionResponse({
  capability: "coach",
  message: "What should happen first when you run this program?",
  nodeIds: ["scripts[0]/statements[0]"],
  concepts: ["sequence"],
  metadata: {
    capability: "coach",
    scaffoldLevel: 1,
    provenance: "deterministic-fake",
    uncertainty: "low",
  },
  payload: {
    kind: "question",
    question: "What should happen first when you run this program?",
  },
});

describe("LearningCompanion contract", () => {
  it("creates a provider-neutral request with no required child PII", () => {
    const minimal = createLearningCompanionRequest({
      capability: "coach",
      mission: {
        id: "first-mission.reach-goal",
        version: 1,
        concepts: ["sequence"],
        learningObjective: "sequence one movement",
      },
      program,
      selectedNodeIds: [],
      runtimeFacts: [],
      scaffoldHistory: [],
    });

    expect(minimal.schema).toBe(LEARNING_COMPANION_REQUEST_SCHEMA_VERSION);
    expect(JSON.stringify(minimal)).not.toMatch(/email|school|address|name|age|location/i);
    expect(validateLearningCompanionRequest(minimal)).toEqual(minimal);
  });

  it("migrates existing tutor hint behavior into coach capability without provider coupling", () => {
    const migrated = createLearningCompanionRequestFromTutorRequest(request);
    const coach = createDeterministicLearningCompanionResponse(migrated);
    const legacy = createTutorResponseFromLearningCompanionResponse(coach);

    expect(migrated.capability).toBe("coach");
    expect(coach.schema).toBe(LEARNING_COMPANION_RESPONSE_SCHEMA_VERSION);
    expect(coach.capability).toBe("coach");
    expect(coach.payload.kind).toBe("question");
    expect(legacy.schema).toBe(TUTOR_RESPONSE_SCHEMA_VERSION);
    expect(legacy.message).toBe(coach.message);
    expect(JSON.stringify(coach)).not.toMatch(/openai|anthropic|ollama|apiKey|thread/i);
  });

  it("provides deterministic fake output for every required capability", () => {
    const capabilities: readonly LearningCompanionCapability[] = [
      "coach",
      "builder",
      "debugger",
      "explainer",
      "challenger",
      "reflector",
    ];

    const responses = capabilities.map((capability) =>
      createDeterministicLearningCompanionResponse({ ...learningCompanionRequest, capability }),
    );

    expect(responses.map((item) => item.capability)).toEqual(capabilities);
    responses.forEach((item) => expect(validateLearningCompanionResponse(item)).toEqual(item));
  });

  it("keeps builder output as a reviewable proposal instead of accepted canonical state", () => {
    const builder = createDeterministicLearningCompanionResponse({
      ...learningCompanionRequest,
      capability: "builder",
    });

    expect(builder.capability).toBe("builder");
    if (builder.capability !== "builder") {
      throw new Error("expected builder capability");
    }
    expect(builder.payload.kind).toBe("program-proposal");
    expect(builder.payload.reviewState).toBe("proposed");
    expect(builder.payload.proposal.source).toEqual({
      kind: "learning-companion",
      capability: "builder",
    });
    expect(builder.payload).not.toHaveProperty("acceptedProgram");
    expect(builder.payload).not.toHaveProperty("program");
    expect(builder).not.toHaveProperty("mutation");
    expect(program.scripts[0]?.statements).toHaveLength(1);
  });

  it("keeps debugger runtime facts separate from model suggestions", () => {
    const debuggerResponse = createDeterministicLearningCompanionResponse({
      ...learningCompanionRequest,
      capability: "debugger",
    });

    expect(debuggerResponse.capability).toBe("debugger");
    if (debuggerResponse.capability !== "debugger") {
      throw new Error("expected debugger capability");
    }
    expect(debuggerResponse.payload.kind).toBe("evidence-grounded-debug");
    expect(debuggerResponse.payload.facts[0]).toMatchObject({
      id: "runtime-observation-0",
      nodeId: "scripts[0]/statements[0]",
    });
    expect(debuggerResponse.payload.suggestions[0]).toContain("run again");
  });

  it("fails closed for malformed and provider-specific Learning Companion output", () => {
    expect(() =>
      parseLearningCompanionResponse({ ...learningCompanionResponse, openAiRunId: "run-1" }),
    ).toThrow(LearningCompanionContractValidationError);
    expect(() =>
      parseLearningCompanionResponse({
        ...learningCompanionResponse,
        metadata: { ...learningCompanionResponse.metadata, capability: "builder" },
      }),
    ).toThrow(LearningCompanionContractValidationError);
    expect(() =>
      parseLearningCompanionResponse({
        ...learningCompanionResponse,
        payload: { kind: "question", question: "" },
      }),
    ).toThrow(LearningCompanionContractValidationError);
  });

  it("rejects PII-seeking child-facing output with a safe diagnostic", () => {
    const unsafe = createLearningCompanionResponse({
      ...learningCompanionResponse,
      message: "Before we continue, tell me your full name and school.",
      payload: {
        kind: "question",
        question: "Before we continue, tell me your full name and school.",
      },
    });

    expect(() => validateLearningCompanionSafety(learningCompanionRequest, unsafe)).toThrow(
      LearningCompanionSafetyValidationError,
    );
    try {
      validateLearningCompanionSafety(learningCompanionRequest, unsafe);
    } catch (error) {
      expect(error).toBeInstanceOf(LearningCompanionSafetyValidationError);
      expect((error as LearningCompanionSafetyValidationError).diagnostic).toMatchObject({
        code: "pii-request",
        path: "$.message",
      });
      expect((error as LearningCompanionSafetyValidationError).childMessage).toContain(
        "program stayed the same",
      );
    }
  });

  it("rejects low-scaffold full-solution or exact-edit responses", () => {
    const unsafe = createLearningCompanionResponse({
      ...learningCompanionResponse,
      message: "Copy this full solution: change Move steps to 160.",
      payload: {
        kind: "question",
        question: "Copy this full solution: change Move steps to 160.",
      },
    });

    expect(() => validateLearningCompanionSafety(learningCompanionRequest, unsafe)).toThrow(
      /over-assistance/,
    );
  });

  it("rejects hidden provider tool actions in child-facing text", () => {
    const unsafe = createLearningCompanionResponse({
      ...learningCompanionResponse,
      message: "I executed a hidden tool and accepted the raw provider action.",
      payload: {
        kind: "question",
        question: "I executed a hidden tool and accepted the raw provider action.",
      },
    });

    expect(() => validateLearningCompanionSafety(learningCompanionRequest, unsafe)).toThrow(
      /hidden-provider-action/,
    );
  });

  it("rejects unsafe or stale ProgramProposal output before canonical mutation", () => {
    const otherProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "move", steps: 20 }],
        },
      ],
    };
    const staleProposal = createProgramProposal({
      id: "stale-ai-proposal",
      baseProgram: otherProgram,
      source: { kind: "learning-companion", capability: "builder" },
      purpose: "Try one exact edit",
      rationale: "Provider proposed an edit against a different program.",
      affectedNodeIds: ["scripts[0]/statements[0]"],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[0]/statements[0]",
          field: "steps",
          value: 160,
        },
      ],
    });
    const unsafe = createLearningCompanionResponse({
      capability: "builder",
      message: "Here is a proposal to inspect.",
      nodeIds: ["scripts[0]/statements[0]"],
      concepts: ["sequence"],
      metadata: {
        capability: "builder",
        scaffoldLevel: 4,
        provenance: "remote-provider",
        uncertainty: "medium",
      },
      payload: {
        kind: "program-proposal",
        proposal: staleProposal,
        reviewState: "proposed",
        validation: { status: "valid", errors: [] },
        preview: { summary: "Change movement.", affectedNodeIds: ["scripts[0]/statements[0]"] },
      },
    });

    expect(() =>
      validateLearningCompanionSafety(
        { ...learningCompanionRequest, capability: "builder" },
        unsafe,
      ),
    ).toThrow(/unsafe-program-proposal/);
    expect(program.scripts[0]?.statements).toHaveLength(1);
  });

  it("rejects debugger facts that were not supplied as deterministic runtime evidence", () => {
    const unsafe = createLearningCompanionResponse({
      capability: "debugger",
      message: "Use runtime facts first.",
      nodeIds: ["scripts[0]/statements[0]"],
      concepts: ["sequence"],
      metadata: {
        capability: "debugger",
        scaffoldLevel: 3,
        provenance: "remote-provider",
        uncertainty: "medium",
      },
      payload: {
        kind: "evidence-grounded-debug",
        facts: [
          {
            id: "invented-fact",
            nodeId: "scripts[0]/statements[0]",
            fact: "The sprite secretly reached the goal.",
          },
        ],
        suggestions: ["Compare against observed runtime evidence."],
      },
    });

    expect(() =>
      validateLearningCompanionSafety(
        { ...learningCompanionRequest, capability: "debugger" },
        unsafe,
      ),
    ).toThrow(/context-provenance-mismatch/);
  });

  it("uses the same conformance assertion for local and remote-style providers", () => {
    const local = assertLearningCompanionProviderContract(
      "fake-local",
      () => learningCompanionResponse,
    );
    const remote = assertLearningCompanionProviderContract("remote-open-compatible", () => ({
      ...learningCompanionResponse,
      metadata: { ...learningCompanionResponse.metadata, provenance: "remote-provider" },
    }));

    expect(local.capability).toBe("coach");
    expect(remote.metadata.provenance).toBe("remote-provider");
  });

  it("keeps the contract package free of provider SDK dependencies", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const dependencyNames = Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    });

    expect(dependencyNames).not.toEqual(
      expect.arrayContaining(["openai", "@anthropic-ai/sdk", "ollama"]),
    );
  });
});
