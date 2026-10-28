import type { ProjectRepository } from "@agorix/project-repository";
import type { OriPgTransactionProvider } from "./oriMig04PostgresAtomicCas.js";
import { createOriMig04PgPersistencePort } from "./oriMig04PgPersistencePort.js";

export interface OriMig04TrustedEpoch {
  readonly deploymentId: string;
  readonly epoch: number;
}

/**
 * Trusted server-only adapter. Epoch is obtained from an authenticated,
 * host-owned rollout context, never from a browser request.
 *
 * The PostgreSQL CAS still rechecks the epoch and authorization under
 * the policy row lock. A stale context cannot authorize a write.
 */
export function createOriMig04PgHostAtomicCommit({
  provider,
  deploymentId,
  resolveEpoch,
  now = () => new Date().toISOString(),
}: {
  readonly provider: OriPgTransactionProvider;
  readonly deploymentId: string;
  readonly resolveEpoch: (owner: string, projectId: string) => Promise<OriMig04TrustedEpoch | null>;
  readonly now?: () => string;
}) {
  const port = createOriMig04PgPersistencePort(provider, deploymentId);
  return Object.freeze({
    async commit(
      owner: string,
      projectId: string,
      storedProject: Awaited<ReturnType<ProjectRepository["get"]>>["storedProject"],
      expectedRevision: number,
    ): Promise<"applied" | "denied" | "conflict"> {
      const context = await resolveEpoch(owner, projectId);
      if (
        !context ||
        context.deploymentId !== deploymentId ||
        !Number.isSafeInteger(context.epoch) ||
        context.epoch < 0
      ) {
        return "denied";
      }
      return port.apply({
        ownerId: owner,
        projectId,
        expectedEpoch: context.epoch,
        expectedRevision,
        storedProject,
        updatedAt: now(),
      });
    },
    emergencyDisable: port.emergencyDisable,
  });
}
