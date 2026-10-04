// Studio provider client. Platform-neutral: no VS Code API, no provider SDK, no credentials
// in source. It reaches the Learning Companion only through the tutor API / adapter boundary
// (an HTTP endpoint that speaks the provider-neutral Learning Companion contract):
//
//   GET  {endpoint}/health      -> { "status": "available" | "degraded" | "unavailable" }
//   POST {endpoint}/companion   -> body: LearningCompanionRequest, reply: LearningCompanionResponse
//
// Every response is validated (contract + safety, docs/safety/AI_OUTPUT_VALIDATION.md) before
// it is returned, so nothing unvalidated can reach a UI. Failures never throw to callers and
// never affect editing or running.
import {
  checkProviderRuntimeHealth,
  describeProviderUnavailableForLearner,
  negotiateCapability,
  selectProviderRuntime,
  type LearningCompanionProviderRuntime,
  type ProviderRuntimeDescriptor,
  type ProviderRuntimeError,
  type ProviderRuntimeHealth,
  type ProviderRuntimeHealthStatus,
  type ProviderRuntimeLocality,
  type ProviderUnavailableReason,
} from "@agorix/provider-runtime";
import {
  LearningCompanionSafetyValidationError,
  validateLearningCompanionSafety,
  type LearningCompanionCapability,
  type LearningCompanionRequest,
  type LearningCompanionResponse,
} from "@agorix/tutor-contract";

export interface StudioProviderSettings {
  readonly enabled: boolean;
  /** Tutor API / adapter boundary endpoint. Loopback hosts are treated as local. */
  readonly endpoint: string;
  /** Optional second endpoint (typically remote). Used only when allowRemote is true. */
  readonly remoteEndpoint: string;
  /** Local runtimes are tried before remote ones when true. */
  readonly preferLocal: boolean;
  /** Explicit opt-in. Default false: a non-loopback endpoint is never contacted. */
  readonly allowRemote: boolean;
  readonly healthTimeoutMs: number;
  readonly requestTimeoutMs: number;
}

export const DEFAULT_STUDIO_PROVIDER_SETTINGS: StudioProviderSettings = {
  enabled: true,
  endpoint: "",
  remoteEndpoint: "",
  preferLocal: true,
  allowRemote: false,
  healthTimeoutMs: 1_500,
  requestTimeoutMs: 8_000,
};

export type StudioAgentState = "available" | "unavailable" | "disabled";

export interface StudioAgentStatus {
  readonly state: StudioAgentState;
  /** Learner-safe copy. Never contains provider, endpoint or credential details. */
  readonly message: string;
  readonly reason?: ProviderUnavailableReason;
  readonly locality?: ProviderRuntimeLocality;
}

export type StudioProviderOutcome =
  | {
      readonly status: "response";
      readonly response: LearningCompanionResponse;
      readonly locality: ProviderRuntimeLocality;
    }
  | {
      readonly status: "unavailable";
      readonly reason: ProviderUnavailableReason;
      readonly message: string;
    }
  | { readonly status: "rejected"; readonly message: string };

export type StudioFetch = (input: string, init: StudioFetchInit) => Promise<StudioFetchResponse>;

export interface StudioFetchInit {
  readonly method: "GET" | "POST";
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly signal: AbortSignal;
}

export interface StudioFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

export interface StudioProviderClientOptions {
  readonly settings: StudioProviderSettings;
  readonly fetch: StudioFetch;
  /**
   * Resolves a deployment credential at call time (VS Code SecretStorage in the extension).
   * The value is only ever placed in the Authorization header, never stored or logged.
   */
  readonly getCredential?: () => PromiseLike<string | undefined> | string | undefined;
  readonly locale?: string;
}

export interface StudioProviderClient {
  probe(): Promise<StudioAgentStatus>;
  request(request: LearningCompanionRequest): Promise<StudioProviderOutcome>;
}

const ALL_CAPABILITIES: readonly LearningCompanionCapability[] = [
  "coach",
  "builder",
  "debugger",
  "explainer",
  "challenger",
  "reflector",
];
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const MAX_RESPONSE_CHARS = 262_144;

