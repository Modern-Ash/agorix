import type { createOriMig04PgAuthenticatedTutorServer } from "./oriMig04PgAuthenticatedTutorServer.js";

type TrustedOri = Omit<
  Parameters<typeof createOriMig04PgAuthenticatedTutorServer>[0]["ori"],
  "pool"
>;

/** Reject incomplete trusted infrastructure before opening a database pool. */
export function assertOriMig04RuntimeDependencies(ori: TrustedOri): void {
  if (
    !ori ||
    !ori.auth ||
    typeof ori.auth.resolveSession !== "function" ||
    typeof ori.sessionToken !== "function" ||
    !ori.repository ||
    typeof ori.repository.get !== "function" ||
    typeof ori.activeProject !== "function" ||
    typeof ori.learningContext !== "function" ||
    typeof ori.rolloutDecide !== "function" ||
    typeof ori.oriRoot !== "string" ||
    ori.oriRoot.length === 0 ||
    !ori.world
  ) {
    throw new Error("Missing trusted Ori runtime dependencies");
  }
}
