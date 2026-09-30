import { describe, expect, it } from "vitest";
import {
  compactLearningState,
  createMemoryLearningDecisionCache,
  evaluateLearningSystem1,
  projectLearningRequirements,
  resolveLearningSystem0,
  type LearningDecisionState,
  type LearningSystem1Provider,
} from "./index.js";

function state(overrides: Partial<LearningDecisionState> = {}): LearningDecisionState {
  return {
    capability: "coach",
    scaffoldLevel: 2,
    scaffoldHistoryLength: 1,
    hasLearnerIntent: true,
    hasRuntime: false,
    runtimeFactCount: 0,
    selectedNodeCount: 1,
    offline: false,
    explicitStrongerHelpRequested: false,
    ...overrides,
  };
}

function provider(
  answers: Record<string, { value: string | number; confidence: number }>,
): LearningSystem1Provider & { calls: number } {
  return {
    id: "laya-local",
    calls: 0,
    async decideMany(_state, questions) {
      this.calls += 1;
      return questions.flatMap((question) => {
        const answer = answers[question.id];
        return answer === undefined
          ? []
          : [{ questionId: question.id, value: answer.value, confidence: answer.confidence }];
      });
    },
  };
}

describe("Learning System-1 adapter", () => {
  it("sends only compact typed state and no learner free text", () => {
    const compact = compactLearningState(state());
    expect(Object.keys(compact).sort()).toEqual(
      [
        "capability",
        "explicitStrongerHelpRequested",
        "hasLearnerIntent",
        "hasRuntime",
        "offline",
        "runtimeFactCount",
        "scaffoldHistoryLength",
        "scaffoldLevel",
        "selectedNodeCount",
      ].sort(),
    );
    expect(JSON.stringify(compact)).not.toContain("learner");
  });

  it("accepts confident typed decisions and abstains below per-question thresholds", async () => {
    const result = await evaluateLearningSystem1(
      state(),
      provider({
        generativeNeeded: { value: "no", confidence: 0.99 },
        assistanceLevel: { value: 5, confidence: 0.5 },
      }),
      { unresolved: ["generativeNeeded", "assistanceLevel"] },
    );
    expect(result.decisions.generativeNeeded?.value).toBe("no");
    expect(result.decisions.assistanceLevel).toBeUndefined();
    expect(result.accepted).toEqual(["generativeNeeded"]);
    expect(result.abstained).toEqual(["assistanceLevel"]);
  });

  it("abstains on malformed choice instead of coercing it", async () => {
    const result = await evaluateLearningSystem1(
      state(),
      provider({ reasoningTier: { value: "frontier", confidence: 1 } }),
      { unresolved: ["reasoningTier"] },
    );
    expect(result.decisions.reasoningTier).toBeUndefined();
    expect(result.abstained).toEqual(["reasoningTier"]);
  });

  it("fails safely when Laya is unavailable", async () => {
    const unavailable: LearningSystem1Provider = {
      id: "laya-local",
      async decideMany() {
        throw new Error("offline");
      },
    };
    const result = await evaluateLearningSystem1(state(), unavailable, {
      unresolved: ["generativeNeeded"],
    });
    expect(result.providerAvailable).toBe(false);
    expect(result.decisions).toEqual({});
    expect(result.abstained).toEqual(["generativeNeeded"]);
  });

  it("reuses decisions for an unchanged non-PII snapshot", async () => {
    const p = provider({ generativeNeeded: { value: "yes", confidence: 0.99 } });
    const cache = createMemoryLearningDecisionCache();
    const options = { cache, unresolved: ["generativeNeeded"] as const };
    const first = await evaluateLearningSystem1(state(), p, options);
    const second = await evaluateLearningSystem1(state(), p, options);
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(p.calls).toBe(1);
  });

  it("keeps deterministic scaffolding floors over conflicting System-1 answers", async () => {
    const s = state({ capability: "builder", scaffoldLevel: 2 });
    const evaluation = await evaluateLearningSystem1(
      s,
      provider({
        solutionAllowance: { value: "complete", confidence: 0.99 },
        assistanceLevel: { value: 5, confidence: 0.99 },
      }),
      { unresolved: ["solutionAllowance", "assistanceLevel"] },
    );
    const requirements = projectLearningRequirements(s, evaluation.decisions);
    expect(requirements.solutionAllowance).toBe("partial");
    expect(requirements.assistanceLevel).toBe(2);
  });

  it("supports debugger fixture while System-0 retains runtime-evidence authority", async () => {
    const s = state({ capability: "debugger", hasRuntime: true, runtimeFactCount: 3 });
    const system0 = resolveLearningSystem0(s);
    const evaluation = await evaluateLearningSystem1(
      s,
      provider({ generativeNeeded: { value: "yes", confidence: 0.99 } }),
      { unresolved: ["generativeNeeded"] },
    );
    const requirements = projectLearningRequirements(s, evaluation.decisions);
    expect(system0.runtimeEvidenceNeeded?.value).toBe("yes");
    expect(requirements.runtimeEvidenceNeeded).toBe("yes");
    expect(requirements.contextNeed).toBe("runtime");
  });
});
