import type { AuthService } from "@agorix/auth-service";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";
import type { createOriMig04AuthenticatedProjectLifecycle } from "./oriMig04AuthenticatedProjectLifecycle.js";

type Projects = ReturnType<typeof createOriMig04AuthenticatedProjectLifecycle>;

/**
 * Trusted server-only bridge between AuthService and project lifecycle.
 * Request handlers must resolve identity with AuthService first.
 */
export function createOriMig04AuthenticatedSessionActions({
  auth,
  projects,
}: {
  readonly auth: Pick<AuthService, "resolveSession" | "signOut" | "deleteAccount">;
  readonly projects: Projects;
}) {
  if (!auth || typeof auth.resolveSession !== "function" ||
      typeof auth.signOut !== "function" || typeof auth.deleteAccount !== "function" ||
      !projects || typeof projects.selectProject !== "function" ||
      typeof projects.logout !== "function" ||
      typeof projects.revokeAccountSessions !== "function") {
    throw new Error("Missing trusted Ori session lifecycle dependencies");
  }

  async function verified(
    token: string,
    onRotatedToken?: (token: string) => void,
  ): Promise<{ session: OriAuthenticatedSession; token: string }> {
    if (!token) throw new Error("Missing trusted Ori session token");
    const result = await auth.resolveSession(token);
    if (result.rotated && !onRotatedToken) {
      throw new Error("Ori session rotation requires coordinated cookie delivery");
    }
    if (result.account.accountId !== result.session.accountId) {
      throw new Error("Ori session account mismatch");
    }
    const session = {
      accountId: result.account.accountId,
      sessionId: result.session.sessionId,
    };
    if (result.rotated) {
      if (!result.previousSessionId) throw new Error("Missing previous Ori session");
      // The old credential is already invalid. Clear its project selection.
      await projects.logout({ ...session, sessionId: result.previousSessionId });
      onRotatedToken?.(result.sessionToken);
    }
    return { session, token: result.sessionToken };
  }

  return Object.freeze({
    async selectProject(
      token: string,
      projectId: string,
      onRotatedToken?: (token: string) => void,
    ): Promise<void> {
      const { session } = await verified(token, onRotatedToken);
      await projects.selectProject(session, projectId);
    },
    async signOut(token: string): Promise<void> {
      const { session, token: currentToken } = await verified(token, () => undefined);
      // Revoke the real credential first; stale project mappings cannot authorize.
      await auth.signOut(currentToken);
      await projects.logout(session);
    },
    async deleteAccount(token: string, password: string): Promise<void> {
      const { session } = await verified(token, () => undefined);
      await auth.deleteAccount(session.accountId, password, async () => {
        await projects.revokeAccountSessions(session.accountId);
      });
    },
  });
}
