import {
  createDeterministicLearningCompanionResponse,
  validateLearningCompanionRequest,
  validateLearningCompanionSafety,
  type LearningCompanionCapability,
  type LearningCompanionRequest,
  type LearningCompanionResponse,
} from "@agorix/tutor-contract";

export const PACKAGE_NAME = "@agorix/provider-runtime";

export type ProviderRuntimeLocality = "local" | "remote";
export type ProviderRuntimeHealthStatus = "available" | "degraded" | "unavailable";
export type ProviderRuntimeErrorCode =
  | "unsupported-capability"
  | "timeout"
  | "cancelled"
  | "not-configured"
  | "authentication-failed"
  | "provider-unavailable"
  | "provider-error"
  | "invalid-response";

export interface ProviderModelConfig {
  readonly providerId: string;
  readonly modelId: string;
  readonly runtimeId?: string;
  readonly timeoutMs?: number;
}

export interface ProviderRuntimeFeatureSet {
  readonly structuredJson: boolean;
  readonly toolCalling: boolean;
  readonly streaming: boolean;
}

export interface ProviderRuntimeContextLimits {
  readonly maxInputTokens?: number;
  readonly maxOutputTokens?: number;
}

export interface ProviderCapabilityDescriptor {
  readonly capability: LearningCompanionCapability;
  readonly structuredOutput: boolean;
  readonly streaming: boolean;
  readonly toolCalling: boolean;
  readonly maxInputTokens?: number;
  readonly maxOutputTokens?: number;
}

export interface ProviderRuntimeDescriptor {
  readonly runtimeId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly locality: ProviderRuntimeLocality;
  readonly features: ProviderRuntimeFeatureSet;
  readonly contextLimits: ProviderRuntimeContextLimits;
  readonly capabilities: readonly ProviderCapabilityDescriptor[];
}

export interface ProviderRuntimeHealth {
  readonly status: ProviderRuntimeHealthStatus;
  readonly checkedAt: string;
  readonly message?: string;
}

export interface CapabilityNegotiationResult {
  readonly supported: boolean;
  readonly capability: LearningCompanionCapability;
  readonly descriptor?: ProviderCapabilityDescriptor;
  readonly missingReason?: "capability-not-advertised" | "structured-output-unavailable";
}

export interface ProviderRuntimeError {
  readonly code: ProviderRuntimeErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly capability?: LearningCompanionCapability;
  readonly providerId?: string;
  readonly modelId?: string;
}

export interface ProviderRuntimeDiagnostics {
  readonly runtimeId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly locality: ProviderRuntimeLocality;
  readonly capability: LearningCompanionCapability;
}

export interface ProviderRuntimeSuccess {
  readonly ok: true;
  readonly response: LearningCompanionResponse;
  readonly diagnostics: ProviderRuntimeDiagnostics;
}

export interface ProviderRuntimeFailure {
  readonly ok: false;
  readonly error: ProviderRuntimeError;
  readonly diagnostics: ProviderRuntimeDiagnostics;
}

export type ProviderRuntimeResult = ProviderRuntimeSuccess | ProviderRuntimeFailure;

export interface ProviderRuntimeRequestOptions {
  readonly timeoutMs?: number;
  readonly cancelled?: boolean;
}

export interface LearningCompanionProviderRuntime {
  readonly descriptor: ProviderRuntimeDescriptor;
  health(): Promise<ProviderRuntimeHealth> | ProviderRuntimeHealth;
  negotiate(capability: LearningCompanionCapability): CapabilityNegotiationResult;
  request(
    request: LearningCompanionRequest,
    options?: ProviderRuntimeRequestOptions,
  ): Promise<ProviderRuntimeResult> | ProviderRuntimeResult;
}

export interface FakeProviderRuntimeConfig {
  readonly runtimeId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly locality: ProviderRuntimeLocality;
  readonly capabilities: readonly LearningCompanionCapability[];
  readonly features?: Partial<ProviderRuntimeFeatureSet>;
  readonly contextLimits?: ProviderRuntimeContextLimits;
  readonly health?: ProviderRuntimeHealthStatus;
  readonly failureMode?: "timeout" | "cancelled" | "provider-error" | "invalid-response";
}

export type ProviderRuntimeFetch = typeof fetch;

export interface OllamaProviderRuntimeConfig {
  readonly endpoint: string;
  readonly modelId: string;
  readonly runtimeId?: string;
  readonly capabilities: readonly LearningCompanionCapability[];
  readonly structuredOutput?: boolean;
  readonly contextLimits?: ProviderRuntimeContextLimits;
  readonly timeoutMs?: number;
  readonly fetch?: ProviderRuntimeFetch;
}

