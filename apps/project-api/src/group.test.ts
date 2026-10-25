import { describe, expect, it } from "vitest";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
} from "@agorix/auth-service";
import { GroupService, InMemoryGroupRepository } from "@agorix/group-service";
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

// Issue #566 over HTTP: organizer capability, groups, join proofs and the child device view.
const ORIGIN = "https://app.agorix.test";
const PASSWORD = "correct horse battery";

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

function setup(withGroup = true) {
  const now = Date.parse("2026-10-25T12:00:00.000Z");
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
  const group = new GroupService({
    repository: new InMemoryGroupRepository(),
    adults: { hasVerifiedEmail: async (id) => (await link.emailStatus(id)).verified },
    secret: "g".repeat(40),
    clock,
  });
  const api = createProjectApi({
    auth,
    link,
    ...(withGroup ? { group } : {}),
    projects: new InMemoryProjectRepository(),
    allowedOrigins: [ORIGIN],
    secureCookies: true,
  });
  const base = { origin: ORIGIN, [CSRF_HEADER_NAME]: "1", "content-type": "application/json" };

  async function adult(username: string, verified = true) {
    const { account } = await auth.register({ username, password: PASSWORD });
    const { sessionToken } = await auth.signIn({ username, password: PASSWORD });
    if (verified) {
      await link.addEmail(account.accountId, `${username}@example.com`);
      await link.verifyEmail(mailer.token());
    }
    return (method: string, url: string, body?: unknown): Promise<ApiResponse> =>
      api.handle({
        method,
        url,
        headers: { ...base, cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
  }
  function device(token?: string, ip = "203.0.113.7") {
    return (method: string, url: string, body?: unknown) =>
      api.handle({
        method,
        url,
        headers: {
          ...base,
          "x-real-ip": ip,
          ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
  }
  return { adult, device };
}

const household = { authority: { kind: "household" } };

async function organizer(ctx: ReturnType<typeof setup>, name = "ada") {
  const call = await ctx.adult(name);
  expect((await call("POST", "/v1/group/organizer")).status).toBe(204);
  const created = await call("POST", "/v1/group", household);
  expect(created.status).toBe(201);
  const groupId = (created.body as { groupId: string }).groupId;
  return { call, groupId };
}

describe("group routes", () => {
  it("are 404 when the group service is not configured", async () => {
    const ctx = setup(false);
    const call = await ctx.adult("ada");
    expect((await call("POST", "/v1/group", household)).status).toBe(404);
    expect((await call("GET", "/v1/group")).status).toBe(404);
    expect((await ctx.device()("POST", "/v1/group/join", { code: "ABCDEF" })).status).toBe(404);
    expect((await ctx.device("tok")("GET", "/v1/group/device")).status).toBe(404);
  });

  it("require an adult session; an anonymous caller cannot create or manage", async () => {
    const ctx = setup();
    expect((await ctx.device()("POST", "/v1/group", household)).status).toBe(401);
    expect((await ctx.device()("DELETE", "/v1/group/grp_x")).status).toBe(401);
  });

  it("refuse the organizer capability without a verified email", async () => {
    const ctx = setup();
    const call = await ctx.adult("ada", false);
    const res = await call("POST", "/v1/group/organizer");
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain("NOT_ORGANIZER");
    expect((await call("POST", "/v1/group", household)).status).toBe(403);
  });

  it("validate the authority shape", async () => {
    const ctx = setup();
    const call = await ctx.adult("ada");
    await call("POST", "/v1/group/organizer");
    for (const body of [
      {},
      { authority: "household" },
      { authority: { kind: "household", extra: 1 } },
      { authority: { kind: "classroom" } },
      { authority: { kind: "classroom", authorizationRef: "has spaces" } },
    ]) {
      expect((await call("POST", "/v1/group", body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("run the whole journey: create, code, join, approve, team, device view, close", async () => {
    const ctx = setup();
    const { call, groupId } = await organizer(ctx);
    expect((await call("POST", "/v1/group", household)).status).toBe(409);

    const code = (await call("POST", `/v1/group/${groupId}/codes`)).body as { code: string };
    const joined = await ctx.device()("POST", "/v1/group/join", { code: code.code });
    expect(joined.status).toBe(201);
    const { deviceToken } = joined.body as { deviceToken: string };
    expect(Object.keys(joined.body as object)).toEqual(["deviceToken"]);

    const child = ctx.device(deviceToken);
    expect(((await child("GET", "/v1/group/device")).body as { status: string }).status).toBe(
      "pending",
    );
    expect((await ctx.device()("POST", "/v1/group/join", { code: code.code })).status).toBe(400);

    const roster = (await call("GET", "/v1/group")).body as {
      slots: { slotId: string; status: string }[];
    };
    const slotId = roster.slots[0]!.slotId;
    expect(roster.slots[0]!.status).toBe("pending");

    const noConsent = await call("POST", `/v1/group/${groupId}/slots/${slotId}/approve`, {
      consentAttested: false,
    });
    expect(noConsent.status).toBe(400);
    const approved = await call("POST", `/v1/group/${groupId}/slots/${slotId}/approve`, {
      consentAttested: true,
    });
    expect(approved.status).toBe(200);

    expect(
      (await call("PATCH", `/v1/group/${groupId}/slots/${slotId}`, { team: "equipo-1" })).status,
    ).toBe(204);
    expect(
      (await call("PATCH", `/v1/group/${groupId}/slots/${slotId}`, { team: "free text" })).status,
    ).toBe(400);

    const view = (await child("GET", "/v1/group/device")).body as Record<string, unknown>;
    expect(view["status"]).toBe("approved");
    expect(view["team"]).toBe("equipo-1");
    expect(Object.keys(view).sort()).toEqual(["alias", "expiresAt", "status", "team"]);

    expect((await call("PATCH", `/v1/group/${groupId}`, { locked: true })).status).toBe(204);
    const code2 = await call("POST", `/v1/group/${groupId}/codes`);
    expect(code2.status).toBe(409);

    expect((await call("DELETE", `/v1/group/${groupId}`)).status).toBe(204);
    expect((await child("GET", "/v1/group/device")).status).toBe(401);
    expect((await call("GET", "/v1/group")).status).toBe(404);
  });

  it("hide another organizer's group and slots", async () => {
    const ctx = setup();
    const mine = await organizer(ctx, "ada");
    const other = await ctx.adult("bea");
    await other("POST", "/v1/group/organizer");
    expect((await other("POST", `/v1/group/${mine.groupId}/codes`)).status).toBe(404);
    expect((await other("DELETE", `/v1/group/${mine.groupId}`)).status).toBe(404);
    expect((await other("PATCH", `/v1/group/${mine.groupId}`, { locked: true })).status).toBe(404);
    expect((await other("DELETE", `/v1/group/${mine.groupId}/slots/slt_x`)).status).toBe(404);
  });

  it("reject malformed ids and unknown device tokens without detail", async () => {
    const ctx = setup();
    const { call } = await organizer(ctx);
    expect((await call("DELETE", "/v1/group/not-an-id")).status).toBe(404);
    expect((await call("DELETE", "/v1/group/grp_abc/slots/bad")).status).toBe(404);
    expect((await ctx.device("nope")("GET", "/v1/group/device")).status).toBe(401);
    expect((await ctx.device()("GET", "/v1/group/device")).status).toBe(401);
  });

  it("rate limit guessed join codes per source", async () => {
    const ctx = setup();
    await organizer(ctx);
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      statuses.push((await ctx.device()("POST", "/v1/group/join", { code: "AAAAAA" })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it("reconnect re-keys the device and invalidates the old key", async () => {
    const ctx = setup();
    const { call, groupId } = await organizer(ctx);
    const code = (await call("POST", `/v1/group/${groupId}/codes`)).body as { code: string };
    const { deviceToken } = (await ctx.device()("POST", "/v1/group/join", { code: code.code }))
      .body as { deviceToken: string };
    const roster = (await call("GET", "/v1/group")).body as { slots: { slotId: string }[] };
    const slotId = roster.slots[0]!.slotId;
    await call("POST", `/v1/group/${groupId}/slots/${slotId}/approve`, { consentAttested: true });

    const re = (await call("POST", `/v1/group/${groupId}/slots/${slotId}/reconnect`)).body as {
      code: string;
    };
    const next = (
      await ctx.device(undefined, "203.0.113.9")("POST", "/v1/group/join", { code: re.code })
    ).body as { deviceToken: string };
    expect((await ctx.device(deviceToken)("GET", "/v1/group/device")).status).toBe(401);
    expect((await ctx.device(next.deviceToken)("GET", "/v1/group/device")).status).toBe(200);
  });
});
