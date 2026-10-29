import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { createOriEducatorAdminAuthorizer } from "./oriEducatorAdminAuthorizer.js";
import { createOriAtomicAdminService } from "./oriAtomicAdminService.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";

/**
 * Composes existing AdminAuth, trusted educator role resolution and atomic
 * SQLite review storage. Internal-only: no route is registered here.
 */
export function createOriEducatorAdminComposition({
  auth,
  trustedHosts,
  resolveRole,
  store,
  enabled = false,
}: {
  readonly auth: AdminAuth;
  readonly trustedHosts: readonly string[];
  readonly resolveRole: (author: string) => Promise<boolean>;
  readonly store: ReturnType<typeof openOriAtomicEducatorReviewStore>;
  readonly enabled?: boolean;
}) {
  const authorize = createOriEducatorAdminAuthorizer({ auth, trustedHosts, resolveRole });
  const service = createOriAtomicAdminService(store, async (session) => {
    if (!enabled) return null;
    return authorize(session as IncomingMessage);
  });
  return Object.freeze({
    acceptanceManifest: (
      request: IncomingMessage,
      reviewId: string,
      provenance: {
        readonly evidenceDigest: string;
        readonly verified: boolean;
      },
    ) => service.acceptanceManifest(request, reviewId, provenance),
    readiness: (
      request: IncomingMessage,
      reviewId: string,
      provenance: {
        readonly evidenceDigest: string;
        readonly verified: boolean;
      },
    ) => service.readiness(request, reviewId, provenance),
    snapshot: (request: IncomingMessage, reviewId: string) => service.snapshot(request, reviewId),
    decide: (
      request: IncomingMessage,
      reviewId: string,
      digest: string,
      revision: number,
      input: Parameters<typeof service.decide>[4],
    ) => service.decide(request, reviewId, digest, revision, input),
    audit: (request: IncomingMessage, reviewId: string) => service.audit(request, reviewId),
  });
}
