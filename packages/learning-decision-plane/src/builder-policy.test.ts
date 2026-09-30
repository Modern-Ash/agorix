import { describe, expect, it } from "vitest";
import { builderProposalPermission } from "./builder-policy.js";
import type { LearningRequirements } from "./index.js";

function requirements(overrides: Partial<LearningRequirements> = {}): LearningRequirements {
  return { schema: "agorix/learning-requirements/v1", generativeNeeded: "yes", clarificationNeeded: "no", assistanceLevel: 2, learningCapability: "builder", solutionAllowance: "partial", runtimeEvidenceNeeded: "no", contextNeed: "program", reasoningTier: "local", provenance: { generativeNeeded: "fallback", clarificationNeeded: "fallback", assistanceLevel: "fallback", learningCapability: "system0", solutionAllowance: "system0", runtimeEvidenceNeeded: "system0", contextNeed: "fallback", reasoningTier: "fallback" }, ...overrides };
}

describe("builder proposal policy", () => {
  it("forbids proposals for non-builder requirements", () => {
    expect(builderProposalPermission(requirements({ learningCapability: "coach", solutionAllowance: "none" }))).toBe("forbidden");
  });
  it("maps partial allowance to bounded proposal authority", () => {
    expect(builderProposalPermission(requirements())).toBe("bounded");
  });
  it("maps explicit complete allowance only to proposal permission, not application authority", () => {
    expect(builderProposalPermission(requirements({ solutionAllowance: "complete" }))).toBe("complete");
  });
});
