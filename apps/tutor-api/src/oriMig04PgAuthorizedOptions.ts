import type { Pool } from "pg";
import type { AuthService } from "@agorix/auth-service";
import type { ProjectRepository } from "@agorix/project-repository";
import type { WorldStateInput } from "@agorix/runtime";
import { createOriAuthServiceSessionResolver } from "./oriAuthServiceSessionResolver.js";
import { createOriAuthorizedReviewOptions } from "./oriAuthorizedReviewComposition.js";
import type { OriLearningContext } from "./oriCanonicalReviewWorkflow.js";
import { createOriMig04PgPilotProjectSelector } from "./oriMig04PgPilotProjectSelector.js";
import { oriKidsFreeWorld } from "./oriKidsFreeWorld.js";
import { createOriPilotVerifiedRun } from "./oriPilotVerifiedRun.js";
import { createOriPilotHintIssuer } from "./oriPilotHintIssuer.js";
import type { createOriSessionLearningJournal } from "./oriSessionLearningJournal.js";
import { createOriMig04PgTrustedComposition } from "./oriMig04PgTrustedComposition.js";
import { createOriPgTransactionProviderFromPool } from "./oriMig04PgTransactionProvider.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";

/**
 * Server-owned PostgreSQL composition for the private pilot. The caller must
 * supply the same database used by the canonical account/project services and
 * trusted learning evidence; constructing this does not activate any policy.
 */
export function createOriMig04PgAuthorizedOptions({
  pool,
  auth,
  repository,
  deploymentId,
  allowedAdultEmail,
  oriRoot,
  world,
  learningContext,
  sessionJournal,
  runOriOverride,
}: {
  readonly pool: Pool;
  readonly auth: Pick<AuthService, "resolveSession">;
  readonly repository: ProjectRepository;
  readonly deploymentId: string;
  readonly allowedAdultEmail: string;
  readonly oriRoot: string;
  readonly world: WorldStateInput;
  readonly learningContext?: (
    owner: string,
    projectId: string,
    sessionId?: string,
    semanticHash?: string,
  ) => Promise<OriLearningContext | null>;
  readonly sessionJournal?: ReturnType<typeof createOriSessionLearningJournal>;
  /** Test-only: production invokes the independent Ori process. */
  readonly runOriOverride?: (evidence: unknown) => Promise<OriHostEvidenceResult>;
}) {
  if ((learningContext === undefined) === (sessionJournal === undefined)) {
    throw new Error("Exactly one trusted Ori learning-context source is required");
  }
  const resolveSession = createOriAuthServiceSessionResolver(auth);
  const activeProject = createOriMig04PgPilotProjectSelector({
    pool,
    deploymentId,
    allowedAdultEmail,
  });
  const atomic = createOriMig04PgTrustedComposition({
    provider: createOriPgTransactionProviderFromPool(pool),
    deploymentId,
    allowedAdultEmail: allowedAdultEmail.trim().toLowerCase(),
  });
  const options = createOriAuthorizedReviewOptions({
    repository,
    oriRoot,
    world,
    worldForProject: oriKidsFreeWorld,
    learningContext: sessionJournal
      ? async (owner, projectId, sessionId, semanticHash) =>
          sessionJournal.learningContext(owner, projectId, sessionId, semanticHash ?? "")
      : learningContext!,
    ...(runOriOverride ? { runOriOverride } : {}),
    resolveSession,
    activeProject,
    oriMig04Visibility: async (owner, projectId) =>
      (await activeProject({ accountId: owner, sessionId: "server-policy-recheck" })) === projectId,
    oriMig04AtomicCommit: atomic.oriMig04AtomicCommit,
  });
  return Object.freeze({
    options: sessionJournal
      ? {
          ...options,
          oriPilotVerifiedRun: createOriPilotVerifiedRun({ repository, journal: sessionJournal }),
          oriPilotHintIssuer: createOriPilotHintIssuer({ repository, journal: sessionJournal }),
        }
      : options,
    emergencyDisable: atomic.emergencyDisable,
  });
}
