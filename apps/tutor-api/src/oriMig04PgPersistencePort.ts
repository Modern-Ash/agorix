import { semanticProjectHash, type StoredProject } from "@agorix/persistence";
import { validateStoredProject } from "@agorix/project-repository";
import {
  commitOriProjectWithPgFence,
  type OriPgCommitResult,
  type OriPgTransactionProvider,
} from "./oriMig04PostgresAtomicCas.js";
import { emergencyDisableOriPgRollout } from "./oriMig04PostgresEmergencyDisable.js";

/**
 * Trusted host-only integration boundary for canonical Ori project writes.
 * The proposal must already have been accepted and validated by the review
 * registry; this module is not an HTTP handler or authorization substitute.
 */
export function createOriMig04PgPersistencePort(
  provider: OriPgTransactionProvider,
  deploymentId: string,
) {
  if (!deploymentId || deploymentId.length > 128) {
    throw new Error("Invalid Ori deployment");
  }
  return Object.freeze({
    async apply({
      ownerId,
      projectId,
      expectedEpoch,
      expectedRevision,
      storedProject,
      updatedAt,
    }: {
      readonly ownerId: string;
      readonly projectId: string;
      readonly expectedEpoch: number;
      readonly expectedRevision: number;
      readonly storedProject: StoredProject;
      readonly updatedAt: string;
    }): Promise<OriPgCommitResult> {
      const canonical = validateStoredProject(storedProject);
      return commitOriProjectWithPgFence(provider, {
        deploymentId,
        ownerId,
        projectId,
        expectedEpoch,
        expectedRevision,
        storedProjectJson: JSON.stringify(canonical),
        semanticHash: semanticProjectHash(canonical),
        updatedAt,
      });
    },
    emergencyDisable(): Promise<number> {
      return emergencyDisableOriPgRollout(provider, deploymentId);
    },
  });
}