export function normalizeStudioProviderSettings(
  raw: Partial<Record<keyof StudioProviderSettings, unknown>> = {},
): StudioProviderSettings {
  const d = DEFAULT_STUDIO_PROVIDER_SETTINGS;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : d.enabled,
    endpoint: normalizeEndpoint(raw.endpoint),
    remoteEndpoint: normalizeEndpoint(raw.remoteEndpoint),
    preferLocal: typeof raw.preferLocal === "boolean" ? raw.preferLocal : d.preferLocal,
    allowRemote: raw.allowRemote === true,
    healthTimeoutMs: positiveInt(raw.healthTimeoutMs, d.healthTimeoutMs),
    requestTimeoutMs: positiveInt(raw.requestTimeoutMs, d.requestTimeoutMs),
  };
}

export function classifyEndpointLocality(endpoint: string): ProviderRuntimeLocality | undefined {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return LOOPBACK_HOSTS.has(url.hostname) ? "local" : "remote";
  } catch {
    return undefined;
  }
}

export function createBoundaryRuntime(options: {
  readonly runtimeId: string;
  readonly endpoint: string;
  readonly locality: ProviderRuntimeLocality;
  readonly settings: StudioProviderSettings;
  readonly fetch: StudioFetch;
  readonly getCredential?: StudioProviderClientOptions["getCredential"];
}): LearningCompanionProviderRuntime {
  const descriptor: ProviderRuntimeDescriptor = {
    runtimeId: options.runtimeId,
    providerId: "tutor-api",
    modelId: "boundary",
    locality: options.locality,
    features: { structuredJson: true, toolCalling: false, streaming: false },
    contextLimits: {},
    capabilities: ALL_CAPABILITIES.map((capability) => ({
      capability,
      structuredOutput: true,
      streaming: false,
      toolCalling: false,
    })),
  };
  const diagnosticsFor = (capability: LearningCompanionCapability) => ({
    runtimeId: descriptor.runtimeId,
    providerId: descriptor.providerId,
    modelId: descriptor.modelId,
    locality: descriptor.locality,
    capability,
  });
  const fail = (
    capability: LearningCompanionCapability,
    code: ProviderRuntimeError["code"],
    message: string,
    retryable: boolean,
  ) => ({
    ok: false as const,
    error: { code, message, retryable, capability },
    diagnostics: diagnosticsFor(capability),
  });

  async function call(
    method: "GET" | "POST",
    path: string,
    timeoutMs: number,
    body?: string,
  ): Promise<StudioFetchResponse> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const credential = await options.getCredential?.();
    // A credential is never sent over cleartext to a non-loopback host.
    if (credential !== undefined && credential.length > 0 && canSendCredential(options.endpoint)) {
      headers.Authorization = `Bearer ${credential}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await options.fetch(`${options.endpoint}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    descriptor,
    async health(): Promise<ProviderRuntimeHealth> {
      const checkedAt = new Date().toISOString();
      try {
        const response = await call("GET", "/health", options.settings.healthTimeoutMs);
        if (!response.ok) {
          return { status: "unavailable", checkedAt };
        }
        const parsed: unknown = JSON.parse(await response.text());
        const status = (parsed as { status?: unknown } | null)?.status;
        return {
          status: isHealthStatus(status) ? status : "unavailable",
          checkedAt,
        };
      } catch {
        return { status: "unavailable", checkedAt };
      }
    },
    negotiate(capability) {
      return negotiateCapability(descriptor, capability);
    },
    async request(request) {
      const capability = request.capability;
      try {
        const response = await call(
          "POST",
          "/companion",
          options.settings.requestTimeoutMs,
          JSON.stringify(request),
        );
        if (response.status === 401 || response.status === 403) {
          return fail(capability, "authentication-failed", "Boundary rejected credentials.", false);
        }
        if (!response.ok) {
          return fail(capability, "provider-error", "Boundary returned an error.", true);
        }
        const text = await response.text();
        if (text.length > MAX_RESPONSE_CHARS) {
          return fail(capability, "invalid-response", "Boundary response too large.", false);
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return fail(capability, "invalid-response", "Boundary response is not JSON.", false);
        }
        // Contract + safety validation. Safety errors are rethrown for the client to map.
        let validated: LearningCompanionResponse;
        try {
          validated = validateLearningCompanionSafety(request, parsed as LearningCompanionResponse);
        } catch (error) {
          if (error instanceof LearningCompanionSafetyValidationError) {
            throw error;
          }
          return fail(
            capability,
            "invalid-response",
            "Boundary response failed validation.",
            false,
          );
        }
        return { ok: true as const, response: validated, diagnostics: diagnosticsFor(capability) };
      } catch (error) {
        if (error instanceof LearningCompanionSafetyValidationError) {
          throw error;
        }
        if (error instanceof Error && error.name === "AbortError") {
          return fail(capability, "timeout", "Boundary request timed out.", true);
        }
        return fail(capability, "provider-unavailable", "Boundary is unreachable.", true);
      }
    },
  };
}

