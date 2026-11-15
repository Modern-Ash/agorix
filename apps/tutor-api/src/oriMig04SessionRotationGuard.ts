import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";

/**
 * Reconciles a verified AuthService session rotation with durable project
 * selection. Never derives the old/new session from browser-controlled input.
 */
export function createOriMig04SessionRotationGuard({
  rotate,
  revoke,
}: {
  readonly rotate: (accountId: string, oldSessionId: string, newSessionId: string) => Promise<void>;
  readonly revoke: (accountId: string, sessionId: string) => Promise<void>;
}) {
  if (typeof rotate !== "function" || typeof revoke !== "function") {
    throw new Error("Missing trusted Ori session rotation lifecycle");
  }
  return Object.freeze({
    async onResolved(
      previous: OriAuthenticatedSession,
      current: OriAuthenticatedSession,
    ): Promise<boolean> {
      if (!previous.accountId || previous.accountId !== current.accountId) return false;
      if (!previous.sessionId || !current.sessionId) return false;
      if (previous.sessionId === current.sessionId) return true;
      try {
        await rotate(current.accountId, previous.sessionId, current.sessionId);
        return true;
      } catch {
        await revoke(current.accountId, previous.sessionId).catch(() => undefined);
        return false;
      }
    },
  });
}
