import type { ProjectRepository } from "@agorix/project-repository";
import type { WorldStateInput } from "@agorix/runtime";
import { createOriCanonicalExecutionPort } from "./oriCanonicalExecutionPort.js";
import {
  createOriPersistedEvidenceResolver,
  oriEvidenceRevision,
} from "./oriPersistedEvidenceResolver.js";
import { createOriHostEvidenceAdapter } from "./oriHostEvidenceAdapter.js";
import { createOriProjectReviewService } from "./oriProjectReviewService.js";
import { createOriReviewRegistry } from "./oriReviewRegistry.js";
import { applyApprovedOriProposal } from "./oriApprovedProjectApply.js";

export interface OriLearningContext {
  readonly attempts: number;
  readonly hintsUsed: number;
  readonly learningStage: "explore" | "connect" | "translate";
}
/**
 * Trusted server-only composition of canonical repository -> runtime ->
 * evidence -> independent Ori process -> review ticket. The caller supplies
 * authenticated owner identity and a real pedagogical evidence source.
 */
export function createOriCanonicalReviewWorkflow({
  repository,
  oriRoot,
  world,
  learningContext,
  runOriOverride,
  mayCommit,
  commitFence,
}: {
  readonly repository: ProjectRepository;
  readonly oriRoot: string;
  readonly world: WorldStateInput;
  readonly learningContext: (
    owner: string,
    projectId: string,
  ) => Promise<OriLearningContext | null>;
  /** Test-only injection; production uses the independent Ori process. */
  readonly runOriOverride?: ReturnType<typeof createOriHostEvidenceAdapter>;
  readonly mayCommit?: (projectId: string) => boolean;
  readonly commitFence?: (projectId: string, write: () => Promise<void>) => Promise<boolean>;
}) {
  const execute = createOriCanonicalExecutionPort({ world, maxSteps: 100 });
  const resolve = createOriPersistedEvidenceResolver({ repository, execute, learningContext });
  const runOri = runOriOverride ?? createOriHostEvidenceAdapter({ oriRoot });
  const ticketProjects = new Map<
    string,
    { owner: string; projectId: string; revision: number; hash: string; created: number }
  >();
  const TICKET_TTL_MS = 5 * 60 * 1000;
  const MAX_BINDINGS = 100;
  const purgeBindings = () => {
    const now = Date.now();
    for (const [id, binding] of ticketProjects)
      if (now - binding.created >= TICKET_TTL_MS) ticketProjects.delete(id);
  };
  const registry = createOriReviewRegistry({
    currentRevision: async (id) => {
      purgeBindings();
      const binding = ticketProjects.get(id);
      if (!binding) return "";
      try {
        const record = await repository.get(binding.owner, binding.projectId);
        return record.ownerId === binding.owner &&
          record.projectId === binding.projectId &&
          record.revision === binding.revision &&
          record.semanticHash === binding.hash
          ? oriEvidenceRevision(record.semanticHash, record.revision)
          : "0".repeat(64);
      } catch {
        return "";
      }
    },
  });
  const appliedTickets = new Set<string>();
  const applyingTickets = new Set<string>();
  const service = createOriProjectReviewService({
    resolveProject: async (owner, projectId) => resolve(owner, projectId, "move"),
    authorizeProject: async (owner, projectId) => {
      try {
        const record = await repository.get(owner, projectId);
        return record.ownerId === owner && record.projectId === projectId;
      } catch {
        return false;
      }
    },
    runOri,
    registry,
  });
  return Object.freeze({
    async propose(owner: string, projectId: string) {
      purgeBindings();
      if (ticketProjects.size >= MAX_BINDINGS) return null;
      const ticket = await service.propose(owner, projectId);
      if (ticket) {
        try {
          const record = await repository.get(owner, projectId);
          if (
            record.ownerId !== owner ||
            record.projectId !== projectId ||
            typeof record.semanticHash !== "string" ||
            !record.semanticHash
          )
            return null;
          ticketProjects.set(ticket.id, {
            owner,
            projectId,
            revision: record.revision,
            hash: record.semanticHash,
            created: Date.now(),
          });
        } catch {
          return null;
        }
      }
      return ticket;
    },
    async decide(
      owner: string,
      projectId: string,
      ticketId: string,
      decision: "accept" | "edit" | "reject",
    ) {
      purgeBindings();
      const ticket = await service.decide(owner, projectId, ticketId, decision);
      // Retain the server-owned revision binding for an accepted ticket until
      // explicit application or TTL expiry. Reject/edit need no mutation.
      if (ticket && ticket.status !== "pending" && ticket.status !== "accepted")
        ticketProjects.delete(ticketId);
      return ticket;
    },
    /**
     * Explicit server-only apply operation. Call only with a principal
     * authenticated by trusted middleware; never accept owner from a browser
     * body. The ticket must already have an accepted review decision.
     */
    async applyAccepted(owner: string, projectId: string, ticketId: string, scriptId: string) {
      purgeBindings();
      if (appliedTickets.has(ticketId) || applyingTickets.has(ticketId)) return "rejected" as const;
      if (!owner || !projectId || !ticketId || !scriptId) return "rejected" as const;
      const ticket = await service.read(owner, projectId, ticketId);
      if (!ticket || ticket.status !== "accepted") return "rejected" as const;
      const binding = ticketProjects.get(ticketId);
      if (!binding || binding.owner !== owner || binding.projectId !== projectId)
        return "rejected" as const;
      applyingTickets.add(ticketId);
      try {
        const result = await applyApprovedOriProposal({
          repository,
          owner,
          projectId,
          expectedRevision: binding.revision,
          approved: true,
          proposal: ticket.proposal,
          allowedBlocks: ["move"],
          scriptId,
          ...(mayCommit ? { mayCommit: () => mayCommit(projectId) } : {}),
          ...(commitFence ? { commitFence: (write: () => Promise<void>) => commitFence(projectId, write) } : {}),
        });
        if (result === "applied") appliedTickets.add(ticketId);
        return result;
      } finally {
        applyingTickets.delete(ticketId);
      }
    },
    async read(owner: string, projectId: string, ticketId: string) {
      purgeBindings();
      // Revalidate project access; the registry's owner/project match alone
      // is not proof that ownership remains valid.
      try {
        const record = await repository.get(owner, projectId);
        if (record.ownerId !== owner || record.projectId !== projectId) return null;
        return service.read(owner, projectId, ticketId);
      } catch {
        return null;
      }
    },
  });
}
