import {
  createLayaLearningProvider,
  evaluateLearningSystem1,
  projectLearningRequirements,
  stateFromLearningCompanionRequest,
  system0LearningDecisions,
  unresolvedLearningQuestions,
  type LayaBatchTransport,
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

export function decideStaticWebLearningRoute(
  request: LearningCompanionRequest,
): {
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


export async function decideWebLearningRouteWithLaya(
  request: LearningCompanionRequest,
  transport: LayaBatchTransport,
): Promise<{
  readonly requirements: LearningRequirements;
  readonly diagnostics: WebLearningDecisionDiagnostics & {
    readonly source: "laya-system1";
    readonly accepted: readonly string[];
    readonly abstained: readonly string[];
  };
}> {
  const state = stateFromLearningCompanionRequest(request);
  const system0 = system0LearningDecisions(state);
  const unresolved = unresolvedLearningQuestions(system0);
  const evaluation = await evaluateLearningSystem1(
    state,
    createLayaLearningProvider(transport),
    { unresolved },
  );
  const requirements = projectLearningRequirements(state, {
    ...system0,
    ...evaluation.decisions,
  });
  return {
    requirements,
    diagnostics: {
      capability: requirements.learningCapability,
      generativeNeeded: requirements.generativeNeeded,
      reasoningTier: requirements.reasoningTier,
      providerSelectionBypassed:
        requirements.generativeNeeded === "no" || requirements.reasoningTier === "deterministic",
      source: "laya-system1",
      accepted: evaluation.accepted,
      abstained: evaluation.abstained,
    },
  };
}
