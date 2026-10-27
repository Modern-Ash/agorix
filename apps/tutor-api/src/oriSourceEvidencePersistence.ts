import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";
import type { OriMachineReviewEvidence } from "./oriMachineReviewEvidenceSource.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { createOriMachineReviewEvidenceSource } from "./oriMachineReviewEvidenceSource.js";

export interface OriCapturedMissionSource {
  readonly missionId: string;
  readonly missionIndex: number;
  readonly oriProposal: unknown | null;
  readonly kidsBaseline: unknown;
  readonly provenance: "ori-loopback-synthetic-mission";
}

/**
 * Persists real loopback source evidence only with separately trusted host
 * learning context and explanation. Does not fabricate missing proposals.
 */
export function createOriSourceEvidencePersistence(
  reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>,
  artifacts: ReturnType<typeof openOriSqliteEvidenceArtifactRepository>,
) {
  const source = createOriMachineReviewEvidenceSource(reviews, artifacts);
  return Object.freeze({
    persist(handoff: OriMig03ReviewHandoff, reviewId: string, digest: string,
      captured: OriCapturedMissionSource,
      host: Pick<OriMachineReviewEvidence, "learningContext" | "learnerFacingExplanation">):
      Readonly<Record<string, string>> | null {
      if (captured.provenance !== "ori-loopback-synthetic-mission" ||
          captured.oriProposal === null || captured.kidsBaseline === null ||
          !host.learningContext || !host.learnerFacingExplanation)
        return null;
      return source.captureMachineEvidence(handoff, reviewId, digest, captured.missionId, {
        oriProposal: captured.oriProposal,
        kidsBaseline: captured.kidsBaseline,
        learningContext: host.learningContext,
        learnerFacingExplanation: host.learnerFacingExplanation,
      });
    },
  });
}
