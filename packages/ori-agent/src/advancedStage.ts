import {
  runOriAdvanced,
  validateOriAdvancedProposal,
  type OriAdvancedContext,
  type OriAdvancedDecision,
} from "./advanced.js";
import { runOriReact, validateOriReactProposal, type OriReactContext } from "./advancedReact.js";
import type { OriTextModel } from "./index.js";

export type OriAdvancedStageContext = OriAdvancedContext | OriReactContext;

export function validateOriAdvancedStageProposal(
  context: OriAdvancedStageContext,
  proposal: unknown,
) {
  return context.stage === "scene"
    ? validateOriAdvancedProposal(context, proposal)
    : validateOriReactProposal(context, proposal);
}

export function runOriAdvancedStage(
  context: OriAdvancedStageContext,
  model?: OriTextModel,
): Promise<OriAdvancedDecision> {
  return context.stage === "scene" ? runOriAdvanced(context, model) : runOriReact(context, model);
}
