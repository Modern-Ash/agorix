import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";
import type { OriExternalShadowInput } from "./oriExternalShadow.js";
import { checkOriReviewHttpRequest } from "./oriReviewHttpGuard.js";
import { readOriReviewBodyWithDeadline } from "./oriReviewDeadline.js";
import type { OriReviewRateLimiter } from "./oriReviewRateLimit.js";
import { validateOriShadowPlan } from "./oriShadowPlanValidation.js";

/**
 * Internal adult-review pipeline. Not registered as an HTTP route.
 * Caller owns a trusted reverse proxy, authentication configuration and
 * feature activation. No child-facing or program-editing behavior.
 */
export interface OriReviewPipelineResult {
  readonly status: 200 | 400 | 401 | 403 | 405 | 415 | 429 | 503;
  readonly body: OriPlanReviewResult | { readonly error: string };
}
export function createOriReviewPipeline(
  auth: AdminAuth,
  trustedHosts: readonly string[],
  limiter: OriReviewRateLimiter,
  review: (input: OriExternalShadowInput) => Promise<OriPlanReviewResult>,
  enabled = false,
  bodyDeadlineMs = 1000,
): (request: IncomingMessage) => Promise<OriReviewPipelineResult> {
  return async (request) => {
    if (!enabled) return { status: 503, body: { error: "unavailable" } };
    const preflight = checkOriReviewHttpRequest(request, auth, trustedHosts);
    if (!preflight.allowed) return { status: preflight.status, body: { error: preflight.reason } };
    // The identity is derived exclusively from the authenticated server session.
    let session;
    try {
      session = auth.read(request);
    } catch {
      return { status: 401, body: { error: "unauthorized" } };
    }
    if (!session) return { status: 401, body: { error: "unauthorized" } };
    if (!limiter.allow(session.author)) return { status: 429, body: { error: "rate-limited" } };
    const input = await readOriReviewBodyWithDeadline(request, bodyDeadlineMs);
    if (!input) return { status: 400, body: { error: "invalid-request" } };
    try {
      const result = await review(input);
      if (
        result?.status !== "ready" ||
        result.appliedChanges !== false ||
        !result.plan ||
        !validateOriShadowPlan(result.plan) ||
        result.plan.stage !== input.hintLevel ||
        result.plan.context.missionStage !== input.missionIndex
      )
        return { status: 503, body: { error: "unavailable" } };
      return { status: 200, body: result };
    } catch {
      return { status: 503, body: { error: "unavailable" } };
    }
  };
}
