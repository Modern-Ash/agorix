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
  onRotatedSession,
}: {
  readonly auth: Pick<AuthService, "resolveSession">;
  readonly sessionToken: (request: IncomingMessage) => string | null;
  readonly onRotatedToken?: (response: ServerResponse, token: string) => void;
  readonly onRotatedSession?: (
    previous: OriAuthenticatedSession,
    current: OriAuthenticatedSession,
  ) => Promise<boolean>;
}): (
  request: IncomingMessage,
  response?: ServerResponse,
) => Promise<OriAuthenticatedSession | null> {
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
      )
        return null;
      const current = {
        accountId: resolved.account.accountId,
        sessionId: resolved.session.sessionId,
      };
      // The old session is supplied by AuthService, never by request headers.
      if (resolved.rotated) {
        if (!response || !onRotatedToken || !onRotatedSession || !resolved.previousSessionId) {
          return null;
        }
        const migrated = await onRotatedSession(
          { accountId: current.accountId, sessionId: resolved.previousSessionId },
          current,
        );
        if (!migrated) return null;
        try {
          onRotatedToken(response, resolved.sessionToken);
        } catch {
          // A failed cookie delivery must not leave a usable migrated project mapping.
          await onRotatedSession(current, {
            accountId: current.accountId,
            sessionId: resolved.previousSessionId,
          }).catch(() => false);
          return null;
        }
      }
      return current;
    } catch {
      return null;
    }
  };
}
