/**
 * Studio Agent decision pipeline (issue #246).
 *
 * signal -> System 0 -> LAYA (injected System-1 provider) -> LearningRequirements
 *        -> injected router (routeLearningRequirements) -> deterministic | local | remote
 *
 * Platform-neutral: no host, transport or provider imports. The router and the
 * LAYA provider are injected; the pipeline never calls a model provider itself.
 * Telemetry is a closed, non-PII data shape (enums and numbers only).
 */
import {
  projectLearningRequirements,
  resolveLearningSystem0,
  type DecisionSource,
  type LearningContextNeed,
  type LearningDecisionSet,
  type LearningDecisionState,
  type LearningRequirements,
  type LearningReasoningTier,
  type SolutionAllowance,
} from "./index.js";
import {
  compactLearningState,
  evaluateLearningSystem1,
  type LearningDecisionQuestionId,
  type LearningSystem1Provider,
} from "./system1.js";
import type { StudioSignal, StudioSignalKind } from "./studio-signals.js";

export const STUDIO_PIPELINE_TELEMETRY_SCHEMA = "agorix/studio-cost-telemetry/v1";
export const STUDIO_DIAGNOSTICS_SCHEMA = "agorix/studio-diagnostics/v1";

export type StudioProviderLocality = "none" | "local" | "remote";
export type StudioRouteStatus = "deterministic" | "selected" | "unavailable";
export type StudioDegradeReason = "budget-tokens" | "budget-requests" | "route-unavailable";

/** Structural subset of `LearningProviderRoute` (provider-runtime); keeps this package provider-free. */
export interface StudioRouteResult {
  readonly status: StudioRouteStatus;
  readonly reason: string;
  readonly providerRequestAllowed: boolean;
  readonly locality?: "local" | "remote";
}

export type StudioRouter = (requirements: LearningRequirements) => StudioRouteResult;

export interface StudioBudget {
  readonly maxTokens?: number;
  readonly maxRequests?: number;
}

export interface StudioPipelineInput {
  readonly signal: StudioSignal;
  readonly state: LearningDecisionState;
  readonly programHash?: string;
  readonly locale?: string;
}

export interface StudioDecisionCost {
  readonly estimatedInputTokens: number;
  readonly estimatedOutputTokens: number;
}

/** Non-PII: enums, booleans and numbers only. */
export interface StudioCostTelemetryEvent {
  readonly schema: typeof STUDIO_PIPELINE_TELEMETRY_SCHEMA;
  readonly signalKind: StudioSignalKind;
  readonly decisionSource: DecisionSource;
  readonly tier: LearningReasoningTier;
  readonly generativeNeeded: boolean;
  readonly cacheHit: boolean;
  readonly estimatedInputTokens: number;
  readonly estimatedOutputTokens: number;
  readonly latencyMs: number;
  readonly providerLocality: StudioProviderLocality;
  readonly degradedReason?: StudioDegradeReason;
}

export interface StudioTelemetrySummary {
  readonly decisions: number;
  readonly bySource: Readonly<Record<DecisionSource, number>>;
  readonly byTier: Readonly<Record<LearningReasoningTier, number>>;
  readonly byLocality: Readonly<Record<StudioProviderLocality, number>>;
  readonly generativeDecisions: number;
  readonly cacheHits: number;
  readonly degraded: number;
  readonly providerRequests: number;
  readonly estimatedInputTokens: number;
  readonly estimatedOutputTokens: number;
  readonly totalLatencyMs: number;
}

export interface StudioDiagnostics {
  readonly schema: typeof STUDIO_DIAGNOSTICS_SCHEMA;
  /** Always true: diagnostics are advisory developer data, never authority. */
  readonly advisory: true;
  readonly route: {
    readonly status: StudioRouteStatus;
    readonly reason: string;
    readonly tier: LearningReasoningTier;
    readonly locality: StudioProviderLocality;
    readonly degradedReason?: StudioDegradeReason;
  };
  readonly decision: {
    readonly source: DecisionSource;
    readonly cacheHit: boolean;
    readonly generativeNeeded: boolean;
  };
  readonly cost: StudioDecisionCost & { readonly latencyMs: number };
  readonly session: StudioTelemetrySummary;
}

