import type { OriActiveProjectPersistence } from "./oriExpiringActiveProjectStore.js";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";

/**
 * Coordinates the active-project selection with authenticated session
 * lifecycle events. The caller must invoke these hooks from trusted auth
 * middleware, never from a browser-provided session identifier.
 */
export function createOriActiveProjectSessionLifecycle(
  persistence: OriActiveProjectPersistence & {
    migrate?: (
      accountId: string,
      oldSessionId: string,
      newSessionId: string,
      now: number,
    ) => Promise<boolean>;
  },
) {
  const valid = (s: string) => s.length > 0 && s.length <= 128;
  return Object.freeze({
    async signedOut(session: OriAuthenticatedSession): Promise<void> {
      if (!valid(session.accountId) || !valid(session.sessionId)) return;
      await persistence.delete(session.accountId, session.sessionId);
    },
    async rotated(
      previous: OriAuthenticatedSession,
      next: OriAuthenticatedSession,
    ): Promise<boolean> {
      if (
        !valid(previous.accountId) ||
        !valid(previous.sessionId) ||
        !valid(next.accountId) ||
        !valid(next.sessionId) ||
        previous.accountId !== next.accountId
      )
        return false;
      if (previous.sessionId === next.sessionId) return true;
      // Session rotation must never fall back to non-atomic read/write/delete.
      if (!persistence.migrate) return false;
      return persistence.migrate(
        previous.accountId,
        previous.sessionId,
        next.sessionId,
        Date.now(),
      );
    },
  });
}
