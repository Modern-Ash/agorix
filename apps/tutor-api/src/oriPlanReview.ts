import type { OriExternalShadowInput } from "./oriExternalShadow.js";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";
import type { OriShadowPlan } from "./oriShadowPlanValidation.js";

/**
 * Internal adult-review boundary. Never expose the returned plan in Kids.
 * Formatting baseline is enforced by repository Prettier.
 * This does not authenticate an adult: callers must enforce that separately.
 */
export interface OriPlanReviewResult {
  readonly status: "ready" | "unavailable";
  readonly plan: OriShadowPlan | null;
  readonly appliedChanges: false;
}
export function createOriPlanReview(
  consumer: OriPlanConsumer,
  enabled: boolean,
): (input: OriExternalShadowInput) => Promise<OriPlanReviewResult> {
  return async (input) => {
    if (!enabled)
      return Object.freeze({ status: "unavailable", plan: null, appliedChanges: false });
    try {
      const plan = await consumer.evaluate(input);
      if (!plan)
        return Object.freeze({ status: "unavailable", plan: null, appliedChanges: false });
      return Object.freeze({ status: "ready", plan, appliedChanges: false });
    } catch {
      return Object.freeze({ status: "unavailable", plan: null, appliedChanges: false });
    }
  };
}
