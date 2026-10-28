import { createTutorServer, type TutorServerOptions } from "./server.js";
import { createOriMig04PgBootstrap } from "./oriMig04PgBootstrapContract.js";

/**
 * Explicit server bootstrap for trusted Ori deployments. Unlike a flag in
 * main.ts, this requires authenticated infrastructure to be supplied by the
 * host. The rollout decision remains mandatory and fail-closed.
 */
export function createOriMig04PgTutorServer({
  tutor,
  ori,
}: {
  readonly tutor: TutorServerOptions;
  readonly ori: Parameters<typeof createOriMig04PgBootstrap>[0];
}) {
  const trusted = createOriMig04PgBootstrap(ori);
  const server = createTutorServer({ ...tutor, ...trusted.options });
  return Object.freeze({ server, emergencyDisable: trusted.emergencyDisable });
}
