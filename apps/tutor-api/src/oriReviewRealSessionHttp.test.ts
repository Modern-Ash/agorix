import { afterEach, describe, expect, it } from "vitest";
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { AdminAuth, hashAdminPassword } from "./adminAuth.js";
import { createOriReviewHttpHandler } from "./oriReviewHttpHandler.js";
import { createOriReviewPipeline } from "./oriReviewPipeline.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";

const password = "a".repeat(28);
const payload = JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 });
const plan: OriPlanReviewResult = {
  status: "ready",
  appliedChanges: false,
  plan: {
    schema: "ori/shadow-plan/v1",
    kind: "pedagogical-plan",
    stage: 2,
    steps: ["Predecir", "Probar", "Comparar"],
    hint: "¿Qué pasará?",
    requiresLearnerApproval: false,
    appliedChanges: false,
    context: { missionStage: 1 },
  },
};
const servers: Server[] = [];

function login(auth: AdminAuth): { cookie: string; csrf: string } {
  let cookie = "";
  const response = {
    setHeader: (_key: string, value: string) => {
      cookie = value.split(";")[0] ?? "";
    },
  } as unknown as ServerResponse;
  const request = {
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as IncomingMessage;
  const session = auth.signIn(password, request, response);
  if (!session) throw new Error("synthetic login failed");
  return { cookie, csrf: session.csrf };
}

async function serve(auth: AdminAuth, enabled = true, onReview: () => void = () => undefined) {
  const pipeline = createOriReviewPipeline(
    auth,
    ["127.0.0.1"],
    createOriReviewRateLimiter(),
    async () => {
      onReview();
      return plan;
    },
    enabled,
  );
  const handler = createOriReviewHttpHandler(pipeline);
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

async function call(port: number, cookie?: string, csrf?: string, origin = "https://127.0.0.1") {
  return new Promise<number>((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        method: "POST",
        path: "/internal/ori-review",
        headers: {
          host: "127.0.0.1",
          origin,
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
          ...(csrf ? { "x-agorix-admin-csrf": csrf } : {}),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe("Ori review HTTP adapter with real AdminAuth lifecycle", () => {
  it("denies requests without a real session before invoking review", async () => {
    const auth = new AdminAuth(hashAdminPassword(password));
    let calls = 0;
    const port = await serve(auth, true, () => calls++);
    expect(await call(port)).toBe(401);
    expect(calls).toBe(0);
  });

  it("accepts a real session and matching CSRF", async () => {
    const auth = new AdminAuth(hashAdminPassword(password));
    const session = login(auth);
    const port = await serve(auth);
    expect(await call(port, session.cookie, session.csrf)).toBe(200);
  });

  it("denies wrong or missing CSRF with a real session", async () => {
    const auth = new AdminAuth(hashAdminPassword(password));
    const session = login(auth);
    const port = await serve(auth);
    expect(await call(port, session.cookie, "wrong")).toBe(403);
    expect(await call(port, session.cookie)).toBe(403);
  });

  it("denies a signed-out session", async () => {
    const auth = new AdminAuth(hashAdminPassword(password));
    const session = login(auth);
    const port = await serve(auth);
    const request = { headers: { cookie: session.cookie } } as IncomingMessage;
    const response = { setHeader: () => undefined } as unknown as ServerResponse;
    auth.signOut(request, response);
    expect(await call(port, session.cookie, session.csrf)).toBe(401);
  });

  it("denies an expired session", async () => {
    let now = 100_000;
    const auth = new AdminAuth(hashAdminPassword(password), "operator", () => now);
    const session = login(auth);
    const port = await serve(auth);
    now += 2 * 60 * 60 * 1000 + 1;
    expect(await call(port, session.cookie, session.csrf)).toBe(401);
  });

  it("rejects a cross-origin request even with valid session", async () => {
    const auth = new AdminAuth(hashAdminPassword(password));
    const session = login(auth);
    const port = await serve(auth);
    expect(await call(port, session.cookie, session.csrf, "https://attacker.example")).toBe(403);
  });

  it("remains unavailable when disabled even with a real session", async () => {
    const auth = new AdminAuth(hashAdminPassword(password));
    const session = login(auth);
    const port = await serve(auth, false);
    expect(await call(port, session.cookie, session.csrf)).toBe(503);
  });
});
