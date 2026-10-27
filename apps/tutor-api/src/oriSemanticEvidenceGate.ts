import { createHash } from "node:crypto";
import type { OriReviewTicket } from "./oriReviewRegistry.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { openOriTicketReviewLineageStore } from "./oriTicketReviewLineage.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { createOriAuthoritativeLineageService } from "./oriAuthoritativeLineageService.js";

/**
 * Read-only semantic gate: ticket proposal must match a persisted Ori proposal
 * artifact in the same review/mission. The host must supply trusted mission ID.
 */
export function createOriSemanticEvidenceGate({
  reviews, artifacts, lineage, presentations, resolveTicket,
}: {
  readonly reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>;
  readonly artifacts: ReturnType<typeof openOriSqliteEvidenceArtifactRepository>;
  readonly lineage: ReturnType<typeof openOriTicketReviewLineageStore>;
  readonly presentations: ReturnType<typeof openOriTicketPresentationSqliteStore>;
  readonly resolveTicket: (owner: string, projectId: string, ticketId: string) =>
    Promise<OriReviewTicket | null>;
}) {
  const base = createOriAuthoritativeLineageService({
    reviews, lineage, presentations, resolveTicket,
  });
  return Object.freeze({
    async assess(owner: string, projectId: string, ticketId: string,
      reviewId: string, missionId: string) {
      const initial = await base.assess(owner, projectId, ticketId, reviewId);
      const blockers = [...initial.blockers];
      try {
        const review = reviews.get(reviewId);
        const ticket = await resolveTicket(owner, projectId, ticketId);
        const record = review && await artifacts.find(reviewId, review.digest,
          missionId, "ori-proposal");
        const bytes = record && await artifacts.read(record.reference);
        if (!review || !ticket || !record || !bytes ||
            bytes.byteLength === 0 || bytes.byteLength > 1_048_576 ||
            createHash("sha256").update(bytes).digest("hex") !== record.sha256)
          blockers.push("ori-proposal-evidence-missing");
        else {
          const proposal: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
          if (JSON.stringify(proposal) !== JSON.stringify(ticket.proposal))
            blockers.push("ori-proposal-semantic-mismatch");
        }
      } catch { blockers.push("ori-proposal-evidence-invalid"); }
      return Object.freeze({
        status: blockers.length ? "blocked" as const : "ready-for-human-review" as const,
        blockers: Object.freeze(blockers),
        rolloutAuthorized: false as const,
      });
    },
  });
}
