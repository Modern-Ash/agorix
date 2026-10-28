import type { IncomingMessage, ServerResponse } from "node:http";
import type { ProjectRepository } from "@agorix/project-repository";
import type { WorldStateInput } from "@agorix/runtime";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";
import type { OriLearningContext } from "./oriCanonicalReviewWorkflow.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";
import { createOriMig04PgHostWiring } from "./oriMig04PgHostWiring.js";
import type { OriPgPool } from "./oriMig04PgTransactionProvider.js";

/**
 * Trusted host-only composition. A caller must provide an authenticated
 * session resolver, canonical repository and shared PostgreSQL pool.
 * No environment flag, browser input or fallback repository write enables
 * the pilot. The rollout decision must remain explicitly fail-closed.
 */
export function createOriMig04PgAuthorizedHostOptions({
  pool,
  deploymentId,
  repository,
  oriRoot,
  world,
  learningContext,
  resolveSession,
  activeProject,
  rolloutDecide,
  runOriOverride,
}: {
  readonly pool: OriPgPool;
  readonly deploymentId: string;
  readonly repository: ProjectRepository;
  readonly oriRoot: string;
  readonly world: WorldStateInput;
  readonly learningContext: (owner: string, projectId: string) => Promise<OriLearningContext | null>;
  readonly resolveSession: (
    request: IncomingMessage,
    response?: ServerResponse,
  ) => Promise<OriAuthenticatedSession | null>;
  readonly activeProject: (session: OriAuthenticatedSession) => Promise<string | null>;
  readonly rolloutDecide: (projectId: string) => { readonly learnerVisible: boolean };
  /** Test-only: inject verified host evidence without spawning Ori CLI. */
  readonly runOriOverride?: (evidence: unknown) => Promise<OriHostEvidenceResult>;
}) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(deploymentId)) {
    throw new Error("Invalid Ori deployment identifier");
  }
  if (
    !pool ||
    typeof pool.connect !== "function" ||
    !repository ||
    !oriRoot ||
    typeof resolveSession !== "function" ||
    typeof activeProject !== "function" ||
    typeof learningContext !== "function" ||
    typeof rolloutDecide !== "function"
  ) {
    throw new Error("Missing trusted Ori host dependencies");
  }
  const persistence = createOriMig04PgHostWiring({ pool, deploymentId });
  const options = createOriAuthorizedReviewOptions({
    repository,
    oriRoot,
    world,
    learningContext,
    resolveSession,
    activeProject,
    oriMig04RolloutDecide: rolloutDecide,
    oriMig04AtomicCommit: persistence.oriMig04AtomicCommit,
    ...(runOriOverride ? { runOriOverride } : {}),
  });
  return Object.freeze({
    options,
    emergencyDisable: persistence.emergencyDisable,
  });
}
