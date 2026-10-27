import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";
import type { OriEducatorSubmission } from "./oriEducatorSubmissionValidation.js";
import type { OriVerifiedEducator } from "./oriEducatorReviewWorkflow.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import {
  createOriVerifiedReviewRecorder,
  type OriVerifiedEvidenceResolver,
} from "./oriVerifiedReviewRecorder.js";

export interface OriTrustedReviewHandoff {
  readonly evidenceDigest: string;
  readonly handoff: OriMig03ReviewHandoff;
}

/**
 * Authenticated administrative boundary. The handoff and evidence resolver
 * must come from trusted server-side providers, never from browser JSON.
 * Authorization is rechecked after asynchronous handoff resolution.
 */
export function createOriAuthorizedReviewRecordingService(
  store: ReturnType<typeof openOriAtomicEducatorReviewStore>,
  authorize: (session: unknown) => Promise<OriVerifiedEducator | null>,
  resolveHandoff: (reviewId: string) => Promise<OriTrustedReviewHandoff | null>,
  evidence: OriVerifiedEvidenceResolver,
) {
  const recorder = createOriVerifiedReviewRecorder(store, evidence);
  return Object.freeze({
    async record(
      session: unknown,
      reviewId: string,
      expectedDigest: string,
      expectedRevision: number,
      submission: OriEducatorSubmission,
    ): Promise<"recorded" | "unauthorized" | "conflict" | "invalid"> {
      const principal = await authorize(session);
      if (!principal?.canReviewOri || !principal.id) return "unauthorized";
      if (submission.reviewerId !== principal.id) return "unauthorized";
      let trusted: OriTrustedReviewHandoff | null;
      try {
        trusted = await resolveHandoff(reviewId);
      } catch {
        return "invalid";
      }
      if (!trusted || trusted.evidenceDigest !== expectedDigest) return "conflict";
      const state = store.get(reviewId);
      if (!state || state.digest !== expectedDigest || state.revision !== expectedRevision)
        return "conflict";
      const reauthorized = await authorize(session);
      if (!reauthorized?.canReviewOri || reauthorized.id !== principal.id)
        return "unauthorized";
      return recorder.record(reviewId, expectedDigest, expectedRevision,
        reauthorized, trusted.handoff, submission);
    },
  });
}
