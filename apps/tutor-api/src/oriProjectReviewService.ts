import type { TrustedOriEvidence, OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
import type { OriReviewRegistry, OriReviewTicket } from "./oriReviewRegistry.js";
import type { OriReviewDecision } from "./oriProposalReview.js";

export interface TrustedOriProject {
  readonly owner: string;
  readonly projectId: string;
  readonly revision: string;
  readonly evidence: TrustedOriEvidence;
}
export interface OriProjectReviewService {
  readonly propose: (principal: string, projectId: string) => Promise<OriReviewTicket | null>;
  readonly decide: (
    principal: string,
    projectId: string,
    ticketId: string,
    decision: OriReviewDecision,
  ) => Promise<OriReviewTicket | null>;
  readonly read: (principal: string, projectId: string, ticketId: string) => OriReviewTicket | null;
}
/**
 * Server-only orchestration seam. resolveProject MUST independently authorize
 * principal + project and derive the canonical revision and trace from the host.
 * The browser must never provide grants, trace, snapshot or revision.
 */
export function createOriProjectReviewService({
  resolveProject,
  authorizeProject,
  runOri,
  registry,
}: {
  readonly resolveProject: (
    principal: string,
    projectId: string,
  ) => Promise<TrustedOriProject | null>;
  readonly authorizeProject: (principal: string, projectId: string) => Promise<boolean>;
  readonly runOri: (evidence: TrustedOriEvidence) => Promise<OriHostEvidenceResult>;
  readonly registry: OriReviewRegistry;
}): OriProjectReviewService {
  const valid = (value: string) => value.length > 0 && value.length <= 128;
  return Object.freeze({
    async propose(principal: string, projectId: string) {
      if (!valid(principal) || !valid(projectId)) return null;
      const project = await resolveProject(principal, projectId);
      if (
        !project ||
        project.owner !== principal ||
        project.projectId !== projectId ||
        project.evidence.programRevision !== project.revision
      )
        return null;
      const result = await runOri(project.evidence);
      if (result.status !== "ready" || result.evidenceReceipt?.programRevision !== project.revision)
        return null;
      // Recheck after asynchronous Ori processing: never issue a ticket for a
      // project already modified or no longer accessible by the principal.
      const latest = await resolveProject(principal, projectId);
      if (
        !latest ||
        latest.owner !== principal ||
        latest.projectId !== projectId ||
        latest.revision !== project.revision
      )
        return null;
      return registry.issue(result, principal, projectId);
    },
    async decide(
      principal: string,
      projectId: string,
      ticketId: string,
      decision: OriReviewDecision,
    ) {
      if (
        !valid(principal) ||
        !valid(projectId) ||
        !valid(ticketId) ||
        !["accept", "edit", "reject"].includes(decision)
      )
        return null;
      if (!(await authorizeProject(principal, projectId))) return null;
      return registry.decide(ticketId, principal, projectId, decision);
    },
    read(principal: string, projectId: string, ticketId: string) {
      if (!valid(principal) || !valid(projectId) || !valid(ticketId)) return null;
      // Read is only a registry lookup. Do not expose this method directly
      // through HTTP without independent authenticated project authorization.
      return registry.read(ticketId, principal, projectId);
    },
  });
}
