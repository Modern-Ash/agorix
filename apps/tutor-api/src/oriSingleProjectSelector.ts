import type { ProjectRepository } from "@agorix/project-repository";
import type { OriAuthenticatedSession } from "./oriAuthenticatedProjectIdentity.js";

/**
 * Conservative server-owned project selection for a learner with exactly
 * one project. No browser-provided project ID or client-side active state.
 * Multiple projects require a separate authenticated server-side selection.
 */
export function createOriSingleProjectSelector(repository: Pick<ProjectRepository, "list">) {
  return async (session: OriAuthenticatedSession): Promise<string | null> => {
    if (!session.accountId || !session.sessionId) return null;
    try {
      const page = await repository.list(session.accountId);
      if (page.nextCursor !== undefined || page.items.length !== 1) return null;
      const project = page.items[0];
      if (!project || project.ownerId !== session.accountId || !project.projectId) return null;
      return project.projectId;
    } catch {
      return null;
    }
  };
}
