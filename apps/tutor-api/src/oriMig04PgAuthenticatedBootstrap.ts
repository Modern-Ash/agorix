import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthService } from "@agorix/auth-service";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";
import { createOriMig04PgBootstrap } from "./oriMig04PgBootstrapContract.js";
import { createOriMig04AuthServiceResolver } from "./oriMig04AuthServiceResolver.js";

/**
 * Real AuthService-backed bootstrap for infrastructure-owned deployments.
 * A trusted middleware must extract the session token; project selection and
 * repository ownership are still verified by the existing identity resolver.
 */
export function createOriMig04PgAuthenticatedBootstrap({
  auth,
  sessionToken,
  onRotatedToken,
  onRotatedSession,
  ...ori
}: Omit<Parameters<typeof createOriMig04PgBootstrap>[0], "resolveSession"> & {
  readonly auth: Pick<AuthService, "resolveSession">;
  readonly sessionToken: (request: IncomingMessage) => string | null;
  readonly onRotatedToken?: (response: ServerResponse, token: string) => void;
  readonly onRotatedSession?: (
    previous: OriAuthenticatedSession,
    current: OriAuthenticatedSession,
  ) => Promise<boolean>;
}) {
  const resolveSession = createOriMig04AuthServiceResolver({
    auth,
    sessionToken,
    ...(onRotatedToken ? { onRotatedToken } : {}),
    ...(onRotatedSession ? { onRotatedSession } : {}),
  });
  return createOriMig04PgBootstrap({ ...ori, resolveSession });
}
