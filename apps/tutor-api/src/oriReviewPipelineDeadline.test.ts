import { afterEach, describe, expect, it } from "vitest";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AdminAuth } from "./adminAuth.js";
import { createOriReviewPipeline } from "./oriReviewPipeline.js";
import { createOriReviewRateLimiter } from "./oriReviewRateLimit.js";
import { createOriReviewHttpHandler } from "./oriReviewHttpHandler.js";
import type { OriPlanReviewResult } from "./oriPlanReview.js";

const auth = { read: () => ({ author: "operator", csrf: "synthetic" }) } as unknown as AdminAuth;
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
async function serve(deadlineMs: number, enabled = true) {
  let calls = 0;
  const pipeline = createOriReviewPipeline(
    auth,
    ["127.0.0.1"],
    createOriReviewRateLimiter(),
    async () => {
      calls++;
      return plan;
    },
    enabled,
    deadlineMs,
  );
  const handler = createOriReviewHttpHandler(pipeline);
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { port: (server.address() as AddressInfo).port, calls: () => calls };
}
function post(port: number, body: string, finish = true) {
  return new Promise<number | "closed">((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1",
      port,
      method: "POST",
      path: "/internal/ori-review",
      headers: {
        host: "127.0.0.1",
        origin: "https://127.0.0.1",
        "content-type": "application/json",
        "x-agorix-admin-csrf": "synthetic",
      },
    }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
    });
    req.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ECONNRESET") resolve("closed");
      else reject(error);
    });
    req.on("close", () => resolve("closed"));
    if (finish) req.end(body);
    else req.write(body);
  });
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});
describe("Ori pipeline body deadline over real HTTP", () => {
  it("accepts a complete request before deadline", async () => {
    const server = await serve(1000);
    expect(await post(server.port, JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 }))).toBe(200);
    expect(server.calls()).toBe(1);
  });
  it("does not invoke Ori when a body stalls beyond deadline", async () => {
    const server = await serve(30);
    const outcome = await post(server.port, "{", false);
    expect([400, "closed"]).toContain(outcome);
    expect(server.calls()).toBe(0);
  });
  it("remains disabled without reading a stalled body", async () => {
    const server = await serve(30, false);
    expect(await post(server.port, "{", false)).toBe(503);
    expect(server.calls()).toBe(0);
  });
});
