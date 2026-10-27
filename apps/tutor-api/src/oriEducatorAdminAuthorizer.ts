import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { checkOriReviewHttpRequest } from "./oriReviewHttpGuard.js";
import type { OriVerifiedEducator } from "./oriEducatorReviewWorkflow.js";

/**
 * Internal authorization boundary for adult-only educator review.
 * The role lookup is supplied by the host and MUST be backed by an
 * authoritative administrative role source, not browser input.
 * This module registers no route.
 */
export function createOriEducatorAdminAuthorizer({
  auth,
  trustedHosts,
  resolveRole,
}: {
  readonly auth: AdminAuth;
  readonly trustedHosts: readonly string[];
  readonly resolveRole: (author: string) => Promise<boolean>;
}) {
  return async (request: IncomingMessage): Promise<OriVerifiedEducator | null> => {
    if (!checkOriReviewHttpRequest(request, auth, trustedHosts).allowed) return null;
    try {
      const initial = auth.read(request);
      if (!initial) return null;
      const allowed = await resolveRole(initial.author);
      if (!allowed) return null;
      const current = auth.read(request);
      if (!current || current.author !== initial.author || current.csrf !== initial.csrf)
        return null;
      return Object.freeze({ id: current.author, canReviewOri: true });
    } catch {
      return null;
    }
  };
}
