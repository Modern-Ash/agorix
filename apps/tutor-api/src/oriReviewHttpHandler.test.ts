import { afterEach, describe, expect, it } from "vitest";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AdminAuth } from "./adminAuth.js";
import { createOriReviewHttpHandler } from "./oriReviewHttpHandler.js";
import { createOriReviewPipeline } from "./oriReviewPipeline.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";

const plan: OriPlanReviewResult = {
  status: "ready",
  appliedChanges: false,
  plan: {
    schema: "ori/shadow-plan/v1",
    kind: "pedagogical-plan",
    stage: 2,
    steps: ["Predecir", "Probar", "Comparar"],
    hint: "¿Qué esperás que pase?",
    requiresLearnerApproval: false,
    appliedChanges: false,
    context: { missionStage: 1 },
  },
};
const auth = {
  read: () => ({ author: "operator", csrf: "synthetic" }),
} as unknown as AdminAuth;
const servers: Server[] = [];
async function serve(enabled: boolean) {
  const pipeline = createOriReviewPipeline(
    auth,
    ["127.0.0.1"],
    createOriReviewRateLimiter(),
    async () => plan,
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
async function call(port: number, origin: string, payload: string) {
  return new Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }>((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1",
      port,
      path: "/internal/ori-review",
      method: "POST",
      headers: {
        host: "127.0.0.1",
        origin,
        "content-type": "application/json",
        "x-agorix-admin-csrf": "synthetic",
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
        headers: res.headers,
      }));
    });
    req.on("error", reject);
    req.end(payload);
  });
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});
describe("Ori experimental HTTP handler over real loopback server", () => {
  it("fails closed while feature is disabled", async () => {
    const port = await serve(false);
    const response = await call(port, "https://127.0.0.1", JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 }));
    expect(response.status).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: "unavailable" });
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("rejects an untrusted origin over actual HTTP transport", async () => {
    const port = await serve(true);
    const response = await call(port, "https://attacker.example", JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 }));
    expect(response.status).toBe(403);
  });
  it("rejects oversized payloads over actual HTTP transport", async () => {
    const port = await serve(true);
    const response = await call(port, "https://127.0.0.1", "x".repeat(513));
    expect(response.status).toBe(400);
  });
  it("returns a validated plan for explicitly enabled admin review", async () => {
    const port = await serve(true);
    const response = await call(port, "https://127.0.0.1", JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 }));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual(plan);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