interface OllamaGenerateResponse {
  readonly response?: unknown;
  readonly done?: unknown;
  readonly error?: unknown;
}

export interface OpenAICompatibleProviderRuntimeConfig {
  readonly baseUrl: string;
  readonly modelId: string;
  readonly runtimeId?: string;
  readonly capabilities: readonly LearningCompanionCapability[];
  readonly structuredOutput?: boolean;
  readonly contextLimits?: ProviderRuntimeContextLimits;
  readonly timeoutMs?: number;
  readonly authToken?: string;
  readonly authHeaderName?: string;
  readonly fetch?: ProviderRuntimeFetch;
}

interface OpenAICompatibleChatResponse {
  readonly choices?: readonly {
    readonly message?: { readonly content?: unknown };
  }[];
  readonly error?: { readonly message?: unknown; readonly code?: unknown } | string;
}

const DEFAULT_FEATURES: ProviderRuntimeFeatureSet = {
  structuredJson: true,
  toolCalling: false,
  streaming: false,
};

export function createProviderModelConfig(
  input: ProviderModelConfig & { readonly runtimeId: string },
): ProviderModelConfig & { readonly runtimeId: string } {
  assertBoundedString(input.providerId, "providerId", 1, 80);
  assertBoundedString(input.modelId, "modelId", 1, 120);
  assertBoundedString(input.runtimeId, "runtimeId", 1, 120);
  if (
    input.timeoutMs !== undefined &&
    (!Number.isInteger(input.timeoutMs) || input.timeoutMs <= 0)
  ) {
    throw new ProviderRuntimeContractError("timeoutMs", "expected positive integer timeout");
  }
  return input;
}

export class ProviderRuntimeContractError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ProviderRuntimeContractError";
    this.path = path;
  }
}

export function createFakeProviderRuntime(
  config: FakeProviderRuntimeConfig,
): LearningCompanionProviderRuntime {
  const descriptor = createDescriptor(config);
  return {
    descriptor,
    health() {
      return {
        status: config.health ?? "available",
        checkedAt: "1970-01-01T00:00:00.000Z",
      };
    },
    negotiate(capability) {
      return negotiateCapability(descriptor, capability);
    },
    request(request, options = {}) {
      const validated = validateLearningCompanionRequest(request);
      const diagnostics = diagnosticsFor(descriptor, validated.capability);
      if (options.cancelled === true || config.failureMode === "cancelled") {
        return failure(
          diagnostics,
          normalizedError("cancelled", "Provider request was cancelled."),
        );
      }
      if (config.failureMode === "timeout" || isTimeout(options.timeoutMs)) {
        return failure(diagnostics, normalizedError("timeout", "Provider request timed out."));
      }
      if (config.failureMode === "provider-error") {
        return failure(
          diagnostics,
          normalizedError("provider-error", "Provider returned an error."),
        );
      }
      const negotiation = negotiateCapability(descriptor, validated.capability);
      if (!negotiation.supported) {
        return failure(
          diagnostics,
          normalizedError(
            "unsupported-capability",
            `Capability ${validated.capability} is not supported by ${descriptor.runtimeId}.`,
            validated.capability,
          ),
        );
      }
      const response = createDeterministicLearningCompanionResponse(validated);
      if (config.failureMode === "invalid-response") {
        return failure(
          diagnostics,
          normalizedError("invalid-response", "Provider response failed validation."),
        );
      }
      return {
        ok: true,
        response: validateLearningCompanionSafety(validated, response),
        diagnostics,
      };
    },
  };
}

