import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";
import { checkOriReviewHttpRequest } from "./oriReviewHttpGuard.js";
import { parseOriApplyRequest } from "./oriApplyRequestContract.js";
import type { OriReviewRateLimiter } from "./oriReviewRateLimit.js";

export interface OriApplyPipelineResult {
  readonly status: 200 | 400 | 401 | 403 | 405 | 409 | 415 | 429 | 503;
  readonly body: { readonly status?: "applied"; readonly error?: string };
}

/**
 * Opt-in, server-only pipeline. It does NOT register an HTTP route.
 * The trusted host must derive owner/project from authenticated session
 * middleware and supply a ticket-bound apply callback. No browser authority.
 */
export function createOriApplyPipeline({
  auth,
  trustedHosts,
  limiter,
  resolvePrincipal,
  apply,
  enabled = false,
  bodyDeadlineMs = 1000,
}: {
  readonly auth: AdminAuth;
  readonly trustedHosts: readonly string[];
  readonly limiter: OriReviewRateLimiter;
  readonly resolvePrincipal: (request: IncomingMessage) => Promise<{
    readonly owner: string;
    readonly projectId: string;
  } | null>;
  readonly apply: (
    owner: string,
    projectId: string,
    ticketId: string,
    scriptId: string,
  ) => Promise<"applied" | "rejected" | "conflict">;
  readonly enabled?: boolean;
  readonly bodyDeadlineMs?: number;
}): (request: IncomingMessage) => Promise<OriApplyPipelineResult> {
  if (!Number.isSafeInteger(bodyDeadlineMs) || bodyDeadlineMs < 1 || bodyDeadlineMs > 10000)
    throw new RangeError("Invalid Ori apply body deadline");
  return async (request) => {
    if (!enabled) return { status: 503, body: { error: "unavailable" } };
    const guard = checkOriReviewHttpRequest(request, auth, trustedHosts);
    if (!guard.allowed) return { status: guard.status, body: { error: guard.reason } };
    const session = auth.read(request);
    if (!session) return { status: 401, body: { error: "unauthorized" } };
    if (!limiter.allow(session.author)) return { status: 429, body: { error: "rate-limited" } };
    let principal;
    try {
      principal = await resolvePrincipal(request);
    } catch {
      return { status: 401, body: { error: "unauthorized" } };
    }
    if (!principal?.owner || !principal.projectId)
      return { status: 401, body: { error: "unauthorized" } };
    // Fail closed on stalled, aborted or oversized requests. Destroying the
    // stream interrupts the pending async iterator on deadline expiry.
    const controller = new AbortController();
    const stop = () => {
      controller.abort();
      request.destroy();
    };
    const timer = setTimeout(stop, bodyDeadlineMs);
    let body = "";
    try {
      if (request.destroyed) return { status: 400, body: { error: "invalid-request" } };
      for await (const chunk of request) {
        if (controller.signal.aborted) return { status: 400, body: { error: "invalid-request" } };
        body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        if (Buffer.byteLength(body, "utf8") > 512)
          return { status: 400, body: { error: "invalid-request" } };
      }
      if (controller.signal.aborted || request.aborted)
        return { status: 400, body: { error: "invalid-request" } };
      // The deadline only bounds body reception, never the authorized write.
      clearTimeout(timer);
      const parsed = parseOriApplyRequest(JSON.parse(body) as unknown);
      if (!parsed) return { status: 400, body: { error: "invalid-request" } };
      const result = await apply(principal.owner, principal.projectId, parsed.ticketId, parsed.scriptId);
      if (result === "applied") return { status: 200, body: { status: "applied" } };
      if (result === "conflict") return { status: 409, body: { error: "conflict" } };
      return { status: 403, body: { error: "forbidden" } };
    } catch {
      return {
        status: controller.signal.aborted || request.aborted ? 400 : 503,
        body: { error: controller.signal.aborted || request.aborted ? "invalid-request" : "unavailable" },
      };
    } finally {
      clearTimeout(timer);
    }
  };
}
