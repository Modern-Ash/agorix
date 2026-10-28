import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";

/**
 * A server-owned session-to-project lookup. The browser cannot supply the
 * project identifier; it must be retrieved by authenticated session identity.
 */
export interface OriSessionProjectStore {
  getActiveProject(accountId: string, sessionId: string): Promise<string | null>;
}

const VALID_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function createOriMig04ActiveProjectResolver(store: OriSessionProjectStore) {
  if (!store || typeof store.getActiveProject !== "function") {
    throw new Error("Missing trusted Ori session-project store");
  }
  return async (session: OriAuthenticatedSession): Promise<string | null> => {
    if (!VALID_ID.test(session.accountId) || !VALID_ID.test(session.sessionId)) return null;
    try {
      const projectId = await store.getActiveProject(session.accountId, session.sessionId);
      return typeof projectId === "string" && VALID_ID.test(projectId) ? projectId : null;
    } catch {
      return null;
    }
  };
}
