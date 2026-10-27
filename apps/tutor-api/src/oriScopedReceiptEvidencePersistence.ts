import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";
import type { OriCapturedMissionSource } from "./oriSourceEvidencePersistence.js";
import { createOriHostContextEvidencePersistence } from "./oriHostContextEvidencePersistence.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { openOriScopedRenderedHintReceiptStore } from "./oriScopedRenderedHintReceiptStore.js";

/**
 * Review-scoped host evidence composition. Never resolves a mission receipt
 * without the review ID and current evidence digest.
 */
export function createOriScopedReceiptEvidencePersistence({
  reviews,
  artifacts,
  receipts,
}: {
  readonly reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>;
  readonly artifacts: ReturnType<typeof openOriSqliteEvidenceArtifactRepository>;
  readonly receipts: ReturnType<typeof openOriScopedRenderedHintReceiptStore>;
}) {
  return Object.freeze({
    async persist(handoff: OriMig03ReviewHandoff, reviewId: string, digest: string,
      captured: OriCapturedMissionSource): Promise<Readonly<Record<string, string>> | null> {
      const current = reviews.get(reviewId);
      if (!current || current.digest !== digest) return null;
      const service = createOriHostContextEvidencePersistence({
        reviews, artifacts,
        resolveHostContext: (missionId, missionIndex) =>
          receipts.resolve(reviewId, digest, missionId, missionIndex),
      });
      return service.persist(handoff, reviewId, digest, captured);
    },
  });
}
