import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";

export interface OriTrustedReviewEvidence {
  readonly reviewId: string;
  readonly evidenceDigest: string;
  readonly missionId: string;
  readonly artifacts: Readonly<Record<string, Uint8Array>>;
}

/**
 * Internal capture of already-produced, trusted server-side evidence.
 * Does not accept browser uploads or generate pedagogical decisions.
 */
export function createOriTrustedReviewEvidenceCapture(
  reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>,
  artifacts: ReturnType<typeof openOriSqliteEvidenceArtifactRepository>,
) {
  return Object.freeze({
    capture(handoff: OriMig03ReviewHandoff, input: OriTrustedReviewEvidence):
      Readonly<Record<string, string>> | null {
      const state = reviews.get(input.reviewId);
      if (!state || state.digest !== input.evidenceDigest) return null;
      const item = handoff.pendingEvidence.find((row) => row.missionId === input.missionId);
      if (!item || handoff.deferredMissionIds.includes(input.missionId)) return null;
      const required = item.requiredEvidence;
      if (Object.keys(input.artifacts).sort().join() !== [...required].sort().join())
        return null;
      // Validate the entire batch before writing any artifact.
      if (required.some((key) => {
        const bytes = input.artifacts[key];
        return !bytes || bytes.byteLength === 0 || bytes.byteLength > 1_048_576;
      })) return null;
      return artifacts.putBatch(input.reviewId, input.evidenceDigest,
        input.missionId, input.artifacts);
    },
  });
}
