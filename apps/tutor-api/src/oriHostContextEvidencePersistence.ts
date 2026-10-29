import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";
import type { OriCapturedMissionSource } from "./oriSourceEvidencePersistence.js";
import { createOriSourceEvidencePersistence } from "./oriSourceEvidencePersistence.js";
import { createOriTrustedHostReviewContextPort } from "./oriTrustedHostReviewContextPort.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";

export function createOriHostContextEvidencePersistence({
  reviews,
  artifacts,
  resolveHostContext,
}: {
  readonly reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>;
  readonly artifacts: ReturnType<typeof openOriSqliteEvidenceArtifactRepository>;
  readonly resolveHostContext: Parameters<typeof createOriTrustedHostReviewContextPort>[0];
}) {
  const context = createOriTrustedHostReviewContextPort(resolveHostContext);
  const persistence = createOriSourceEvidencePersistence(reviews, artifacts);
  return Object.freeze({
    async persist(
      handoff: OriMig03ReviewHandoff,
      reviewId: string,
      digest: string,
      captured: OriCapturedMissionSource,
    ): Promise<Readonly<Record<string, string>> | null> {
      if (!captured.oriProposal) return null;
      const host = await context.resolveFor(captured);
      if (!host) return null;
      // Source persistence rechecks current digest and mission before writing.
      return persistence.persist(handoff, reviewId, digest, captured, {
        learningContext: host.learningContext,
        learnerFacingExplanation: host.learnerFacingExplanation,
      });
    },
  });
}
