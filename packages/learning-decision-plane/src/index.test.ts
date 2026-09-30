import { describe, expect, it } from "vitest";
import {
  projectLearningRequirements,
  resolveLearningSystem0,
  type LearningDecisionAnswer,
  type LearningDecisionState,
  type SolutionAllowance,
} from "./index.js";

function state(overrides: Partial<LearningDecisionState> = {}): LearningDecisionState {
  return {
    capability: "coach",
    scaffoldLevel: 1,
    scaffoldHistoryLength: 0,
    hasLearnerIntent: true,
    hasRuntime: false,
    runtimeFactCount: 0,
    selectedNodeCount: 0,
    offline: false,
    explicitStrongerHelpRequested: false,
    ...overrides,
  };
}

function system1<T extends string | number>(
  value: T,
  confidence = 0.99,
): LearningDecisionAnswer<T> {
  return { value, source: "system1", confidence, reason: "test-advisory" };
}

describe("Learning Decision Plane System-0", () => {
  it("keeps offline interactions deterministic without generative assistance", () => {
    const requirements = projectLearningRequirements(state({ offline: true }));
    expect(requirements.generativeNeeded).toBe("no");
    expect(requirements.reasoningTier).toBe("deterministic");
    expect(requirements.provenance.generativeNeeded).toBe("system0");
  });

  it("requires runtime evidence for debugger", () => {
    const answers = resolveLearningSystem0(state({ capability: "debugger", hasRuntime: true }));
    expect(answers.runtimeEvidenceNeeded?.value).toBe("yes");
    expect(answers.contextNeed?.value).toBe("runtime");
  });

  it("does not let Laya remove the debugger runtime-evidence floor", () => {
    const requirements = projectLearningRequirements(state({ capability: "debugger" }), {
      runtimeEvidenceNeeded: system1("no"),
      contextNeed: system1("none"),
    });
    expect(requirements.runtimeEvidenceNeeded).toBe("yes");
    expect(requirements.contextNeed).toBe("runtime");
  });

  it("does not allow a complete builder solution without deterministic permission", () => {
    const requirements = projectLearningRequirements(state({ capability: "builder", scaffoldLevel: 2 }), {
      solutionAllowance: system1<SolutionAllowance>("complete"),
    });
    expect(requirements.solutionAllowance).toBe("partial");
    expect(requirements.provenance.solutionAllowance).toBe("system0");
  });

  it("allows deterministic complete-solution permission only after explicit stronger help at high scaffold", () => {
    const requirements = projectLearningRequirements(
      state({
        capability: "builder",
        scaffoldLevel: 4,
        explicitStrongerHelpRequested: true,
      }),
      { solutionAllowance: system1<SolutionAllowance>("complete") },
    );
    expect(requirements.solutionAllowance).toBe("complete");
  });

  it("low-confidence advisory fails to safe defaults and cannot increase assistance", () => {
    const requirements = projectLearningRequirements(state({ scaffoldLevel: 2 }), {
      generativeNeeded: system1("no", 0.2),
      assistanceLevel: system1(5, 0.2),
      reasoningTier: system1("remote", 0.2),
    });
    expect(requirements.generativeNeeded).toBe("yes");
    expect(requirements.assistanceLevel).toBe(2);
    expect(requirements.reasoningTier).toBe("local");
    expect(requirements.provenance.generativeNeeded).toBe("fallback");
  });

  it("challenger and reflector keep assistance bounded even when advisory asks for more", () => {
    for (const capability of ["challenger", "reflector"] as const) {
      const requirements = projectLearningRequirements(state({ capability, scaffoldLevel: 5 }), {
        assistanceLevel: system1(5),
      });
      expect(requirements.assistanceLevel).toBe(2);
    }
  });

  it("never lets advisory change the requested capability at the foundation boundary", () => {
    const requirements = projectLearningRequirements(state({ capability: "debugger" }), {
      learningCapability: system1("builder"),
    });
    expect(requirements.learningCapability).toBe("debugger");
    expect(requirements.provenance.learningCapability).toBe("system0");
  });
});
