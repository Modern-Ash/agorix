import { describe, expect, it, vi } from "vitest";
import { parseOriDebugGuidance, requestOriDebugGuidance } from "./oriDebugGuidanceClient.js";

const guidance = {
  schema: "agorix/ori-debug-guidance/v1",
  nextStep: "Revisar el paso 2 de la traza verificada por el host",
  question: "Preguntarse si ese paso produjo lo que esperabas",
  appliedChanges: false,
};

describe("Kids Ori debug guidance client", () => {
  it("accepts only the read-only, bounded guidance shape", () => {
    expect(parseOriDebugGuidance(guidance)).toEqual(guidance);
    expect(parseOriDebugGuidance({ ...guidance, proposal: { apply: true } })).toBeNull();
    expect(parseOriDebugGuidance({ ...guidance, appliedChanges: true })).toBeNull();
    expect(
      parseOriDebugGuidance({ ...guidance, nextStep: "Ejecutá código desconocido" }),
    ).toBeNull();
  });
  it("sends no child text or project identity in its request", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => guidance,
    })) as unknown as typeof fetch;
    expect(await requestOriDebugGuidance(fetchMock)).toEqual(guidance);
    const [url, options] = vi.mocked(fetchMock).mock.calls[0]!;
    expect(url).toBe("/api/tutor/ori/review/debug");
    expect(options?.body).toBe("{}");
    expect(options?.credentials).toBe("same-origin");
    expect(options?.headers).toMatchObject({ "x-agorix-request": "1" });
  });
  it("leaves Kids available when guidance is denied or malformed", async () => {
    const denied = vi.fn(async () => ({ ok: false })) as unknown as typeof fetch;
    const malformed = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ...guidance, appliedChanges: true }),
    })) as unknown as typeof fetch;
    expect(await requestOriDebugGuidance(denied)).toBeNull();
    expect(await requestOriDebugGuidance(malformed)).toBeNull();
  });
});
