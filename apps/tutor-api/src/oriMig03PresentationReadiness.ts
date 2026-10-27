import type { OriReviewTicket } from "./oriReviewRegistry.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";

/**
 * Adult-only, read-only readiness assessment across ticket acknowledgement
 * and technical review. Never grants rollout or pedagogical approval.
 */
export function createOriMig03PresentationReadiness({
  tickets,
  reviews,
  resolveTicket,
}: {
  readonly tickets: ReturnType<typeof openOriTicketPresentationSqliteStore>;
  readonly reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>;
  readonly resolveTicket: (
    owner: string,
    projectId: string,
    ticketId: string,
  ) => Promise<OriReviewTicket | null>;
}) {
  return Object.freeze({
    async assess(
      owner: string,
      projectId: string,
      ticketId: string,
      reviewId: string,
    ): Promise<{
      readonly status: "ready-for-human-review" | "blocked";
      readonly blockers: readonly string[];
      readonly rolloutAuthorized: false;
    }> {
      const blockers: string[] = [];
      const hash = tickets.read(owner, projectId, ticketId);
      if (!hash) blockers.push("presentation-ack-missing");
      let ticket: OriReviewTicket | null = null;
      try {
        ticket = await resolveTicket(owner, projectId, ticketId);
      } catch {
        blockers.push("ticket-lookup-unavailable");
      }
      if (!ticket || ticket.id !== ticketId || ticket.appliedChanges !== false)
        blockers.push("ticket-unavailable");
      const review = reviews.get(reviewId);
      if (!review) blockers.push("review-unavailable");
      if (review && (review.matrix.missing > 0 || review.matrix.divergent > 0))
        blockers.push("technical-evidence-incomplete");
      if (hash && !/^[a-f0-9]{64}$/.test(hash)) blockers.push("presentation-hash-invalid");
      return Object.freeze({
        status: blockers.length === 0 ? "ready-for-human-review" : "blocked",
        blockers: Object.freeze(blockers),
        rolloutAuthorized: false,
      });
    },
  });
}
