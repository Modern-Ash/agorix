import type { IncomingMessage, ServerResponse } from "node:http";
import type { ProjectRepository } from "@agorix/project-repository";
import type { OriReviewIdentityResolver } from "./oriReviewHttpContract.js";

export interface OriAuthenticatedSession {
  readonly accountId: string;
  readonly sessionId: string;
}
/**
 * Trusted authentication middleware resolves the account and session.
 * The active project is selected from server-owned session state, not a
 * request body, query string, or arbitrary project header.
 */
export function createOriAuthorizedProjectIdentityResolver({
  resolveSession,
  activeProject,
  repository,
}: {
  readonly resolveSession: (
    request: IncomingMessage,
    response?: ServerResponse,
  ) => Promise<OriAuthenticatedSession | null>;
  readonly activeProject: (session: OriAuthenticatedSession) => Promise<string | null>;
  readonly repository: ProjectRepository;
}): OriReviewIdentityResolver {
  const valid = (s: string) => s.length > 0 && s.length <= 128;
  return async (request, response) => {
    try {
      const session = await resolveSession(request, response);
      if (!session || !valid(session.accountId) || !valid(session.sessionId)) return null;
      const projectId = await activeProject(session);
      if (!projectId || !valid(projectId)) return null;
      const project = await repository.get(session.accountId, projectId);
      if (project.ownerId !== session.accountId || project.projectId !== projectId) return null;
      return { ownerId: session.accountId, projectId };
    } catch {
      return null;
    }
  };
}
