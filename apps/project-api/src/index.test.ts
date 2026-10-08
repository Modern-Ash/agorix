import { describe, expect, it } from "vitest";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
} from "@agorix/auth-service";
import { semanticProjectHash, type StoredProject } from "@agorix/persistence";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import {
  CSRF_HEADER_NAME,
  SESSION_COOKIE_NAME,
  createProjectApi,
  type ApiLogEvent,
  type ApiResponse,
} from "./index.js";

const ORIGIN = "https://app.agorix.test";
const PASSWORD = "correct horse battery";

function stored(scriptId = "main"): StoredProject {
  return {
    schemaVersion: SCHEMA_VERSION,
    program: {
      schema: SCHEMA_VERSION,
      scripts: [{ id: scriptId, trigger: { type: "onStart" }, statements: [] }],
    },
    metadata: {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
    },
  };
}

function setup(rotate = true) {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  let counter = 0;
  const auth = new AuthService({
    accounts: new InMemoryAccountRepository(),
    sessions: new InMemorySessionRepository(),
    clock: { now: () => new Date(now) },
    policy: { session: { rotateOnResolve: rotate } },
  });
  const projects = new InMemoryProjectRepository({
    idFactory: () => `proj-${++counter}`,
  });
  const logs: ApiLogEvent[] = [];
  const api = createProjectApi({
    auth,
    projects,
    allowedOrigins: [ORIGIN],
    secureCookies: true,
    log: (e) => logs.push(e),
  });

  async function client(username: string) {
    await auth.register({ username, password: PASSWORD });
    const signed = await auth.signIn({ username, password: PASSWORD });
    let token = signed.sessionToken;
    return {
      get token() {
        return token;
      },
      async call(
        method: string,
        url: string,
        body?: unknown,
        extra: Record<string, string> = {},
      ): Promise<ApiResponse> {
        const res = await api.handle({
          method,
          url,
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${token}`,
            origin: ORIGIN,
            [CSRF_HEADER_NAME]: "1",
            "content-type": "application/json",
            ...extra,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const set = res.headers["set-cookie"];
        if (set !== undefined) {
          token = /=([^;]+)/.exec(set)![1]!;
        }
        return res;
      },
    };
  }
  return {
    api,
    client,
    logs,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const errCode = (r: ApiResponse) => (r.body as { error: { code: string } }).error.code;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rec = (r: ApiResponse) => r.body as Record<string, any>;

describe("project api", () => {
  it("reports the session summary without ids or secrets", async () => {
    const { client } = setup();
    const a = await client("alice");
    const res = await a.call("GET", "/v1/session");
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("accountId");
    expect(rec(res).account.alias).toBe("alice");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("authorizes with explicit register, sign-in and sign-out routes", async () => {
    const { api } = setup();
    const register = await api.handle({
      method: "POST",
      url: "/v1/auth/register",
      headers: { origin: ORIGIN, [CSRF_HEADER_NAME]: "1", "content-type": "application/json" },
      body: JSON.stringify({ username: "Dana", password: PASSWORD }),
    });
    expect(register.status).toBe(201);
    expect(rec(register).account.alias).toBe("Dana");
    expect(JSON.stringify(register.body)).not.toMatch(/password|token|session/i);

    const signed = await api.handle({
      method: "POST",
      url: "/v1/auth/sign-in",
      headers: { origin: ORIGIN, [CSRF_HEADER_NAME]: "1", "content-type": "application/json" },
      body: JSON.stringify({ username: "dana", password: PASSWORD }),
    });
    expect(signed.status).toBe(200);
    const cookie = signed.headers["set-cookie"]!;
    expect(cookie).toContain(SESSION_COOKIE_NAME);
    expect(JSON.stringify(signed.body)).not.toMatch(/accountId|token|password/i);

    const session = await api.handle({
      method: "GET",
      url: "/v1/session",
      headers: { cookie },
    });
    expect(session.status).toBe(200);

    const currentCookie = session.headers["set-cookie"] ?? cookie;
    const signedOut = await api.handle({
      method: "POST",
      url: "/v1/auth/sign-out",
      headers: { cookie: currentCookie, origin: ORIGIN, [CSRF_HEADER_NAME]: "1" },
    });
    expect(signedOut.status).toBe(204);
    expect(signedOut.headers["set-cookie"]).toContain("Max-Age=0");

    const after = await api.handle({
      method: "GET",
      url: "/v1/session",
      headers: { cookie: currentCookie },
    });
    expect(after.status).toBe(401);
  });

  it("supports owner CRUD, rename, duplicate and delete", async () => {
    const { client } = setup();
    const a = await client("alice");
    const created = await a.call("POST", "/v1/projects", {
      title: "  My   game ",
      storedProject: stored(),
    });
    expect(created.status).toBe(201);
    expect(rec(created).title).toBe("My game");
    expect(rec(created).ownerId).toBeUndefined();
    const id = rec(created).projectId as string;

    const list = await a.call("GET", "/v1/projects");
    expect(rec(list).items).toHaveLength(1);
    expect(rec(list).items[0].storedProject).toBeUndefined();

    const got = await a.call("GET", `/v1/projects/${id}`);
    expect(rec(got).storedProject).toEqual(stored());

    const updated = await a.call("PUT", `/v1/projects/${id}`, {
      expectedRevision: 1,
      storedProject: stored("second"),
    });
    expect(updated.status).toBe(200);
    expect(rec(updated).revision).toBe(2);
    expect(rec(updated).unchanged).toBe(false);

    const renamed = await a.call("PATCH", `/v1/projects/${id}`, {
      expectedRevision: 2,
      title: "Renamed",
    });
    expect(rec(renamed).revision).toBe(3);
    expect(rec(renamed).title).toBe("Renamed");

    const dup = await a.call("POST", `/v1/projects/${id}/duplicate`, {});
    expect(dup.status).toBe(201);
    expect(rec(dup).projectId).not.toBe(id);
    expect(rec(dup).semanticHash).toBe(rec(renamed).semanticHash);
    expect(semanticProjectHash(rec(dup).storedProject)).toBe(rec(renamed).semanticHash);

    const del = await a.call("DELETE", `/v1/projects/${id}?expectedRevision=3`);
    expect(del.status).toBe(204);
    expect((await a.call("GET", `/v1/projects/${id}`)).status).toBe(404);
  });

  it("accepts shared creative metadata for web and Studio projects", async () => {
    const { client } = setup();
    const a = await client("alice");
    const project: StoredProject = {
      ...stored(),
      metadata: {
        ...stored().metadata,
        actors: [
          {
            id: "actor:main",
            name: "Nova",
            x: 52,
            y: 128,
            direction: 0,
            size: 100,
            visible: true,
            costumeId: "asset:costume.default",
            scripts: ["main"],
          },
        ],
        stage: {
          backdropId: "asset:space.trailhead",
          width: 264,
          height: 192,
          actorOrder: ["actor:main"],
        },
        assets: [
          {
            id: "asset:costume.default",
            kind: "costume",
            name: "Nova default",
            source: "builtin:costume.default",
            tags: ["starter"],
          },
          {
            id: "asset:space.trailhead",
            kind: "backdrop",
            name: "Space trailhead",
            source: "builtin:space.trailhead",
            tags: ["space", "mission"],
          },
        ],
      },
    };

    const created = await a.call("POST", "/v1/projects", {
      title: "Creative project",
      storedProject: project,
    });

    expect(created.status).toBe(201);
    expect(rec(created).storedProject).toEqual(project);
    expect(rec(created).semanticHash).toBe(semanticProjectHash(project));
  });

  it("never lets account B reach A's project, even with the id", async () => {
    const { client } = setup();
    const a = await client("alice");
    const b = await client("bobby");
    const created = await a.call("POST", "/v1/projects", {
      title: "Secret",
      storedProject: stored(),
    });
    const id = rec(created).projectId as string;

    const missing = await b.call("GET", "/v1/projects/does-not-exist");
    for (const res of [
      await b.call("GET", `/v1/projects/${id}`),
      await b.call("PUT", `/v1/projects/${id}`, {
        expectedRevision: 1,
        storedProject: stored("x"),
      }),
      await b.call("PATCH", `/v1/projects/${id}`, { expectedRevision: 1, title: "x" }),
      await b.call("POST", `/v1/projects/${id}/duplicate`, {}),
      await b.call("DELETE", `/v1/projects/${id}`),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(missing.body); // indistinguishable from nonexistent
    }
    expect(rec(await b.call("GET", "/v1/projects")).items).toEqual([]);
    expect((await a.call("GET", `/v1/projects/${id}`)).status).toBe(200);
  });

  it("ignores or rejects client-supplied owner ids", async () => {
    const { client } = setup();
    const a = await client("alice");
    const res = await a.call("POST", "/v1/projects", {
      title: "x",
      ownerId: "someone-else",
      storedProject: stored(),
    });
    expect(res.status).toBe(400);
    expect(rec(res).error.reason).toBe("UNKNOWN_FIELD");
  });

  it("rejects unauthenticated requests", async () => {
    const { api } = setup();
    const res = await api.handle({
      method: "GET",
      url: "/v1/projects",
      headers: {},
    });
    expect(res.status).toBe(401);
    expect(errCode(res)).toBe("UNAUTHENTICATED");
    const bogus = await api.handle({
      method: "GET",
      url: "/v1/projects",
      headers: { cookie: `${SESSION_COOKIE_NAME}=nope` },
    });
    expect(errCode(bogus)).toBe("SESSION_EXPIRED");
  });

  it("returns typed SESSION_EXPIRED after idle expiry", async () => {
    const { client, advance } = setup();
    const a = await client("alice");
    expect((await a.call("GET", "/v1/projects")).status).toBe(200);
    advance(31 * 60 * 1000);
    const res = await a.call("GET", "/v1/projects");
    expect(res.status).toBe(401);
    expect(errCode(res)).toBe("SESSION_EXPIRED");
  });

  it("rotates the session cookie with safe attributes", async () => {
    const { client } = setup();
    const a = await client("alice");
    const res = await a.call("GET", "/v1/session");
    const cookie = res.headers["set-cookie"]!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
  });

  it("enforces CSRF protections on mutating requests", async () => {
    const { client, api } = setup(false);
    const a = await client("alice");
    const base = {
      method: "POST",
      url: "/v1/projects",
      body: JSON.stringify({ title: "x", storedProject: stored() }),
    };
    const cookie = `${SESSION_COOKIE_NAME}=${a.token}`;
    const noMarker = await api.handle({
      ...base,
      headers: { cookie, "content-type": "application/json" },
    });
    expect(noMarker.status).toBe(403);
    expect(errCode(noMarker)).toBe("CSRF_REJECTED");
    const badOrigin = await api.handle({
      ...base,
      headers: {
        cookie,
        origin: "https://evil.test",
        [CSRF_HEADER_NAME]: "1",
        "content-type": "application/json",
      },
    });
    expect(errCode(badOrigin)).toBe("CSRF_REJECTED");
  });

  it("returns revision conflicts with only safe recovery metadata", async () => {
    const { client } = setup();
    const a = await client("alice");
    const created = await a.call("POST", "/v1/projects", { title: "P", storedProject: stored() });
    const id = rec(created).projectId as string;
    const second = await a.call("PUT", `/v1/projects/${id}`, {
      expectedRevision: 1,
      storedProject: stored("one"),
    });
    const stale = await a.call("PUT", `/v1/projects/${id}`, {
      expectedRevision: 1,
      storedProject: stored("two"),
    });
    expect(stale.status).toBe(409);
    expect(errCode(stale)).toBe("REVISION_CONFLICT");
    const error = rec(stale).error;
    expect(error.recovery).toEqual({
      currentRevision: 2,
      currentUpdatedAt: rec(second).updatedAt,
      currentSemanticHash: rec(second).semanticHash,
    });
    expect(JSON.stringify(stale.body)).not.toContain("one");
    // Stale delete conflicts too and nothing is removed.
    expect((await a.call("DELETE", `/v1/projects/${id}?expectedRevision=1`)).status).toBe(409);
    expect((await a.call("GET", `/v1/projects/${id}`)).status).toBe(200);
  });

  it("makes autosave retries idempotent", async () => {
    const { client } = setup();
    const a = await client("alice");
    const created = await a.call("POST", "/v1/projects", { title: "P", storedProject: stored() });
    const id = rec(created).projectId as string;
    const save = { expectedRevision: 1, storedProject: stored("one") };
    const first = await a.call("PUT", `/v1/projects/${id}`, save);
    const retry = await a.call("PUT", `/v1/projects/${id}`, save);
    expect(retry.status).toBe(200);
    expect(rec(retry).revision).toBe(rec(first).revision);
    expect(rec(retry).unchanged).toBe(true);
  });

  it("replays create with the same Idempotency-Key", async () => {
    const { client } = setup();
    const a = await client("alice");
    const body = { title: "P", storedProject: stored() };
    const headers = { "idempotency-key": "autosave-key-1" };
    const one = await a.call("POST", "/v1/projects", body, headers);
    const two = await a.call("POST", "/v1/projects", body, headers);
    expect(rec(two).projectId).toBe(rec(one).projectId);
    expect(rec(await a.call("GET", "/v1/projects")).items).toHaveLength(1);
    const reuse = await a.call("POST", "/v1/projects", { ...body, title: "Other" }, headers);
    expect(reuse.status).toBe(422);
  });

  it("rejects invalid projects, history fields, bad titles and oversize bodies", async () => {
    const { client } = setup();
    const a = await client("alice");
    const bad = await a.call("POST", "/v1/projects", {
      title: "x",
      storedProject: { schemaVersion: SCHEMA_VERSION, program: { nope: true }, metadata: {} },
    });
    expect(bad.status).toBe(400);
    expect(errCode(bad)).toBe("VALIDATION");

    const history = await a.call("POST", "/v1/projects", {
      title: "x",
      storedProject: { ...stored(), undoStack: [stored()] },
    });
    expect(rec(history).error.reason).toBe("HISTORY_NOT_PERSISTED");
    const topHistory = await a.call("POST", "/v1/projects", {
      title: "x",
      storedProject: stored(),
      redoStack: [],
    });
    expect(rec(topHistory).error.reason).toBe("HISTORY_NOT_PERSISTED");

    const blank = await a.call("POST", "/v1/projects", { title: "   ", storedProject: stored() });
    expect(rec(blank).error.reason).toBe("INVALID_TITLE");
    const long = await a.call("POST", "/v1/projects", {
      title: "x".repeat(500),
      storedProject: stored(),
    });
    expect(long.status).toBe(400);

    const huge = await a.call("POST", "/v1/projects", {
      title: "x",
      storedProject: stored(),
      pad: "y".repeat(2_000_000),
    });
    expect(huge.status).toBe(413);

    const notJson = await a.call("POST", "/v1/projects", undefined);
    expect(notJson.status).toBe(400);
  });

  it("persists only submitted canonical state (no proposal/preview side effects)", async () => {
    const { client } = setup();
    const a = await client("alice");
    const created = await a.call("POST", "/v1/projects", { title: "P", storedProject: stored() });
    const id = rec(created).projectId as string;
    const preview = await a.call("PUT", `/v1/projects/${id}`, {
      expectedRevision: 1,
      storedProject: stored(),
      proposal: { pending: true },
    });
    expect(preview.status).toBe(400);
    expect(rec(await a.call("GET", `/v1/projects/${id}`)).revision).toBe(1);
  });

  it("does not log sensitive data", async () => {
    const { client, logs } = setup();
    const a = await client("alice");
    await a.call("POST", "/v1/projects", { title: "TopSecretTitle", storedProject: stored() });
    await a.call("GET", "/v1/projects/zzz");
    const text = JSON.stringify(logs);
    expect(text).not.toContain("TopSecretTitle");
    expect(text).not.toContain(a.token);
    expect(
      logs.every((l) => Object.keys(l).every((k) => ["route", "status", "errorCode"].includes(k))),
    ).toBe(true);
    expect(logs.length).toBeGreaterThan(1);
  });

  it("maps unexpected failures to a retryable TRANSIENT error", async () => {
    const { client } = setup();
    const a = await client("alice");
    const api = createProjectApi({
      auth: {
        register: async () => {
          throw new Error("db down secret-detail");
        },
        signIn: async () => {
          throw new Error("db down secret-detail");
        },
        signOut: async () => {
          throw new Error("db down secret-detail");
        },
        resolveSession: async () => {
          throw new Error("db down secret-detail");
        },
      },
      projects: new InMemoryProjectRepository(),
    });
    const res = await api.handle({
      method: "GET",
      url: "/v1/projects",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${a.token}` },
    });
    expect(res.status).toBe(503);
    expect(rec(res).error.retryable).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("secret-detail");
  });
});
