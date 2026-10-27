import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";
import type { OriEducatorSubmission } from "./oriEducatorSubmissionValidation.js";
import type { OriVerifiedEducator } from "./oriEducatorReviewWorkflow.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { createOriPersistedEvidenceReferenceVerifier } from "./oriPersistedEvidenceReferenceVerifier.js";
import { createOriAuthorizedReviewRecordingService } from "./oriAuthorizedReviewRecordingService.js";

/**
 * Trusted single-host composition of persisted review decisions and artifact
 * integrity checks. No browser-controlled evidence repository or role source.
 */
export function createOriArtifactBackedReviewService({
  reviews,
  artifacts,
  authorize,
  resolveHandoff,
}: {
  readonly reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>;
  readonly artifacts: ReturnType<typeof openOriSqliteEvidenceArtifactRepository>;
  readonly authorize: (session: unknown) => Promise<OriVerifiedEducator | null>;
  readonly resolveHandoff: (reviewId: string) => Promise<{
    readonly evidenceDigest: string;
    readonly handoff: OriMig03ReviewHandoff;
  } | null>;
}) {
  const recording = createOriAuthorizedReviewRecordingService(
    reviews,
    authorize,
    resolveHandoff,
    createOriPersistedEvidenceReferenceVerifier(artifacts),
  );
  return Object.freeze({
    record: (
      session: unknown,
      reviewId: string,
      digest: string,
      revision: number,
      submission: OriEducatorSubmission,
    ) => recording.record(session, reviewId, digest, revision, submission),
  });
}
