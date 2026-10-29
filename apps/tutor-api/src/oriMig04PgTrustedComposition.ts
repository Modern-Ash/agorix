import type { OriPgTransactionProvider } from "./oriMig04PostgresAtomicCas.js";
import { createOriMig04PgEpochResolver } from "./oriMig04PgEpochResolver.js";
import { createOriMig04PgHostAtomicCommit } from "./oriMig04PgHostAtomicCommit.js";

/**
 * Trusted host-only composition. Never construct this from learner input.
 * Requires a PostgreSQL transaction provider backed by a shared database.
 * Does not enable Ori routes or rollout on its own.
 */
export function createOriMig04PgTrustedComposition({
  provider,
  deploymentId,
  allowedAdultEmail,
  now,
}: {
  readonly provider: OriPgTransactionProvider;
  readonly deploymentId: string;
  readonly allowedAdultEmail?: string;
  readonly now?: () => string;
}) {
  const resolveEpoch = createOriMig04PgEpochResolver(provider, deploymentId);
  const host = createOriMig04PgHostAtomicCommit({
    provider,
    deploymentId,
    ...(allowedAdultEmail ? { allowedAdultEmail } : {}),
    resolveEpoch,
    ...(now ? { now } : {}),
  });
  return Object.freeze({
    oriMig04AtomicCommit: host.commit,
    emergencyDisable: host.emergencyDisable,
  });
}
