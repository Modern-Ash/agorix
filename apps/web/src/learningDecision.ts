import {
  projectLearningRequirements,
  stateFromLearningCompanionRequest,
  type LearningRequirements,
} from "@agorix/learning-decision-plane";
import type { LearningCompanionRequest } from "@agorix/tutor-contract";

export interface WebLearningDecisionDiagnostics {
  readonly capability: LearningRequirements["learningCapability"];
  readonly generativeNeeded: LearningRequirements["generativeNeeded"];
  readonly reasoningTier: LearningRequirements["reasoningTier"];
  readonly providerSelectionBypassed: boolean;
  readonly source: "system0-or-fallback";
}

export function decideStaticWebLearningRoute(request: LearningCompanionRequest): {
  readonly requirements: LearningRequirements;
  readonly diagnostics: WebLearningDecisionDiagnostics;
} {
  const state = stateFromLearningCompanionRequest(request);
  const requirements = projectLearningRequirements(state);
  return {
    requirements,
    diagnostics: {
      capability: requirements.learningCapability,
      generativeNeeded: requirements.generativeNeeded,
      reasoningTier: requirements.reasoningTier,
      providerSelectionBypassed:
        requirements.generativeNeeded === "no" || requirements.reasoningTier === "deterministic",
      source: "system0-or-fallback",
    },
  };
}
