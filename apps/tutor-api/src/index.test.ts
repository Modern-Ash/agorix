import { describe, expect, it, vi } from "vitest";
import {
  createLearningCompanionRequestFromTutorRequest,
  validateTutorResponse,
  type TutorRequest,
} from "@agorix/tutor-contract";
import { assertProviderRuntimeConformance } from "@agorix/provider-runtime";
import {
  configFromEnv,
  createTutorAdapterRuntime,
  describeTutorApi,
  isTutorAdapterConfigured,
  requestTutorResponse,
  TutorAdapterConfigurationError,
  type TutorAdapterConfig,
} from "./index.js";

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

const providerMessage = "What evidence did the runtime show?";
const learningCompanionJson = JSON.stringify({
  schema: "agorix/learning-companion-response/v1",
  capability: "coach",
  message: providerMessage,
  nodeIds: ["scripts[0]/statements[0]"],
  concepts: ["sequence"],
  metadata: {
    capability: "coach",
    scaffoldLevel: 2,
    provenance: "remote-provider",
    uncertainty: "medium",
  },
  payload: { kind: "question", question: providerMessage },
});

const remoteConfig: TutorAdapterConfig = {
  adapter: "openai-compatible",
  model: "gateway-model",
  baseUrl: "https://gateway.example.test/v1",
  authToken: "secret-token",
  timeoutMs: 500,
  capabilities: ["coach"],
};

const fakeConfig: TutorAdapterConfig = {
  adapter: "fake",
  timeoutMs: 500,
  capabilities: ["coach"],
};

function completionResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

function recordingFetch(
  handler: (input: string, init: RequestInit | undefined) => Response | Promise<Response>,
): { fetch: typeof fetch; calls: Array<{ input: string; init: RequestInit | undefined }> } {
  const calls: Array<{ input: string; init: RequestInit | undefined }> = [];
  const fetchImpl = async (input: unknown, init?: RequestInit): Promise<Response> => {
    calls.push({ input: String(input), init });
    return handler(String(input), init);
  };
  return { fetch: fetchImpl as typeof fetch, calls };
}

function bodyOf(call: { init: RequestInit | undefined }): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}

describe("tutor-api server boundary", () => {
  it("describes the server-side adapter surface", () => {
    expect(describeTutorApi()).toContain("server-side provider adapter");
  });

  it("defaults to the deterministic adapter with no commercial endpoint or model", () => {
    expect(configFromEnv({})).toEqual({
      adapter: "fake",
      timeoutMs: 4_000,
      capabilities: ["coach"],
      includeLearnerQuestion: false,
    });
  });

  it("reads provider, model, base URL, auth, timeout and capabilities from the environment", () => {
    expect(
      configFromEnv({
        AGORIX_TUTOR_ADAPTER: "openai-compatible",
        AGORIX_TUTOR_BASE_URL: "https://gateway.example.test/v1",
        AGORIX_TUTOR_MODEL: "gateway-model",
        AGORIX_TUTOR_AUTH_TOKEN: "secret-token",
        AGORIX_TUTOR_AUTH_HEADER: "x-gateway-key",
        AGORIX_TUTOR_TIMEOUT_MS: "2500",
        AGORIX_TUTOR_CAPABILITIES: "coach, explainer",
        AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION: "1",
      }),
    ).toEqual({
      adapter: "openai-compatible",
      baseUrl: "https://gateway.example.test/v1",
      model: "gateway-model",
      authToken: "secret-token",
      authHeaderName: "x-gateway-key",
      timeoutMs: 2_500,
      capabilities: ["coach", "explainer"],
      includeLearnerQuestion: true,
    });
  });

  it("accepts the legacy provider, endpoint and api key variables", () => {
    expect(
      configFromEnv({
        AGORIX_TUTOR_PROVIDER: "openai-compatible",
        AGORIX_TUTOR_ENDPOINT: "https://gateway.example.test/v1/chat/completions/",
        AGORIX_TUTOR_API_KEY: "secret-token",
        AGORIX_TUTOR_MODEL: "gateway-model",
      }),
    ).toMatchObject({
      adapter: "openai-compatible",
      baseUrl: "https://gateway.example.test/v1",
      authToken: "secret-token",
    });
  });

  it("rejects unknown adapters and unknown capabilities", () => {
    expect(() => configFromEnv({ AGORIX_TUTOR_ADAPTER: "some-vendor" })).toThrow(
      TutorAdapterConfigurationError,
    );
    expect(() => configFromEnv({ AGORIX_TUTOR_CAPABILITIES: "coach,telepathy" })).toThrow(
      /unknown capability/,
    );
  });
});

