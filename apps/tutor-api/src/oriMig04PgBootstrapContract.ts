import type { IncomingMessage, ServerResponse } from "node:http";
import type { ProjectRepository } from "@agorix/project-repository";
import type { WorldStateInput } from "@agorix/runtime";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";
import type { OriLearningContext } from "./oriCanonicalReviewWorkflow.js";
import { createOriMig04PgAuthorizedHostOptions } from "./oriMig04PgAuthorizedHostComposition.js";
import type { OriPgPool } from "./oriMig04PgTransactionProvider.js";

/**
 * Server-only bootstrap contract. All dependencies must come from trusted
 * infrastructure; environment flags and client headers cannot authorize Ori.
 */
export function createOriMig04PgBootstrap({
  pool,
  deploymentId,
  repository,
  oriRoot,
  world,
  learningContext,
  resolveSession,
  activeProject,
  rolloutDecide,
}: {
  readonly pool: OriPgPool;
  readonly deploymentId: string;
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
  readonly rolloutDecide: (projectId: string) => { readonly learnerVisible: boolean };
}) {
  return createOriMig04PgAuthorizedHostOptions({
    pool,
    deploymentId,
    repository,
    oriRoot,
    world,
    learningContext,
    resolveSession,
    activeProject,
    rolloutDecide,
  });
}
