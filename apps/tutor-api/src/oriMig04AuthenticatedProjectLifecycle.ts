import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";
import type { createOriMig04PgSessionProjectLifecycle } from "./oriMig04PgSessionProjectLifecycle.js";

type Lifecycle = ReturnType<typeof createOriMig04PgSessionProjectLifecycle>;
type VerifiedSession = OriAuthenticatedSession;

/**
 * Trusted server-side account lifecycle. Identity must be supplied by the
 * AuthService resolver, never from request body, query string or headers.
 */
export function createOriMig04AuthenticatedProjectLifecycle(lifecycle: Lifecycle) {
  if (!lifecycle || typeof lifecycle.select !== "function" ||
      typeof lifecycle.revoke !== "function" || typeof lifecycle.revokeAll !== "function") {
    throw new Error("Missing durable Ori project lifecycle");
  }
  function requireIdentity(session: VerifiedSession): VerifiedSession {
    if (!session || typeof session.accountId !== "string" ||
        typeof session.sessionId !== "string" ||
        !session.accountId || !session.sessionId) {
      throw new Error("Missing verified Ori session identity");
    }
    return session;
  }
  return Object.freeze({
    async selectProject(session: VerifiedSession, projectId: string): Promise<void> {
      const verified = requireIdentity(session);
      await lifecycle.select(verified.accountId, verified.sessionId, projectId);
    },
    async logout(session: VerifiedSession): Promise<void> {
      const verified = requireIdentity(session);
      await lifecycle.revoke(verified.accountId, verified.sessionId);
    },
    async revokeAccountSessions(accountId: string): Promise<void> {
      if (!accountId) throw new Error("Missing verified Ori account identity");
      await lifecycle.revokeAll(accountId);
    },
  });
}
