import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programSemanticHash } from "@agorix/proposals";
import {
  INTENT_PLAN_AUDIT_SCHEMA_VERSION,
  INTENT_PLAN_REQUEST_SCHEMA_VERSION,
  INTENT_PLAN_RESPONSE_SCHEMA_VERSION,
  INTENT_PLAN_SCHEMA_VERSION,
  MAX_INTENT_PLAN_STEPS,
  IntentPlanValidationError,
  acceptIntentPlan,
  createDeterministicIntentPlan,
  createIntentPlanCardView,
  createIntentPlanRequest,
  createIntentPlanResponse,
  editIntentPlanStep,
  parseIntentPlanResponse,
  rejectIntentPlan,
  validateIntentPlan,
  validateIntentPlanRequest,
  validateIntentPlanResponse,
  type IntentPlan,
  type IntentPlanRequest,
  type IntentPlanResponse,
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

function request(learnerIntent: string, overrides: Partial<IntentPlanRequest> = {}) {
  return createIntentPlanRequest({
    learnerIntent,
    mission: {
      id: "first-mission.reach-goal",
      version: 1,
      learningObjective: "Reach the goal by ordering blocks the runtime can prove.",
      concepts: ["sequence", "events", "movement"],
    },
    program,
    selectedNodeIds: [],
    priorClarifications: [],
    reading: { locale: "en", readingLevel: "middle-grade" },
    ...overrides,
  });
}

function planFrom(learnerIntent: string, overrides: Partial<IntentPlanRequest> = {}): IntentPlan {
  const response = createDeterministicIntentPlan(request(learnerIntent, overrides));
  expect(response.kind).toBe("plan");
  if (response.kind !== "plan") {
    throw new Error(`expected a plan, received ${response.kind}`);
  }
  return response.plan;
}

function clarificationFrom(
  learnerIntent: string,
  overrides: Partial<IntentPlanRequest> = {},
): IntentPlanResponse & { readonly kind: "clarification" } {
  const response = createDeterministicIntentPlan(request(learnerIntent, overrides));
  expect(response.kind).toBe("clarification");
  if (response.kind !== "clarification") {
    throw new Error(`expected a clarification, received ${response.kind}`);
  }
  return response;
}

describe("intent-to-plan contract (issue #86)", () => {
  it("keeps request, response, plan and audit schemas versioned and provider-free", () => {
    const plan = planFrom("move toward the goal");

    expect(request("move toward the goal").schema).toBe(INTENT_PLAN_REQUEST_SCHEMA_VERSION);
    expect(plan.schema).toBe(INTENT_PLAN_SCHEMA_VERSION);
    expect(createDeterministicIntentPlan(request("move toward the goal")).schema).toBe(
      INTENT_PLAN_RESPONSE_SCHEMA_VERSION,
    );
    expect(rejectIntentPlan(program, plan).audit.schema).toBe(INTENT_PLAN_AUDIT_SCHEMA_VERSION);
    expect(JSON.stringify(plan)).not.toMatch(/openai|ollama|claude|gpt|apiKey|token/i);
  });

  it("rejects a request that smuggles provider-specific fields", () => {
    expect(() =>
      validateIntentPlanRequest({
        ...request("move toward the goal"),
        temperature: 0.2,
      } as unknown as IntentPlanRequest),
    ).toThrowError(IntentPlanValidationError);
  });
});

describe("AC-001 clear intent progresses without unnecessary questions", () => {
  it("plans a single clear action with no clarification", () => {
    const response = createDeterministicIntentPlan(request("move toward the goal"));

    expect(response.kind).toBe("plan");
    expect(response.metadata.questionsAsked).toBe(0);
    if (response.kind !== "plan") {
      throw new Error("expected a plan");
    }
    expect(response.plan.steps).toHaveLength(1);
    expect(response.plan.steps[0]?.description).toBe("move toward the goal");
  });

  it("decomposes an ordered multi-step intent without asking anything", () => {
    const plan = planFrom("move toward the goal then turn then check if it touches the goal");

    expect(plan.steps.map((step) => step.description)).toEqual([
      "move toward the goal",
      "turn",
      "check if it touches the goal",
    ]);
    expect(plan.steps.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(plan.omittedSteps).toBe(0);
  });

  it("still plans after earlier clarifications were answered", () => {
    const plan = planFrom("move toward the goal then turn", {
      priorClarifications: ["What should your sprite do first?"],
    });

    expect(plan.status).toBe("proposed");
    expect(plan.steps).toHaveLength(2);
  });
});

describe("AC-002 ambiguous intent triggers a pedagogically useful clarification", () => {
  it("asks one ordering question when actions are joined without an order", () => {
    const response = clarificationFrom("move toward the goal and turn");

    expect(response.clarification.reason).toBe("ambiguous-order");
    expect(response.clarification.question).toBe("You said two things: which one happens first?");
    expect(response.clarification.options).toEqual(["move toward the goal", "turn"]);
    expect(response.metadata.questionsAsked).toBe(1);
  });

  it("asks what should happen when the intent names no action at all", () => {
    const response = clarificationFrom("make it cooler");

    expect(response.clarification.reason).toBe("missing-action");
    expect(response.clarification.question).toBe("What should your sprite do first?");
    expect(response.clarification.options).toContain("move toward the goal");
    expect(response.clarification.options).toContain("check if it touches the goal");
  });

  it("asks for an exact outcome when the learner only describes a quality", () => {
    const response = clarificationFrom("move but make it better");

    expect(response.clarification.reason).toBe("vague-outcome");
    expect(response.clarification.question).toBe("What has to happen on the stage, exactly?");
  });

  it("rejects learner-facing text that asks for personal data or hides provider actions", () => {
    const clarification = {
      reason: "missing-action",
      question: "Tell me your full name first",
      options: ["move toward the goal"],
    } as const;

    expect(() =>
      validateIntentPlanResponse({
        schema: INTENT_PLAN_RESPONSE_SCHEMA_VERSION,
        kind: "clarification",
        message: clarification.question,
        metadata: { provenance: "deterministic-fake", uncertainty: "medium", questionsAsked: 1 },
        clarification,
      }),
    ).toThrow(/pii-request/);

    const plan = planFrom("move toward the goal");
    expect(() =>
      validateIntentPlanResponse({
        schema: INTENT_PLAN_RESPONSE_SCHEMA_VERSION,
        kind: "plan",
        message: "Here is your plan.",
        metadata: { provenance: "deterministic-fake", uncertainty: "low", questionsAsked: 0 },
        plan: {
          ...plan,
          steps: plan.steps.map((step, index) =>
            index === 0 ? { ...step, description: "move after a hidden tool_call" } : step,
          ),
        },
      }),
    ).toThrow(/hidden-provider-action/);
  });
});

describe("AC-003 planning performs no canonical mutation", () => {
  it("leaves the canonical program byte-identical while planning", () => {
    const before = structuredClone(program);
    const beforeHash = programSemanticHash(program);

    createDeterministicIntentPlan(request("move toward the goal then turn"));

    expect(program).toEqual(before);
    expect(programSemanticHash(program)).toBe(beforeHash);
  });

  it("anchors the plan to the current canonical hash", () => {
    const plan = planFrom("move toward the goal then turn");

    expect(plan.baseProgramHash).toBe(programSemanticHash(program));
  });

  it("anchors plans to the Mission Spec hash when the request has one", () => {
    const withSpec = planFrom("move toward the beacon", {
      missionSpecHash: "mission:abcd1234",
      mission: {
        id: "first-mission.reach-goal",
        version: 1,
        learningObjective: "Guide the rocket to the beacon.",
        concepts: ["sequence", "events", "movement"],
      },
    });
    const withoutSpec = planFrom("move toward the beacon");

    expect(withSpec.missionSpecHash).toBe("mission:abcd1234");
    expect(withSpec.learningObjective).toBe("Guide the rocket to the beacon.");
    expect(withSpec.id).not.toBe(withoutSpec.id);
  });

  it("keeps the program unchanged across edit, accept and reject decisions", () => {
    const before = structuredClone(program);
    const plan = planFrom("move toward the goal then turn");
    const stepId = plan.steps[0]?.id ?? "";

    const edited = editIntentPlanStep(program, plan, stepId, "move two steps at a time");
    const accepted = acceptIntentPlan(program, edited.plan);
    const rejected = rejectIntentPlan(program, accepted.plan);

    for (const result of [edited, accepted, rejected]) {
      expect(result.program).toEqual(before);
      expect(programSemanticHash(result.program)).toBe(plan.baseProgramHash);
    }
    expect(program).toEqual(before);
  });

  it("records every learner decision in an audit event", () => {
    const plan = planFrom("move toward the goal then turn");
    const stepId = plan.steps[0]?.id ?? "";
    const edited = editIntentPlanStep(program, plan, stepId, "move two steps at a time");

    expect(edited.audit).toEqual({
      schema: INTENT_PLAN_AUDIT_SCHEMA_VERSION,
      planId: plan.id,
      decision: "edit",
      baseProgramHash: plan.baseProgramHash,
      programHash: plan.baseProgramHash,
      revision: 2,
    });
  });
});

describe("AC-004 plan references the learning objective and concepts where relevant", () => {
  it("repeats the learning objective and the concepts the mission teaches", () => {
    const plan = planFrom("move toward the goal then turn");

    expect(plan.learningObjective).toBe("Reach the goal by ordering blocks the runtime can prove.");
    expect(plan.concepts).toEqual(["movement", "sequence", "events"]);
    expect(plan.steps.map((step) => step.concept)).toEqual(["movement", "movement"]);
  });

  it("links a step to the canonical node it maps to", () => {
    const plan = planFrom("move toward the goal");

    expect(plan.steps[0]?.nodeId).toBe("scripts[0]/statements[0]");
    expect(plan.steps[0]?.rationale).toBe("This step practices movement.");
  });

  it("omits a concept when the step does not map to one the mission teaches", () => {
    const plan = planFrom("repeat a movement", {
      mission: {
        id: "first-mission.reach-goal",
        version: 1,
        learningObjective: "Reach the goal by ordering blocks the runtime can prove.",
        concepts: ["movement"],
      },
    });

    expect(plan.steps[0]?.concept).toBeUndefined();
    expect(plan.concepts).toEqual(["movement"]);
  });

  it("keeps a learner clause the planner does not recognise, without inventing a concept", () => {
    const plan = planFrom("move toward the goal then draw a rainbow");

    expect(plan.steps[1]?.description).toBe("draw a rainbow");
    expect(plan.steps[1]?.concept).toBeUndefined();
    expect(plan.steps[1]?.rationale).toBe("This idea is yours: you decide how to build it.");
  });
});

describe("AC-005 the learner can edit or reject the plan", () => {
  it("lets the learner rewrite a step in their own words and keeps the plan editable", () => {
    const plan = planFrom("move toward the goal then turn");
    const stepId = plan.steps[1]?.id ?? "";
    const result = editIntentPlanStep(program, plan, stepId, "  turn left  ");

    expect(result.plan.status).toBe("proposed");
    expect(result.plan.revision).toBe(2);
    expect(result.plan.steps[1]?.description).toBe("turn left");
    expect(result.plan.steps[0]?.description).toBe("move toward the goal");
  });

  it("lets the learner reject the plan", () => {
    const plan = planFrom("move toward the goal then turn");
    const result = rejectIntentPlan(program, plan);

    expect(result.plan.status).toBe("rejected");
    expect(result.audit.decision).toBe("reject");
  });

  it("records acceptance without mutating the canonical program", () => {
    const plan = planFrom("move toward the goal then turn");
    const result = acceptIntentPlan(program, plan);

    expect(result.plan.status).toBe("accepted");
    expect(result.program).toEqual(program);
  });

  it("refuses to edit or accept a decided plan", () => {
    const plan = planFrom("move toward the goal then turn");
    const rejected = rejectIntentPlan(program, plan).plan;

    expect(() =>
      editIntentPlanStep(program, rejected, rejected.steps[0]?.id ?? "", "nope"),
    ).toThrow(/PLAN_NOT_EDITABLE/);
    expect(() => acceptIntentPlan(program, rejected)).toThrow(/PLAN_NOT_EDITABLE/);
  });

  it("refuses an unknown step id", () => {
    expect(() =>
      editIntentPlanStep(program, planFrom("move toward the goal"), "nope", "x"),
    ).toThrow(/UNKNOWN_STEP/);
  });

  it("refuses to accept a plan anchored to a different canonical program", () => {
    const plan = planFrom("move toward the goal");
    const changed: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "move", steps: 99 }],
        },
      ],
    };

    expect(() => acceptIntentPlan(changed, plan)).toThrow(/STALE_PLAN/);
  });

  it("offers only the learner actions the current status allows", () => {
    const plan = planFrom("move toward the goal");
    const rejected = rejectIntentPlan(program, plan).plan;

    expect(createIntentPlanCardView(plan).actions).toEqual(["edit", "confirm", "reject"]);
    expect(createIntentPlanCardView(rejected).actions).toEqual(["reject"]);
  });
});

