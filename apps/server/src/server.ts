import { createServer, type Server } from "node:http";
import { AGORIX_PROJECT_MAX_BYTES } from "@agorix/persistence";
import type { ApiRequest, ApiResponse, ProjectApi } from "@agorix/project-api";

export const MAX_HTTP_BODY_BYTES = AGORIX_PROJECT_MAX_BYTES + 16 * 1024;

export interface ProjectHttpLogEvent {
  readonly method: string;
  readonly status: number;
  readonly durationMs: number;
}

export interface ProjectHttpServerOptions {
  readonly api: ProjectApi;
  readonly maxBodyBytes?: number;
  /** No URL, cookies, project ids, credentials or body content enter this event. */
  readonly log?: (event: ProjectHttpLogEvent) => void;
}

function json(status: number, body: unknown): ApiResponse {
  return {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
    body,
  };
}

const TOO_LARGE = json(413, {
  error: {
    code: "VALIDATION",
    message: "Request body is too large",
    retryable: false,
    reason: "PAYLOAD_TOO_LARGE",
  },
});

const UNAVAILABLE = json(503, {
  error: { code: "TRANSIENT", message: "Temporarily unavailable", retryable: true },
});

/** Transport for the existing, owner-scoped Project API. It keeps raw request bodies bounded. */
export function createProjectHttpServer(options: ProjectHttpServerOptions): Server {
  const maxBodyBytes = options.maxBodyBytes ?? MAX_HTTP_BODY_BYTES;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new Error("maxBodyBytes must be a positive integer");
  }

  const server = createServer(async (incoming, outgoing) => {
    const started = performance.now();
    const method = incoming.method ?? "GET";
    let response: ApiResponse;
    try {
      if (method === "GET" && incoming.url === "/healthz") {
        response = json(200, { status: "ok" });
      } else if (!incoming.url?.startsWith("/v1/")) {
        response = json(404, {
          error: { code: "NOT_FOUND", message: "Not found", retryable: false },
        });
      } else {
        const chunks: Buffer[] = [];
        let length = 0;
        let tooLarge = false;
        for await (const chunk of incoming) {
          length += chunk.length;
          if (length > maxBodyBytes) {
            tooLarge = true;
          } else {
            chunks.push(chunk);
          }
        }
        if (tooLarge) {
          response = TOO_LARGE;
        } else {
          const headers: Record<string, string | undefined> = {};
          for (const [name, value] of Object.entries(incoming.headers)) {
            headers[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
          }
          const body = Buffer.concat(chunks).toString("utf8");
          const request: ApiRequest = {
            method,
            url: incoming.url,
            headers,
            ...(body === "" ? {} : { body }),
          };
          response = await options.api.handle(request);
        }
      }
    } catch {
      response = UNAVAILABLE;
    }

    if (!outgoing.destroyed) {
      outgoing.writeHead(response.status, response.headers);
      outgoing.end(response.body === null ? undefined : JSON.stringify(response.body));
    }
    options.log?.({
      method,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 50;
  return server;
}
