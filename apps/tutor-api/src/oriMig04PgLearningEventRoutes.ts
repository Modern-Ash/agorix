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
      let raw = "";
      for await (const chunk of request) {
        raw += String(chunk);
        if (raw.length > 1024) { send(413); return true; }
      }
      const payload: unknown = JSON.parse(raw);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        send(400); return true;
      }
      const fields = payload as Record<string, unknown>;
      if (Object.keys(fields).sort().join() !== "kind" &&
          Object.keys(fields).sort().join() !== "kind,stage") {
        send(400); return true;
      }
      const kind = fields["kind"];
      const event: OriLearningEvent | null =
        kind === "attempt" || kind === "hint"
          ? Object.keys(fields).length === 1 ? { kind } : null
          : kind === "stage" && ["explore", "connect", "translate"].includes(String(fields["stage"]))
            ? { kind, stage: fields["stage"] as "explore" | "connect" | "translate" }
            : null;
      if (!event) { send(400); return true; }
      // A browser request cannot prove a genuine attempt or hint. These
      // events must originate from the trusted execution/hint handlers.
      if (event.kind === "attempt" || event.kind === "hint") {
        send(403); return true;
      }
      const resolved = await auth.resolveSession(token);
      if (resolved.rotated) {
        if (!resolved.previousSessionId) { send(403); return true; }
        // Do not move project mapping or accept events during token rotation.
        // A trusted session lifecycle must coordinate rotation first.
        send(409); return true;
      }
      const accountId = resolved.account.accountId;
      if (accountId !== resolved.session.accountId) { send(403); return true; }
      const projectId = await activeProject(accountId, resolved.session.sessionId);
      if (!projectId || !(await record(accountId, projectId, event))) {
        send(403); return true;
      }
      send(204);
    } catch {
      send(403);
    }
    return true;
  };
}