export function createOllamaProviderRuntime(
  config: OllamaProviderRuntimeConfig,
): LearningCompanionProviderRuntime {
  const descriptor = createOllamaDescriptor(config);
  const fetchImpl = config.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new ProviderRuntimeContractError("fetch", "expected fetch implementation");
  }
  return {
    descriptor,
    async health() {
      try {
        const response = await fetchImpl(ollamaUrl(config.endpoint, "/api/tags"), {
          method: "GET",
        });
        return {
          status: response.ok ? "available" : "unavailable",
          checkedAt: new Date(0).toISOString(),
          ...(response.ok
            ? {}
            : { message: `Ollama health check returned HTTP ${response.status}.` }),
        };
      } catch {
        return {
          status: "unavailable",
          checkedAt: new Date(0).toISOString(),
          message: "Ollama daemon is unavailable.",
        };
      }
    },
    negotiate(capability) {
      return negotiateCapability(descriptor, capability);
    },
    async request(request, options = {}) {
      const validated = validateLearningCompanionRequest(request);
      const diagnostics = diagnosticsFor(descriptor, validated.capability);
      if (options.cancelled === true) {
        return failure(
          diagnostics,
          normalizedError(
            "cancelled",
            "Provider request was cancelled.",
            validated.capability,
            descriptor,
          ),
        );
      }
      const negotiation = negotiateCapability(descriptor, validated.capability);
      if (!negotiation.supported) {
        return failure(
          diagnostics,
          normalizedError(
            "unsupported-capability",
            negotiation.missingReason === "structured-output-unavailable"
              ? `Capability ${validated.capability} requires structured output that ${descriptor.modelId} does not advertise.`
              : `Capability ${validated.capability} is not supported by ${descriptor.runtimeId}.`,
            validated.capability,
            descriptor,
          ),
        );
      }
      const timeoutMs = options.timeoutMs ?? config.timeoutMs;
      if (isTimeout(timeoutMs)) {
        return failure(
          diagnostics,
          normalizedError(
            "timeout",
            "Provider request timed out.",
            validated.capability,
            descriptor,
          ),
        );
      }
      let didTimeout = false;
      const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
      const timeoutHandle =
        timeoutMs === undefined || controller === undefined
          ? undefined
          : setTimeout(() => {
              didTimeout = true;
              controller.abort();
            }, timeoutMs);
      try {
        const response = await fetchImpl(ollamaUrl(config.endpoint, "/api/generate"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: config.modelId,
            stream: false,
            format: "json",
            prompt: createOllamaPrompt(validated),
          }),
          ...(controller === undefined ? {} : { signal: controller.signal }),
        });
        if (!response.ok) {
          return failure(
            diagnostics,
            normalizedError(
              response.status === 404 || response.status >= 500
                ? "provider-unavailable"
                : "provider-error",
              `Ollama returned HTTP ${response.status}.`,
              validated.capability,
              descriptor,
            ),
          );
        }
        const payload = (await response.json()) as OllamaGenerateResponse;
        if (typeof payload.error === "string" && payload.error.length > 0) {
          return failure(
            diagnostics,
            normalizedError("provider-error", payload.error, validated.capability, descriptor),
          );
        }
        try {
          const providerOutput = parseOllamaProviderOutput(payload.response);
          return {
            ok: true,
            response: validateLearningCompanionSafety(
              validated,
              providerOutput as LearningCompanionResponse,
            ),
            diagnostics,
          };
        } catch {
          return failure(
            diagnostics,
            normalizedError(
              "invalid-response",
              "Provider response failed validation.",
              validated.capability,
              descriptor,
            ),
          );
        }
      } catch (error) {
        const code = didTimeout ? "timeout" : isAbortError(error) ? "cancelled" : undefined;
        return failure(
          diagnostics,
          code === undefined
            ? normalizeProviderRuntimeError(error, descriptor, validated.capability)
            : normalizedError(
                code,
                code === "timeout"
                  ? "Provider request timed out."
                  : "Provider request was cancelled.",
                validated.capability,
                descriptor,
              ),
        );
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
      }
    },
  };
}

