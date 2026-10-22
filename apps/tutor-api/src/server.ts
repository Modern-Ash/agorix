import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { validateTutorRequest } from "@agorix/tutor-contract";
import type { ProviderRuntimeErrorCode, ProviderRuntimeFetch } from "@agorix/provider-runtime";
import {
  isTutorAdapterConfigured,
  requestTutorResponse,
  type TutorAdapterConfig,
} from "./index.js";

export const MAX_BODY_BYTES = 64 * 1024;
const HEALTH_TTL_MS = 15_000;

export interface TutorServerOptions {
  readonly config: TutorAdapterConfig;
  /** Injected for tests; defaults to the platform `fetch`. */
  readonly fetch?: typeof fetch;
  readonly healthTtlMs?: number;
  readonly now?: () => number;
}

interface Health {
  readonly configured: boolean;
  readonly available: boolean;
  readonly providerInUse: "deterministic" | "openai-compatible";
  readonly lastErrorClass: ProviderRuntimeErrorCode | null;
}

/**
 * Same-origin HTTP surface for the Learning Companion (issue #348). It sits behind the web
 * host (`/api/tutor/*`), reads provider settings from the server environment only, and
 * answers with the deterministic fallback whenever the provider is missing or fails. The
 * browser never receives a provider token, endpoint or diagnostic detail.
 */
export function createTutorServer(options: TutorServerOptions): Server {
  const { config } = options;
  const fetchImpl = options.fetch ?? fetch;
  const ttl = options.healthTtlMs ?? HEALTH_TTL_MS;
  const now = options.now ?? Date.now;
  let cached: { readonly at: number; readonly health: Health } | undefined;
  let lastErrorClass: ProviderRuntimeErrorCode | null = null;

  async function health(): Promise<Health> {
    if (cached !== undefined && now() - cached.at < ttl) return cached.health;
    const configured = isTutorAdapterConfigured(config);
    const available = configured && (await probe());
    const value: Health = {
      configured,
      available,
      providerInUse:
        available && config.adapter === "openai-compatible" ? "openai-compatible" : "deterministic",
      lastErrorClass,
    };
    cached = { at: now(), health: value };
    return value;
  }

  async function probe(): Promise<boolean> {
    if (config.adapter === "fake") {
      lastErrorClass = null;
      return true;
    }
    const baseUrl = config.baseUrl;
    if (baseUrl === undefined) return false;
    const headers: Record<string, string> = {};
    if (config.authToken !== undefined) {
      headers[config.authHeaderName ?? "authorization"] =
        config.authHeaderName === undefined ? `Bearer ${config.authToken}` : config.authToken;
    }
    try {
      const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/models`, {
        headers,
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (response.ok) {
        lastErrorClass = null;
        return true;
      }
      lastErrorClass =
        response.status === 401 || response.status === 403
          ? "authentication-failed"
          : response.status >= 500
            ? "provider-error"
            : "provider-unavailable";
      return false;
    } catch (cause) {
      lastErrorClass =
        cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")
          ? "timeout"
          : "provider-unavailable";
      return false;
    }
  }

  return createServer((request, response) => {
    handle(request, response).catch(() => send(response, 500, error("internal")));
  });

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url ?? "/", "http://local").pathname;
    if (path === "/api/tutor/health") {
      if (request.method !== "GET") return send(response, 405, error("method-not-allowed"));
      return send(response, 200, await health());
    }
    if (path === "/api/tutor/respond") {
      if (request.method !== "POST") return send(response, 405, error("method-not-allowed"));
      return respond(request, response);
    }
    return send(response, 404, error("not-found"));
  }

  async function respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!(request.headers["content-type"] ?? "").includes("application/json")) {
      return send(response, 415, error("unsupported-media-type"));
    }
    if (!sameOrigin(request)) return send(response, 403, error("forbidden-origin"));
    const body = await readBody(request);
    if (body === "too-large") return send(response, 413, error("payload-too-large"));
    let tutorRequest;
    try {
      tutorRequest = validateTutorRequest(JSON.parse(body));
    } catch {
      return send(response, 400, error("invalid-request"));
    }
    const result = await requestTutorResponse(tutorRequest, config, {
      fetch: fetchImpl as unknown as ProviderRuntimeFetch,
    });
    if (result.diagnostics.errorCode !== undefined) lastErrorClass = result.diagnostics.errorCode;
    else lastErrorClass = null;
    cached = undefined;
    return send(response, 200, { response: result.response, source: result.diagnostics.source });
  }
}

/** A browser request must come from the host that served the page; non-browser callers send no Origin. */
function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

async function readBody(request: IncomingMessage): Promise<string | "too-large"> {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (declared > MAX_BODY_BYTES) return "too-large";
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) return "too-large";
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function error(code: string): { readonly error: { readonly code: string } } {
  return { error: { code } };
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}
