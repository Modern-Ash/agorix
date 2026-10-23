import { afterEach, describe, expect, it } from "vitest";
import {
  AuthService,
  InMemoryAccountRepository,
  InMemorySessionRepository,
} from "@agorix/auth-service";
import { createProjectApi } from "@agorix/project-api";
import { InMemoryProjectRepository } from "@agorix/project-repository";
import { createProjectHttpServer, type ProjectHttpLogEvent } from "./server.js";
import type { Server } from "node:http";

const ORIGIN = "https://agorix.test";
const PASSWORD = "correct horse battery";
const openServers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
});

async function setup(options: { maxBodyBytes?: number; signInAttempts?: number } = {}) {
  const auth = new AuthService({
    accounts: new InMemoryAccountRepository(),
    sessions: new InMemorySessionRepository(),
    policy: { signInRateLimit: { maxAttempts: options.signInAttempts ?? 10 } },
  });
  const logs: ProjectHttpLogEvent[] = [];
  const api = createProjectApi({
    auth,
    projects: new InMemoryProjectRepository(),
    allowedOrigins: [ORIGIN],
    secureCookies: true,
  });
  const server = createProjectHttpServer({
    api,
    ...(options.maxBodyBytes === undefined ? {} : { maxBodyBytes: options.maxBodyBytes }),
    log: (event) => logs.push(event),
  });
  openServers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Expected TCP address");
  const base = `http://127.0.0.1:${address.port}`;
  let cookie = "";

  async function call(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        origin: ORIGIN,
        ...(method === "GET" ? {} : { "x-agorix-request": "1" }),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(cookie === "" ? {} : { cookie }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie !== null) cookie = setCookie.split(";")[0] ?? "";
    return response;
  }
  return { call, logs, base };
}

const storedProject = {
  schemaVersion: "agorix/program/v1",
  program: {
    schema: "agorix/program/v1",
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
  },
  metadata: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    missionProgress: 0,
    hintLevel: 0,
  },
};

describe("real project HTTP server", () => {
  it("registers, signs in, saves and reloads a private project over HTTP", async () => {
    const { call, logs } = await setup();
    const health = await call("GET", "/healthz");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    expect(
      (await call("POST", "/v1/auth/register", { username: "alice", password: PASSWORD })).status,
    ).toBe(201);
    const signed = await call("POST", "/v1/auth/sign-in", {
      username: "alice",
      password: PASSWORD,
    });
    expect(signed.status).toBe(200);
    expect(signed.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Strict");
    expect(signed.headers.get("set-cookie")).toContain("Secure");

    const created = await call("POST", "/v1/projects", { title: "Mi mundo", storedProject });
    expect(created.status).toBe(201);
    const project = (await created.json()) as { projectId: string; revision: number };
    expect(project.revision).toBe(1);
    const listed = await call("GET", "/v1/projects");
    expect(listed.status).toBe(200);
    expect(JSON.stringify(await listed.json())).toContain(project.projectId);
    const reopened = await call("GET", `/v1/projects/${project.projectId}`);
    expect(reopened.status).toBe(200);
    expect((await reopened.json()) as object).toMatchObject({ title: "Mi mundo", storedProject });

    expect(
      (await call("POST", "/v1/auth/register", { username: "bob", password: PASSWORD })).status,
    ).toBe(201);
    expect(
      (await call("POST", "/v1/auth/sign-in", { username: "bob", password: PASSWORD })).status,
    ).toBe(200);
    expect((await call("GET", `/v1/projects/${project.projectId}`)).status).toBe(404);

    const out = await call("POST", "/v1/auth/sign-out", {});
    expect(out.status).toBe(204);
    expect((await call("GET", "/v1/projects")).status).toBe(401);
    expect(logs.every((event) => !JSON.stringify(event).includes("Mi mundo"))).toBe(true);
  });

  it("rejects missing CSRF proof, foreign origins, oversized bodies and unknown routes", async () => {
    const { call } = await setup({ maxBodyBytes: 100 });
    const credentials = { username: "alice", password: PASSWORD };
    expect(
      (await call("POST", "/v1/auth/register", credentials, { "x-agorix-request": "" })).status,
    ).toBe(403);
    expect(
      (await call("POST", "/v1/auth/register", credentials, { origin: "https://foreign.test" }))
        .status,
    ).toBe(403);
    const oversized = await call("POST", "/v1/auth/register", {
      ...credentials,
      extra: "x".repeat(200),
    });
    expect(oversized.status).toBe(413);
    expect((await oversized.json()) as object).toMatchObject({
      error: { code: "VALIDATION", reason: "PAYLOAD_TOO_LARGE" },
    });
    expect((await call("GET", "/not-an-api")).status).toBe(404);
  });

  it("honors authentication rate limits through the real transport", async () => {
    const { call } = await setup({ signInAttempts: 2 });
    await call("POST", "/v1/auth/register", { username: "alice", password: PASSWORD });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(
        (await call("POST", "/v1/auth/sign-in", { username: "alice", password: "wrong password" }))
          .status,
      ).toBe(401);
    }
    expect(
      (await call("POST", "/v1/auth/sign-in", { username: "alice", password: "wrong password" }))
        .status,
    ).toBe(429);
  });
});
