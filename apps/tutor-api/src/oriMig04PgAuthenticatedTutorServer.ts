import { createTutorServer, type TutorServerOptions } from "./server.js";
import { createOriMig04PgAuthenticatedBootstrap } from "./oriMig04PgAuthenticatedBootstrap.js";

/**
 * Explicit authenticated TutorServer entrypoint for trusted infrastructure.
 * The session token must be supplied by server-owned middleware, while
 * active-project selection and canonical repository are mandatory inputs.
 */
export function createOriMig04PgAuthenticatedTutorServer({
  tutor,
  ori,
}: {
  readonly tutor: TutorServerOptions;
  readonly ori: Parameters<typeof createOriMig04PgAuthenticatedBootstrap>[0];
}) {
  const trusted = createOriMig04PgAuthenticatedBootstrap(ori);
  const server = createTutorServer({ ...tutor, ...trusted.options });
  return Object.freeze({ server, emergencyDisable: trusted.emergencyDisable });
}
