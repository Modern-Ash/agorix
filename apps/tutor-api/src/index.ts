import {
  createDeterministicTutorResponse,
  parseTutorResponse,
  validateTutorRequest,
  type TutorRequest,
  type TutorResponse,
} from "@agorix/tutor-contract";

export const PACKAGE_NAME = "@agorix/tutor-api";

export type TutorProviderKind = "fake" | "openai-compatible";

export interface TutorProviderConfig {
  readonly provider: TutorProviderKind;
  readonly model: string;
  readonly endpoint?: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  readonly includeLearnerQuestion?: boolean;
}

export interface TutorProviderDiagnostics {
  readonly provider: TutorProviderKind;
  readonly model: string;
  readonly source: "provider" | "fallback";
  readonly unavailableReason?: "not-configured" | "timeout" | "provider-error" | "invalid-response";
}

export interface TutorProviderResult {
  readonly response: TutorResponse;
  readonly diagnostics: TutorProviderDiagnostics;
}

export interface TutorProviderRuntime {
  readonly fetch?: typeof fetch;
  readonly setTimeout?: typeof setTimeout;
  readonly clearTimeout?: typeof clearTimeout;
}

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 4_000;

export function describeTutorApi(): string {
  return `tutor-api — server-side provider adapter for ${PACKAGE_NAME}`;
}

export function configFromEnv(env: Record<string, string | undefined>): TutorProviderConfig {
  const provider = env.AGORIX_TUTOR_PROVIDER === "openai-compatible" ? "openai-compatible" : "fake";
  return {
    provider,
    model: env.AGORIX_TUTOR_MODEL ?? "gpt-4o-mini",
    endpoint: env.AGORIX_TUTOR_ENDPOINT ?? DEFAULT_ENDPOINT,
    ...(env.AGORIX_TUTOR_API_KEY === undefined ? {} : { apiKey: env.AGORIX_TUTOR_API_KEY }),
    timeoutMs: parseTimeout(env.AGORIX_TUTOR_TIMEOUT_MS),
    includeLearnerQuestion: env.AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION === "1",
  };
}

export async function requestTutorResponse(
  request: TutorRequest,
  config: TutorProviderConfig,
  runtime: TutorProviderRuntime = {},
): Promise<TutorProviderResult> {
  const validated = validateTutorRequest(request);
  if (config.provider === "fake") {
    return fallback(validated, config, undefined);
  }
  if (config.apiKey === undefined || config.apiKey.trim() === "") {
    return fallback(validated, config, "not-configured");
  }

  try {
    const providerOutput = await callOpenAiCompatibleProvider(validated, config, runtime);
    return {
      response: parseTutorResponse(providerOutput),
      diagnostics: { provider: config.provider, model: config.model, source: "provider" },
    };
  } catch (error) {
    return fallback(validated, config, reasonFor(error));
  }
}

async function callOpenAiCompatibleProvider(
  request: TutorRequest,
  config: TutorProviderConfig,
  runtime: TutorProviderRuntime,
): Promise<unknown> {
  const fetchImpl = runtime.fetch ?? globalThis.fetch;
  if (fetchImpl === undefined) {
    throw new ProviderError("provider-error");
  }

  const controller = new AbortController();
  const setTimer = runtime.setTimeout ?? globalThis.setTimeout;
  const clearTimer = runtime.clearTimeout ?? globalThis.clearTimeout;
  const timeout = setTimer(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(config.endpoint ?? DEFAULT_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a child-safe coding tutor. Return only valid JSON matching agorix/tutor-response/v1.",
          },
          { role: "user", content: JSON.stringify(toMinimalTutorContext(request, config)) },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ProviderError("provider-error");
    }
    const payload = (await response.json()) as OpenAiCompatibleResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new ProviderError("invalid-response");
    }
    return JSON.parse(content) as unknown;
  } catch (error) {
    if (isAbortError(error)) {
      throw new ProviderError("timeout");
    }
    throw error;
  } finally {
    clearTimer(timeout);
  }
}

function toMinimalTutorContext(request: TutorRequest, config: TutorProviderConfig) {
  return {
    schema: request.schema,
    mission: request.mission,
    programSummary: request.program.scripts.map((script) => ({
      trigger: script.trigger.type,
      statementTypes: script.statements.map((statement) => statement.type),
    })),
    runtime: {
      outcome: request.runtime.outcome,
      stepsUsed: request.runtime.stepsUsed,
      finalWorld: request.runtime.finalWorld,
    },
    hintHistory: request.hintHistory,
    reading: request.reading,
    ...(config.includeLearnerQuestion === true && request.learnerQuestion !== undefined
      ? { learnerQuestion: request.learnerQuestion }
      : {}),
  };
}

function fallback(
  request: TutorRequest,
  config: TutorProviderConfig,
  unavailableReason: TutorProviderDiagnostics["unavailableReason"],
): TutorProviderResult {
  return {
    response: createDeterministicTutorResponse(request),
    diagnostics: {
      provider: config.provider,
      model: config.model,
      source: "fallback",
      ...(unavailableReason === undefined ? {} : { unavailableReason }),
    },
  };
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

class ProviderError extends Error {
  readonly reason: NonNullable<TutorProviderDiagnostics["unavailableReason"]>;

  constructor(reason: NonNullable<TutorProviderDiagnostics["unavailableReason"]>) {
    super(reason);
    this.name = "ProviderError";
    this.reason = reason;
  }
}

function reasonFor(error: unknown): NonNullable<TutorProviderDiagnostics["unavailableReason"]> {
  if (error instanceof ProviderError) {
    return error.reason;
  }
  return "invalid-response";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

interface OpenAiCompatibleResponse {
  readonly choices?: readonly [
    {
      readonly message?: {
        readonly content?: string;
      };
    },
  ];
}
