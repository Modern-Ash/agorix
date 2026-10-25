import type { OriExternalShadowInput } from "./oriExternalShadow.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";

/**
 * Host-owned authorization boundary for future adult-only diagnostics.
 * This is NOT an HTTP endpoint, nor a substitute for authenticated sessions.
 */
export interface OriAdultReviewPolicy {
  readonly enabled: boolean;
  readonly role: "educator" | "administrator" | "learner" | "anonymous";
  readonly authorizedMissionIndices: readonly number[];
}
export function mayReviewOriPlan(
  policy: OriAdultReviewPolicy,
  input: OriExternalShadowInput,
): boolean {
  return (
    policy.enabled === true &&
    (policy.role === "educator" || policy.role === "administrator") &&
    Number.isSafeInteger(input.missionIndex) &&
    policy.authorizedMissionIndices.includes(input.missionIndex)
  );
}
export function createAuthorizedOriPlanReview(
  review: (input: OriExternalShadowInput) => Promise<OriPlanReviewResult>,
  policy: OriAdultReviewPolicy,
): (input: OriExternalShadowInput) => Promise<OriPlanReviewResult> {
  return async (input) => {
    if (!mayReviewOriPlan(policy, input)) {
      return Object.freeze({
        status: "unavailable",
        plan: null,
        appliedChanges: false,
      });
    }
    try {
      return await review(input);
    } catch {
      return Object.freeze({
        status: "unavailable",
        plan: null,
        appliedChanges: false,
      });
    }
  };
}
