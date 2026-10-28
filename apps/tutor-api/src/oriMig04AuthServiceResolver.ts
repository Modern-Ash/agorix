import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthService } from "@agorix/auth-service";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";

/**
 * Adapts the actual Agorix AuthService to Ori's trusted session boundary.
 * The caller supplies a server-owned token extractor (e.g. verified cookie
 * middleware). Never infer an identity from x-owner-id or x-project-id.
 */
export function createOriMig04AuthServiceResolver({
  auth,
  sessionToken,
  onRotatedToken,
}: {
  readonly auth: Pick<AuthService, "resolveSession">;
  readonly sessionToken: (request: IncomingMessage) => string | null;
  readonly onRotatedToken?: (
    response: ServerResponse,
    token: string,
  ) => void;
}): (request: IncomingMessage, response?: ServerResponse) => Promise<OriAuthenticatedSession | null> {
  if (!auth || typeof auth.resolveSession !== "function" || typeof sessionToken !== "function") {
    throw new Error("Missing trusted Ori authentication dependencies");
  }
  return async (request, response) => {
    try {
      const token = sessionToken(request);
      if (!token) return null;
      const resolved = await auth.resolveSession(token);
      if (
        !resolved.account.accountId ||
        resolved.account.accountId !== resolved.session.accountId ||
        !resolved.session.sessionId
      ) return null;
      // Rotated sessions must not be used unless the new token is delivered.
      if (resolved.rotated) {
        if (!response || !onRotatedToken) return null;
        onRotatedToken(response, resolved.sessionToken);
      }
      return {
        accountId: resolved.account.accountId,
        sessionId: resolved.session.sessionId,
      };
    } catch {
      return null;
    }
  };
}
