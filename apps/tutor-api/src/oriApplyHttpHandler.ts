import type { IncomingMessage, ServerResponse } from "node:http";
import type { OriApplyPipelineResult } from "./oriApplyPipeline.js";

/**
 * Internal HTTP response adapter for an authenticated Ori apply pipeline.
 * This module deliberately does NOT register a route or enable Kids.
 */
export function createOriApplyHttpHandler(
  pipeline: (request: IncomingMessage) => Promise<OriApplyPipelineResult>,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request, response) => {
    let result: OriApplyPipelineResult;
    try {
      result = await pipeline(request);
    } catch {
      result = { status: 503, body: { error: "unavailable" } };
    }
    if (response.headersSent || response.writableEnded || response.destroyed) return;
    response.writeHead(result.status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    });
    response.end(JSON.stringify(result.body));
  };
}
