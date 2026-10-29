import { createHash } from "node:crypto";
import type { OriReviewTicket } from "./oriReviewRegistry.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { openOriTicketReviewLineageStore } from "./oriTicketReviewLineage.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { createOriSemanticEvidenceGate } from "./oriSemanticEvidenceGate.js";

/** Adult-only, deterministic audit bundle. No child identifiers or raw program. */
export function createOriMig03EducatorAuditBundle({
  reviews,
  artifacts,
  lineage,
  presentations,
  resolveTicket,
}: {
  readonly reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>;
  readonly artifacts: ReturnType<typeof openOriSqliteEvidenceArtifactRepository>;
  readonly lineage: ReturnType<typeof openOriTicketReviewLineageStore>;
  readonly presentations: ReturnType<typeof openOriTicketPresentationSqliteStore>;
  readonly resolveTicket: (
    owner: string,
    projectId: string,
    ticketId: string,
  ) => Promise<OriReviewTicket | null>;
}) {
  const gate = createOriSemanticEvidenceGate({
    reviews,
    artifacts,
    lineage,
    presentations,
    resolveTicket,
  });
  return Object.freeze({
    async build(
      owner: string,
      projectId: string,
      ticketId: string,
      reviewId: string,
      missionId: string,
    ) {
      const before = reviews.get(reviewId);
      const readiness = await gate.assess(owner, projectId, ticketId, reviewId, missionId);
      const after = reviews.get(reviewId);
      const blockers = [...readiness.blockers];
      if (!before || !after || before.digest !== after.digest || before.revision !== after.revision)
        blockers.push("review-changed");
      const evidence =
        after && (await artifacts.find(reviewId, after.digest, missionId, "ori-proposal"));
      const presentationHash = presentations.read(owner, projectId, ticketId);
      const summary = {
        schema: "agorix/ori-mig03-educator-audit/v1" as const,
        reviewId,
        missionId,
        ticketId,
        reviewDigest: after?.digest ?? null,
        reviewRevision: after?.revision ?? null,
        proposalEvidenceHash: evidence?.sha256 ?? null,
        presentationHash,
        technicalReadiness: blockers.length
          ? ("blocked" as const)
          : ("ready-for-human-review" as const),
        blockers: [...new Set(blockers)].sort(),
        humanApproval: false as const,
        rolloutAuthorized: false as const,
      };
      const auditHash = createHash("sha256").update(JSON.stringify(summary)).digest("hex");
      return Object.freeze({ ...summary, auditHash });
    },
  });
}
