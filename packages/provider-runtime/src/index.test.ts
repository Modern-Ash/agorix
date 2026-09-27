import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { runProgram } from "@agorix/runtime";
import { createLearningCompanionRequest } from "@agorix/tutor-contract";
import {
  PACKAGE_NAME,
  assertProviderRuntimeConformance,
  createFakeProviderRuntime,
  createOllamaProviderRuntime,
  createProviderModelConfig,
  negotiateCapability,
  normalizeProviderRuntimeError,
  ProviderRuntimeContractError,
  type LearningCompanionProviderRuntime,
  type ProviderRuntimeResult,
} from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 10 }],
    },
  ],
};

const result = runProgram(
  program,
  { sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 20, y: 0 } },
  { collectObservations: true },
);

const request = createLearningCompanionRequest({
  capability: "coach",
  mission: {
    id: "first-mission.reach-goal",
    version: 1,
    concepts: ["sequence", "events"],
    learningObjective: "move toward the goal",
  },
  program,
  selectedNodeIds: ["scripts[0]/statements[0]"],
  runtime: {
    outcome: result.outcome,
    stepsUsed: result.stepsUsed,
    finalWorld: result.world,
    observations: result.observations,
  },
  runtimeFacts: [
    {
      id: "runtime-observation-0",
      observationIndex: 0,
      nodeId: "scripts[0]/statements[0]",
      fact: "The runtime observed the move statement.",
    },
  ],
  scaffoldHistory: [],
});

function mustSync(
  result: ProviderRuntimeResult | Promise<ProviderRuntimeResult>,
): ProviderRuntimeResult {
  if (typeof (result as { then?: unknown }).then === "function") {
    throw new Error("expected synchronous fake runtime result");
  }
  return result as ProviderRuntimeResult;
}

const localRuntime = createFakeProviderRuntime({
  runtimeId: "fake-local",
  providerId: "fake-local-provider",
  modelId: "tiny-local-model",
  locality: "local",
  capabilities: ["coach", "debugger", "reflector"],
  contextLimits: { maxInputTokens: 2_048, maxOutputTokens: 512 },
});

const remoteRuntime = createFakeProviderRuntime({
  runtimeId: "fake-remote",
  providerId: "fake-remote-provider",
  modelId: "remote-json-model",
  locality: "remote",
  capabilities: ["coach", "builder", "explainer", "challenger"],
  features: { streaming: true },
  contextLimits: { maxInputTokens: 8_192, maxOutputTokens: 1_024 },
});

describe("provider-runtime package", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/provider-runtime");
  });

  it("keeps provider-neutral contracts free of vendor SDK dependencies", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const dependencyNames = Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    });

    expect(dependencyNames).not.toEqual(
      expect.arrayContaining(["openai", "@anthropic-ai/sdk", "ollama"]),
    );
  });
});

