import type { IncomingMessage, ServerResponse } from "node:http";
import type { createOriAuthorizedReviewRecordingService } from "./oriAuthorizedReviewRecordingService.js";

type Service = ReturnType<typeof createOriAuthorizedReviewRecordingService>;
function reply(response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent || response.writableEnded || response.destroyed) return;
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}
class InvalidReviewBody extends Error {
  constructor(readonly status: 400 | 413) {
    super("invalid-review-body");
  }
}
async function bodyJson(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) {
    body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    if (Buffer.byteLength(body, "utf8") > 4096) throw new InvalidReviewBody(413);
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new InvalidReviewBody(400);
  }
}

/** Adult-only HTTP boundary; the host must supply authenticated service. */
export function createOriVerifiedRecordHttpHandler(
  service: Service,
  authorizeRequest: (request: IncomingMessage) => Promise<boolean>,
) {
  return async (
    reviewId: string,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      if (request.method !== "POST" || !/^[a-zA-Z0-9_-]{1,80}$/.test(reviewId))
        return reply(response, 404, { error: "not-found" });
      // Fail closed before reading any untrusted body or resolving evidence.
      if (!(await authorizeRequest(request))) return reply(response, 403, { error: "forbidden" });
      const raw = await bodyJson(request);
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return reply(response, 400, { error: "invalid-request" });
      const data = raw as Record<string, unknown>;
      if (
        Object.keys(data).sort().join() !==
          "disposition,evidenceDigest,evidenceRefs,missionId,rationale,reviewerId,revision" ||
        typeof data["evidenceDigest"] !== "string" ||
        !/^[a-f0-9]{64}$/.test(data["evidenceDigest"]) ||
        !Number.isSafeInteger(data["revision"]) ||
        typeof data["missionId"] !== "string" ||
        typeof data["reviewerId"] !== "string" ||
        typeof data["rationale"] !== "string" ||
        (data["disposition"] !== "approve" && data["disposition"] !== "reject") ||
        !data["evidenceRefs"] ||
        typeof data["evidenceRefs"] !== "object" ||
        Array.isArray(data["evidenceRefs"]) ||
        Object.values(data["evidenceRefs"]).some((value) => typeof value !== "string")
      )
        return reply(response, 400, { error: "invalid-request" });
      const result = await service.record(
        request,
        reviewId,
        data["evidenceDigest"],
        data["revision"] as number,
        {
          missionId: data["missionId"],
          reviewerId: data["reviewerId"],
          disposition: data["disposition"],
          rationale: data["rationale"],
          evidenceRefs: data["evidenceRefs"] as Record<string, string>,
        },
      );
      return reply(
        response,
        result === "recorded"
          ? 200
          : result === "unauthorized"
            ? 403
            : result === "conflict"
              ? 409
              : 400,
        result === "recorded" ? { status: result } : { error: result },
      );
    } catch (cause) {
      if (cause instanceof InvalidReviewBody)
        return reply(response, cause.status, {
          error: cause.status === 413 ? "body-too-large" : "invalid-request",
        });
      return reply(response, 503, { error: "unavailable" });
    }
  };
}
