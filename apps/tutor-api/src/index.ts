import {
  createDeterministicTutorResponse,
  createLearningCompanionRequestFromTutorRequest,
  createTutorResponseFromLearningCompanionResponse,
  validateTutorRequest,
  type LearningCompanionCapability,
  type LearningCompanionRequest,
  type TutorRequest,
  type TutorResponse,
} from "@agorix/tutor-contract";
import {
  createFakeProviderRuntime,
  createOpenAICompatibleProviderRuntime,
  type LearningCompanionProviderRuntime,
  type ProviderRuntimeDescriptor,
  type ProviderRuntimeErrorCode,
  type ProviderRuntimeFetch,
} from "@agorix/provider-runtime";

export const PACKAGE_NAME = "@agorix/tutor-api";

export type TutorAdapterKind = "fake" | "openai-compatible";

export interface TutorAdapterConfig {
  readonly adapter: TutorAdapterKind;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly authToken?: string;
  readonly authHeaderName?: string;
  readonly timeoutMs: number;
  readonly capabilities: readonly LearningCompanionCapability[];
  readonly includeLearnerQuestion?: boolean;
}

export interface TutorAdapterDiagnostics {
  readonly adapter: TutorAdapterKind;
  readonly runtimeId: string;
  readonly providerId: string;
  readonly model: string;
  readonly source: "runtime" | "fallback";
  readonly errorCode?: ProviderRuntimeErrorCode;
}

export interface TutorAdapterResult {
  readonly response: TutorResponse;
  readonly diagnostics: TutorAdapterDiagnostics;
}

export interface TutorAdapterDependencies {
  readonly fetch?: ProviderRuntimeFetch;
}

const DEFAULT_TIMEOUT_MS = 4_000;
const FAKE_RUNTIME_ID = "tutor-api:fake";
const FAKE_PROVIDER_ID = "fake";
const DETERMINISTIC_MODEL_ID = "deterministic";
const UNCONFIGURED_MODEL_ID = "unconfigured";
const OPENAI_COMPATIBLE_PROVIDER_ID = "openai-compatible";
const CHAT_COMPLETIONS_SUFFIX = "/chat/completions";
const DEFAULT_CAPABILITIES: readonly LearningCompanionCapability[] = ["coach"];
const TUTOR_CAPABILITY = "coach" as const satisfies LearningCompanionCapability;
const DETERMINISTIC_CAPABILITIES: readonly LearningCompanionCapability[] = [TUTOR_CAPABILITY];
const KNOWN_CAPABILITIES = [
  "coach",
  "builder",
  "debugger",
  "explainer",
  "challenger",
  "reflector",
] as const satisfies readonly LearningCompanionCapability[];

type MutableLearningCompanionRequest = {
  -readonly [Key in keyof LearningCompanionRequest]: LearningCompanionRequest[Key];
};

export class TutorAdapterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TutorAdapterConfigurationError";
  }
}

export function describeTutorApi(): string {
  return `tutor-api — server-side provider adapter for ${PACKAGE_NAME}`;
}

export function configFromEnv(env: Record<string, string | undefined>): TutorAdapterConfig {
  const baseUrl = normalizeBaseUrl(env.AGORIX_TUTOR_BASE_URL ?? env.AGORIX_TUTOR_ENDPOINT);
  const model = bounded(env.AGORIX_TUTOR_MODEL);
  const authToken = bounded(env.AGORIX_TUTOR_AUTH_TOKEN ?? env.AGORIX_TUTOR_API_KEY);
  const authHeaderName = bounded(env.AGORIX_TUTOR_AUTH_HEADER);
  return {
    adapter: readAdapter(env),
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(model === undefined ? {} : { model }),
    ...(authToken === undefined ? {} : { authToken }),
    ...(authHeaderName === undefined ? {} : { authHeaderName }),
    timeoutMs: parseTimeout(env.AGORIX_TUTOR_TIMEOUT_MS),
    capabilities: parseCapabilities(env.AGORIX_TUTOR_CAPABILITIES),
    includeLearnerQuestion: env.AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION === "1",
  };
}

export function isTutorAdapterConfigured(config: TutorAdapterConfig): boolean {
  if (config.adapter === "fake") {
    return true;
  }
  return bounded(config.baseUrl) !== undefined && bounded(config.model) !== undefined;
}

export function createTutorAdapterRuntime(
  config: TutorAdapterConfig,
  dependencies: TutorAdapterDependencies = {},
): LearningCompanionProviderRuntime {
  if (config.capabilities.length === 0) {
    throw new TutorAdapterConfigurationError("capabilities: expected at least one capability");
  }
  if (config.adapter === "fake") {
    return createFakeProviderRuntime({
      runtimeId: FAKE_RUNTIME_ID,
      providerId: FAKE_PROVIDER_ID,
      modelId: bounded(config.model) ?? DETERMINISTIC_MODEL_ID,
      locality: "local",
      capabilities: config.capabilities,
    });
  }
  const baseUrl = bounded(config.baseUrl);
  const modelId = bounded(config.model);
  if (baseUrl === undefined || modelId === undefined) {
    throw new TutorAdapterConfigurationError(
      "baseUrl and model are required for the openai-compatible adapter",
    );
  }
  const authToken = bounded(config.authToken);
  return createOpenAICompatibleProviderRuntime({
    baseUrl,
    modelId,
    capabilities: config.capabilities,
    timeoutMs: config.timeoutMs,
    ...(authToken === undefined ? {} : { authToken }),
    ...(bounded(config.authHeaderName) === undefined
      ? {}
      : { authHeaderName: bounded(config.authHeaderName) as string }),
    ...(dependencies.fetch === undefined ? {} : { fetch: dependencies.fetch }),
  });
}

