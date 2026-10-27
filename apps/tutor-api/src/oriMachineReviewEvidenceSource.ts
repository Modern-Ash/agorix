import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { createOriTrustedReviewEvidenceCapture } from "./oriTrustedReviewEvidenceCapture.js";

export interface OriMachineReviewEvidence {
  readonly oriProposal: unknown;
  readonly kidsBaseline: unknown;
  readonly learningContext: unknown;
  readonly learnerFacingExplanation: unknown;
}

/**
 * Captures only host-produced machine evidence. The educator rationale is
 * intentionally excluded: it must be written by a real authorized reviewer.
 */
export function createOriMachineReviewEvidenceSource(
  reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>,
  artifacts: ReturnType<typeof openOriSqliteEvidenceArtifactRepository>,
) {
  const capture = createOriTrustedReviewEvidenceCapture(reviews, artifacts);
  return Object.freeze({
    captureMachineEvidence(
      handoff: OriMig03ReviewHandoff,
      reviewId: string,
      digest: string,
      missionId: string,
      evidence: OriMachineReviewEvidence,
    ): Readonly<Record<string, string>> | null {
      const item = handoff.pendingEvidence.find((row) => row.missionId === missionId);
      if (!item) return null;
      const expectedMachine = [
        "ori-proposal",
        "kids-baseline",
        "learning-context",
        "learner-facing-explanation",
      ];
      if (
        item.requiredEvidence.some(
          (key) => key !== "educator-rationale" && !expectedMachine.includes(key),
        )
      )
        return null;
      // Never claim a complete educator checklist when rationale is still missing.
      const machineHandoff: OriMig03ReviewHandoff = {
        ...handoff,
        pendingEvidence: handoff.pendingEvidence.map((row) =>
          row.missionId === missionId
            ? {
                ...row,
                requiredEvidence: row.requiredEvidence.filter(
                  (key) => key !== "educator-rationale",
                ),
              }
            : row,
        ),
      };
      const values: Record<string, unknown> = {
        "ori-proposal": evidence.oriProposal,
        "kids-baseline": evidence.kidsBaseline,
        "learning-context": evidence.learningContext,
        "learner-facing-explanation": evidence.learnerFacingExplanation,
      };
      const payload: Record<string, Uint8Array> = {};
      for (const key of item.requiredEvidence) {
        if (key === "educator-rationale") continue;
        const value = values[key];
        if (value === null || value === undefined) return null;
        const encoded = JSON.stringify(value);
        if (!encoded || encoded === "{}" || encoded === "null") return null;
        payload[key] = Buffer.from(encoded, "utf8");
      }
      return capture.capture(machineHandoff, {
        reviewId,
        evidenceDigest: digest,
        missionId,
        artifacts: payload,
      });
    },
  });
}