export interface StudioPipelineDecision {
  readonly requirements: LearningRequirements;
  readonly route: StudioRouteResult;
  /** True only when the host may call a provider for this decision. */
  readonly providerRequestAllowed: boolean;
  readonly source: DecisionSource;
  readonly cacheHit: boolean;
  readonly cost: StudioDecisionCost;
  readonly degradedReason?: StudioDegradeReason;
  /** Plain learner-facing sentence when the agent degraded to deterministic responses. */
  readonly learnerNotice?: string;
  readonly telemetry: StudioCostTelemetryEvent;
  readonly diagnostics: StudioDiagnostics;
}

export interface StudioPipelineCache {
  get(key: string): StudioCachedDecision | undefined;
  set(key: string, value: StudioCachedDecision): void;
}

export interface StudioCachedDecision {
  readonly requirements: LearningRequirements;
  readonly source: DecisionSource;
}

export interface StudioPipelineOptions {
  /** LAYA System-1 provider (e.g. createLayaLearningProvider(transport)). Omit to disable. */
  readonly system1?: LearningSystem1Provider;
  /** Router, e.g. wrapping routeLearningRequirements. Omit for deterministic-only. */
  readonly route?: StudioRouter;
  readonly budget?: StudioBudget;
  readonly cache?: StudioPipelineCache;
  /** Injected clock in ms (monotonic); default Date.now. */
  readonly now?: () => number;
  readonly onTelemetry?: (event: StudioCostTelemetryEvent) => void;
  readonly estimate?: (requirements: LearningRequirements) => StudioDecisionCost;
}

export interface StudioPipeline {
  decide(input: StudioPipelineInput): Promise<StudioPipelineDecision>;
  /** Decide many signals; identical decision keys share one LAYA call. */
  decideBatch(inputs: readonly StudioPipelineInput[]): Promise<readonly StudioPipelineDecision[]>;
  summary(): StudioTelemetrySummary;
  events(): readonly StudioCostTelemetryEvent[];
  budgetRemaining(): { readonly tokens?: number; readonly requests?: number };
  diagnostics(): StudioDiagnostics | undefined;
}

const INPUT_TOKENS: Readonly<Record<LearningContextNeed, number>> = {
  none: 50,
  program: 400,
  mission: 200,
  runtime: 300,
  history: 300,
  bounded: 600,
};
const OUTPUT_TOKENS: Readonly<Record<SolutionAllowance, number>> = {
  none: 150,
  partial: 400,
  complete: 800,
};
const MAX_EVENTS = 200;
const MAX_CACHE = 256;

export function estimateStudioCost(requirements: LearningRequirements): StudioDecisionCost {
  if (requirements.generativeNeeded === "no" || requirements.reasoningTier === "deterministic") {
    return { estimatedInputTokens: 0, estimatedOutputTokens: 0 };
  }
  return {
    estimatedInputTokens: INPUT_TOKENS[requirements.contextNeed],
    estimatedOutputTokens: OUTPUT_TOKENS[requirements.solutionAllowance],
  };
}

export function createMemoryStudioPipelineCache(maxEntries = MAX_CACHE): StudioPipelineCache {
  const values = new Map<string, StudioCachedDecision>();
  return {
    get: (key) => values.get(key),
    set: (key, value) => {
      if (!values.has(key) && values.size >= maxEntries) {
        const oldest = values.keys().next().value;
        if (oldest !== undefined) values.delete(oldest);
      }
      values.set(key, value);
    },
  };
}

export function studioDecisionKey(input: StudioPipelineInput, providerId = "none"): string {
  return JSON.stringify({
    schema: "agorix/studio-decision-key/v1",
    programHash: input.programHash ?? "none",
    signal: { kind: input.signal.kind, code: input.signal.code ?? null },
    scaffoldLevel: input.state.scaffoldLevel,
    state: compactLearningState(input.state),
    providerId,
  });
}

