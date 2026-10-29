import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
import { validateOriRevisionAtReview, type OriReviewDecision } from "./oriProposalReview.js";

export interface OriProposalReviewSession {
  readonly proposal: unknown;
  readonly revision: string;
  readonly digest: string;
  readonly status: "pending" | "accepted" | "edited" | "rejected" | "stale";
  readonly appliedChanges: false;
}
export function beginOriProposalReview(
  result: OriHostEvidenceResult,
): OriProposalReviewSession | null {
  if (
    result.status !== "ready" ||
    !result.proposal ||
    !result.evidenceReceipt ||
    !result.evidenceReceipt.complete
  )
    return null;
  return Object.freeze({
    proposal: structuredClone(result.proposal),
    revision: result.evidenceReceipt.programRevision,
    digest: result.evidenceReceipt.digest,
    status: "pending",
    appliedChanges: false,
  });
}
/**
 * A decision is an audit event only. A separate trusted host mutation command
 * would have to recheck revision, permissions, program model and approval.
 */
export function decideOriProposalReview(
  session: OriProposalReviewSession,
  currentRevision: string,
  decision: OriReviewDecision,
): OriProposalReviewSession {
  if (session.status !== "pending") return session;
  const result: OriHostEvidenceResult = {
    status: "ready",
    proposal: session.proposal,
    evidenceReceipt: { programRevision: session.revision, digest: session.digest, complete: true },
    requiresLearnerApproval: true,
    appliedChanges: false,
  };
  const checked = validateOriRevisionAtReview(result, currentRevision, decision);
  if (checked.status === "invalid") return session;
  return Object.freeze({
    ...session,
    status:
      checked.status === "stale"
        ? "stale"
        : decision === "accept"
          ? "accepted"
          : decision === "edit"
            ? "edited"
            : "rejected",
    appliedChanges: false,
  });
}
