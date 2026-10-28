import type { IncomingMessage, ServerResponse } from "node:http";
import type { ProjectRepository } from "@agorix/project-repository";
import type { WorldStateInput } from "@agorix/runtime";
import {
  createOriAuthorizedProjectIdentityResolver,
  type OriAuthenticatedSession,
} from "./oriAuthenticatedProjectIdentity.js";
import {
  createOriCanonicalReviewWorkflow,
  type OriLearningContext,
} from "./oriCanonicalReviewWorkflow.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
import { createOriPresentationServerComposition } from "./oriPresentationServerComposition.js";
import type { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";

/**
 * Complete server-side dependency composition for TutorServerOptions.
 * Production must supply a real authenticated session resolver, a trusted
 * server-side active-project selector, canonical project repository and
 * verified pedagogical context. No environment flag enables this by itself.
 */
export function createOriAuthorizedReviewOptions({
  repository,
  oriRoot,
  world,
  learningContext,
  resolveSession,
  activeProject,
  runOriOverride,
  presentationStore,
  oriMig04RolloutDecide,
  oriMig04CommitFence,
  oriMig04AtomicCommit,
}: {
  readonly repository: ProjectRepository;
  readonly oriRoot: string;
  readonly world: WorldStateInput;
  readonly learningContext: (
    owner: string,
    projectId: string,
  ) => Promise<OriLearningContext | null>;
  readonly resolveSession: (
    request: IncomingMessage,
    response?: ServerResponse,
  ) => Promise<OriAuthenticatedSession | null>;
  readonly activeProject: (session: OriAuthenticatedSession) => Promise<string | null>;
  /** Optional durable store; absent means presentation route remains disabled. */
  readonly presentationStore?: ReturnType<typeof openOriTicketPresentationSqliteStore>;
  readonly oriMig04RolloutDecide?: (projectId: string) => { readonly learnerVisible: boolean };
  readonly oriMig04CommitFence?: (
    projectId: string,
    write: () => Promise<void>,
  ) => Promise<boolean>;
  /** Trusted host-only atomic persistence callback. */
  readonly oriMig04AtomicCommit?: (
    owner: string,
    projectId: string,
    storedProject: Awaited<ReturnType<ProjectRepository["get"]>>["storedProject"],
    expectedRevision: number,
  ) => Promise<"applied" | "denied" | "conflict">;
  /** Test-only: production invokes the real Ori process. */
  readonly runOriOverride?: (evidence: unknown) => Promise<OriHostEvidenceResult>;
}) {
  // Pilot mode cannot expose learner-facing Ori without an atomic commit boundary.
  // A single-process fence is insufficient for multi-instance deployments.
  const pilotAllowed = Boolean(oriMig04RolloutDecide && oriMig04AtomicCommit);
  const guardedRollout = oriMig04RolloutDecide
    ? (projectId: string) => ({
        learnerVisible: pilotAllowed && oriMig04RolloutDecide(projectId).learnerVisible,
      })
    : undefined;
  const identity = createOriAuthorizedProjectIdentityResolver({
    repository,
    resolveSession,
    activeProject,
  });
  const workflow = createOriCanonicalReviewWorkflow({
    repository,
    oriRoot,
    world,
    learningContext,
    ...(runOriOverride ? { runOriOverride } : {}),
    ...(guardedRollout
      ? { mayCommit: (projectId: string) => guardedRollout(projectId).learnerVisible }
      : {}),
    ...(oriMig04CommitFence ? { commitFence: oriMig04CommitFence } : {}),
    ...(oriMig04AtomicCommit ? { atomicCommit: oriMig04AtomicCommit } : {}),
  });
  return Object.freeze({
    oriReviewEnabled: true as const,
    ...(guardedRollout ? { oriMig04RolloutDecide: guardedRollout } : {}),
    ...(presentationStore
      ? createOriPresentationServerComposition({
          identity,
          resolveTicket: (owner, projectId, ticketId) => workflow.read(owner, projectId, ticketId),
          store: presentationStore,
        })
      : {}),
    oriReviewIdentity: identity,
    ...(pilotAllowed
      ? {
          oriReviewApplyEnabled: true as const,
          oriReviewApply: (owner: string, projectId: string, ticketId: string, scriptId: string) =>
            workflow.applyAccepted(owner, projectId, ticketId, scriptId),
        }
      : {}),
    oriReviewPropose: (owner: string, projectId: string) => workflow.propose(owner, projectId),
    oriReviewDecision: (
      owner: string,
      projectId: string,
      ticketId: string,
      decision: "accept" | "edit" | "reject",
    ) => workflow.decide(owner, projectId, ticketId, decision),
  });
}
