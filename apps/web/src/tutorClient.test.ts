import { describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { createTutorRequest, createTutorResponse } from "@agorix/tutor-contract";
import { createWorldState } from "@agorix/runtime";
import { requestWebTutorHint } from "./tutorClient.js";

const request = createTutorRequest({
  mission: { id: "first-mission.reach-goal", version: 1, concepts: ["movement"] },
  program: {
    schema: SCHEMA_VERSION,
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
  },
  runtime: {
    outcome: "completed",
    stepsUsed: 0,
    finalWorld: createWorldState(),
    observations: [],
  },
  hintHistory: [],
});

describe("Web tutor client (#356)", () => {
  it("posts a bounded same-origin request only in active mode and marks a valid runtime hint", async () => {
    const hint = createTutorResponse({
      hintLevel: 1,
      message: "What do you expect the sprite to do next?",
      nodeIds: [],
      concepts: ["movement"],
    });
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ response: hint, source: "runtime" }), {
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await requestWebTutorHint(request, "active", fetchImpl);
    expect(result).toEqual({ response: hint, source: "server" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/tutor/respond",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify(request),
      }),
    );
  });

  it("keeps local hints for offline mode, provider fallback, errors and malformed responses", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    expect((await requestWebTutorHint(request, "local", fetchImpl)).source).toBe("local");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await requestWebTutorHint(request, "active", fetchImpl)).source).toBe("local");

    const serverFallback = async () =>
      new Response(JSON.stringify({ response: { bad: true }, source: "fallback" }), {
        headers: { "content-type": "application/json" },
      });
    expect((await requestWebTutorHint(request, "active", serverFallback)).source).toBe("local");

    const badResponse = async () =>
      new Response(JSON.stringify({ response: { bad: true }, source: "runtime" }), {
        headers: { "content-type": "application/json" },
      });
    expect((await requestWebTutorHint(request, "active", badResponse)).source).toBe("local");
  });
});
