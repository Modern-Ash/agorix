import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeProviderRuntime } from "@agorix/provider-runtime";
import type { LearningCompanionRequest, LearningCompanionResponse } from "@agorix/tutor-contract";
import {
  createCompanionTurn,
  createStudioStarterProject,
  openStoredProject,
} from "./studioCore.js";
import {
  classifyEndpointLocality,
  createStudioProviderClient,
  normalizeStudioProviderSettings,
  type StudioFetch,
  type StudioProviderSettings,
} from "./studioProvider.js";

const CANARY = "canary-bearer-0001";

function request(action: "explain" | "build" = "explain"): LearningCompanionRequest {
  const project = openStoredProject(
    createStudioStarterProject({
      starter: "first-mission",
      locale: "en",
      now: "2026-10-03T12:00:00.000Z",
    }),
  );
  return createCompanionTurn(project, action).request;
}

interface BoundaryOptions {
  health?: "available" | "degraded" | "unavailable";
  mutate?: (response: LearningCompanionResponse) => unknown;
  raw?: string;
  status?: number;
  hang?: boolean;
}

const servers: Server[] = [];
const seenAuth: Array<string | undefined> = [];

/** Real loopback HTTP server standing in for the tutor API boundary; deterministic, no credentials. */
async function startBoundary(options: BoundaryOptions = {}): Promise<string> {
  const fake = createFakeProviderRuntime({
    runtimeId: "fake",
    providerId: "fake",
    modelId: "deterministic",
    locality: "local",
    capabilities: ["coach", "builder", "debugger", "explainer", "challenger", "reflector"],
  });
  const server = createServer(async (req: IncomingMessage, res) => {
    seenAuth.push(req.headers.authorization);
    if (options.hang === true) {
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      res.end(JSON.stringify({ status: options.health ?? "available" }));
      return;
    }
    let body = "";
    for await (const chunk of req) {
      body += String(chunk);
    }
    const result = await fake.request(JSON.parse(body) as LearningCompanionRequest);
    res.statusCode = options.status ?? 200;
    if (options.raw !== undefined) {
      res.end(options.raw);
    } else if (result.ok) {
      res.end(JSON.stringify(options.mutate ? options.mutate(result.response) : result.response));
    } else {
      res.end("{}");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const nodeFetch: StudioFetch = (input, init) => fetch(input, init);

function client(overrides: Partial<StudioProviderSettings>, extra: { credential?: string } = {}) {
  return createStudioProviderClient({
    settings: normalizeStudioProviderSettings({
      healthTimeoutMs: 300,
      requestTimeoutMs: 600,
      ...overrides,
    }),
    fetch: nodeFetch,
    ...(extra.credential === undefined ? {} : { getCredential: () => extra.credential }),
  });
}

afterEach(async () => {
  seenAuth.length = 0;
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

describe("Studio provider client", () => {
  it("works end to end against a deterministic boundary with no credentials", async () => {
    const endpoint = await startBoundary();
    const c = client({ endpoint });
    expect(await c.probe()).toMatchObject({ state: "available", locality: "local" });
    const outcome = await c.request(request());
    expect(outcome.status).toBe("response");
    expect(seenAuth.every((a) => a === undefined)).toBe(true);
  });

  it("reports disabled when turned off and never calls the network", async () => {
    let calls = 0;
    const c = createStudioProviderClient({
      settings: normalizeStudioProviderSettings({ enabled: false, endpoint: "http://127.0.0.1:1" }),
      fetch: async () => {
        calls += 1;
        throw new Error("no network expected");
      },
    });
    expect(await c.probe()).toMatchObject({ state: "disabled", reason: "offline-mode" });
    expect(await c.request(request())).toMatchObject({ status: "unavailable" });
    expect(calls).toBe(0);
  });

  it("reports disabled for an unconfigured endpoint", async () => {
    expect(await client({}).probe()).toMatchObject({
      state: "disabled",
      reason: "no-compatible-provider",
    });
  });

  it("is unavailable when the boundary is down, unhealthy or hangs, with learner-safe copy", async () => {
    const down = await startBoundary();
    await new Promise((r) => servers.pop()!.close(r));
    for (const endpoint of [
      down,
      await startBoundary({ health: "unavailable" }),
      await startBoundary({ hang: true }),
    ]) {
      const status = await client({ endpoint }).probe();
      expect(status.state).toBe("unavailable");
      expect(status.message).toContain("You can still build and run your program");
      expect(status.message).not.toContain("127.0.0.1");
    }
    const outcome = await client({ endpoint: down }).request(request());
    expect(outcome).toMatchObject({ status: "unavailable", reason: "all-unavailable" });
  });

  it("never contacts a remote endpoint without allowRemote, and uses it with opt-in", async () => {
    let calls = 0;
    const spy: StudioFetch = async (input, init) => {
      calls += 1;
      return input.endsWith("/health")
        ? { ok: true, status: 200, text: async () => '{"status":"available"}' }
        : nodeFetch(input, init);
    };
    const base = { remoteEndpoint: "https://tutor.example.test" };
    const blocked = createStudioProviderClient({
      settings: normalizeStudioProviderSettings(base),
      fetch: spy,
    });
    expect(await blocked.probe()).toMatchObject({ state: "disabled" });
    expect(calls).toBe(0);
    const allowed = createStudioProviderClient({
      settings: normalizeStudioProviderSettings({ ...base, allowRemote: true }),
      fetch: spy,
    });
    expect(await allowed.probe()).toMatchObject({ state: "available", locality: "remote" });
  });

  it("prefers local over remote when both are available, and falls back when local is down", async () => {
    const local = await startBoundary();
    const spy: StudioFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => '{"status":"available"}',
    });
    const mixed = createStudioProviderClient({
      settings: normalizeStudioProviderSettings({
        endpoint: local,
        remoteEndpoint: "https://tutor.example.test",
        allowRemote: true,
      }),
      fetch: (input, init) =>
        input.startsWith("https") ? spy(input, init) : nodeFetch(input, init),
    });
    expect(await mixed.probe()).toMatchObject({ locality: "local" });
    await new Promise((r) => servers.pop()!.close(r));
    expect(await mixed.probe()).toMatchObject({ state: "available", locality: "remote" });
  });

  describe("response validation before any UI", () => {
    it.each([
      ["malformed schema", (r: LearningCompanionResponse) => ({ ...r, schema: "bogus" })],
      ["unknown field", (r: LearningCompanionResponse) => ({ ...r, extra: 1 })],
    ])("fails closed on %s", async (_name, mutate) => {
      const endpoint = await startBoundary({ mutate });
      expect(await client({ endpoint }).request(request())).toMatchObject({
        status: "unavailable",
      });
    });

    it("fails closed on non-JSON, error status and oversized bodies", async () => {
      for (const options of [
        { raw: "not json" },
        { status: 500, raw: "{}" },
        { raw: "x".repeat(300_000) },
      ]) {
        const endpoint = await startBoundary(options);
        expect((await client({ endpoint }).request(request())).status).toBe("unavailable");
      }
    });

    it("rejects PII-seeking output with the child-safe message and no raw content", async () => {
      const endpoint = await startBoundary({
        mutate: (r) => ({ ...r, message: "What is your home address and your school name?" }),
      });
      const outcome = await client({ endpoint }).request(request());
      expect(outcome).toEqual({
        status: "rejected",
        message: "I couldn't use that AI suggestion safely. Your program stayed the same.",
      });
    });

    it("rejects a capability mismatch", async () => {
      const endpoint = await startBoundary({
        mutate: (r) => ({ ...r, capability: r.capability === "coach" ? "builder" : "coach" }),
      });
      expect((await client({ endpoint }).request(request())).status).not.toBe("response");
    });
  });

  describe("credentials", () => {
    it("sends the credential only as a bearer header to loopback and never leaks it in results", async () => {
      const endpoint = await startBoundary();
      const c = client({ endpoint }, { credential: CANARY });
      const outcome = await c.request(request());
      expect(seenAuth).toContain(`Bearer ${CANARY}`);
      expect(JSON.stringify(outcome)).not.toContain(CANARY);
      expect(JSON.stringify(await c.probe())).not.toContain(CANARY);
    });

    it("never sends a credential over cleartext to a remote host", async () => {
      const headers: Array<Record<string, string>> = [];
      const c = createStudioProviderClient({
        settings: normalizeStudioProviderSettings({
          endpoint: "http://tutor.example.test",
          allowRemote: true,
        }),
        fetch: async (_input, init) => {
          headers.push(init.headers);
          return { ok: true, status: 200, text: async () => '{"status":"available"}' };
        },
        getCredential: () => CANARY,
      });
      await c.probe();
      expect(headers.length).toBeGreaterThan(0);
      expect(JSON.stringify(headers)).not.toContain(CANARY);
    });

    it("keeps credential values out of the settings schema and sources", async () => {
      const { readFileSync, readdirSync } = await import("node:fs");
      const manifest = JSON.parse(
        readFileSync(new URL("../package.json", import.meta.url), "utf8"),
      );
      const keys = Object.keys(manifest.contributes.configuration.properties);
      expect(keys.filter((k) => /token|secret|key|password|credential/i.test(k))).toEqual([]);
      for (const file of readdirSync(new URL(".", import.meta.url))) {
        if (file.endsWith(".ts")) {
          expect(readFileSync(new URL(file, import.meta.url), "utf8")).not.toMatch(
            /sk-[A-Za-z0-9]{8,}/,
          );
        }
      }
    });

    it("produces no console output while handling a credentialed failure", async () => {
      const lines: unknown[] = [];
      const original = { log: console.log, warn: console.warn, error: console.error };
      console.log = console.warn = console.error = (...a: unknown[]) => void lines.push(...a);
      try {
        const c = client({ endpoint: "http://127.0.0.1:1" }, { credential: CANARY });
        await c.probe();
        await c.request(request());
      } finally {
        Object.assign(console, original);
      }
      expect(JSON.stringify(lines)).not.toContain(CANARY);
      expect(lines).toEqual([]);
    });
  });

  it("normalizes settings defensively", () => {
    expect(
      normalizeStudioProviderSettings({
        endpoint: "ftp://x",
        allowRemote: "yes",
        requestTimeoutMs: -5,
      }),
    ).toMatchObject({
      endpoint: "",
      allowRemote: false,
      requestTimeoutMs: 8000,
    });
    expect(
      normalizeStudioProviderSettings({ endpoint: " http://localhost:8787/// " }).endpoint,
    ).toBe("http://localhost:8787");
    expect(classifyEndpointLocality("http://[::1]:1")).toBe("local");
    expect(classifyEndpointLocality("https://a.example")).toBe("remote");
    expect(classifyEndpointLocality("nope")).toBeUndefined();
  });
});