describe("provider capability negotiation", () => {
  it("runs two fake adapters with different capability sets through the same interface", () => {
    const runtimes: readonly LearningCompanionProviderRuntime[] = [localRuntime, remoteRuntime];

    for (const runtime of runtimes) {
      const response = mustSync(runtime.request(request));
      expect(response.ok).toBe(true);
      expect(response.diagnostics.runtimeId).toBe(runtime.descriptor.runtimeId);
      expect(response.diagnostics.providerId).toBe(runtime.descriptor.providerId);
    }

    expect(localRuntime.descriptor.locality).toBe("local");
    expect(remoteRuntime.descriptor.locality).toBe("remote");
    expect(localRuntime.negotiate("debugger").supported).toBe(true);
    expect(remoteRuntime.negotiate("debugger").supported).toBe(false);
  });

  it("makes capability mismatch explicit", () => {
    const builderRequest = createLearningCompanionRequest({ ...request, capability: "builder" });

    const negotiation = localRuntime.negotiate("builder");
    const response = mustSync(localRuntime.request(builderRequest));

    expect(negotiation).toEqual({
      supported: false,
      capability: "builder",
      missingReason: "capability-not-advertised",
    });
    expect(response.ok).toBe(false);
    if (response.ok) {
      throw new Error("expected capability mismatch failure");
    }
    expect(response.error).toMatchObject({
      code: "unsupported-capability",
      capability: "builder",
      retryable: false,
    });
  });

  it("reports structured-output mismatch separately from missing capability", () => {
    const textOnlyRuntime = createFakeProviderRuntime({
      runtimeId: "fake-text-only",
      providerId: "fake-local-provider",
      modelId: "text-only-model",
      locality: "local",
      capabilities: ["coach"],
      features: { structuredJson: false },
    });

    expect(negotiateCapability(textOnlyRuntime.descriptor, "coach")).toMatchObject({
      supported: false,
      capability: "coach",
      missingReason: "structured-output-unavailable",
    });
  });

  it("normalizes timeout, cancellation and provider errors", () => {
    const timedOut = mustSync(
      createFakeProviderRuntime({
        runtimeId: "fake-timeout",
        providerId: "fake-local-provider",
        modelId: "timeout-model",
        locality: "local",
        capabilities: ["coach"],
        failureMode: "timeout",
      }).request(request),
    );
    const cancelled = mustSync(
      createFakeProviderRuntime({
        runtimeId: "fake-cancelled",
        providerId: "fake-local-provider",
        modelId: "cancelled-model",
        locality: "local",
        capabilities: ["coach"],
      }).request(request, { cancelled: true }),
    );
    const providerFailure = mustSync(
      createFakeProviderRuntime({
        runtimeId: "fake-failure",
        providerId: "fake-local-provider",
        modelId: "failure-model",
        locality: "local",
        capabilities: ["coach"],
        failureMode: "provider-error",
      }).request(request),
    );

    for (const item of [timedOut, cancelled, providerFailure]) {
      expect(item.ok).toBe(false);
    }
    expect(timedOut.ok ? undefined : timedOut.error.code).toBe("timeout");
    expect(cancelled.ok ? undefined : cancelled.error.code).toBe("cancelled");
    expect(providerFailure.ok ? undefined : providerFailure.error.code).toBe("provider-error");
    expect(
      normalizeProviderRuntimeError(new Error("boom"), localRuntime.descriptor, "coach"),
    ).toMatchObject({
      code: "provider-error",
      providerId: "fake-local-provider",
      modelId: "tiny-local-model",
    });
  });

  it("changes provider and model through configuration", () => {
    const local = createProviderModelConfig({
      runtimeId: "local-runtime",
      providerId: "local-provider",
      modelId: "local-model",
      timeoutMs: 2_000,
    });
    const remote = createProviderModelConfig({
      runtimeId: "remote-runtime",
      providerId: "remote-provider",
      modelId: "remote-model",
      timeoutMs: 8_000,
    });

    expect(local.providerId).not.toBe(remote.providerId);
    expect(local.modelId).not.toBe(remote.modelId);
    expect(request.schema).toBe("agorix/learning-companion-request/v1");
  });

  it("provides a synchronous conformance harness for deterministic adapters", () => {
    expect(assertProviderRuntimeConformance(localRuntime, request).ok).toBe(true);
    expect(() =>
      assertProviderRuntimeConformance(
        localRuntime,
        createLearningCompanionRequest({ ...request, capability: "builder" }),
      ),
    ).not.toThrow();
  });

  it("rejects invalid config early", () => {
    expect(() =>
      createProviderModelConfig({ runtimeId: "", providerId: "local", modelId: "model" }),
    ).toThrow(ProviderRuntimeContractError);
  });
});