export function createOpenAICompatibleProviderRuntime(
  config: OpenAICompatibleProviderRuntimeConfig,
): LearningCompanionProviderRuntime {
  const descriptor = createOpenAICompatibleDescriptor(config);
  const fetchImpl = config.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new ProviderRuntimeContractError("fetch", "expected fetch implementation");
  }
  return {
    descriptor,
    async health() {
      try {
        const response = await fetchImpl(openAICompatibleUrl(config.baseUrl, "/models"), {
          method: "GET",
          headers: openAICompatibleHeaders(config),
        });
        return {
          status: response.ok ? "available" : "unavailable",
          checkedAt: new Date(0).toISOString(),
          ...(response.ok
            ? {}
            : {
                message: `OpenAI-compatible gateway health check returned HTTP ${response.status}.`,
              }),
        };
      } catch {
        return {
          status: "unavailable",
          checkedAt: new Date(0).toISOString(),
          message: "OpenAI-compatible gateway is unavailable.",
        };
      }
    },
    negotiate(capability) {
      return negotiateCapability(descriptor, capability);
    },
    async request(request, options = {}) {
      const validated = validateLearningCompanionRequest(request);
      const diagnostics = diagnosticsFor(descriptor, validated.capability);
      if (options.cancelled === true) {
        return failure(
          diagnostics,
          normalizedError(
            "cancelled",
            "Provider request was cancelled.",
            validated.capability,
            descriptor,
          ),
        );
      }
      const negotiation = negotiateCapability(descriptor, validated.capability);
      if (!negotiation.supported) {
        return failure(
          diagnostics,
          normalizedError(
            "unsupported-capability",
            negotiation.missingReason === "structured-output-unavailable"
              ? `Capability ${validated.capability} requires structured output that ${descriptor.modelId} does not advertise.`
              : `Capability ${validated.capability} is not supported by ${descriptor.runtimeId}.`,
            validated.capability,
            descriptor,
          ),
        );
      }
      const timeoutMs = options.timeoutMs ?? config.timeoutMs;
      if (isTimeout(timeoutMs)) {
        return failure(
          diagnostics,
          normalizedError(
            "timeout",
            "Provider request timed out.",
            validated.capability,
            descriptor,
          ),
        );
      }
      let didTimeout = false;
      const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
      const timeoutHandle =
        timeoutMs === undefined || controller === undefined
          ? undefined
          : setTimeout(() => {
              didTimeout = true;
              controller.abort();
            }, timeoutMs);
      try {
        const response = await fetchImpl(openAICompatibleUrl(config.baseUrl, "/chat/completions"), {
          method: "POST",
          headers: openAICompatibleHeaders(config),
          body: JSON.stringify({
            model: config.modelId,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "Return only one JSON object matching agorix/learning-companion-response/v1.",
              },
              { role: "user", content: createGatewayPrompt(validated) },
            ],
          }),
          ...(controller === undefined ? {} : { signal: controller.signal }),
        });
        if (!response.ok) {
          return failure(
            diagnostics,
            normalizedError(
              response.status === 401 || response.status === 403
                ? "authentication-failed"
                : response.status === 404 || response.status >= 500
                  ? "provider-unavailable"
                  : "provider-error",
              `OpenAI-compatible gateway returned HTTP ${response.status}.`,
              validated.capability,
              descriptor,
            ),
          );
        }
        const payload = (await response.json()) as OpenAICompatibleChatResponse;
        const providerError = openAICompatibleErrorMessage(payload.error);
        if (providerError !== undefined) {
          return failure(
            diagnostics,
            normalizedError("provider-error", providerError, validated.capability, descriptor),
          );
        }
        try {
          const content = payload.choices?.[0]?.message?.content;
          const providerOutput = parseProviderJsonContent(content);
          return {
            ok: true,
            response: validateLearningCompanionSafety(
              validated,
              providerOutput as LearningCompanionResponse,
            ),
            diagnostics,
          };
        } catch {
          return failure(
            diagnostics,
            normalizedError(
              "invalid-response",
              "Provider response failed validation.",
              validated.capability,
              descriptor,
            ),
          );
        }
      } catch (error) {
        const code = didTimeout ? "timeout" : isAbortError(error) ? "cancelled" : undefined;
        return failure(
          diagnostics,
          code === undefined
            ? normalizeProviderRuntimeError(error, descriptor, validated.capability)
            : normalizedError(
                code,
                code === "timeout"
                  ? "Provider request timed out."
                  : "Provider request was cancelled.",
                validated.capability,
                descriptor,
              ),
        );
      } finally {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      }
    },
  };
}

export function negotiateCapability(
  descriptor: ProviderRuntimeDescriptor,
  capability: LearningCompanionCapability,
): CapabilityNegotiationResult {
  const match = descriptor.capabilities.find((item) => item.capability === capability);
  if (match === undefined) {
    return { supported: false, capability, missingReason: "capability-not-advertised" };
  }
  if (!match.structuredOutput || !descriptor.features.structuredJson) {
    return {
      supported: false,
      capability,
      descriptor: match,
      missingReason: "structured-output-unavailable",
    };
  }
  return { supported: true, capability, descriptor: match };
}

export function normalizeProviderRuntimeError(
  error: unknown,
  descriptor: ProviderRuntimeDescriptor,
  capability: LearningCompanionCapability,
): ProviderRuntimeError {
  if (isProviderRuntimeError(error)) {
    return error;
  }
  if (error instanceof ProviderRuntimeContractError) {
    return normalizedError("invalid-response", error.message, capability, descriptor);
  }
  if (error instanceof Error && error.name === "AbortError") {
    return normalizedError("cancelled", "Provider request was cancelled.", capability, descriptor);
  }
  return normalizedError("provider-error", "Provider request failed.", capability, descriptor);
}

