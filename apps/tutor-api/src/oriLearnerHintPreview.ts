import type { OriExternalShadowInput } from "./oriExternalShadow.js";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";
import { validateOriShadowPlan } from "./oriShadowPlanValidation.js";

/**
 * Opt-in internal pedagogical preview for Agorix learners.
 * This does not register a route, render UI, or mutate learner programs.
 */
export interface OriLearnerHintPreview {
  readonly status: "ready" | "unavailable";
  readonly hint?: string;
  readonly nextStep?: string;
  readonly requiresLearnerApproval: true;
  readonly appliedChanges: false;
}
const unavailable: OriLearnerHintPreview = Object.freeze({
  status: "unavailable",
  requiresLearnerApproval: true,
  appliedChanges: false,
});
export function createOriLearnerHintPreview(
  consumer: OriPlanConsumer,
  enabled = false,
): (input: OriExternalShadowInput) => Promise<OriLearnerHintPreview> {
  return async (input) => {
    if (!enabled) return unavailable;
    try {
      const plan = await consumer.evaluate(input);
      if (
        !plan ||
        !validateOriShadowPlan(plan) ||
        plan.stage !== input.hintLevel ||
        plan.context.missionStage !== input.missionIndex
      )
        return unavailable;
      return Object.freeze({
        status: "ready",
        hint: plan.hint,
        nextStep: plan.steps[0],
        requiresLearnerApproval: true,
        appliedChanges: false,
      });
    } catch {
      return unavailable;
    }
  };
}
