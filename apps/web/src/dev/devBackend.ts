/**
 * DEVELOPMENT AND E2E ONLY. Not a production auth claim.
 *
 * Hosts the real `createProjectApi` handler, `AuthService` and in-memory
 * repositories inside one Node process. State is lost on restart; this backend
 * is only used by the dev server and browser tests.
 */
import { AuthService } from "@agorix/auth-service";
import { InMemoryAccountRepository, InMemorySessionRepository } from "@agorix/auth-service";
import { createProjectApi, type ApiRequest, type ApiResponse } from "@agorix/project-api";
import { InMemoryProjectRepository } from "@agorix/project-repository";

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

  function sameOrigin(request: ApiRequest, origin: string | undefined): boolean {
    const host = request.headers["host"];
    return origin === undefined || (host !== undefined && origin === `http://${host}`);
  }

  return {
    async handle(request) {
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