export function assertProviderRuntimeConformance(
  runtime: LearningCompanionProviderRuntime,
  request: LearningCompanionRequest,
): ProviderRuntimeResult {
  const validated = validateLearningCompanionRequest(request);
  const negotiation = runtime.negotiate(validated.capability);
  const result = runtime.request(validated);
  if (isPromiseLike(result)) {
    throw new ProviderRuntimeContractError(
      "runtime.request",
      "async runtimes need async conformance harness",
    );
  }
  if (negotiation.supported && !result.ok) {
    throw new ProviderRuntimeContractError(
      "runtime.request",
      "supported capability returned failure",
    );
  }
  if (!negotiation.supported && result.ok) {
    throw new ProviderRuntimeContractError(
      "runtime.request",
      "unsupported capability returned success",
    );
  }
  return result;
}

function createOpenAICompatibleDescriptor(
  config: OpenAICompatibleProviderRuntimeConfig,
): ProviderRuntimeDescriptor {
  assertBoundedString(config.baseUrl, "baseUrl", 1, 300);
  assertBoundedString(config.modelId, "modelId", 1, 120);
  if (config.runtimeId !== undefined) assertBoundedString(config.runtimeId, "runtimeId", 1, 120);
  if (config.authToken !== undefined) assertBoundedString(config.authToken, "authToken", 1, 1_000);
  if (config.authHeaderName !== undefined) {
    assertBoundedString(config.authHeaderName, "authHeaderName", 1, 120);
  }
  if (
    config.timeoutMs !== undefined &&
    (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0)
  ) {
    throw new ProviderRuntimeContractError("timeoutMs", "expected positive integer timeout");
  }
  if (config.capabilities.length === 0) {
    throw new ProviderRuntimeContractError("capabilities", "expected at least one capability");
  }
  const features: ProviderRuntimeFeatureSet = {
    structuredJson: config.structuredOutput ?? true,
    toolCalling: false,
    streaming: false,
  };
  return {
    runtimeId: config.runtimeId ?? `openai-compatible:${config.modelId}`,
    providerId: "openai-compatible",
    modelId: config.modelId,
    locality: config.authToken === undefined ? "local" : "remote",
    features,
    contextLimits: config.contextLimits ?? {},
    capabilities: config.capabilities.map((capability) => ({
      capability,
      structuredOutput: features.structuredJson,
      streaming: false,
      toolCalling: false,
      ...(config.contextLimits?.maxInputTokens === undefined
        ? {}
        : { maxInputTokens: config.contextLimits.maxInputTokens }),
      ...(config.contextLimits?.maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens: config.contextLimits.maxOutputTokens }),
    })),
  };
}

function createOllamaDescriptor(config: OllamaProviderRuntimeConfig): ProviderRuntimeDescriptor {
  assertBoundedString(config.endpoint, "endpoint", 1, 300);
  assertBoundedString(config.modelId, "modelId", 1, 120);
  if (config.runtimeId !== undefined) {
    assertBoundedString(config.runtimeId, "runtimeId", 1, 120);
  }
  if (
    config.timeoutMs !== undefined &&
    (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0)
  ) {
    throw new ProviderRuntimeContractError("timeoutMs", "expected positive integer timeout");
  }
  if (config.capabilities.length === 0) {
    throw new ProviderRuntimeContractError("capabilities", "expected at least one capability");
  }
  const features: ProviderRuntimeFeatureSet = {
    structuredJson: config.structuredOutput ?? true,
    toolCalling: false,
    streaming: false,
  };
  return {
    runtimeId: config.runtimeId ?? `ollama:${config.modelId}`,
    providerId: "ollama",
    modelId: config.modelId,
    locality: "local",
    features,
    contextLimits: config.contextLimits ?? {},
    capabilities: config.capabilities.map((capability) => ({
      capability,
      structuredOutput: features.structuredJson,
      streaming: false,
      toolCalling: false,
      ...(config.contextLimits?.maxInputTokens === undefined
        ? {}
        : { maxInputTokens: config.contextLimits.maxInputTokens }),
      ...(config.contextLimits?.maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens: config.contextLimits.maxOutputTokens }),
    })),
  };
}

