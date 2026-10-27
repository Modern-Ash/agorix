import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";
import {
  validateOriEducatorSubmissions,
  type OriEducatorSubmission,
} from "./oriEducatorSubmissionValidation.js";
import type { OriVerifiedEducator } from "./oriEducatorReviewWorkflow.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";

export interface OriVerifiedEvidenceResolver {
  verify(reviewId: string, digest: string, missionId: string,
    evidenceRefs: Readonly<Record<string, string>>): Promise<boolean>;
}

/**
 * Server-side recording boundary. An authenticated principal and a trusted
 * evidence resolver are required; no browser-supplied identity is trusted.
 * Decisions remain subject to the store's atomic digest/revision CAS.
 */
export function createOriVerifiedReviewRecorder(
  store: ReturnType<typeof openOriAtomicEducatorReviewStore>,
  evidence: OriVerifiedEvidenceResolver,
) {
  return Object.freeze({
    async record(
      reviewId: string,
      expectedDigest: string,
      expectedRevision: number,
      principal: OriVerifiedEducator | null,
      handoff: OriMig03ReviewHandoff,
      submission: OriEducatorSubmission,
    ): Promise<"recorded" | "unauthorized" | "conflict" | "invalid"> {
      if (!principal?.canReviewOri || !principal.id) return "unauthorized";
      if (submission.reviewerId !== principal.id) return "unauthorized";
      const state = store.get(reviewId);
      if (!state || state.digest !== expectedDigest || state.revision !== expectedRevision)
        return "conflict";
      const item = handoff.pendingEvidence.find((entry) => entry.missionId === submission.missionId);
      if (!item || handoff.deferredMissionIds.includes(submission.missionId) ||
          handoff.unresolvedMissionIds.includes(submission.missionId))
        return "invalid";
      // Validate this individual decision without declaring whole-batch acceptance.
      const scoped: OriMig03ReviewHandoff = {
        ...handoff, missionCount: 1, selectedForReview: 1,
        pendingEvidence: [item], deferredMissionIds: [], unresolvedMissionIds: [],
      };
      if (validateOriEducatorSubmissions(scoped, [submission]).status !== "complete-for-recording")
        return "invalid";
      try {
        if (!await evidence.verify(reviewId, expectedDigest, submission.missionId,
          submission.evidenceRefs)) return "invalid";
      } catch { return "invalid"; }
      // Re-read after async verification; CAS also protects the write.
      return store.submit(reviewId, expectedDigest, expectedRevision, principal, {
        missionId: submission.missionId,
        decision: submission.disposition,
        rationale: submission.rationale,
      });
    },
  });
}
