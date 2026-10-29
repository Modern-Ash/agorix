import type { ProjectRepository } from "@agorix/project-repository";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";
import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriTicketReviewLineageStore } from "./oriTicketReviewLineage.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { createOriMig03HostEvidenceProbes } from "./oriMig03HostEvidenceProbes.js";
import { runOriMig03TechnicalExitChecks } from "./oriMig03ExecutableExitChecks.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;

/** Host-only technical exit orchestration, never a learner-facing route. */
export function createOriMig03HostExitComposition({
  session,
  repository,
  projectId,
  ticketId,
  resolveTicket,
  presentations,
  reviews,
  lineage,
  reviewId,
  checkOriProcess,
  humanReviewVerified,
}: {
  readonly session: () => Promise<OriAuthenticatedSession | null>;
  readonly repository: ProjectRepository;
  readonly projectId: string;
  readonly ticketId: string;
  readonly resolveTicket: (
    owner: string,
    project: string,
    ticket: string,
  ) => Promise<OriReviewTicket | null>;
  readonly presentations: ReturnType<typeof openOriTicketPresentationSqliteStore>;
  readonly reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>;
  readonly lineage: ReturnType<typeof openOriTicketReviewLineageStore>;
  readonly reviewId: string;
  readonly checkOriProcess: () => Promise<boolean>;
  readonly humanReviewVerified: () => Promise<boolean>;
}) {
  const probes = createOriMig03HostEvidenceProbes({
    session,
    repository,
    projectId,
    ticketId,
    resolveTicket,
    presentations,
    reviews,
    lineage,
    reviewId,
    checkOriProcess,
    humanReviewVerified,
  });
  return Object.freeze({
    assess: (bundle: Bundle) => runOriMig03TechnicalExitChecks(bundle, probes),
  });
}
