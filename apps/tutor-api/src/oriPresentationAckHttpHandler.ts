import type { IncomingMessage, ServerResponse } from "node:http";
import type { OriReviewIdentityResolver } from "./oriReviewHttpContract.js";
import type { createOriTicketPresentationAcknowledgement } from "./oriTicketPresentationAcknowledgement.js";

type Service = ReturnType<typeof createOriTicketPresentationAcknowledgement>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reply(response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent || response.writableEnded || response.destroyed) return;
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}
/**
 * Opt-in HTTP handler only. Host must mount behind a disabled-by-default
 * feature gate and supply authenticated project identity from server state.
 */
export function createOriPresentationAckHttpHandler(
  identity: OriReviewIdentityResolver,
  service: Service,
) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (request.method !== "POST") return reply(response, 405, { error: "method" });
    const origin = request.headers.origin;
    const host = request.headers.host;
    let sameOrigin = false;
    try {
      const parsed = new URL(origin ?? "");
      sameOrigin = parsed.host === host && ["http:", "https:"].includes(parsed.protocol);
    } catch {
      /* invalid origin */
    }
    if (request.headers["x-agorix-request"] !== "1" || !sameOrigin)
      return reply(response, 403, { error: "forbidden" });
    const principal = await identity(request, response);
    if (!principal) return reply(response, 401, { error: "unauthorized" });
    let data: unknown;
    try {
      let body = "";
      for await (const chunk of request) {
        body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        if (Buffer.byteLength(body) > 1024) return reply(response, 413, { error: "too-large" });
      }
      data = JSON.parse(body);
    } catch {
      return reply(response, 400, { error: "invalid-json" });
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      return reply(response, 400, { error: "invalid-body" });
    const payload = data as Record<string, unknown>;
    if (
      Object.keys(payload).sort().join() !== "description,ticketId" ||
      typeof payload["ticketId"] !== "string" ||
      !UUID.test(payload["ticketId"]) ||
      typeof payload["description"] !== "string"
    )
      return reply(response, 400, { error: "invalid-body" });
    const result = await service.acknowledge(
      principal.ownerId,
      principal.projectId,
      payload["ticketId"],
      payload["description"],
    );
    return reply(response, result === "recorded" ? 200 : result === "invalid" ? 400 : 503, {
      status: result,
    });
  };
}