describe("AC-006 the deterministic fake supports test scenarios", () => {
  it("returns the same plan for the same request", () => {
    const first = createDeterministicIntentPlan(request("move toward the goal then turn"));
    const second = createDeterministicIntentPlan(request("move toward the goal then turn"));

    expect(second).toEqual(first);
  });

  it("marks every fake response with deterministic provenance and no credentials", () => {
    const plan = createDeterministicIntentPlan(request("move toward the goal"));
    const clarification = createDeterministicIntentPlan(request("make it cooler"));

    expect(plan.metadata.provenance).toBe("deterministic-fake");
    expect(clarification.metadata.provenance).toBe("deterministic-fake");
    expect(JSON.stringify([plan, clarification])).not.toMatch(/apiKey|bearer|password/i);
  });

  it("reports honest uncertainty when a clause could not be interpreted", () => {
    const concrete = planFrom("move toward the goal then turn");
    const partlyUnknown = planFrom("move toward the goal then draw a rainbow");

    expect(concrete.steps.every((step) => step.concept !== undefined)).toBe(true);
    expect(partlyUnknown.steps[1]?.concept).toBeUndefined();
    expect(
      createDeterministicIntentPlan(request("move toward the goal then draw a rainbow")).metadata
        .uncertainty,
    ).toBe("medium");
  });

  it("caps the plan deterministically and reports the clauses it held back", () => {
    const clauses = Array.from(
      { length: MAX_INTENT_PLAN_STEPS + 2 },
      (_, index) => `turn ${index}`,
    );
    const plan = planFrom(clauses.join(" then "));

    expect(plan.steps).toHaveLength(MAX_INTENT_PLAN_STEPS);
    expect(plan.omittedSteps).toBe(2);
  });

  it("scenarios are locale-aware without changing the contract", () => {
    const spanishReading = { locale: "es-MX" };

    expect(planFrom("mover hacia la meta", { reading: spanishReading }).steps[0]?.rationale).toBe(
      "Este paso practica movimiento.",
    );
    expect(
      planFrom("mover hacia la meta luego girar", { reading: spanishReading }).steps,
    ).toHaveLength(2);
    expect(
      clarificationFrom("mover hacia la meta y girar", { reading: spanishReading }).clarification
        .question,
    ).toBe("Diste dos cosas: ¿cuál pasa primero?");
  });
});

