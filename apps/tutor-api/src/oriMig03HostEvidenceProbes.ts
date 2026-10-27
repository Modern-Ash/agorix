import type { ProjectRepository } from "@agorix/project-repository";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";
import type { OriMig03VerifiedHostProbes } from "./oriMig03ExecutableExitChecks.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";

/**
 * Concrete host-backed checks for one scoped review. No HTTP endpoint, no
 * browser-controlled flags, and no implicit human signoff.
 */
export function createOriMig03HostEvidenceProbes({
  session, repository, projectId, ticketId, resolveTicket,
  presentations, reviews, reviewId, checkOriProcess, humanReviewVerified,
}: {
  readonly session: () => Promise<OriAuthenticatedSession | null>;
  readonly repository: ProjectRepository;
  readonly projectId: string;
  readonly ticketId: string;
  readonly resolveTicket: (owner: string, project: string, ticket: string) =>
    Promise<OriReviewTicket | null>;
  readonly presentations: ReturnType<typeof openOriTicketPresentationSqliteStore>;
  readonly reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>;
  readonly reviewId: string;
  readonly checkOriProcess: () => Promise<boolean>;
  readonly humanReviewVerified: () => Promise<boolean>;
}): OriMig03VerifiedHostProbes {
  const principal = async () => {
    const value = await session();
    return value && value.accountId && value.sessionId ? value : null;
  };
  return Object.freeze({
    session: async () => !!(await principal()),
    project: async () => {
      const user = await principal();
      if (!user) return false;
      const project = await repository.get(user.accountId, projectId);
      return project.ownerId === user.accountId && project.projectId === projectId;
    },
    oriProcess: checkOriProcess,
    durableStorage: async () => {
      const user = await principal();
      if (!user) return false;
      const ticket = await resolveTicket(user.accountId, projectId, ticketId);
      const review = reviews.get(reviewId);
      return !!ticket && ticket.id === ticketId && !!review &&
        !!presentations.read(user.accountId, projectId, ticketId);
    },
    educatorReview: humanReviewVerified,
  });
}