export function describeStudioDegradeForLearner(
  reason: StudioDegradeReason,
  locale: string | undefined = "en",
): string {
  const es = locale.toLowerCase().startsWith("es");
  if (reason === "route-unavailable") {
    return es
      ? "La ayuda de IA no está disponible ahora. Igual podés construir y ejecutar tu programa."
      : "AI help isn't available right now. You can still build and run your program.";
  }
  return es
    ? "Llegamos al límite de ayuda de IA de esta sesión. Seguimos con ayuda sencilla, y tu programa funciona igual."
    : "We've reached this session's AI help limit, so I'll keep to simple built-in help. Your program works the same.";
}

function emptyCounts<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

export function createStudioPipeline(options: StudioPipelineOptions = {}): StudioPipeline {
  const now = options.now ?? Date.now;
  const cache = options.cache ?? createMemoryStudioPipelineCache();
  const estimate = options.estimate ?? estimateStudioCost;
  const budget = options.budget;
  const inflight = new Map<string, Promise<StudioCachedDecision & { cacheHit: boolean }>>();
  const events: StudioCostTelemetryEvent[] = [];
  let tokensUsed = 0;
  let requestsUsed = 0;
  let lastDiagnostics: StudioDiagnostics | undefined;
  const agg = {
    decisions: 0,
    bySource: emptyCounts(["system0", "system1", "fallback"] as const),
    byTier: emptyCounts(["deterministic", "local", "remote"] as const),
    byLocality: emptyCounts(["none", "local", "remote"] as const),
    generativeDecisions: 0,
    cacheHits: 0,
    degraded: 0,
    providerRequests: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    totalLatencyMs: 0,
  };

  const summary = (): StudioTelemetrySummary => ({
    ...agg,
    bySource: { ...agg.bySource },
    byTier: { ...agg.byTier },
    byLocality: { ...agg.byLocality },
  });

  async function resolve(
    input: StudioPipelineInput,
  ): Promise<StudioCachedDecision & { cacheHit: boolean }> {
    const key = studioDecisionKey(input, options.system1?.id);
    const cached = cache.get(key);
    if (cached !== undefined) return { ...cached, cacheHit: true };
    const pending = inflight.get(key);
    if (pending !== undefined) return pending;
    const work = (async () => {
      const system0 = resolveLearningSystem0(input.state);
      const system0Complete =
        system0.generativeNeeded !== undefined && system0.reasoningTier !== undefined;
      let advisory: LearningDecisionSet = {};
      let source: DecisionSource = "system0";
      let cacheable = true;
      if (!system0Complete) {
        source = "fallback";
        if (options.system1 !== undefined) {
          const unresolved = (
            [
              "generativeNeeded",
              "clarificationNeeded",
              "assistanceLevel",
              "learningCapability",
              "solutionAllowance",
              "runtimeEvidenceNeeded",
              "contextNeed",
              "reasoningTier",
            ] as const satisfies readonly LearningDecisionQuestionId[]
          ).filter((id) => system0[id] === undefined);
          const evaluation = await evaluateLearningSystem1(input.state, options.system1, {
            unresolved,
          });
          advisory = evaluation.decisions;
          if (evaluation.providerAvailable && evaluation.accepted.length > 0) source = "system1";
          if (!evaluation.providerAvailable) cacheable = false;
        }
      }
      const value: StudioCachedDecision = {
        requirements: projectLearningRequirements(input.state, advisory),
        source,
      };
      if (cacheable) cache.set(key, value);
      return { ...value, cacheHit: false };
    })();
    inflight.set(key, work);
    try {
      return await work;
    } finally {
      inflight.delete(key);
    }
  }

  async function decide(input: StudioPipelineInput): Promise<StudioPipelineDecision> {
    const started = now();
    const resolved = await resolve(input);
    let requirements = resolved.requirements;
    const planned = estimate(requirements);
    const generative =
      requirements.generativeNeeded === "yes" && requirements.reasoningTier !== "deterministic";

    let degradedReason: StudioDegradeReason | undefined;
    if (generative && budget !== undefined) {
      const tokens = planned.estimatedInputTokens + planned.estimatedOutputTokens;
      if (budget.maxRequests !== undefined && requestsUsed + 1 > budget.maxRequests) {
        degradedReason = "budget-requests";
      } else if (budget.maxTokens !== undefined && tokensUsed + tokens > budget.maxTokens) {
        degradedReason = "budget-tokens";
      }
    }
    if (degradedReason !== undefined) {
      requirements = {
        ...requirements,
        generativeNeeded: "no",
        reasoningTier: "deterministic",
      };
    }

    let route: StudioRouteResult =
      options.route !== undefined && degradedReason === undefined
        ? options.route(requirements)
        : {
            status: "deterministic",
            reason: degradedReason ?? "deterministic",
            providerRequestAllowed: false,
          };
    if (route.status === "unavailable" && degradedReason === undefined) {
      degradedReason = "route-unavailable";
      route = { ...route, providerRequestAllowed: false };
    }

    const providerRequestAllowed = route.providerRequestAllowed && degradedReason === undefined;
    const cost = providerRequestAllowed
      ? planned
      : { estimatedInputTokens: 0, estimatedOutputTokens: 0 };
    if (providerRequestAllowed) {
      requestsUsed += 1;
      tokensUsed += cost.estimatedInputTokens + cost.estimatedOutputTokens;
    }

    const locality: StudioProviderLocality = providerRequestAllowed
      ? (route.locality ?? (requirements.reasoningTier === "remote" ? "remote" : "local"))
      : "none";
    const latencyMs = Math.max(0, now() - started);
    const telemetry: StudioCostTelemetryEvent = {
      schema: STUDIO_PIPELINE_TELEMETRY_SCHEMA,
      signalKind: input.signal.kind,
      decisionSource: resolved.source,
      tier: requirements.reasoningTier,
      generativeNeeded: requirements.generativeNeeded === "yes",
      cacheHit: resolved.cacheHit,
      estimatedInputTokens: cost.estimatedInputTokens,
      estimatedOutputTokens: cost.estimatedOutputTokens,
      latencyMs,
      providerLocality: locality,
      ...(degradedReason !== undefined ? { degradedReason } : {}),
    };
    record(telemetry, providerRequestAllowed);

    const diagnostics: StudioDiagnostics = {
      schema: STUDIO_DIAGNOSTICS_SCHEMA,
      advisory: true,
      route: {
        status: route.status,
        reason: route.reason,
        tier: requirements.reasoningTier,
        locality,
        ...(degradedReason !== undefined ? { degradedReason } : {}),
      },
      decision: {
        source: resolved.source,
        cacheHit: resolved.cacheHit,
        generativeNeeded: telemetry.generativeNeeded,
      },
      cost: { ...cost, latencyMs },
      session: summary(),
    };
    lastDiagnostics = diagnostics;

    return {
      requirements,
      route,
      providerRequestAllowed,
      source: resolved.source,
      cacheHit: resolved.cacheHit,
      cost,
      ...(degradedReason !== undefined
        ? {
            degradedReason,
            learnerNotice: describeStudioDegradeForLearner(degradedReason, input.locale),
          }
        : {}),
      telemetry,
      diagnostics,
    };
  }

  function record(event: StudioCostTelemetryEvent, providerRequest: boolean): void {
    agg.decisions += 1;
    agg.bySource[event.decisionSource] += 1;
    agg.byTier[event.tier] += 1;
    agg.byLocality[event.providerLocality] += 1;
    if (event.generativeNeeded) agg.generativeDecisions += 1;
    if (event.cacheHit) agg.cacheHits += 1;
    if (event.degradedReason !== undefined) agg.degraded += 1;
    if (providerRequest) agg.providerRequests += 1;
    agg.estimatedInputTokens += event.estimatedInputTokens;
    agg.estimatedOutputTokens += event.estimatedOutputTokens;
    agg.totalLatencyMs += event.latencyMs;
    events.push(event);
    if (events.length > MAX_EVENTS) events.shift();
    options.onTelemetry?.(event);
  }

  return {
    decide,
    decideBatch: (inputs) => Promise.all(inputs.map((input) => decide(input))),
    summary,
    events: () => [...events],
    budgetRemaining: () => ({
      ...(budget?.maxTokens !== undefined
        ? { tokens: Math.max(0, budget.maxTokens - tokensUsed) }
        : {}),
      ...(budget?.maxRequests !== undefined
        ? { requests: Math.max(0, budget.maxRequests - requestsUsed) }
        : {}),
    }),
    diagnostics: () => lastDiagnostics,
  };
}