describe("tutor-api delegation to provider-runtime", () => {
  it("sends the mapped request to the configured compatible gateway", async () => {
    const { fetch: fetchImpl, calls } = recordingFetch(() =>
      completionResponse(learningCompanionJson),
    );

    const result = await requestTutorResponse(request, remoteConfig, { fetch: fetchImpl });

    expect(result.response).toEqual(validateTutorResponse(result.response));
    expect(result.response.message).toBe(providerMessage);
    expect(result.response.hintLevel).toBe(2);
    expect(result.diagnostics).toEqual({
      adapter: "openai-compatible",
      runtimeId: "openai-compatible:gateway-model",
      providerId: "openai-compatible",
      model: "gateway-model",
      source: "runtime",
    });
    expect(calls[0]?.input).toBe("https://gateway.example.test/v1/chat/completions");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer secret-token");
    expect(bodyOf(calls[0]!)).toMatchObject({
      model: "gateway-model",
      response_format: { type: "json_object" },
    });
  });

  it("keeps learner free text out of provider context unless it is opted in", async () => {
    const excluded = recordingFetch(() => completionResponse(learningCompanionJson));
    const included = recordingFetch(() => completionResponse(learningCompanionJson));

    await requestTutorResponse(request, remoteConfig, { fetch: excluded.fetch });
    await requestTutorResponse(
      request,
      { ...remoteConfig, includeLearnerQuestion: true },
      {
        fetch: included.fetch,
      },
    );

    expect(String(excluded.calls[0]?.init?.body)).not.toContain("my private words");
    expect(String(included.calls[0]?.init?.body)).toContain("my private words");
  });

  it("keeps the secret out of diagnostics on success and on failure", async () => {
    const ok = recordingFetch(() => completionResponse(learningCompanionJson));
    const failed = recordingFetch(() => new Response("nope", { status: 401 }));

    const okResult = await requestTutorResponse(request, remoteConfig, { fetch: ok.fetch });
    const failedResult = await requestTutorResponse(request, remoteConfig, { fetch: failed.fetch });

    expect(JSON.stringify(okResult.diagnostics)).not.toContain("secret-token");
    expect(JSON.stringify(failedResult.diagnostics)).not.toContain("secret-token");
  });

  it("degrades to the deterministic response when the remote adapter is not configured", async () => {
    const { fetch: fetchImpl, calls } = recordingFetch(() =>
      completionResponse(learningCompanionJson),
    );
    const unconfigured: TutorAdapterConfig = {
      adapter: "openai-compatible",
      timeoutMs: 500,
      capabilities: ["coach"],
    };

    expect(isTutorAdapterConfigured(unconfigured)).toBe(false);
    const result = await requestTutorResponse(request, unconfigured, { fetch: fetchImpl });

    expect(calls).toHaveLength(0);
    expect(result.diagnostics).toMatchObject({ source: "fallback", errorCode: "not-configured" });
    expect(result.response).toEqual((await requestTutorResponse(request, fakeConfig)).response);
  });

  it("normalizes gateway failures into provider-neutral error codes", async () => {
    const cases: ReadonlyArray<{
      readonly status: number;
      readonly errorCode: string;
      readonly label: string;
    }> = [
      { status: 401, errorCode: "authentication-failed", label: "rejects unauthenticated calls" },
      { status: 503, errorCode: "provider-unavailable", label: "isolates provider outages" },
      { status: 400, errorCode: "provider-error", label: "isolates rejected requests" },
    ];

    for (const testCase of cases) {
      const { fetch: fetchImpl } = recordingFetch(
        () => new Response("nope", { status: testCase.status }),
      );
      const result = await requestTutorResponse(request, remoteConfig, { fetch: fetchImpl });
      expect(result.diagnostics, testCase.label).toMatchObject({
        source: "fallback",
        errorCode: testCase.errorCode,
      });
    }

    const malformed = recordingFetch(() => completionResponse("{not json"));
    const malformedResult = await requestTutorResponse(request, remoteConfig, {
      fetch: malformed.fetch,
    });
    expect(malformedResult.diagnostics).toMatchObject({
      source: "fallback",
      errorCode: "invalid-response",
    });
  });

  it("makes an outage observably equivalent to the deterministic local adapter", async () => {
    const { fetch: fetchImpl } = recordingFetch(() => new Response("down", { status: 503 }));

    const local = await requestTutorResponse(request, fakeConfig);
    const degraded = await requestTutorResponse(request, remoteConfig, { fetch: fetchImpl });

    expect(degraded.response).toEqual(local.response);
    expect(degraded.response).toEqual(validateTutorResponse(degraded.response));
    expect(local.response.message).toBe("What should happen first when you run this program?");
    expect(local.diagnostics).toMatchObject({ adapter: "fake", source: "runtime" });
    expect(degraded.diagnostics).toMatchObject({
      adapter: "openai-compatible",
      source: "fallback",
    });
  });

  it("normalizes a slow gateway into a timeout without leaking provider text", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        (_input: unknown, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      );

      const pending = requestTutorResponse(request, remoteConfig, {
        fetch: fetchImpl as unknown as typeof fetch,
      });
      await vi.advanceTimersByTimeAsync(remoteConfig.timeoutMs);
      const result = await pending;

      expect(result.diagnostics).toMatchObject({ source: "fallback", errorCode: "timeout" });
      expect(JSON.stringify(result.response)).not.toContain("secret-token");
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes the deterministic adapter through the shared conformance harness", () => {
    const runtime = createTutorAdapterRuntime(fakeConfig);
    const result = assertProviderRuntimeConformance(
      runtime,
      createLearningCompanionRequestFromTutorRequest(request),
    );

    expect(result.ok).toBe(true);
    expect(runtime.descriptor).toMatchObject({
      providerId: "fake",
      modelId: "deterministic",
      locality: "local",
    });
  });

  it("delegates capability negotiation to provider-runtime", async () => {
    const { fetch: fetchImpl, calls } = recordingFetch(() =>
      completionResponse(learningCompanionJson),
    );
    const runtime = createTutorAdapterRuntime(
      { ...remoteConfig, capabilities: ["explainer"] },
      { fetch: fetchImpl },
    );

    const result = await runtime.request(createLearningCompanionRequestFromTutorRequest(request));

    expect(calls).toHaveLength(0);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "unsupported-capability" },
    });
  });
});
