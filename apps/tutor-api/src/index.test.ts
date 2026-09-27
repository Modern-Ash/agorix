import { describe, expect, it } from "vitest";
import {
  configFromEnv,
  describeTutorApi,
  requestTutorResponse,
  type TutorProviderConfig,
} from "./index.js";
import type { TutorRequest } from "@agorix/tutor-contract";

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
  learnerQuestion: "my private words",
  reading: { locale: "en-US", readingLevel: "middle-grade" },
};

const providerConfig: TutorProviderConfig = {
  provider: "openai-compatible",
  model: "test-model",
  endpoint: "https://provider.example.test/chat",
  apiKey: "secret-key",
  timeoutMs: 500,
};

describe("tutor-api", () => {
  it("describes the server-side adapter surface", () => {
    expect(describeTutorApi()).toContain("server-side provider adapter");
  });

  it("loads provider, model and timeout from environment config", () => {
    expect(
      configFromEnv({
        AGORIX_TUTOR_PROVIDER: "openai-compatible",
        AGORIX_TUTOR_MODEL: "gpt-test",
        AGORIX_TUTOR_ENDPOINT: "https://gateway.example.test/v1/chat/completions",
        AGORIX_TUTOR_API_KEY: "sk-test",
        AGORIX_TUTOR_TIMEOUT_MS: "1234",
      }),
    ).toEqual({
      provider: "openai-compatible",
      model: "gpt-test",
      endpoint: "https://gateway.example.test/v1/chat/completions",
      apiKey: "sk-test",
      timeoutMs: 1234,
      includeLearnerQuestion: false,
    });
  });

  it("calls an OpenAI-compatible provider and validates the response before returning it", async () => {
    let capturedBody = "";
    const result = await requestTutorResponse(request, providerConfig, {
      fetch: async (_url, init) => {
        capturedBody = String(init?.body);
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    schema: "agorix/tutor-response/v1",
                    hintLevel: 1,
                    message: "Compare the move steps with the goal distance.",
                    nodeIds: ["scripts[0]/statements[0]"],
                    concepts: ["movement"],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        );
      },
    });

    expect(result.diagnostics).toEqual({
      provider: "openai-compatible",
      model: "test-model",
      source: "provider",
    });
    expect(result.response.message).toContain("move steps");
    expect(capturedBody).toContain('"model":"test-model"');
    expect(capturedBody).not.toContain("secret-key");
    expect(capturedBody).not.toContain("my private words");
  });

  it("can include learner question only when explicitly configured", async () => {
    let capturedBody = "";
    await requestTutorResponse(
      request,
      { ...providerConfig, includeLearnerQuestion: true },
      {
        fetch: async (_url, init) => {
          capturedBody = String(init?.body);
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      schema: "agorix/tutor-response/v1",
                      hintLevel: 1,
                      message: "What changed after Run?",
                      nodeIds: [],
                      concepts: ["sequence"],
                    }),
                  },
                },
              ],
            }),
            { status: 200 },
          );
        },
      },
    );

    expect(capturedBody).toContain("my private words");
  });

  it("falls back to deterministic fake mode when provider config has no secret", async () => {
    const result = await requestTutorResponse(request, {
      provider: "openai-compatible",
      model: "test-model",
      endpoint: "https://provider.example.test/chat",
      timeoutMs: providerConfig.timeoutMs,
    });

    expect(result.diagnostics).toMatchObject({
      source: "fallback",
      unavailableReason: "not-configured",
    });
    expect(result.response.schema).toBe("agorix/tutor-response/v1");
  });

  it("falls back when provider output fails the tutor response contract", async () => {
    const result = await requestTutorResponse(request, providerConfig, {
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ message: "bad" }) } }],
          }),
          { status: 200 },
        ),
    });

    expect(result.diagnostics).toMatchObject({
      source: "fallback",
      unavailableReason: "invalid-response",
    });
    expect(result.response.schema).toBe("agorix/tutor-response/v1");
  });

  it("falls back on provider outage without throwing into the editor flow", async () => {
    const result = await requestTutorResponse(request, providerConfig, {
      fetch: async () => new Response("nope", { status: 503 }),
    });

    expect(result.diagnostics).toMatchObject({
      source: "fallback",
      unavailableReason: "provider-error",
    });
  });

  it("aborts slow providers and falls back", async () => {
    const result = await requestTutorResponse(
      request,
      { ...providerConfig, timeoutMs: 1 },
      {
        fetch: (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      },
    );

    expect(result.diagnostics).toMatchObject({
      source: "fallback",
      unavailableReason: "timeout",
    });
  });
});
