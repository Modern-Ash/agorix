import {
  runOriAdvanced,
  validateOriAdvancedProposal,
  type OriAdvancedContext,
  type OriAdvancedDecision,
} from "./advanced.js";
import { runOriReact, validateOriReactProposal, type OriReactContext } from "./advancedReact.js";
import { runOriScore, validateOriScoreProposal, type OriScoreContext } from "./advancedScore.js";
import type { OriTextModel } from "./index.js";

export type OriAdvancedStageContext = OriAdvancedContext | OriReactContext | OriScoreContext;

export function validateOriAdvancedStageProposal(
  context: OriAdvancedStageContext,
  proposal: unknown,
) {
  return context.stage === "scene"
    ? validateOriAdvancedProposal(context, proposal)
    : context.stage === "react"
      ? validateOriReactProposal(context, proposal)
      : validateOriScoreProposal(context, proposal);
}

export function runOriAdvancedStage(
  context: OriAdvancedStageContext,
  model?: OriTextModel,
): Promise<OriAdvancedDecision> {
  return context.stage === "scene"
    ? runOriAdvanced(context, model)
    : context.stage === "react"
      ? runOriReact(context, model)
      : runOriScore(context, model);
}