export async function requestTutorResponse(
  request: TutorRequest,
  config: TutorAdapterConfig,
  dependencies: TutorAdapterDependencies = {},
): Promise<TutorAdapterResult> {
  const validated = validateTutorRequest(request);
  if (!isTutorAdapterConfigured(config)) {
    return fallback(validated, config, "not-configured");
  }
  const runtime = createTutorAdapterRuntime(config, dependencies);
  const result = await runtime.request(toCompanionRequest(validated, config), {
    timeoutMs: config.timeoutMs,
  });
  if (!result.ok) {
    return fallback(validated, config, result.error.code);
  }
  return {
    response: createTutorResponseFromLearningCompanionResponse(result.response),
    diagnostics: { ...identityOf(runtime.descriptor, config), source: "runtime" },
  };
}

function toCompanionRequest(
  request: TutorRequest,
  config: TutorAdapterConfig,
): LearningCompanionRequest {
  const companion = createLearningCompanionRequestFromTutorRequest(request);
  if (config.includeLearnerQuestion === true || companion.learnerIntent === undefined) {
    return companion;
  }
  const projected: MutableLearningCompanionRequest = { ...companion };
  delete projected.learnerIntent;
  return projected;
}

async function fallback(
  request: TutorRequest,
  config: TutorAdapterConfig,
  errorCode: ProviderRuntimeErrorCode,
): Promise<TutorAdapterResult> {
  const model = bounded(config.model);
  return {
    response: await deterministicTutorResponse(request),
    diagnostics: {
      adapter: config.adapter,
      runtimeId:
        config.adapter === "fake"
          ? FAKE_RUNTIME_ID
          : `${OPENAI_COMPATIBLE_PROVIDER_ID}:${model ?? UNCONFIGURED_MODEL_ID}`,
      providerId: config.adapter === "fake" ? FAKE_PROVIDER_ID : OPENAI_COMPATIBLE_PROVIDER_ID,
      model: model ?? (config.adapter === "fake" ? DETERMINISTIC_MODEL_ID : UNCONFIGURED_MODEL_ID),
      source: "fallback",
      errorCode,
    },
  };
}

async function deterministicTutorResponse(request: TutorRequest): Promise<TutorResponse> {
  const runtime = createFakeProviderRuntime({
    runtimeId: FAKE_RUNTIME_ID,
    providerId: FAKE_PROVIDER_ID,
    modelId: DETERMINISTIC_MODEL_ID,
    locality: "local",
    capabilities: DETERMINISTIC_CAPABILITIES,
  });
  const result = await runtime.request(createLearningCompanionRequestFromTutorRequest(request));
  return result.ok
    ? createTutorResponseFromLearningCompanionResponse(result.response)
    : createDeterministicTutorResponse(request);
}

function identityOf(
  descriptor: ProviderRuntimeDescriptor,
  config: TutorAdapterConfig,
): Omit<TutorAdapterDiagnostics, "source" | "errorCode"> {
  return {
    adapter: config.adapter,
    runtimeId: descriptor.runtimeId,
    providerId: descriptor.providerId,
    model: descriptor.modelId,
  };
}

function readAdapter(env: Record<string, string | undefined>): TutorAdapterKind {
  const value = bounded(env.AGORIX_TUTOR_ADAPTER ?? env.AGORIX_TUTOR_PROVIDER);
  if (value === undefined) {
    return "fake";
  }
  if (value === "fake" || value === OPENAI_COMPATIBLE_PROVIDER_ID) {
    return value;
  }
  throw new TutorAdapterConfigurationError(
    `AGORIX_TUTOR_ADAPTER: expected "fake" or "${OPENAI_COMPATIBLE_PROVIDER_ID}"`,
  );
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function parseCapabilities(value: string | undefined): readonly LearningCompanionCapability[] {
  if (value === undefined) {
    return DEFAULT_CAPABILITIES;
  }
  const capabilities: LearningCompanionCapability[] = [];
  for (const entry of value.split(",")) {
    const candidate = entry.trim();
    if (candidate.length === 0) {
      continue;
    }
    const capability = KNOWN_CAPABILITIES.find((known) => known === candidate);
    if (capability === undefined) {
      throw new TutorAdapterConfigurationError(
        `AGORIX_TUTOR_CAPABILITIES: unknown capability "${candidate}"; expected one of ${KNOWN_CAPABILITIES.join(", ")}`,
      );
    }
    if (!capabilities.includes(capability)) {
      capabilities.push(capability);
    }
  }
  if (capabilities.length === 0) {
    throw new TutorAdapterConfigurationError(
      "AGORIX_TUTOR_CAPABILITIES: expected at least one capability",
    );
  }
  return capabilities;
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = withoutTrailingSlash(bounded(value));
  if (trimmed === undefined) {
    return undefined;
  }
  return trimmed.endsWith(CHAT_COMPLETIONS_SUFFIX)
    ? withoutTrailingSlash(trimmed.slice(0, -CHAT_COMPLETIONS_SUFFIX.length))
    : trimmed;
}

function withoutTrailingSlash(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function bounded(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
