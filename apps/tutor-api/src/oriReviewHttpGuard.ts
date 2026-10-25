import type { IncomingMessage } from "node:http";
import type { AdminAuth } from "./adminAuth.js";

/**
 * Fail-closed preflight for a future adult-only Ori review POST route.
 * No endpoint is registered by this module.
 */
export type OriReviewHttpDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly status: 401 | 403 | 405 | 415; readonly reason: string };

export function checkOriReviewHttpRequest(
  request: IncomingMessage,
  auth: AdminAuth,
  trustedHosts: readonly string[] = [],
): OriReviewHttpDecision {
  if (request.method !== "POST")
    return { allowed: false, status: 405, reason: "method-not-allowed" };
  const origin = request.headers.origin;
  const host = request.headers.host;
  // Reject missing or ambiguous origins, and disallow cross-origin requests.
  if (
    typeof origin !== "string" ||
    typeof host !== "string" ||
    !/^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/.test(host) ||
    !trustedHosts.includes(host)
  )
    return { allowed: false, status: 403, reason: "invalid-origin" };
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return { allowed: false, status: 403, reason: "invalid-origin" };
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.host !== host ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  )
    return { allowed: false, status: 403, reason: "invalid-origin" };
  const type = request.headers["content-type"];
  if (typeof type !== "string" || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type))
    return { allowed: false, status: 415, reason: "unsupported-media-type" };
  let session;
  try {
    session = auth.read(request);
  } catch {
    return { allowed: false, status: 401, reason: "unauthorized" };
  }
  if (!session) return { allowed: false, status: 401, reason: "unauthorized" };
  if (
    typeof request.headers["x-agorix-admin-csrf"] !== "string" ||
    request.headers["x-agorix-admin-csrf"] !== session.csrf
  )
    return { allowed: false, status: 403, reason: "invalid-csrf" };
  return { allowed: true };
}
