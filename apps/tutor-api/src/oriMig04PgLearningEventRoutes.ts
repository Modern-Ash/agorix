import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthService } from "@agorix/auth-service";
import { createOriMig04SessionCookieTransport } from "./oriMig04SessionCookieTransport.js";
import type { OriLearningEvent } from "./oriMig04PgLearningEvents.js";

/**
 * Authenticated, same-origin learning-event boundary. Never accepts owner ID,
 * counters, session ID or project ID as authority. The active project is
 * resolved from the verified account/session mapping.
 */
export function createOriMig04PgLearningEventRoutes({
  auth,
  activeProject,
  record,
}: {
  readonly auth: Pick<AuthService, "resolveSession">;
  readonly activeProject: (accountId: string, sessionId: string) => Promise<string | null>;
  readonly record: (accountId: string, projectId: string, event: OriLearningEvent) => Promise<boolean>;
}) {
  const cookies = createOriMig04SessionCookieTransport();
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const path = new URL(request.url ?? "/", "http://local").pathname;
    if (path !== "/api/tutor/ori/learning/event") return false;
    const send = (status: number) => {
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(status === 204 ? undefined : JSON.stringify({ status: "denied" }));
    };
    if (request.method !== "POST") { send(405); return true; }
    let originOk = false;
    try {
      const origin = new URL(request.headers.origin ?? "");
      originOk = origin.protocol === "https:" && origin.host === request.headers.host;
    } catch { originOk = false; }
    if (!originOk || !/^application\/json(?:\s*;|\s*$)/i.test(request.headers["content-type"] ?? "")) {
      send(403); return true;
    }
    try {
      const token = cookies.sessionToken(request);
      if (!token) { send(401); return true; }
      // No client event is trusted as pedagogical evidence. Validation of
      // event provenance belongs in the authenticated runtime/hint handler.
      // Keep the public route explicitly denied rather than accepting forged
      // attempts, hints or stages.
      void auth;
      void activeProject;
      void record;
      send(403);
    } catch {
      send(403);
    }
    return true;
  };
}
