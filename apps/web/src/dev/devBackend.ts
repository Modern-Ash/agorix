/**
 * DEVELOPMENT AND E2E ONLY. Not a production auth claim.
 *
 * Hosts the real `createProjectApi` handler, `AuthService` and in-memory
 * repositories inside one Node process, and adds the sign-in/register/sign-out
 * routes that issue #189 deliberately did not ship. State is lost on restart,
 * cookies are not `Secure`, and nothing here has had a security review. A real
 * HTTP server with real account routes still has to be built.
 */
import { AuthPublicError, AuthService } from "@agorix/auth-service";
import { InMemoryAccountRepository, InMemorySessionRepository } from "@agorix/auth-service";
import {
  SESSION_COOKIE_NAME,
  createProjectApi,
  type ApiRequest,
  type ApiResponse,
} from "@agorix/project-api";
import { InMemoryProjectRepository } from "@agorix/project-repository";

export const DEV_AUTH_PATH = "/__dev/auth";

export interface DevBackend {
  handle(request: ApiRequest): Promise<ApiResponse>;
}

/** Same-origin only: a request is accepted when its Origin (if any) equals its own Host. */
export function createDevBackend(): DevBackend {
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  const auth = new AuthService({
    accounts,
    sessions,
    policy: {
      // Dev/e2e only: generous limits so automated journeys are not rate limited.
      registerRateLimit: { maxAttempts: 10_000 },
      signInRateLimit: { maxAttempts: 10_000 },
    },
  });
  const api = createProjectApi({
    auth,
    projects: new InMemoryProjectRepository(),
    allowedOrigins: [],
  });

  function json(status: number, body: unknown, extra: Record<string, string> = {}): ApiResponse {
    return {
      status,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
        ...extra,
      },
      body,
    };
  }

  function failure(status: number, code: string): ApiResponse {
    return json(status, { error: { code, message: "Request failed", retryable: false } });
  }

  function csrfOk(request: ApiRequest): boolean {
    const origin = request.headers["origin"];
    return request.headers["x-agorix-request"] === "1" && sameOrigin(request, origin);
  }

  function sameOrigin(request: ApiRequest, origin: string | undefined): boolean {
    const host = request.headers["host"];
    return origin === undefined || (host !== undefined && origin === `http://${host}`);
  }

  function readCredentials(
    request: ApiRequest,
  ): { username: string; password: string } | undefined {
    try {
      const body: unknown = JSON.parse(request.body ?? "");
      if (typeof body !== "object" || body === null) return undefined;
      const { username, password } = body as Record<string, unknown>;
      return typeof username === "string" && typeof password === "string"
        ? { username, password }
        : undefined;
    } catch {
      return undefined;
    }
  }

  function readToken(request: ApiRequest): string | undefined {
    for (const part of (request.headers["cookie"] ?? "").split(";")) {
      const index = part.indexOf("=");
      if (index > 0 && part.slice(0, index).trim() === SESSION_COOKIE_NAME) {
        return part.slice(index + 1).trim() || undefined;
      }
    }
    return undefined;
  }

  function cookie(token: string, maxAgeSeconds: number): string {
    return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
  }

  async function handleAuth(request: ApiRequest, action: string): Promise<ApiResponse> {
    if (request.method.toUpperCase() !== "POST") return failure(404, "NOT_FOUND");
    if (!csrfOk(request)) return failure(403, "CSRF_REJECTED");
    try {
      if (action === "logout") {
        const token = readToken(request);
        if (token !== undefined) await auth.signOut(token);
        return json(200, { ok: true }, { "set-cookie": cookie("", 0) });
      }
      const credentials = readCredentials(request);
      if (credentials === undefined) return failure(400, "VALIDATION");
      if (action === "register") {
        await auth.register(credentials);
        return json(201, { ok: true });
      }
      if (action === "login") {
        const result = await auth.signIn(credentials);
        const maxAge = Math.max(
          0,
          Math.floor((Date.parse(result.session.expiresAt) - Date.now()) / 1000),
        );
        return json(200, { ok: true }, { "set-cookie": cookie(result.sessionToken, maxAge) });
      }
      return failure(404, "NOT_FOUND");
    } catch (error) {
      if (error instanceof AuthPublicError) {
        switch (error.code) {
          case "INVALID_CREDENTIALS":
            return failure(401, "INVALID_CREDENTIALS");
          case "USERNAME_TAKEN":
            return failure(409, "USERNAME_TAKEN");
          case "RATE_LIMITED":
            return failure(429, "RATE_LIMITED");
          case "PASSWORD_POLICY_VIOLATION":
            return failure(422, "PASSWORD_POLICY_VIOLATION");
          default:
            return failure(401, "SESSION_EXPIRED");
        }
      }
      // Alias validation (PlatformContractError) or unexpected failures: no details leave the process.
      const alias = error instanceof Error && error.name === "PlatformContractError";
      return alias ? failure(422, "INVALID_ALIAS") : failure(503, "TRANSIENT");
    }
  }

  return {
    async handle(request) {
      const path = new URL(request.url, "http://dev.invalid").pathname;
      if (path.startsWith(`${DEV_AUTH_PATH}/`)) {
        return handleAuth(request, path.slice(DEV_AUTH_PATH.length + 1));
      }
      // A same-origin Origin is dropped so the API's cross-origin allow-list (empty here) only sees foreign ones.
      const origin = request.headers["origin"];
      if (origin !== undefined && sameOrigin(request, origin)) {
        const rest = Object.fromEntries(
          Object.entries(request.headers).filter(([name]) => name !== "origin"),
        );
        return api.handle({ ...request, headers: rest });
      }
      return api.handle(request);
    },
  };
}
