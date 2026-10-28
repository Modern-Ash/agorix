import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createOriMig04WebAuthRoutes } from "./oriMig04WebAuthRoutes.js";

function request(path: string, origin: string, body: unknown): IncomingMessage {
  const stream = Readable.from([JSON.stringify(body)]);
  return Object.assign(stream, {
    url: path,
    method: "POST",
    headers: {
      origin,
      host: "agorix.example",
      "content-type": "application/json",
    },
  }) as IncomingMessage;
}

function response() {
  const state = { status: 0, body: "", headers: {} as Record<string, unknown> };
  const reply = {
    writeHead: (status: number, headers: Record<string, unknown>) => {
      state.status = status;
      state.headers = headers;
    },
    end: (body: string) => {
      state.body = body;
    },
    getHeader: () => undefined,
    setHeader: () => undefined,
    headersSent: false,
  } as unknown as ServerResponse;
  return { state, reply };
}

describe("MIG-04 opt-in web auth HTTP routes", () => {
  it("rejects cross-origin and non-HTTPS requests before authentication", async () => {
    let calls = 0;
    const routes = createOriMig04WebAuthRoutes({
      register: async () => { calls++; return {} as never; },
      signIn: async () => { calls++; return {} as never; },
    }, {} as never);
    for (const origin of ["https://attacker.example", "http://agorix.example", "invalid"]) {
      const { state, reply } = response();
      await routes(request("/api/tutor/ori/auth/login", origin, {}), reply);
      expect(state.status).toBe(403);
    }
    expect(calls).toBe(0);
  });

  it("registers with real service boundary without returning credentials", async () => {
    let username = "";
    const routes = createOriMig04WebAuthRoutes({
      register: async (input) => {
        username = input.username;
        return {} as never;
      },
      signIn: async () => ({} as never),
    }, {} as never);
    const { state, reply } = response();
    expect(await routes(request("/api/tutor/ori/auth/register", "https://agorix.example", {
      username: "learner",
      password: "secret",
    }), reply)).toBe(true);
    expect(state.status).toBe(201);
    expect(username).toBe("learner");
    expect(state.body).not.toContain("secret");
  });

  it("leaves unrelated TutorServer routes untouched", async () => {
    const routes = createOriMig04WebAuthRoutes({} as never, {} as never);
    const { reply } = response();
    expect(await routes(request("/api/tutor/health", "https://agorix.example", {}), reply)).toBe(false);
  });
});