function createDescriptor(config: FakeProviderRuntimeConfig): ProviderRuntimeDescriptor {
  assertBoundedString(config.runtimeId, "runtimeId", 1, 120);
  assertBoundedString(config.providerId, "providerId", 1, 80);
  assertBoundedString(config.modelId, "modelId", 1, 120);
  const features = { ...DEFAULT_FEATURES, ...(config.features ?? {}) };
  return {
    runtimeId: config.runtimeId,
    providerId: config.providerId,
    modelId: config.modelId,
    locality: config.locality,
    features,
    contextLimits: config.contextLimits ?? {},
    capabilities: config.capabilities.map((capability) => ({
      capability,
      structuredOutput: features.structuredJson,
      streaming: features.streaming,
      toolCalling: features.toolCalling,
      ...(config.contextLimits?.maxInputTokens === undefined
        ? {}
        : { maxInputTokens: config.contextLimits.maxInputTokens }),
      ...(config.contextLimits?.maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens: config.contextLimits.maxOutputTokens }),
    })),
  };
}

function diagnosticsFor(
  descriptor: ProviderRuntimeDescriptor,
  capability: LearningCompanionCapability,
): ProviderRuntimeDiagnostics {
  return {
    runtimeId: descriptor.runtimeId,
    providerId: descriptor.providerId,
    modelId: descriptor.modelId,
    locality: descriptor.locality,
    capability,
  };
}

function failure(
  diagnostics: ProviderRuntimeDiagnostics,
  error: ProviderRuntimeError,
): ProviderRuntimeFailure {
  return { ok: false, error, diagnostics };
}

function normalizedError(
  code: ProviderRuntimeErrorCode,
  message: string,
  capability?: LearningCompanionCapability,
  descriptor?: ProviderRuntimeDescriptor,
): ProviderRuntimeError {
  return {
    code,
    message,
    retryable: ["timeout", "provider-unavailable", "provider-error"].includes(code),
    ...(capability === undefined ? {} : { capability }),
    ...(descriptor === undefined
      ? {}
      : { providerId: descriptor.providerId, modelId: descriptor.modelId }),
  };
}

function isProviderRuntimeError(value: unknown): value is ProviderRuntimeError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    "retryable" in value
  );
}

function openAICompatibleUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${path}`;
}

function openAICompatibleHeaders(
  config: OpenAICompatibleProviderRuntimeConfig,
): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.authToken !== undefined) {
    headers[config.authHeaderName ?? "authorization"] =
      config.authHeaderName === undefined ? `Bearer ${config.authToken}` : config.authToken;
  }
  return headers;
}

function createGatewayPrompt(request: LearningCompanionRequest): string {
  return [
    "You are the Agorix Learning Companion provider adapter.",
    "Return JSON only and preserve the requested capability.",
    JSON.stringify({
      capability: request.capability,
      mission: request.mission,
      selectedNodeIds: request.selectedNodeIds,
      runtimeFacts: request.runtimeFacts,
      scaffoldHistory: request.scaffoldHistory,
      learnerIntent: request.learnerIntent,
    }),
  ].join("\n");
}

function openAICompatibleErrorMessage(
  error: OpenAICompatibleChatResponse["error"],
): string | undefined {
  if (typeof error === "string" && error.length > 0) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }
  return undefined;
}

function parseProviderJsonContent(value: unknown): unknown {
  if (typeof value !== "string")
    throw new ProviderRuntimeContractError("response.content", "expected JSON string");
  return JSON.parse(value) as unknown;
}

function ollamaUrl(endpoint: string, path: string): string {
  const base = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  return `${base}${path}`;
}

function createOllamaPrompt(request: LearningCompanionRequest): string {
  return [
    "You are the Agorix Learning Companion provider adapter.",
    "Return only one JSON object matching agorix/learning-companion-response/v1.",
    "Do not propose canonical program mutations unless the requested capability schema permits it.",
    JSON.stringify({
      capability: request.capability,
      mission: request.mission,
      selectedNodeIds: request.selectedNodeIds,
      runtimeFacts: request.runtimeFacts,
      scaffoldHistory: request.scaffoldHistory,
      learnerIntent: request.learnerIntent,
    }),
  ].join("\n");
}

function parseOllamaProviderOutput(value: unknown): unknown {
  if (typeof value === "string") {
    return JSON.parse(value) as unknown;
  }
  return value;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isTimeout(timeoutMs: number | undefined): boolean {
  return timeoutMs !== undefined && timeoutMs <= 0;
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as { then?: unknown }).then === "function";
}

function assertBoundedString(value: string, path: string, min: number, max: number): void {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    throw new ProviderRuntimeContractError(path, `expected string length ${min}-${max}`);
  }
}

export * from "./selection.js";
