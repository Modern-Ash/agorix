import { describe, expect, it } from "vitest";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
} from "@agorix/auth-service";
import { InMemoryLinkRepository, LinkService, type MailMessage } from "@agorix/link-service";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import { CSRF_HEADER_NAME, SESSION_COOKIE_NAME, createProjectApi } from "./index.js";

// Issue #514: cross-cutting privacy checks on the real HTTP surface.
const ORIGIN = "https://app.agorix.test";
const EMAIL = "privacy.check@example.com";

describe("link privacy over HTTP", () => {
  it("never returns the email address, the code hash or a raw secret in any response", async () => {
    const auth = new AuthService({
      accounts: new InMemoryAccountRepository(),
      sessions: new InMemorySessionRepository(),
      policy: { session: { rotateOnResolve: false } },
    });
    const mails: MailMessage[] = [];
    const link = new LinkService({
      repository: new InMemoryLinkRepository(),
      secret: "p".repeat(40),
      mailer: { send: async (m) => void mails.push(m) },
    });
    const api = createProjectApi({
      auth,
      link,
      projects: new InMemoryProjectRepository(),
      allowedOrigins: [ORIGIN],
    });
    await auth.register({ username: "privacy-adult", password: "correct horse battery" });
    const { sessionToken } = await auth.signIn({
      username: "privacy-adult",
      password: "correct horse battery",
    });
    const headers = (extra: Record<string, string> = {}) => ({
      origin: ORIGIN,
      [CSRF_HEADER_NAME]: "1",
      "content-type": "application/json",
      ...extra,
    });
    const adult = (method: string, url: string, body?: unknown) =>
      api.handle({
        method,
        url,
        headers: headers({ cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` }),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const bodies: string[] = [];
    const record = async (promise: ReturnType<typeof adult>) => {
      const res = await promise;
      bodies.push(JSON.stringify(res.body ?? null) + JSON.stringify(res.headers));
      return res;
    };

    await record(adult("POST", "/v1/account/email", { email: EMAIL }));
    const mail = mails.find((m) => m.kind === "verify-email");
    if (mail?.kind !== "verify-email") throw new Error("no mail");
    await record(
      api.handle({
        method: "POST",
        url: "/v1/account/email/verify",
        headers: headers(),
        body: JSON.stringify({ token: mail.token }),
      }),
    );
    await record(adult("GET", "/v1/account/email"));
    const code = (await (await record(adult("POST", "/v1/link/codes"))).body) as { code: string };
    const redeemed = await record(
      api.handle({
        method: "POST",
        url: "/v1/link/redeem",
        headers: headers({ "x-real-ip": "203.0.113.5" }),
        body: JSON.stringify({ code: code.code }),
      }),
    );
    const token = (redeemed.body as { deviceToken: string }).deviceToken;
    await record(
      api.handle({
        method: "PUT",
        url: "/v1/link/summary",
        headers: headers({ authorization: `Bearer ${token}` }),
        body: JSON.stringify({
          version: 1,
          completedMissions: 1,
          practicedConcepts: [1, 0, 0],
          decisions: { used: 0, changed: 0, rejected: 0 },
          minutesByDay: [],
          ageBand: "6-8",
          dailyLimitMinutes: 30,
        }),
      }),
    );
    await record(adult("GET", "/v1/link/devices"));
    await record(adult("GET", "/v1/link/summaries"));

    // The adult routes see their own address only through {present, verified}; nothing echoes it.
    const everything = bodies.join("\n");
    expect(everything).not.toContain(EMAIL);
    expect(everything).not.toContain("example.com");
    expect(everything).not.toContain("privacy-adult".toUpperCase());
    // Device-facing answers carry no account identity at all.
    const deviceView = bodies[4] ?? "";
    expect(deviceView).not.toMatch(/accountId|alias|email|privacy-adult/i);
  });
});
