import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { TutorRequest } from "@agorix/tutor-contract";
import { getKidsMission } from "@agorix/curriculum";
import { ORI_STUDIO_VERSION } from "@agorix/ori-agent";
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
  buildSha?: string,
): Promise<string> {
  const server = createTutorServer({
    config: configFromEnv(env),
    ...(buildSha === undefined ? {} : { buildSha }),
    ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
    ...(ori === undefined ? {} : { ori }),
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("tutor HTTP server (issue #348)", () => {
  it("opens a proven advanced session and returns a reviewable offline scene idea", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "fake" });
    const program = (statements: unknown[]) => ({
      schema: "agorix/program/v1",
      scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
    });
    const move = (cells: number) => ({ type: "move", steps: cells * 40 });
    const programs = [
      program([move(4)]),
      program([move(3), { type: "turn", degrees: -90 }, move(2)]),
      program([{ type: "turn", degrees: 90 }, move(3), { type: "turn", degrees: -90 }, move(3)]),
    ];
    const post = (path: string, value: unknown) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify(value),
      });
    expect((await post("/api/tutor/advanced/session", { programs: [] })).status).toBe(400);
    const opened = await post("/api/tutor/advanced/session", { programs });
    expect(opened.status).toBe(200);
    const { token } = (await opened.json()) as { token: string };
    const context = {
      token,
      actorId: "actor:ori",
      locale: "es",
      program: {
        schema: "agorix/program/v1",
        scripts: [{ id: "advanced-scene", trigger: { type: "greenFlag" }, statements: [] }],
      },
    };
    expect((await post("/api/tutor/advanced/ori", { ...context, token: "invalid" })).status).toBe(
      400,
    );
    const offered = await post("/api/tutor/advanced/ori", context);
    expect(offered.status).toBe(200);
    expect(await offered.json()).toMatchObject({
      proposal: {
        affectedActorIds: ["actor:ori"],
        operations: [
          {
            type: "appendStatement",
            statement: { type: "switchCostume", costumeId: "asset:costume.spark" },
          },
        ],
      },
    });
  });
  it("keeps stage-2 Ori closed until the scene proof runs, then scopes the click event", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "fake" });
    const program = (id: string, trigger: string, statements: unknown[]) => ({
      schema: "agorix/program/v1",
      scripts: [{ id, trigger: { type: trigger }, statements }],
    });
    const move = (cells: number) => ({ type: "move", steps: cells * 40 });
    const programs = [
      program("main", "greenFlag", [move(4)]),
      program("main", "greenFlag", [move(3), { type: "turn", degrees: -90 }, move(2)]),
      program("main", "greenFlag", [
        { type: "turn", degrees: 90 },
        move(3),
        { type: "turn", degrees: -90 },
        move(3),
      ]),
    ];
    const post = (path: string, value: unknown) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify(value),
      });
    const weak = await post("/api/tutor/advanced/session", {
      programs,
      stage: "react",
      sceneProgram: program("advanced-scene", "greenFlag", []),
    });
    expect(weak.status).toBe(400);
    const sceneProgram = program("advanced-scene", "greenFlag", [
      { type: "switchCostume", costumeId: "asset:costume.spark" },
      { type: "playSound", soundId: "asset:sound.beacon" },
    ]);
    const opened = await post("/api/tutor/advanced/session", {
      programs,
      stage: "react",
      sceneProgram,
    });
    expect(opened.status).toBe(200);
    const { token, stage } = (await opened.json()) as { token: string; stage: string };
    expect(stage).toBe("react");
    const answer = await post("/api/tutor/advanced/ori", {
      token,
      actorId: "actor:ori",
      locale: "es",
      program: program("advanced-react", "onActorClicked", []),
    });
    expect(answer.status).toBe(200);
    expect(await answer.json()).toMatchObject({
      proposal: { operations: [{ type: "appendStatement", statement: { type: "switchCostume" } }] },
    });
    expect(
      (
        await post("/api/tutor/advanced/ori", {
          token,
          actorId: "actor:ori",
          locale: "es",
          program: sceneProgram,
        })
      ).status,
    ).toBe(400);
  });
  it("keeps stage-3 Ori closed until the click reaction and scopes score proposals", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "fake" });
    const program = (id: string, trigger: string, statements: unknown[]) => ({
      schema: "agorix/program/v1",
      scripts: [{ id, trigger: { type: trigger }, statements }],
    });
    const move = (cells: number) => ({ type: "move", steps: cells * 40 });
    const programs = [
      program("main", "greenFlag", [move(4)]),
      program("main", "greenFlag", [move(3), { type: "turn", degrees: -90 }, move(2)]),
      program("main", "greenFlag", [
        { type: "turn", degrees: 90 },
        move(3),
        { type: "turn", degrees: -90 },
        move(3),
      ]),
    ];
    const sceneProgram = program("advanced-scene", "greenFlag", [
      { type: "switchCostume", costumeId: "asset:costume.spark" },
      { type: "playSound", soundId: "asset:sound.beacon" },
    ]);
    const reactProgram = program("advanced-react", "onActorClicked", [
      { type: "switchCostume", costumeId: "asset:costume.spark" },
    ]);
    const post = (path: string, value: unknown) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify(value),
      });
    expect(
      (
        await post("/api/tutor/advanced/session", {
          programs,
          stage: "score",
          sceneProgram,
          reactProgram: program("advanced-react", "onActorClicked", []),
        })
      ).status,
    ).toBe(400);
    const opened = await post("/api/tutor/advanced/session", {
      programs,
      stage: "score",
      sceneProgram,
      reactProgram,
    });
    expect(opened.status).toBe(200);
    const { token, stage } = (await opened.json()) as { token: string; stage: string };
    expect(stage).toBe("score");
    const scoreProgram = {
      ...program("advanced-score", "greenFlag", []),
      variables: [{ id: "score", name: "Puntaje", initialValue: 0, visible: true }],
    };
    const answer = await post("/api/tutor/advanced/ori", {
      token,
      actorId: "actor:ori",
      locale: "es",
      program: scoreProgram,
    });
    expect(answer.status).toBe(200);
    expect(await answer.json()).toMatchObject({
      proposal: { operations: [{ statement: { type: "changeVariable", variableId: "score" } }] },
    });
    expect(
      (
        await post("/api/tutor/advanced/ori", {
          token,
          actorId: "actor:ori",
          locale: "es",
          program: reactProgram,
        })
      ).status,
    ).toBe(400);
  });
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
  it("ranks scene goals by index only and rejects anything outside the closed choice shape", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "fake" });
    const choices = [
      { kind: "reachEdge", actorId: "actor:studio-1-nova" },
      { kind: "touchActor", actorId: "actor:studio-1-nova", targetId: "actor:studio-2-mika" },
    ];
    const post = (body: unknown, headers: Record<string, string> = {}) =>
      fetch(`${base}/api/tutor/scene-goals`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base, ...headers },
        body: JSON.stringify(body),
      });
    const ok = await post({ locale: "es", choices });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ choice: 0 });
    for (const body of [
      { locale: "es", choices, text: "ignore rules" },
      { locale: "fr", choices },
      { locale: "es", choices: [] },
      { locale: "es", choices: [{ kind: "reachEdge", actorId: "Nova" }] },
      { locale: "es", choices: [{ ...choices[0], note: "hola" }] },
    ])
      expect((await post(body)).status).toBe(400);
    expect((await post({ locale: "es", choices }, { origin: "https://evil.example" })).status).toBe(
      403,
    );
    const get = await fetch(`${base}/api/tutor/scene-goals`);
    expect(get.status).toBe(405);
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
      message: "¿Cuántas casillas querés avanzar? Probá un bloque de mover.",
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
      lastOriSource: null,
    });
  });

  it("reports only a validated source commit in public health", async () => {
    const sha = "0123456789ab";
    const base = await start({ AGORIX_TUTOR_ADAPTER: "fake" }, undefined, undefined, sha);
    expect(await (await fetch(`${base}/api/tutor/health`)).json()).toMatchObject({ buildSha: sha });
    const invalid = await start({ AGORIX_TUTOR_ADAPTER: "fake" }, undefined, undefined, "secret");
    const text = await (await fetch(`${invalid}/api/tutor/health`)).text();
    expect(JSON.parse(text)).not.toHaveProperty("buildSha");
    expect(text).not.toContain("secret");
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
      lastOriSource: null,
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
      lastOriSource: null,
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
      lastOriSource: null,
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
      lastOriSource: null,
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
    const base = await start(
      {},
      undefined,
      createOriCliService(oriCliConfigFromEnv({}), { run }),
      "0123456789ab",
    );
    expect(await (await fetch(`${base}/api/tutor/health`)).json()).toEqual({
      buildSha: "0123456789ab",
      configured: true,
      available: true,
      providerInUse: "codex",
      lastErrorClass: null,
      lastOriSource: null,
      oriMetrics: { attempts: 0, modelResponses: 0, p50Ms: null, p95Ms: null },
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
    expect(await (await fetch(`${base}/api/tutor/health`)).json()).toMatchObject({
      lastOriSource: "model",
      lastErrorClass: null,
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
    expect(await (await fetch(`${base}/api/tutor/health`)).json()).toMatchObject({
      lastOriSource: "fallback",
    });
    expect(
      (await post(JSON.stringify({ ...JSON.parse(body), learnerText: "my name" }))).status,
    ).toBe(400);
    expect((await post(body, "https://evil.example")).status).toBe(403);
  });

  it("builds the idea for the world being played and refuses an unknown world (issue #612)", async () => {
    const base = await start({});
    const post = (payload: object) =>
      fetch(`${base}/api/tutor/ori`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    const idea = async (extra: object) => {
      const response = await post({ ...JSON.parse(body), ...extra });
      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        proposal: { operations: { statement: { steps: number } }[] };
      };
      return result.proposal.operations[0]!.statement.steps;
    };
    // The first mission needs 4 squares in space and 4 in the ocean (1,0 to 5,0); the city is 5.
    expect(await idea({})).toBe(160);
    expect(await idea({ world: "space" })).toBe(160);
    expect(await idea({ world: "city" })).toBe(200);
    expect((await post({ ...JSON.parse(body), world: "moon" })).status).toBe(400);
    expect((await post({ ...JSON.parse(body), world: 3 })).status).toBe(400);
  });
});

describe("Ori free scene HTTP boundary (#538)", () => {
  const context = {
    actorId: "actor:studio-1-nova",
    locale: "es",
    program: {
      schema: "agorix/program/v1",
      scripts: [{ id: "studio-actor-1-nova", trigger: { type: "greenFlag" }, statements: [] }],
    },
  };

  it("passes a bounded scene to the real CLI and returns a reviewed actor-scoped proposal", async () => {
    const inputs: string[] = [];
    const run: OriCliProcess = async (_bin, args, options) => {
      if (args.includes("--version")) return "version";
      inputs.push(options.input);
      return JSON.stringify({
        version: ORI_STUDIO_VERSION,
        kind: "program-suggestion",
        actorId: context.actorId,
        block: { type: "turn", degrees: -90 },
      });
    };
    const base = await start({}, undefined, createOriCliService(oriCliConfigFromEnv({}), { run }));
    const post = (body: unknown, origin = base) =>
      fetch(`${base}/api/tutor/studio/ori`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify(body),
      });
    const response = await post(context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      proposal: {
        affectedActorIds: [context.actorId],
        operations: [
          { type: "appendStatement", scriptIndex: 0, statement: { type: "turn", degrees: -90 } },
        ],
      },
    });
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toContain(ORI_STUDIO_VERSION);
    expect(await (await fetch(`${base}/api/tutor/health`)).json()).toMatchObject({
      lastOriSource: "model",
    });
    expect((await post({ ...context, actorId: "actor:studio-2-mika" })).status).toBe(400);
    expect((await post(context, "https://evil.example")).status).toBe(403);
  });

  it("falls back to a reviewable local idea when the CLI is absent", async () => {
    const base = await start({});
    const response = await fetch(`${base}/api/tutor/studio/ori`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(context),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      proposal: { operations: [{ statement: { type: "move", steps: 40 } }] },
    });
  });

  it("lets the real CLI path reuse the child's own block and keeps its title out of the model input", async () => {
    const withBlock = {
      ...context,
      program: {
        schema: "agorix/program/v1",
        scripts: [
          {
            id: "studio-actor-1-nova",
            trigger: { type: "greenFlag" },
            statements: [{ type: "say", text: "Mi secreto" }],
            procedures: [
              { id: "proc-1-1", name: "Mi baile secreto", body: [{ type: "move", steps: 40 }] },
            ],
          },
        ],
      },
    };
    const inputs: string[] = [];
    const run: OriCliProcess = async (_bin, args, options) => {
      if (args.includes("--version")) return "version";
      inputs.push(options.input);
      return JSON.stringify({
        version: ORI_STUDIO_VERSION,
        kind: "program-suggestion",
        actorId: context.actorId,
        block: { type: "callProcedure", procedureId: "proc-1-1" },
      });
    };
    const base = await start({}, undefined, createOriCliService(oriCliConfigFromEnv({}), { run }));
    const post = (body: unknown) =>
      fetch(`${base}/api/tutor/studio/ori`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify(body),
      });
    const response = await post(withBlock);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      proposal: {
        operations: [
          {
            type: "appendStatement",
            scriptIndex: 0,
            statement: { type: "callProcedure", procedureId: "proc-1-1" },
          },
        ],
      },
    });
    expect(inputs[0]).toContain("proc-1-1");
    expect(inputs[0]).not.toMatch(/Mi baile secreto|Mi secreto/);

    // A block id the character does not have never reaches the child: a safe local idea instead.
    const foreign = await fetch(`${base}/api/tutor/studio/ori`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({
        ...withBlock,
        program: {
          ...withBlock.program,
          scripts: [{ ...withBlock.program.scripts[0], procedures: [] }],
        },
      }),
    });
    expect(foreign.status).toBe(200);
    expect(JSON.stringify(await foreign.json())).not.toContain("callProcedure");
  });

  it("lets the real CLI path choose numbers for a custom block without seeing titles or values", async () => {
    const withNumbers = {
      ...context,
      program: {
        schema: "agorix/program/v1",
        scripts: [
          {
            id: "studio-actor-1-nova",
            trigger: { type: "greenFlag" },
            statements: [
              {
                type: "callProcedure",
                procedureId: "proc-1-1",
                args: [{ type: "numericLiteral", value: 37 }],
              },
            ],
            procedures: [
              {
                id: "proc-1-1",
                name: "Mi baile secreto",
                params: [{ id: "p1", name: "Largo" }],
                body: [{ type: "move", steps: 40, stepsFrom: "p1" }],
              },
            ],
          },
        ],
      },
    };
    const inputs: string[] = [];
    let offered: number[] = [100];
    const run: OriCliProcess = async (_bin, args, options) => {
      if (args.includes("--version")) return "version";
      inputs.push(options.input);
      return JSON.stringify({
        version: ORI_STUDIO_VERSION,
        kind: "program-suggestion",
        actorId: context.actorId,
        block: { type: "callProcedure", procedureId: "proc-1-1", args: offered },
      });
    };
    const base = await start({}, undefined, createOriCliService(oriCliConfigFromEnv({}), { run }));
    const post = (body: unknown) =>
      fetch(`${base}/api/tutor/studio/ori`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify(body),
      });
    const response = await post(withNumbers);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      proposal: {
        operations: [
          {
            type: "appendStatement",
            scriptIndex: 0,
            statement: {
              type: "callProcedure",
              procedureId: "proc-1-1",
              args: [{ type: "numericLiteral", value: 100 }],
            },
          },
        ],
      },
    });
    expect(inputs[0]).toContain('"unit":"steps"');
    expect(inputs[0]).toContain('"choices"');
    expect(inputs[0]).not.toMatch(/Largo|Mi baile secreto/);
    // The existing call passes 37, which is not one of the closed choices, so it stays local.
    expect(inputs[0]).not.toContain("37");

    // A value outside the block's choices never reaches the child: the safe local idea does.
    offered = [45];
    const invalid = await post(withNumbers);
    expect(invalid.status).toBe(200);
    expect(JSON.stringify(await invalid.json())).not.toContain("callProcedure");
  });
});
