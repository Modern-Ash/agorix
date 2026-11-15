import {
  createStudioSignal,
  stateFromLearningCompanionRequest,
  type StudioPipeline,
} from "@agorix/learning-decision-plane";
import { programSemanticHash } from "@agorix/proposals";
import type { LearningCompanionResponse } from "@agorix/tutor-contract";
import {
  createCompanionRequest,
  type StudioCompanionAction,
  type StudioCompanionOptions,
  type StudioProject,
} from "./studioCore.js";
import type { StudioProviderClient } from "./studioProvider.js";

/** Explicit learner requests share the proposal pipeline's policy and request budget. */
export function createTeachingSource(options: {
  readonly pipeline: StudioPipeline;
  readonly client: StudioProviderClient | undefined;
}): {
  request(
    project: StudioProject,
    action: Exclude<StudioCompanionAction, "build">,
    context: StudioCompanionOptions,
  ): Promise<LearningCompanionResponse | undefined>;
} {
  let sequence = 0;
  return {
    async request(project, action, context) {
      if (!options.client) return undefined;
      try {
        const request = createCompanionRequest(project, action, context);
        const signal = createStudioSignal("selection-changed", ++sequence);
        if (!signal) return undefined;
        const programHash = programSemanticHash(project.stored.program);
        const decision = await options.pipeline.decide({
          signal,
          state: stateFromLearningCompanionRequest(request, {
            explicitStrongerHelpRequested: true,
          }),
          programHash,
          locale: project.stored.metadata.locale ?? "en",
        });
        if (!decision.providerRequestAllowed) return undefined;
        const outcome = await options.client.request(request);
        if (outcome.status !== "response") return undefined;
        if (outcome.response.capability !== request.capability) return undefined;
        if (outcome.response.metadata.provenance === "deterministic-fake") return undefined;
        return outcome.response;
      } catch {
        return undefined;
      }
    },
  };
}
