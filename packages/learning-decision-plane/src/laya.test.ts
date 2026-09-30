import { describe, expect, it } from "vitest";
import { createLayaLearningProvider, evaluateLearningSystem1 } from "./index.js";
import type { LearningDecisionState } from "./index.js";

const STATE: LearningDecisionState = {
  capability: "coach",
  scaffoldLevel: 1,
  scaffoldHistoryLength: 0,
  hasLearnerIntent: true,
  hasRuntime: false,
  runtimeFactCount: 0,
  selectedNodeCount: 0,
  offline: false,
  explicitStrongerHelpRequested: false,
};

describe("Laya learning adapter", () => {
  it("maps bounded questions to an injected batch transport", async () => {
    let received: unknown;
    const provider = createLayaLearningProvider({
      async decideMany(input) {
        received = input;
        return [{ id: "generativeNeeded", value: "no", confidence: 0.99 }];
      },
    });

    const result = await evaluateLearningSystem1(STATE, provider, {
      unresolved: ["generativeNeeded"],
    });

    expect(result.decisions.generativeNeeded?.value).toBe("no");
    expect(received).toEqual({
      state: {
        capability: "coach",
        scaffoldLevel: 1,
        scaffoldHistoryLength: 0,
        hasLearnerIntent: true,
        hasRuntime: false,
        runtimeFactCount: 0,
        selectedNodeCount: 0,
        offline: false,
        explicitStrongerHelpRequested: false,
      },
      questions: [{ id: "generativeNeeded", type: "choice", choices: ["no", "yes"] }],
    });
  });

  it("ignores answers for questions that were not requested", async () => {
    const provider = createLayaLearningProvider({
      async decideMany() {
        return [
          { id: "generativeNeeded", value: "yes", confidence: 0.99 },
          { id: "reasoningTier", value: "remote", confidence: 1 },
        ];
      },
    });
    const result = await evaluateLearningSystem1(STATE, provider, {
      unresolved: ["generativeNeeded"],
    });
    expect(result.accepted).toEqual(["generativeNeeded"]);
    expect(result.decisions.reasoningTier).toBeUndefined();
  });
});
