import type { IncomingMessage, ServerResponse } from "node:http";
import type { createOriEducatorAdminHttpAdapter } from "./oriEducatorAdminHttpAdapter.js";

type Handler = ReturnType<typeof createOriEducatorAdminHttpAdapter>;
const prefix = "/api/tutor/admin/ori-educator/";
function reply(response: ServerResponse, status: number, reason: string): void {
  if (response.headersSent || response.writableEnded || response.destroyed) return;
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify({ error: reason }));
}

/**
 * Optional adult-only route dispatcher. The host must explicitly mount it,
 * inject a role-protected handler and enable it; no route is registered here.
 */
export function createOriEducatorRouteDispatcher({
  handler,
  enabled = false,
}: {
  readonly handler: Handler;
  readonly enabled?: boolean;
}) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const path = new URL(request.url ?? "/", "http://local").pathname;
    if (!path.startsWith(prefix)) return false;
    if (!enabled) { reply(response, 404, "not-found"); return true; }
    const parts = path.slice(prefix.length).split("/");
    if (parts.length !== 2 || !/^[a-zA-Z0-9_-]{1,80}$/.test(parts[0] ?? "") ||
      !["snapshot", "decide", "audit"].includes(parts[1] ?? "")) {
      reply(response, 404, "not-found"); return true;
    }
    if (request.method !== "POST") {
      reply(response, 405, "method-not-allowed"); return true;
    }
    try {
      await handler(parts[1] as "snapshot" | "decide" | "audit", parts[0]!, request, response);
    } catch {
      reply(response, 503, "unavailable");
    }
    return true;
  };
}