describe("ollama provider runtime", () => {
  function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
    return new Response(JSON.stringify(body), { status });
  }

  it("uses configured endpoint and model without credentials", async () => {
    const calls: Array<{ readonly input: string; readonly init: RequestInit | undefined }> = [];
    const responseBody = {
      response: JSON.stringify({
        schema: "agorix/learning-companion-response/v1",
        capability: "coach",
        message: "What evidence did the runtime show?",
        nodeIds: ["scripts[0]/statements[0]"],
        concepts: ["sequence"],
        metadata: {
          capability: "coach",
          scaffoldLevel: 1,
          provenance: "local-provider",
          uncertainty: "medium",
        },
        payload: {
          kind: "question",
          question: "What evidence did the runtime show?",
        },
      }),
      done: true,
    };
    const runtime = createOllamaProviderRuntime({
      endpoint: "http://localhost:11434/",
      modelId: "qwen2.5-coder:7b",
      capabilities: ["coach", "explainer"],
      fetch: async (input, init) => {
        calls.push({ input: String(input), init });
        return jsonResponse(responseBody);
      },
    });

    const result = await runtime.request(request, { timeoutMs: 2_000 });

    expect(runtime.descriptor).toMatchObject({
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      locality: "local",
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe("http://localhost:11434/api/generate");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      model: "qwen2.5-coder:7b",
      stream: false,
      format: "json",
    });
  });

  it("reports health without requiring Ollama in deterministic tests", async () => {
    const available = createOllamaProviderRuntime({
      endpoint: "http://127.0.0.1:11434",
      modelId: "local-model",
      capabilities: ["coach"],
      fetch: async () => jsonResponse({ models: [] }),
    });
    const unavailable = createOllamaProviderRuntime({
      endpoint: "http://127.0.0.1:11434",
      modelId: "local-model",
      capabilities: ["coach"],
      fetch: async () => {
        throw new Error("connection refused");
      },
    });

    expect(await available.health()).toMatchObject({ status: "available" });
    expect(await unavailable.health()).toMatchObject({ status: "unavailable" });
  });

  it("fails explicitly when configured structured output is unavailable", async () => {
    const runtime = createOllamaProviderRuntime({
      endpoint: "http://localhost:11434",
      modelId: "text-only-local-model",
      capabilities: ["coach"],
      structuredOutput: false,
      fetch: async () => jsonResponse({ response: "{}" }),
    });

    expect(runtime.negotiate("coach")).toMatchObject({
      supported: false,
      missingReason: "structured-output-unavailable",
    });
    const result = await runtime.request(request);

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("unsupported-capability");
  });

  it("isolates unavailable daemon and malformed output as provider failures", async () => {
    const unavailable = createOllamaProviderRuntime({
      endpoint: "http://localhost:11434",
      modelId: "missing-model",
      capabilities: ["coach"],
      fetch: async () => jsonResponse({ error: "model missing" }, false, 500),
    });
    const malformed = createOllamaProviderRuntime({
      endpoint: "http://localhost:11434",
      modelId: "bad-json-model",
      capabilities: ["coach"],
      fetch: async () => jsonResponse({ response: "not json", done: true }),
    });

    const outage = await unavailable.request(request);
    const invalid = await malformed.request(request);

    expect(outage.ok).toBe(false);
    expect(outage.ok ? undefined : outage.error.code).toBe("provider-unavailable");
    expect(invalid.ok).toBe(false);
    expect(invalid.ok ? undefined : invalid.error.code).toBe("invalid-response");
  });

  it("normalizes request timeout before contacting the daemon", async () => {
    let called = false;
    const runtime = createOllamaProviderRuntime({
      endpoint: "http://localhost:11434",
      modelId: "slow-local-model",
      capabilities: ["coach"],
      fetch: async () => {
        called = true;
        return jsonResponse({ response: "{}" });
      },
    });

    const timedOut = await runtime.request(request, { timeoutMs: 0 });

    expect(called).toBe(false);
    expect(timedOut.ok).toBe(false);
    expect(timedOut.ok ? undefined : timedOut.error.code).toBe("timeout");
  });

  it("normalizes cancellation and unsupported capabilities", async () => {
    const runtime = createOllamaProviderRuntime({
      endpoint: "http://localhost:11434",
      modelId: "coach-only-model",
      capabilities: ["coach"],
      fetch: async () => jsonResponse({ response: "{}" }),
    });

    const cancelled = await runtime.request(request, { cancelled: true });
    const builder = await runtime.request(
      createLearningCompanionRequest({ ...request, capability: "builder" }),
    );

    expect(cancelled.ok).toBe(false);
    expect(cancelled.ok ? undefined : cancelled.error.code).toBe("cancelled");
    expect(builder.ok).toBe(false);
    expect(builder.ok ? undefined : builder.error.code).toBe("unsupported-capability");
  });
});
