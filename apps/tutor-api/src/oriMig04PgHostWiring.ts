import type { OriPgPool } from "./oriMig04PgTransactionProvider.js";
import { createOriPgTransactionProvider } from "./oriMig04PgTransactionProvider.js";
import { createOriMig04PgTrustedComposition } from "./oriMig04PgTrustedComposition.js";

/**
 * Production-oriented dependency wiring for a host with an authenticated
 * project repository and a shared PostgreSQL pool.
 *
 * Explicitly inject the returned oriMig04AtomicCommit into
 * createOriAuthorizedReviewOptions. This module does not enable any route.
 */
export function createOriMig04PgHostWiring({
  pool,
  deploymentId,
  now,
}: {
  readonly pool: OriPgPool;
  readonly deploymentId: string;
  readonly now?: () => string;
}) {
  const provider = createOriPgTransactionProvider(pool);
  const trusted = createOriMig04PgTrustedComposition({
    provider,
    deploymentId,
    ...(now ? { now } : {}),
  });
  return Object.freeze({
    oriMig04AtomicCommit: trusted.oriMig04AtomicCommit,
    emergencyDisable: trusted.emergencyDisable,
  });
}
