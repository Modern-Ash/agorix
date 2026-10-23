import { describe, expect, it } from "vitest";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
} from "@agorix/auth-service";
import { InMemoryLinkRepository, LinkService, type MailMessage } from "@agorix/link-service";
import type { StoredProject } from "@agorix/persistence";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import {
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
  createProjectApi,
  type ApiResponse,
} from "./index.js";

// Issues #517 and #519: email at registration, and permanent deletion of the account.
const ORIGIN = "https://app.agorix.test";
const PASSWORD = "correct horse battery";

const project: StoredProject = {
  schemaVersion: SCHEMA_VERSION,
  program: {
    schema: SCHEMA_VERSION,
    scripts: [{ id: "m", trigger: { type: "onStart" }, statements: [] }],
  },
  metadata: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    missionProgress: 0,
    hintLevel: 0,
  },
};

function setup(options: { requireEmail?: boolean; link?: boolean } = {}) {
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  const auth = new AuthService({
    accounts,
    sessions,
    policy: { session: { rotateOnResolve: false } },
  });
  const mails: MailMessage[] = [];
  const linkRepo = new InMemoryLinkRepository();
  const link = new LinkService({
    repository: linkRepo,
    secret: "k".repeat(40),
    mailer: { send: async (m) => void mails.push(m) },
  });
  const projects = new InMemoryProjectRepository();
  const api = createProjectApi({
    auth,
    ...(options.link === false ? {} : { link }),
    projects,
    allowedOrigins: [ORIGIN],
    ...(options.requireEmail === undefined ? {} : { requireEmail: options.requireEmail }),
  });
  const headers = (extra: Record<string, string> = {}) => ({
    origin: ORIGIN,
    [CSRF_HEADER_NAME]: "1",
    "content-type": "application/json",
    ...extra,
  });
  const call = (
    method: string,
    url: string,
    body?: unknown,
    cookie?: string,
  ): Promise<ApiResponse> =>
    api.handle({
      method,
      url,
      headers: headers(cookie === undefined ? {} : { cookie }),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function signIn(username: string): Promise<string> {
    const { sessionToken } = await auth.signIn({ username, password: PASSWORD });
    return `${SESSION_COOKIE_NAME}=${sessionToken}`;
  }
  return { api, auth, accounts, sessions, link, linkRepo, projects, mails, call, signIn };
}

describe("registration email (#519)", () => {
  it("requires a valid email when configured, and creates nothing when it is missing or bad", async () => {
    const s = setup({ requireEmail: true });
    const missing = await s.call("POST", "/v1/auth/register", {
      username: "ada",
      password: PASSWORD,
    });
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ error: { reason: "EMAIL_REQUIRED" } });
    const bad = await s.call("POST", "/v1/auth/register", {
      username: "ada",
      password: PASSWORD,
      email: "nope",
    });
    expect(bad.body).toMatchObject({ error: { reason: "INVALID_EMAIL" } });
    expect(await s.accounts.findByNormalizedUsername("ada")).toBeUndefined();
    expect(s.mails).toEqual([]);
  });

  it("registers and sends the verification message", async () => {
    const s = setup({ requireEmail: true });
    const ok = await s.call("POST", "/v1/auth/register", {
      username: "ada",
      password: PASSWORD,
      email: "Ada@Example.com",
    });
    expect(ok.status).toBe(201);
    expect(JSON.stringify(ok.body)).not.toContain("example.com");
    expect(s.mails).toEqual([
      expect.objectContaining({ kind: "verify-email", to: "ada@example.com" }),
    ]);
    const account = await s.accounts.findByNormalizedUsername("ada");
    expect(await s.link.emailStatus(account!.account.accountId)).toEqual({
      present: true,
      verified: false,
    });
  });

  it("an address that belongs to someone else gives the same answer and the owner is told", async () => {
    const s = setup({ requireEmail: true });
    await s.call("POST", "/v1/auth/register", {
      username: "ada",
      password: PASSWORD,
      email: "ada@example.com",
    });
    const second = await s.call("POST", "/v1/auth/register", {
      username: "bob",
      password: PASSWORD,
      email: "ada@example.com",
    });
    expect(second.status).toBe(201);
    expect(s.mails.map((m) => m.kind)).toEqual(["verify-email", "email-in-use"]);
    const bob = await s.accounts.findByNormalizedUsername("bob");
    expect(await s.link.emailStatus(bob!.account.accountId)).toEqual({
      present: false,
      verified: false,
    });
  });

  it("requires email by default with linking and ignores the policy without a link service", async () => {
    const plain = setup();
    expect(
      (await plain.call("POST", "/v1/auth/register", { username: "ada", password: PASSWORD })).body,
    ).toMatchObject({ error: { reason: "EMAIL_REQUIRED" } });
    const without = setup({ requireEmail: true, link: false });
    expect(
      (await without.call("POST", "/v1/auth/register", { username: "ada", password: PASSWORD }))
        .status,
    ).toBe(201);
    expect(without.mails).toEqual([]);
  });

  it("accepts only known body keys", async () => {
    const s = setup({ requireEmail: true });
    const res = await s.call("POST", "/v1/auth/register", {
      username: "ada",
      password: PASSWORD,
      email: "a@example.com",
      admin: true,
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /v1/account (#517)", () => {
  async function adultWithData(s: ReturnType<typeof setup>, name = "ada") {
    await s.auth.register({ username: name, password: PASSWORD });
    const accountId = (await s.accounts.findByNormalizedUsername(name))!.account.accountId;
    await s.link.addEmail(accountId, `${name}@example.com`);
    const token = (s.mails.at(-1) as { token: string }).token;
    await s.link.verifyEmail(token);
    const { code } = await s.link.createLinkCode(accountId);
    const device = await s.link.redeemLinkCode(code, "src");
    await s.projects.create(accountId, "One", project);
    await s.projects.create(accountId, "Two", project);
    return { accountId, device, cookie: await s.signIn(name) };
  }

  it("needs the right password and deletes nothing otherwise", async () => {
    const s = setup();
    const { accountId, cookie } = await adultWithData(s);
    const wrong = await s.call(
      "DELETE",
      "/v1/account",
      { password: "wrong password here" },
      cookie,
    );
    expect(wrong.status).toBe(400);
    expect(wrong.body).toMatchObject({ error: { reason: "WRONG_PASSWORD" } });
    const empty = await s.call("DELETE", "/v1/account", {}, cookie);
    expect(empty.status).toBe(400);
    expect((await s.projects.list(accountId)).items).toHaveLength(2);
    expect(await s.accounts.findByAccountId(accountId)).toBeDefined();
    expect(await s.link.listDevices(accountId)).toHaveLength(1);
  });

  it("removes projects, link data, sessions and the account, and clears the cookie", async () => {
    const s = setup();
    const { accountId, device, cookie } = await adultWithData(s);
    const other = await adultWithData(s, "bob");
    const res = await s.call("DELETE", "/v1/account", { password: PASSWORD }, cookie);
    expect(res.status).toBe(204);
    expect(res.headers["set-cookie"]).toContain("Max-Age=0");
    expect(await s.accounts.findByAccountId(accountId)).toBeUndefined();
    expect((await s.projects.list(accountId)).items).toEqual([]);
    expect(s.linkRepo.rowCountFor(accountId)).toBe(0);
    expect(s.sessions.snapshot().filter((r) => r.session.accountId === accountId)).toEqual([]);
    await expect(s.link.resolveDevice(device.deviceToken)).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED",
    });
    expect((await s.call("GET", "/v1/session", undefined, cookie)).status).toBe(401);
    // Another adult is untouched.
    expect(await s.accounts.findByAccountId(other.accountId)).toBeDefined();
    expect((await s.projects.list(other.accountId)).items).toHaveLength(2);
    expect(s.linkRepo.rowCountFor(other.accountId)).toBeGreaterThan(0);
    await expect(s.link.resolveDevice(other.device.deviceToken)).resolves.toBeDefined();
  });

  it("is a 401 without a session and needs the CSRF marker", async () => {
    const s = setup();
    await adultWithData(s);
    expect((await s.call("DELETE", "/v1/account", { password: PASSWORD })).status).toBe(401);
    const noCsrf = await s.api.handle({
      method: "DELETE",
      url: "/v1/account",
      headers: { cookie: "agorix_session=x", "content-type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    expect(noCsrf.status).toBe(403);
  });

  it("works for an account that has no link data or projects, and a second call finds no session", async () => {
    const s = setup({ link: false });
    await s.auth.register({ username: "solo", password: PASSWORD });
    const cookie = await s.signIn("solo");
    expect((await s.call("DELETE", "/v1/account", { password: PASSWORD }, cookie)).status).toBe(
      204,
    );
    expect((await s.call("DELETE", "/v1/account", { password: PASSWORD }, cookie)).status).toBe(
      401,
    );
  });

  it("rate limits wrong passwords", async () => {
    const s = setup();
    const { cookie } = await adultWithData(s);
    for (let i = 0; i < 10; i += 1) {
      expect(
        (await s.call("DELETE", "/v1/account", { password: "wrong password here" }, cookie)).status,
      ).toBe(400);
    }
    const blocked = await s.call("DELETE", "/v1/account", { password: PASSWORD }, cookie);
    expect(blocked.status).toBe(429);
  });

  it("a failure while cleaning up keeps the account so the adult can try again", async () => {
    const s = setup();
    const { accountId, cookie } = await adultWithData(s);
    const original = s.projects.deleteByOwner.bind(s.projects);
    let failures = 1;
    s.projects.deleteByOwner = async (...args) => {
      if (failures-- > 0) throw new Error("disk hiccup");
      return original(...args);
    };
    const first = await s.call("DELETE", "/v1/account", { password: PASSWORD }, cookie);
    expect(first.status).toBe(503);
    expect(await s.accounts.findByAccountId(accountId)).toBeDefined();
    const second = await s.call("DELETE", "/v1/account", { password: PASSWORD }, cookie);
    expect(second.status).toBe(204);
    expect(s.linkRepo.rowCountFor(accountId)).toBe(0);
  });
});
