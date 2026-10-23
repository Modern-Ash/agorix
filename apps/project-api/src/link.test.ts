import { describe, expect, it } from "vitest";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
} from "@agorix/auth-service";
import {
  InMemoryLinkRepository,
  LinkService,
  type MailMessage,
  type Mailer,
} from "@agorix/link-service";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import {
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
  createProjectApi,
  type ApiResponse,
} from "./index.js";

// Issues #505 to #508 over HTTP.
const ORIGIN = "https://app.agorix.test";
const PASSWORD = "correct horse battery";

const summary = {
  version: 1,
  completedMissions: 2,
  practicedConcepts: [1, 1, 0],
  decisions: { used: 1, changed: 0, rejected: 0 },
  minutesByDay: [{ day: "2026-10-22", minutes: 10 }],
  ageBand: "6-8",
  dailyLimitMinutes: 30,
};

class Capture implements Mailer {
  sent: MailMessage[] = [];
  async send(m: MailMessage) {
    this.sent.push(m);
  }
  token() {
    const m = [...this.sent].reverse().find((x) => x.kind === "verify-email");
    if (!m || m.kind !== "verify-email") throw new Error("no mail");
    return m.token;
  }
}

function setup(withLink = true) {
  let now = Date.parse("2026-10-23T12:00:00.000Z");
  const clock = { now: () => new Date(now) };
  const auth = new AuthService({
    accounts: new InMemoryAccountRepository(),
    sessions: new InMemorySessionRepository(),
    clock,
    policy: { session: { rotateOnResolve: false } },
  });
  const mailer = new Capture();
  const link = new LinkService({
    repository: new InMemoryLinkRepository(),
    secret: "k".repeat(40),
    mailer,
    clock,
  });
  const api = createProjectApi({
    auth,
    ...(withLink ? { link } : {}),
    projects: new InMemoryProjectRepository(),
    allowedOrigins: [ORIGIN],
    secureCookies: true,
  });
  const base = { origin: ORIGIN, [CSRF_HEADER_NAME]: "1", "content-type": "application/json" };

  async function adult(username: string) {
    await auth.register({ username, password: PASSWORD });
    const { sessionToken } = await auth.signIn({ username, password: PASSWORD });
    return (method: string, url: string, body?: unknown): Promise<ApiResponse> =>
      api.handle({
        method,
        url,
        headers: { ...base, cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
  }
  function device(token?: string, ip = "203.0.113.7") {
    return (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
      api.handle({
        method,
        url,
        headers: {
          ...base,
          "x-real-ip": ip,
          ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
  }
  return { api, adult, device, mailer, advance: (ms: number) => (now += ms) };
}

async function verified(ctx: ReturnType<typeof setup>, name = "ada") {
  const call = await ctx.adult(name);
  expect((await call("POST", "/v1/account/email", { email: `${name}@example.com` })).status).toBe(
    202,
  );
  const verify = await ctx.device()("POST", "/v1/account/email/verify", {
    token: ctx.mailer.token(),
  });
  expect(verify.status).toBe(204);
  return call;
}

describe("account email routes", () => {
  it("requires a session, CSRF and a valid body", async () => {
    const ctx = setup();
    const anonymous = await ctx.device()("POST", "/v1/account/email", { email: "a@example.com" });
    expect(anonymous.status).toBe(401);
    const call = await ctx.adult("ada");
    const noCsrf = await ctx.api.handle({
      method: "POST",
      url: "/v1/account/email",
      headers: { cookie: "agorix_session=x", "content-type": "application/json" },
      body: "{}",
    });
    expect(noCsrf.status).toBe(403);
    expect((await call("POST", "/v1/account/email", { email: "nope" })).body).toMatchObject({
      error: { reason: "INVALID_EMAIL" },
    });
    expect(
      (await call("POST", "/v1/account/email", { email: "a@example.com", extra: 1 })).status,
    ).toBe(400);
    expect((await call("GET", "/v1/account/email")).body).toEqual({
      present: false,
      verified: false,
    });
  });

  it("verifies through the public route and reports the status, never the address", async () => {
    const ctx = setup();
    const call = await verified(ctx);
    const status = await call("GET", "/v1/account/email");
    expect(status.body).toEqual({ present: true, verified: true });
    expect(JSON.stringify(status.body)).not.toContain("example.com");
    const again = await ctx.device()("POST", "/v1/account/email/verify", {
      token: ctx.mailer.token(),
    });
    expect(again.status).toBe(400);
    expect(again.body).toMatchObject({ error: { reason: "INVALID_OR_EXPIRED" } });
  });

  it("answers an address that belongs to someone else exactly like a fresh one", async () => {
    const ctx = setup();
    await verified(ctx, "ada");
    const other = await ctx.adult("bob");
    const taken = await other("POST", "/v1/account/email", { email: "ada@example.com" });
    const fresh = await other("POST", "/v1/account/email", { email: "bob@example.com" });
    expect(taken.status).toBe(fresh.status);
    expect(taken.body).toEqual(fresh.body);
  });
});

describe("link flow over HTTP", () => {
  it("creates a code, redeems it without a cookie, uploads a summary and rotates the token", async () => {
    const ctx = setup();
    const adult = await verified(ctx);
    const created = await adult("POST", "/v1/link/codes");
    expect(created.status).toBe(201);
    const { code } = created.body as { code: string };

    const redeemed = await ctx.device()("POST", "/v1/link/redeem", { code });
    expect(redeemed.status).toBe(201);
    const first = (redeemed.body as { deviceToken: string }).deviceToken;
    expect(JSON.stringify(redeemed.body)).not.toMatch(/accountId|email|alias/i);

    const put = await ctx.device(first)("PUT", "/v1/link/summary", summary);
    expect(put.status).toBe(200);
    const { deviceToken: second, stored } = put.body as { deviceToken: string; stored: boolean };
    expect(stored).toBe(true);
    expect(second).not.toBe(first);

    const list = await adult("GET", "/v1/link/devices");
    expect((list.body as { items: unknown[] }).items).toHaveLength(1);
    const summaries = await adult("GET", "/v1/link/summaries");
    expect(JSON.stringify(summaries.body)).toContain('"completedMissions":2');
  });

  it("refuses a code without a verified email", async () => {
    const ctx = setup();
    const call = await ctx.adult("ada");
    const res = await call("POST", "/v1/link/codes");
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: { reason: "EMAIL_NOT_VERIFIED" } });
  });

  it("device routes need a valid bearer token and never accept the adult cookie", async () => {
    const ctx = setup();
    const adult = await verified(ctx);
    expect((await ctx.device()("PUT", "/v1/link/summary", summary)).status).toBe(401);
    expect((await ctx.device("not-a-token")("PUT", "/v1/link/summary", summary)).status).toBe(401);
    const cookieOnly = await adult("PUT", "/v1/link/summary", summary);
    expect(cookieOnly.status).toBe(401);
    const { code } = (await adult("POST", "/v1/link/codes")).body as { code: string };
    const { deviceToken } = (await ctx.device()("POST", "/v1/link/redeem", { code })).body as {
      deviceToken: string;
    };
    expect((await ctx.device(deviceToken)("GET", "/v1/link/devices")).status).toBe(401);
    expect((await ctx.device(deviceToken)("DELETE", "/v1/link/codes")).status).toBe(401);
    expect(
      (await ctx.device(deviceToken)("POST", "/v1/account/email", { email: "x@y.org" })).status,
    ).toBe(401);
  });

  it("rejects summaries with extra keys, free text or oversize bodies", async () => {
    const ctx = setup();
    const adult = await verified(ctx);
    const { code } = (await adult("POST", "/v1/link/codes")).body as { code: string };
    let token = (
      (await ctx.device()("POST", "/v1/link/redeem", { code })).body as { deviceToken: string }
    ).deviceToken;
    const bad = await ctx.device(token)("PUT", "/v1/link/summary", { ...summary, note: "hi" });
    expect(bad.status).toBe(400);
    const text = await ctx.device(token)("PUT", "/v1/link/summary", {
      ...summary,
      completedMissions: "many",
    });
    expect(text.status).toBe(400);
    expect(text.body).toMatchObject({ error: { reason: "INVALID_SUMMARY" } });
    const huge = await ctx.api.handle({
      method: "PUT",
      url: "/v1/link/summary",
      headers: {
        origin: ORIGIN,
        [CSRF_HEADER_NAME]: "1",
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...summary, pad: "x".repeat(9000) }),
    });
    expect(huge.status).toBe(413);
    token = token.slice(0, 1);
  });

  it("unlinking from the adult side kills the device token; the device can unlink itself", async () => {
    const ctx = setup();
    const adult = await verified(ctx);
    const first = (await adult("POST", "/v1/link/codes")).body as { code: string };
    const dev1 = (await ctx.device()("POST", "/v1/link/redeem", { code: first.code })).body as {
      deviceToken: string;
    };
    const items = ((await adult("GET", "/v1/link/devices")).body as { items: { linkId: string }[] })
      .items;
    expect((await adult("DELETE", `/v1/link/devices/${items[0]!.linkId}`)).status).toBe(204);
    expect((await ctx.device(dev1.deviceToken)("PUT", "/v1/link/summary", summary)).status).toBe(
      401,
    );

    const second = (await adult("POST", "/v1/link/codes")).body as { code: string };
    const dev2 = (await ctx.device()("POST", "/v1/link/redeem", { code: second.code })).body as {
      deviceToken: string;
    };
    expect((await ctx.device(dev2.deviceToken)("DELETE", "/v1/link/self")).status).toBe(204);
    expect((await ctx.device(dev2.deviceToken)("DELETE", "/v1/link/self")).status).toBe(401);
  });

  it("an adult cannot touch another adult's device", async () => {
    const ctx = setup();
    const ada = await verified(ctx, "ada");
    const { code } = (await ada("POST", "/v1/link/codes")).body as { code: string };
    await ctx.device()("POST", "/v1/link/redeem", { code });
    const linkId = ((await ada("GET", "/v1/link/devices")).body as { items: { linkId: string }[] })
      .items[0]!.linkId;
    const bob = await ctx.adult("bob");
    expect((await bob("DELETE", `/v1/link/devices/${linkId}`)).status).toBe(404);
    expect((await bob("PATCH", `/v1/link/devices/${linkId}`, { syncEnabled: false })).status).toBe(
      404,
    );
    expect((await bob("GET", "/v1/link/devices")).body).toEqual({ items: [] });
    expect((await ada("DELETE", "/v1/link/devices/not-a-link-id")).status).toBe(404);
  });

  it("sync off makes the upload a harmless no-op", async () => {
    const ctx = setup();
    const adult = await verified(ctx);
    const { code } = (await adult("POST", "/v1/link/codes")).body as { code: string };
    const { deviceToken } = (await ctx.device()("POST", "/v1/link/redeem", { code })).body as {
      deviceToken: string;
    };
    const linkId = (
      (await adult("GET", "/v1/link/devices")).body as { items: { linkId: string }[] }
    ).items[0]!.linkId;
    expect(
      (await adult("PATCH", `/v1/link/devices/${linkId}`, { syncEnabled: false })).status,
    ).toBe(204);
    const put = await ctx.device(deviceToken)("PUT", "/v1/link/summary", summary);
    expect((put.body as { stored: boolean }).stored).toBe(false);
    expect(
      (await adult("PATCH", `/v1/link/devices/${linkId}`, { syncEnabled: "yes" })).status,
    ).toBe(400);
  });
});

describe("brute force and exposure", () => {
  it("throttles a source after ten wrong codes and shares nothing between sources", async () => {
    const ctx = setup();
    const adult = await verified(ctx);
    for (let i = 0; i < 10; i += 1) {
      const res = await ctx.device(undefined, "198.51.100.9")("POST", "/v1/link/redeem", {
        code: "000000",
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { reason: "INVALID_OR_EXPIRED" } });
    }
    const { code } = (await adult("POST", "/v1/link/codes")).body as { code: string };
    const blocked = await ctx.device(undefined, "198.51.100.9")("POST", "/v1/link/redeem", {
      code,
    });
    expect(blocked.status).toBe(429);
    const other = await ctx.device(undefined, "198.51.100.10")("POST", "/v1/link/redeem", { code });
    expect(other.status).toBe(201);
  });

  it("the redeem route needs the CSRF marker and a JSON body", async () => {
    const ctx = setup();
    const missing = await ctx.api.handle({
      method: "POST",
      url: "/v1/link/redeem",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    });
    expect(missing.status).toBe(403);
    const wrongType = await ctx.api.handle({
      method: "POST",
      url: "/v1/link/redeem",
      headers: { origin: ORIGIN, [CSRF_HEADER_NAME]: "1", "content-type": "text/plain" },
      body: "123456",
    });
    expect(wrongType.status).toBe(415);
  });

  it("sets no-store on every link response", async () => {
    const ctx = setup();
    const adult = await verified(ctx);
    const res = await adult("POST", "/v1/link/codes");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("is a 404 everywhere when the link service is not configured", async () => {
    const ctx = setup(false);
    const call = await ctx.adult("ada");
    for (const [method, url] of [
      ["GET", "/v1/account/email"],
      ["POST", "/v1/link/codes"],
      ["GET", "/v1/link/devices"],
      ["GET", "/v1/link/summaries"],
    ] as const) {
      expect((await call(method, url, method === "POST" ? {} : undefined)).status).toBe(404);
    }
    expect((await ctx.device()("POST", "/v1/link/redeem", { code: "123456" })).status).toBe(404);
    expect((await ctx.device()("POST", "/v1/account/email/verify", { token: "x" })).status).toBe(
      404,
    );
  });
});
