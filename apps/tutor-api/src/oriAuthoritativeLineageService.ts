import type { OriReviewTicket } from "./oriReviewRegistry.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriTicketReviewLineageStore } from "./oriTicketReviewLineage.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { createOriBoundPresentationReadiness } from "./oriTicketReviewLineage.js";

/**
 * Trusted issuance-to-review lineage service. Caller must derive identity and
 * review ID from authenticated host state, never request JSON.
 */
export function createOriAuthoritativeLineageService({
  reviews,
  lineage,
  presentations,
  resolveTicket,
}: {
  readonly reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>;
  readonly lineage: ReturnType<typeof openOriTicketReviewLineageStore>;
  readonly presentations: ReturnType<typeof openOriTicketPresentationSqliteStore>;
  readonly resolveTicket: (
    owner: string,
    projectId: string,
    ticketId: string,
  ) => Promise<OriReviewTicket | null>;
}) {
  const gate = createOriBoundPresentationReadiness(lineage, reviews, presentations);
  return Object.freeze({
    async bindIssuedTicket(
      owner: string,
      projectId: string,
      ticketId: string,
      reviewId: string,
    ): Promise<boolean> {
      const before = reviews.get(reviewId);
      if (!before) return false;
      try {
        const ticket = await resolveTicket(owner, projectId, ticketId);
        if (
          !ticket ||
          ticket.id !== ticketId ||
          ticket.status !== "pending" ||
          ticket.appliedChanges !== false
        )
          return false;
        const after = reviews.get(reviewId);
        if (!after || before.digest !== after.digest || before.revision !== after.revision)
          return false;
        return lineage.bind({
          owner,
          projectId,
          ticketId,
          reviewId,
          digest: after.digest,
          revision: after.revision,
        });
      } catch {
        return false;
      }
    },
    async assess(owner: string, projectId: string, ticketId: string, reviewId: string) {
      const base = gate.assess(owner, projectId, ticketId, reviewId);
      const blockers = [...base.blockers];
      try {
        const ticket = await resolveTicket(owner, projectId, ticketId);
        if (!ticket || ticket.id !== ticketId || ticket.appliedChanges !== false)
          blockers.push("ticket-not-authorized");
      } catch {
        blockers.push("ticket-not-authorized");
      }
      return Object.freeze({
        status: blockers.length ? ("blocked" as const) : ("ready-for-human-review" as const),
        blockers: Object.freeze(blockers),
        rolloutAuthorized: false as const,
      });
    },
  });
}
