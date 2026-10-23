/**
 * DEVELOPMENT AND E2E ONLY. Not a production auth claim.
 *
 * Hosts the real `createProjectApi` handler, `AuthService` and in-memory
 * repositories inside one Node process. State is lost on restart; this backend
 * is only used by the dev server and browser tests.
 */
import { AuthService } from "@agorix/auth-service";
import { InMemoryAccountRepository, InMemorySessionRepository } from "@agorix/auth-service";
import {
  InMemoryLinkRepository,
  LinkService,
  type Mailer,
  type MailMessage,
} from "@agorix/link-service";
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
  // Dev/e2e only: verification mail is captured in memory so a browser test can read the token
  // from `/v1/__dev/mail`. Nothing like this exists in the production server.
  const mails: MailMessage[] = [];
  const mailer: Mailer = { send: async (message) => void mails.push(message) };
  const link = new LinkService({
    repository: new InMemoryLinkRepository(),
    secret: "d".repeat(40),
    mailer,
    policy: {
      emailResendCooldownMs: 0,
      emailSendsPerHour: 10_000,
      redeemFailuresPerSource: 10_000,
      redeemFailuresGlobal: 10_000,
    },
  });
  const api = createProjectApi({
    auth,
    link,
    projects: new InMemoryProjectRepository(),
    allowedOrigins: [],
  });

  function sameOrigin(request: ApiRequest, origin: string | undefined): boolean {
    const host = request.headers["host"];
    return origin === undefined || (host !== undefined && origin === `http://${host}`);
  }

  return {
    async handle(request) {
      if (request.method === "GET" && request.url === "/v1/__dev/mail") {
        const last = [...mails].reverse().find((mail) => mail.kind === "verify-email");
        return {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
          body: last?.kind === "verify-email" ? { token: last.token, to: last.to } : {},
        };
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
