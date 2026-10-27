import type { IncomingMessage, ServerResponse } from "node:http";
import type { createOriEducatorAdminComposition } from "./oriEducatorAdminComposition.js";

type Admin = ReturnType<typeof createOriEducatorAdminComposition>;
function send(response: ServerResponse, status: number, body: unknown): void {
  if (response.destroyed || response.writableEnded || response.headersSent) return;
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

/**
 * Adult-only acceptance export. The host provides provenance from a trusted
 * server-side source; no browser-supplied "verified" or digest is accepted.
 */
export function createOriAcceptanceManifestHttpHandler(
  admin: Admin,
  trustedProvenance: (reviewId: string) => Promise<{
    readonly evidenceDigest: string;
    readonly verified: boolean;
  } | null>,
) {
  return async (reviewId: string, request: IncomingMessage,
    response: ServerResponse): Promise<void> => {
    try {
      if (request.method !== "POST" || !/^[a-zA-Z0-9_-]{1,80}$/.test(reviewId))
        return send(response, 404, { error: "not-found" });
      const authorized = await admin.snapshot(request, reviewId);
      if (!authorized) return send(response, 403, { error: "forbidden" });
      const provenance = await trustedProvenance(reviewId);
      if (!provenance) return send(response, 503, { error: "evidence-unavailable" });
      const manifest = await admin.acceptanceManifest(request, reviewId, provenance);
      return send(response, manifest ? 200 : 403,
        manifest ?? { error: "forbidden" });
    } catch {
      return send(response, 503, { error: "unavailable" });
    }
  };
}
