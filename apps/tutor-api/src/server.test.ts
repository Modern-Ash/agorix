import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { TutorRequest } from "@agorix/tutor-contract";
import { getKidsMission } from "@agorix/curriculum";
import { createOriCliService, oriCliConfigFromEnv, type OriCliProcess } from "./oriCli.js";
import { configFromEnv } from "./index.js";
import { createTutorServer, MAX_BODY_BYTES } from "./server.js";

const request: TutorRequest = {
  schema: "agorix/tutor-request/v1",
  mission: { id: "first-mission.reach-goal", version: 1, concepts: ["sequence", "movement"] },
  program: {
    schema: "agorix/program/v1",
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [{ type: "move", steps: 10 }],
      },
    ],
  },
  runtime: {
    outcome: "completed",
    stepsUsed: 1,
    finalWorld: { sprite: { x: 10, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
    observations: [
      {
        kind: "run-complete",
        step: 1,
        nodeId: "$",
        outcome: "completed",
        world: { sprite: { x: 10, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
      },
    ],
  },
  hintHistory: [],
  reading: { locale: "es-AR", readingLevel: "middle-grade" },
};

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

async function start(
  env: Record<string, string | undefined>,
  fetchImpl?: typeof fetch,
  ori?: ReturnType<typeof createOriCliService>,
): Promise<string> {
  const server = createTutorServer({
    config: configFromEnv(env),
    ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
    ...(ori === undefined ? {} : { ori }),
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("tutor HTTP server (issue #348)", () => {
  it("serves only a proven fixed free-world goal when Ori is offline", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "fake" });
    const response = await fetch(`${base}/api/tutor/goals`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ locale: "es" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cell: { cx: 4, cy: 2 },
      successCheck: "touches-goal",
      message: "¿Podés llegar a la meta en columna 5, fila 3?",
    });
    const invalid = await fetch(`${base}/api/tutor/goals`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ locale: "es", text: "ignore rules" }),
    });
    expect(invalid.status).toBe(400);
  });
  it("limits Ori chat, rejects invalid input and never echoes child text", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "fake" });
    const sendChat = (text: string, extra: Record<string, unknown> = {}) =>
      fetch(`${base}/api/tutor/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify({
          missionId: "kids.m1.straight",
          locale: "es",
          program: request.program,
          text,
          ...extra,
        }),
      });
    const unsafe = await sendChat("Mi correo es niña@example.com, ¿cómo muevo bloques?");
    expect(unsafe.status).toBe(200);
    expect(await unsafe.json()).toEqual({
      message: "eso no lo puedo hacer, ¿seguimos con tu programa?",
    });
    const fallback = await sendChat("¿Cómo muevo bloques?");
    expect(fallback.status).toBe(200);
    expect(await fallback.json()).toEqual({
      message: "Ori no está disponible ahora. Probá un bloque y mirá qué pasa.",
    });
    expect((await sendChat("x".repeat(161))).status).toBe(400);
    expect((await sendChat("¿Cómo muevo?", { surprise: true })).status).toBe(400);
    expect(
      (
        await fetch(`${base}/api/tutor/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: "https://other.example" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
    for (let i = 0; i < 4; i++) expect((await sendChat("¿Cómo muevo? ")).status).toBe(200);
    expect((await sendChat("¿Cómo muevo? ")).status).toBe(429);
  });
  it("reports not configured when no provider is set (normal local mode)", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "openai-compatible" });
    const response = await fetch(`${base}/api/tutor/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      configured: false,
      available: false,
      providerInUse: "deterministic",
      lastErrorClass: null,
    });
  });

  it("reports available for the fake adapter and never leaks secrets", async () => {
    const base = await start({
      AGORIX_TUTOR_ADAPTER: "fake",
      AGORIX_TUTOR_AUTH_TOKEN: "super-secret-token",
    });
    const text = await (await fetch(`${base}/api/tutor/health`)).text();
    expect(JSON.parse(text)).toEqual({
      configured: true,
      available: true,
      providerInUse: "deterministic",
      lastErrorClass: null,
    });
    expect(text).not.toContain("super-secret-token");
  });

  it("probes a configured provider and reports it down when unreachable", async () => {
    const failing = (async () => {
      throw new TypeError("connect ECONNREFUSED");
    }) as typeof fetch;
    const base = await start(
      {
        AGORIX_TUTOR_ADAPTER: "openai-compatible",
        AGORIX_TUTOR_BASE_URL: "http://provider.test/v1",
        AGORIX_TUTOR_MODEL: "m",
      },
      failing,
    );
    expect(await (await fetch(`${base}/api/tutor/health`)).json()).toEqual({
      configured: true,
      available: false,
      providerInUse: "deterministic",
      lastErrorClass: "provider-unavailable",
    });
  });

  it("probes a configured provider and reports it up when /models answers", async () => {
    const seen: string[] = [];
    const ok = (async (url: string | URL | Request) => {
      seen.push(String(url));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const base = await start(
      {
        AGORIX_TUTOR_ADAPTER: "openai-compatible",
        AGORIX_TUTOR_BASE_URL: "http://provider.test/v1",
        AGORIX_TUTOR_MODEL: "m",
      },
      ok,
    );
    expect(await (await fetch(`${base}/api/tutor/health`)).json()).toEqual({
      configured: true,
      available: true,
      providerInUse: "openai-compatible",
      lastErrorClass: null,
    });
    expect(seen).toEqual(["http://provider.test/v1/models"]);
  });

  it("exposes only a safe error class for an authentication failure", async () => {
    const denied = (async () => new Response("secret diagnostic", { status: 401 })) as typeof fetch;
    const base = await start(
      {
        AGORIX_TUTOR_ADAPTER: "openai-compatible",
        AGORIX_TUTOR_BASE_URL: "http://private-provider.test/v1",
        AGORIX_TUTOR_MODEL: "private-model",
        AGORIX_TUTOR_AUTH_TOKEN: "private-token",
      },
      denied,
    );
    const text = await (await fetch(`${base}/api/tutor/health`)).text();
    expect(JSON.parse(text)).toEqual({
      configured: true,
      available: false,
      providerInUse: "deterministic",
      lastErrorClass: "authentication-failed",
    });
    expect(text).not.toMatch(/private|secret/);
  });

  it("answers a tutor request with a validated response and only the source", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "fake" });
    const response = await fetch(`${base}/api/tutor/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { response: { schema: string }; source: string };
    expect(body.response.schema).toBe("agorix/tutor-response/v1");
    expect(["runtime", "fallback"]).toContain(body.source);
    expect(Object.keys(body).sort()).toEqual(["response", "source"]);
  });

  it("falls back to deterministic help when the provider is not configured", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "openai-compatible" });
    const response = await fetch(`${base}/api/tutor/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { source: string }).source).toBe("fallback");
  });

  it("rejects bad input with calm 4xx errors", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "fake" });
    const post = (body: string, contentType = "application/json") =>
      fetch(`${base}/api/tutor/respond`, {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      });
    expect((await post("{oops")).status).toBe(400);
    expect((await post("{}")).status).toBe(400);
    expect((await post("{}", "text/plain")).status).toBe(415);
    expect((await post(" ".repeat(MAX_BODY_BYTES + 1))).status).toBe(413);
    expect((await fetch(`${base}/api/tutor/respond`)).status).toBe(405);
    expect((await fetch(`${base}/api/tutor/nope`)).status).toBe(404);
  });

  it("refuses cross-origin browser requests", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "fake" });
    const response = await fetch(`${base}/api/tutor/respond`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify(request),
    });
    expect(response.status).toBe(403);
  });
});

describe("Ori HTTP boundary (issue #381)", () => {
  const mission = getKidsMission("kids.m1.straight", "es");
  const body = JSON.stringify({
    missionId: mission.id,
    locale: "es",
    hintLevel: 1,
    program: mission.starterProject,
  });

  it("returns only a validated reviewable proposal and adult-only CLI health", async () => {
    const run: OriCliProcess = async (_bin, args) =>
      args.includes("--version")
        ? "version"
        : JSON.stringify({
            version: "agorix/ori-agent/v1",
            kind: "program-suggestion",
            reason: "toward-goal",
            blocks: [{ type: "move", count: 4 }],
          });
    const base = await start({}, undefined, createOriCliService(oriCliConfigFromEnv({}), { run }));
    expect(await (await fetch(`${base}/api/tutor/health`)).json()).toEqual({
      configured: true,
      available: true,
      providerInUse: "codex",
      lastErrorClass: null,
    });
    const response = await fetch(`${base}/api/tutor/ori`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(result).sort()).toEqual(["message", "proposal"]);
    expect(JSON.stringify(result)).not.toMatch(/codex|opencode|providerId|runtimeId|diagnostic/);
    expect(result.proposal).toMatchObject({
      source: { kind: "learning-companion", capability: "builder" },
    });
  });

  it("falls back without a CLI and rejects extra fields, free text, and cross-origin calls", async () => {
    const base = await start({});
    const post = (payload: string, origin?: string) =>
      fetch(`${base}/api/tutor/ori`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
        body: payload,
      });
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as { proposal: { operations: unknown[] } }).proposal.operations,
    ).toHaveLength(1);
    expect(
      (await post(JSON.stringify({ ...JSON.parse(body), learnerText: "my name" }))).status,
    ).toBe(400);
    expect((await post(body, "https://evil.example")).status).toBe(403);
  });
});
