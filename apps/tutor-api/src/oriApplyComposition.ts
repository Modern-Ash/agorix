import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import type { OriReviewRateLimiter } from "./oriReviewRateLimit.js";
import { createOriApplyPipeline } from "./oriApplyPipeline.js";
import { createOriApplyHttpHandler } from "./oriApplyHttpHandler.js";

export interface OriApplyPrincipal {
  readonly owner: string;
  readonly projectId: string;
}
export interface OriApplyWorkflow {
  applyAccepted(
    owner: string,
    projectId: string,
    ticketId: string,
    scriptId: string,
  ): Promise<"applied" | "rejected" | "conflict">;
}

/**
 * Server-only composition seam. No route is registered by this module.
 * The host must supply trusted authentication, identity and project workflow.
 * This adapter never accepts authority fields from browser JSON.
 */
export function createOriApplyComposition({
  auth,
  trustedHosts,
  limiter,
  resolvePrincipal,
  workflow,
  enabled = false,
}: {
  readonly auth: AdminAuth;
  readonly trustedHosts: readonly string[];
  readonly limiter: OriReviewRateLimiter;
  readonly resolvePrincipal: (request: IncomingMessage) => Promise<OriApplyPrincipal | null>;
  readonly workflow: OriApplyWorkflow;
  readonly enabled?: boolean;
}): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const pipeline = createOriApplyPipeline({
    auth,
    trustedHosts,
    limiter,
    resolvePrincipal,
    apply: (owner, projectId, ticketId, scriptId) =>
      workflow.applyAccepted(owner, projectId, ticketId, scriptId),
    enabled,
  });
  return createOriApplyHttpHandler(pipeline);
}
