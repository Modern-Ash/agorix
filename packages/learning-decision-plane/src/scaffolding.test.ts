import { describe, expect, it } from "vitest";
import { resolveScaffoldingPolicy } from "./index.js";

describe("adaptive scaffolding policy", () => {
  it("forbids a complete solution on the first Explore interaction", () => {
    const policy = resolveScaffoldingPolicy({ stage: "explore", requestedCapability: "builder", attemptCount: 0, priorHintLevels: [], strongerHelpRequested: false, lessHelpRequested: false, hasRuntimeEvidence: false, priorProposalDecisions: [] });
    expect(policy.maximumAssistanceLevel).toBe(2);
    expect(policy.solutionAllowance).toBe("partial");
  });

  it("escalates predictably after repeated attempts but stays bounded", () => {
    const policy = resolveScaffoldingPolicy({ stage: "connect", requestedCapability: "coach", attemptCount: 3, priorHintLevels: [1, 2], strongerHelpRequested: false, lessHelpRequested: false, hasRuntimeEvidence: true, priorProposalDecisions: [] });
    expect(policy.maximumAssistanceLevel).toBe(4);
    expect(policy.solutionAllowance).toBe("none");
  });

  it("allows complete builder help only after repeated failure and explicit stronger-help request", () => {
    const policy = resolveScaffoldingPolicy({ stage: "collaborate", requestedCapability: "builder", attemptCount: 3, priorHintLevels: [2, 3], strongerHelpRequested: true, lessHelpRequested: false, hasRuntimeEvidence: true, priorProposalDecisions: ["modified"] });
    expect(policy.maximumAssistanceLevel).toBe(5);
    expect(policy.solutionAllowance).toBe("complete");
    expect(policy.requiredLearnerPrompt).toBe("prediction");
  });

  it("honors a request for less help", () => {
    const policy = resolveScaffoldingPolicy({ stage: "create", requestedCapability: "explainer", attemptCount: 0, priorHintLevels: [], strongerHelpRequested: false, lessHelpRequested: true, hasRuntimeEvidence: false, priorProposalDecisions: [] });
    expect(policy.maximumAssistanceLevel).toBe(3);
  });

  it("requires prediction/reflection for the corresponding learning roles", () => {
    const base = { stage: "connect" as const, attemptCount: 1, priorHintLevels: [1] as const, strongerHelpRequested: false, lessHelpRequested: false, hasRuntimeEvidence: true, priorProposalDecisions: [] as const };
    expect(resolveScaffoldingPolicy({ ...base, requestedCapability: "challenger" }).requiredLearnerPrompt).toBe("prediction");
    expect(resolveScaffoldingPolicy({ ...base, requestedCapability: "reflector" }).requiredLearnerPrompt).toBe("reflection");
  });
});
