import { describe, expect, it } from "vitest";
import { createOriShadowTransport } from "./oriExternalShadowTransport.js";
import { createOriShadowMetrics } from "./oriShadowMetrics.js";

const input = { missionIndex: 0, hintLevel: 1 as const, scriptCount: 1 };
describe("Ori shadow transport security regression", () => {
  it.each([
    "https://example.com/v1/plan",
    "http://192.168.1.10:11485/v1/plan",
    "http://user:pass@localhost:11485/v1/plan",
    "http://localhost:11485/admin",
    "http://localhost:11485/v1/plan?token=abc",
    "http://localhost:11485/v1/plan#fragment",
    "file:///tmp/plan",
  ])("rejects untrusted endpoint %s", (url) => {
    expect(() => createOriShadowTransport(url)).toThrow();
  });
  it.each(["/v0/shadow", "/v1/plan"])("uses POST with minimized JSON on %s", async (path) => {
    const seen: { url?: string; init?: RequestInit } = {};
    const fetchMock = (async (url: RequestInfo | URL, init?: RequestInit) => {
      seen.url = String(url);
      seen.init = init;
      return new Response(
        path === "/v1/plan"
          ? JSON.stringify({
              schema: "ori/shadow-plan/v1", kind: "pedagogical-plan", stage: 1,
              steps: ["Pensar", "Probar", "Reflexionar"], hint: "¿Qué sigue?",
              requiresLearnerApproval: false, appliedChanges: false,
              context: { missionStage: 0 },
            })
          : JSON.stringify({ accepted: true }),
      );
    }) as typeof fetch;
    const metrics = createOriShadowMetrics();
    await createOriShadowTransport(`http://127.0.0.1:11485${path}`, fetchMock, metrics)(input);
    expect(seen.url).toContain(path);
    expect(seen.init?.method).toBe("POST");
    expect(seen.init?.redirect).toBe("error");
    expect(seen.init?.credentials).toBe("omit");
    expect(JSON.parse(String(seen.init?.body))).toEqual(input);
    expect(metrics.snapshot().valid).toBe(1);
  });
});
