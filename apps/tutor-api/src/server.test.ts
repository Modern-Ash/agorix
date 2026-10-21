import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { TutorRequest } from "@agorix/tutor-contract";
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
): Promise<string> {
  const server = createTutorServer({
    config: configFromEnv(env),
    ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("tutor HTTP server (issue #348)", () => {
  it("reports not configured when no provider is set (normal local mode)", async () => {
    const base = await start({ AGORIX_TUTOR_ADAPTER: "openai-compatible" });
    const response = await fetch(`${base}/api/tutor/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ configured: false, available: false });
  });

  it("reports available for the fake adapter and never leaks secrets", async () => {
    const base = await start({
      AGORIX_TUTOR_ADAPTER: "fake",
      AGORIX_TUTOR_AUTH_TOKEN: "super-secret-token",
    });
    const text = await (await fetch(`${base}/api/tutor/health`)).text();
    expect(JSON.parse(text)).toEqual({ configured: true, available: true });
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
    });
    expect(seen).toEqual(["http://provider.test/v1/models"]);
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
