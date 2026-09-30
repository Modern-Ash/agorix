import { describe, expect, it } from "vitest";
import { createLearningCompanionRequest } from "@agorix/tutor-contract";
import {
  createLayaLearningProvider,
  evaluateLearningSystem1,
  projectLearningRequirements,
  resolveLearningSystem0,
  stateFromLearningCompanionRequest,
} from "./index.js";

describe("Laya release integration", () => {
  it("runs real Laya adapter + System-1 thresholds + LearningRequirements projection", async () => {
    const request = createLearningCompanionRequest({
      capability: "explainer",
      mission: {
        id: "first",
        version: 1,
        concepts: ["movement"],
        learningObjective: "Understand movement",
      },
      program: {
        schema: "agorix/program/v1",
        scripts: [{
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "move", steps: 24 }],
        }],
      },
      selectedNodeIds: ["scripts[0]/statements[0]"],
      runtimeFacts: [],
      scaffoldHistory: [],
    });
    const state = stateFromLearningCompanionRequest(request);
    const system0 = resolveLearningSystem0(state);
    const unresolved = [
      "generativeNeeded",
      "clarificationNeeded",
      "assistanceLevel",
      "solutionAllowance",
      "runtimeEvidenceNeeded",
      "reasoningTier",
    ] as const;

    const laya = createLayaLearningProvider({
      async decideMany({ questions }) {
        const values: Record<string, string | number> = {
          generativeNeeded: "yes",
          clarificationNeeded: "no",
          assistanceLevel: 1,
          solutionAllowance: "none",
          runtimeEvidenceNeeded: "no",
          reasoningTier: "local",
        };
        return questions.map((question) => ({
          id: question.id,
          value: values[question.id]!,
          confidence: 0.99,
        }));
      },
    });

    const evaluation = await evaluateLearningSystem1(state, laya, { unresolved });
    const requirements = projectLearningRequirements(state, {
      ...system0,
      ...evaluation.decisions,
    });

    expect(evaluation.providerAvailable).toBe(true);
    expect(evaluation.abstained).toEqual([]);
    expect(evaluation.accepted).toEqual(unresolved);
    expect(requirements).toMatchObject({
      learningCapability: "explainer",
      contextNeed: "program",
      generativeNeeded: "yes",
      reasoningTier: "local",
      solutionAllowance: "none",
    });
    expect(requirements.provenance.generativeNeeded).toBe("system1");
    expect(requirements.provenance.contextNeed).toBe("system0");
  });

  it("abstains below confidence and preserves safe projection fallback", async () => {
    const request = createLearningCompanionRequest({
      capability: "coach",
      mission: { id: "first", version: 1, concepts: ["movement"], learningObjective: "Move" },
      program: { schema: "agorix/program/v1", scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }] },
      selectedNodeIds: [],
      runtimeFacts: [],
      scaffoldHistory: [],
    });
    const state = stateFromLearningCompanionRequest(request);
    const laya = createLayaLearningProvider({
      async decideMany({ questions }) {
        return questions.map((question) => ({
          id: question.id,
          value: question.choices[0]!,
          confidence: 0.1,
        }));
      },
    });
    const evaluation = await evaluateLearningSystem1(state, laya);
    expect(evaluation.accepted).toEqual([]);
    expect(evaluation.abstained.length).toBeGreaterThan(0);
    expect(projectLearningRequirements(state, evaluation.decisions).solutionAllowance).toBe("none");
  });
});
