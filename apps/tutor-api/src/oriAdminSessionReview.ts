import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import type { OriExternalShadowInput } from "./oriExternalShadow.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";
import { createAuthorizedOriPlanReview } from "./oriAdultReviewPolicy.js";

/**
 * Trusted server-side adapter for an existing authenticated admin session.
 * Not an HTTP route: callers must separately enforce same-origin, CSRF and
 * request limits before invoking it. Never accepts roles from client JSON.
 */
export function createAdminSessionOriReview(
  auth: AdminAuth,
  review: (input: OriExternalShadowInput) => Promise<OriPlanReviewResult>,
  enabled: boolean,
  authorizedMissionIndices: readonly number[],
): (request: IncomingMessage, input: OriExternalShadowInput) => Promise<OriPlanReviewResult> {
  const guarded = createAuthorizedOriPlanReview(review, {
    enabled,
    role: "administrator",
    authorizedMissionIndices,
  });
  return async (request, input) => {
    if (!auth.read(request)) {
      return Object.freeze({
        status: "unavailable",
        plan: null,
        appliedChanges: false,
      });
    }
    return guarded(input);
  };
}
