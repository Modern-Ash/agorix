import type { IncomingMessage, ServerResponse } from "node:http";
import type { OriReviewDecision } from "./oriProposalReview.js";

export interface OriReviewPrincipal {
  readonly ownerId: string;
  readonly projectId: string;
}
export interface OriReviewHttpRequest {
  readonly ticketId: string;
  readonly decision: OriReviewDecision;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** This parses only an opaque ticket and decision, never an owner or revision. */
export function parseOriReviewHttpRequest(raw: unknown): OriReviewHttpRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (
    Object.keys(data).sort().join() !== "decision,ticketId" ||
    typeof data["ticketId"] !== "string" ||
    !UUID.test(data["ticketId"]) ||
    !["accept", "edit", "reject"].includes(String(data["decision"]))
  )
    return null;
  return { ticketId: data["ticketId"], decision: data["decision"] as OriReviewDecision };
}
export type OriReviewIdentityResolver = (
  request: IncomingMessage,
  response?: ServerResponse,
) => Promise<OriReviewPrincipal | null>;
/** Identity must come from trusted authenticated session middleware. */
export function validateOriReviewPrincipal(
  value: OriReviewPrincipal | null,
): OriReviewPrincipal | null {
  if (
    !value ||
    typeof value.ownerId !== "string" ||
    typeof value.projectId !== "string" ||
    !value.ownerId ||
    value.ownerId.length > 128 ||
    !value.projectId ||
    value.projectId.length > 128
  )
    return null;
  return value;
}
