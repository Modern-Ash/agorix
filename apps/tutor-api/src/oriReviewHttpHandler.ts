import type { IncomingMessage, ServerResponse } from "node:http";
import type { OriReviewPipelineResult } from "./oriReviewPipeline.js";

/**
 * Experimental HTTP adapter for a future adult-only Ori review endpoint.
 * NOT registered in createTutorServer; host must provide a guarded pipeline.
 */
export function createOriReviewHttpHandler(
  pipeline: (request: IncomingMessage) => Promise<OriReviewPipelineResult>,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request, response) => {
    let result: OriReviewPipelineResult;
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