export function createStudioProviderClient(
  options: StudioProviderClientOptions,
): StudioProviderClient {
  const { settings } = options;
  const locale = options.locale ?? "en";

  const runtimes = (): readonly LearningCompanionProviderRuntime[] => {
    const seen = new Set<string>();
    const result: LearningCompanionProviderRuntime[] = [];
    [settings.endpoint, settings.remoteEndpoint].forEach((endpoint, index) => {
      const locality = endpoint === "" ? undefined : classifyEndpointLocality(endpoint);
      if (locality === undefined || seen.has(endpoint)) {
        return;
      }
      seen.add(endpoint);
      result.push(
        createBoundaryRuntime({
          runtimeId: `studio-boundary:${index}`,
          endpoint,
          locality,
          settings,
          fetch: options.fetch,
          ...(options.getCredential === undefined ? {} : { getCredential: options.getCredential }),
        }),
      );
    });
    return result;
  };

  const preferredOrder = (all: readonly LearningCompanionProviderRuntime[]): string[] =>
    [...all]
      .sort((a, b) => {
        const rank = (r: LearningCompanionProviderRuntime) =>
          (r.descriptor.locality === "local") === settings.preferLocal ? 0 : 1;
        return rank(a) - rank(b);
      })
      .map((r) => r.descriptor.runtimeId);

  const unavailable = (reason: ProviderUnavailableReason) => ({
    reason,
    message: describeProviderUnavailableForLearner(reason, locale),
  });

  async function select(capability: LearningCompanionCapability) {
    if (!settings.enabled) {
      return { kind: "off" as const, ...unavailable("offline-mode") };
    }
    const all = runtimes();
    if (all.length === 0) {
      return { kind: "off" as const, ...unavailable("no-compatible-provider") };
    }
    if (!settings.allowRemote && all.every((r) => r.descriptor.locality === "remote")) {
      // Remote endpoints without explicit opt-in are policy-disabled, never contacted.
      return { kind: "off" as const, ...unavailable("offline-mode") };
    }
    const health: ReadonlyMap<string, ProviderRuntimeHealthStatus> =
      await checkProviderRuntimeHealth(
        settings.allowRemote ? all : all.filter((r) => r.descriptor.locality === "local"),
      );
    const outcome = selectProviderRuntime(all, health, {
      capability,
      preferredOrder: preferredOrder(all),
      allowRemote: settings.allowRemote,
    });
    return outcome.status === "selected"
      ? { kind: "selected" as const, runtime: outcome.runtime }
      : { kind: "unavailable" as const, ...unavailable(outcome.reason) };
  }

  return {
    async probe() {
      const selection = await select("coach");
      if (selection.kind === "selected") {
        return {
          state: "available",
          message: "AI help is ready.",
          locality: selection.runtime.descriptor.locality,
        };
      }
      return {
        state: selection.kind === "off" ? "disabled" : "unavailable",
        message: selection.message,
        reason: selection.reason,
      };
    },
    async request(request) {
      try {
        const selection = await select(request.capability);
        if (selection.kind !== "selected") {
          return { status: "unavailable", reason: selection.reason, message: selection.message };
        }
        const result = await selection.runtime.request(request, {
          timeoutMs: settings.requestTimeoutMs,
        });
        if (result.ok) {
          return {
            status: "response",
            response: result.response,
            locality: selection.runtime.descriptor.locality,
          };
        }
        return { status: "unavailable", ...unavailable("all-unavailable") };
      } catch (error) {
        if (error instanceof LearningCompanionSafetyValidationError) {
          return { status: "rejected", message: error.childMessage };
        }
        return { status: "unavailable", ...unavailable("all-unavailable") };
      }
    },
  };
}

function normalizeEndpoint(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim().replace(/\/+$/, "");
  return classifyEndpointLocality(trimmed) === undefined ? "" : trimmed;
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 120_000
    ? value
    : fallback;
}

function isHealthStatus(value: unknown): value is ProviderRuntimeHealthStatus {
  return value === "available" || value === "degraded" || value === "unavailable";
}

function canSendCredential(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" || LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