describe("intent-plan validation", () => {
  it("round-trips a parsed response from an untrusted source", () => {
    const response = createDeterministicIntentPlan(request("move toward the goal"));

    expect(parseIntentPlanResponse(JSON.parse(JSON.stringify(response)))).toEqual(response);
  });

  it("rejects a response with provider-specific fields", () => {
    const response = createIntentPlanResponse({
      kind: "plan",
      message: "Here is your plan.",
      metadata: { provenance: "deterministic-fake", uncertainty: "low", questionsAsked: 0 },
      plan: planFrom("move toward the goal"),
    });

    expect(() =>
      validateIntentPlanResponse({ ...response, model: "gpt-4o" } as unknown as IntentPlanResponse),
    ).toThrowError(/unexpected provider-specific field/);
  });

  it("rejects a plan whose steps are out of order", () => {
    const plan = planFrom("move toward the goal then turn");

    expect(() =>
      validateIntentPlan({
        ...plan,
        steps: plan.steps.map((step, index) => ({ ...step, order: plan.steps.length - index })),
      }),
    ).toThrow(/INVALID_PLAN/);
  });

  it("rejects a clarification without child-choosable options", () => {
    expect(() =>
      validateIntentPlanResponse({
        schema: INTENT_PLAN_RESPONSE_SCHEMA_VERSION,
        kind: "clarification",
        message: "What should your sprite do first?",
        metadata: { provenance: "deterministic-fake", uncertainty: "medium", questionsAsked: 1 },
        clarification: {
          reason: "missing-action",
          question: "What should your sprite do first?",
          options: [],
        },
      }),
    ).toThrow(/INVALID_CLARIFICATION/);
  });

  it("rejects a request without a learner intent", () => {
    expect(() => createIntentPlanRequest({ ...request("move"), learnerIntent: "  " })).toThrow(
      /INVALID_REQUEST/,
    );
  });
});

describe("provider text is plain text only", () => {
  it("rejects a link or markup in an intent plan step", () => {
    const plan = planFrom("move toward the goal");
    for (const bad of [
      "see https://example.test/solution",
      "<b>move</b> now",
      "go to www.example.test",
    ]) {
      expect(() =>
        validateIntentPlanResponse({
          schema: INTENT_PLAN_RESPONSE_SCHEMA_VERSION,
          kind: "plan",
          message: "Here is your plan.",
          metadata: { provenance: "deterministic-fake", uncertainty: "low", questionsAsked: 0 },
          plan: {
            ...plan,
            steps: plan.steps.map((step, index) =>
              index === 0 ? { ...step, description: bad } : step,
            ),
          },
        }),
      ).toThrow(/active-content/);
    }
  });
});
