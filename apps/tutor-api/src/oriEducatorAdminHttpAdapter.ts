import type { IncomingMessage, ServerResponse } from "node:http";
import type { createOriEducatorAdminComposition } from "./oriEducatorAdminComposition.js";

type Admin = ReturnType<typeof createOriEducatorAdminComposition>;
type Result = { readonly status: number; readonly body: unknown };
const error = (status: number, reason: string): Result => ({
  status, body: { error: reason },
});
function respond(response: ServerResponse, result: Result) {
  if (response.destroyed || response.writableEnded || response.headersSent) return;
  response.writeHead(result.status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  response.end(JSON.stringify(result.body));
}
async function readJson(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) {
    body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    if (Buffer.byteLength(body, "utf8") > 1024) throw Error("body-too-large");
  }
  return JSON.parse(body) as unknown;
}
/**
 * Internal HTTP adapter. Must be mounted only by an authenticated adult-only
 * host. No routes are registered and no learner feature is enabled here.
 */
export function createOriEducatorAdminHttpAdapter(admin: Admin) {
  return async (operation: "snapshot" | "decide" | "audit",
    reviewId: string, request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      if (!reviewId || reviewId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(reviewId))
        return respond(response, error(400, "invalid-review-id"));
      if (request.method !== "POST") return respond(response, error(405, "method-not-allowed"));
      if (operation === "snapshot") {
        const result = await admin.snapshot(request, reviewId);
        return respond(response, result ? { status: 200, body: result } : error(403, "forbidden"));
      }
      if (operation === "audit") {
        const result = await admin.audit(request, reviewId);
        return respond(response, result ? { status: 200, body: result } : error(403, "forbidden"));
      }
      const raw = await readJson(request);
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return respond(response, error(400, "invalid-request"));
      const data = raw as Record<string, unknown>;
      if (Object.keys(data).sort().join() !== "decision,evidenceDigest,missionId,rationale,revision")
        return respond(response, error(400, "invalid-request"));
      if (typeof data["evidenceDigest"] !== "string" ||
          !/^[a-f0-9]{64}$/.test(data["evidenceDigest"]) ||
          typeof data["revision"] !== "number" ||
          !Number.isSafeInteger(data["revision"]) ||
          typeof data["missionId"] !== "string" ||
          typeof data["rationale"] !== "string" ||
          (data["decision"] !== "approve" && data["decision"] !== "reject"))
        return respond(response, error(400, "invalid-request"));
      const result = await admin.decide(request, reviewId, data["evidenceDigest"],
        data["revision"], {
          missionId: data["missionId"], rationale: data["rationale"], decision: data["decision"],
        });
      const status = result === "recorded" ? 200 : result === "conflict" ? 409 :
        result === "unauthorized" ? 403 : 400;
      return respond(response, {
        status, body: result === "recorded" ? { status: "recorded" } : { error: result },
      });
    } catch {
      return respond(response, error(503, "unavailable"));
    }
  };
}
