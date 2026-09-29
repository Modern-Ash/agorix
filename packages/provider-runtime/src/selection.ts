/**
 * Capability-aware provider selection with ordered fallback and a
 * meaningful offline mode (issue #96).
 *
 * Selection is a pure, synchronous function over a precomputed health map so
 * it stays trivially table-testable — checking live health is a separate,
 * async concern (`checkProviderRuntimeHealth`). This mirrors how
 * `negotiateCapability` already keeps capability matching pure and
 * synchronous in `index.ts`.
 */
import type { LearningCompanionCapability } from "@agorix/tutor-contract";
import {
  negotiateCapability,
  ProviderRuntimeContractError,
  type LearningCompanionProviderRuntime,
  type ProviderRuntimeDescriptor,
  type ProviderRuntimeHealth,
  type ProviderRuntimeHealthStatus,
  type ProviderRuntimeLocality,
} from "./index.js";

export type ProviderSelectionAttemptOutcome =
  | "eligible"
  | "capability-unsupported"
  | "health-unavailable"
  | "excluded-remote"
  | "excluded-offline";

export interface ProviderSelectionAttempt {
  readonly runtimeId: string;
  readonly providerId: string;
  readonly locality: ProviderRuntimeLocality;
  readonly outcome: ProviderSelectionAttemptOutcome;
}

export interface ProviderSelectionConfig {
  readonly capability: LearningCompanionCapability;
  /**
   * Fallback order, by `runtimeId`. Runtimes not listed here are never
   * selected — an explicit allowlist, not just a preference.
   */
  readonly preferredOrder: readonly string[];
  /** Default true. Set false to restrict selection to local runtimes only. */
  readonly allowRemote?: boolean;
  /** Forces the offline path regardless of runtime health (e.g. a learner/parent toggle). */
  readonly offline?: boolean;
}

export type ProviderUnavailableReason =
  "offline-mode" | "no-compatible-provider" | "all-unavailable";

export interface ProviderSelectionSelected {
  readonly status: "selected";
  readonly runtime: LearningCompanionProviderRuntime;
  readonly descriptor: ProviderRuntimeDescriptor;
  readonly attempts: readonly ProviderSelectionAttempt[];
}

export interface ProviderSelectionUnavailable {
  readonly status: "unavailable";
  readonly reason: ProviderUnavailableReason;
  readonly attempts: readonly ProviderSelectionAttempt[];
}

export type ProviderSelectionOutcome = ProviderSelectionSelected | ProviderSelectionUnavailable;

/**
 * Selects the first runtime (in `preferredOrder`) that both supports the
 * requested capability and is not known-unavailable in `health`. A runtime
 * missing from `health` is treated as available — callers that never probed
 * health (e.g. a pure fake runtime in tests) are not penalized.
 */
export function selectProviderRuntime(
  runtimes: readonly LearningCompanionProviderRuntime[],
  health: ReadonlyMap<string, ProviderRuntimeHealthStatus>,
  config: ProviderSelectionConfig,
): ProviderSelectionOutcome {
  if (config.preferredOrder.length === 0) {
    throw new ProviderRuntimeContractError("preferredOrder", "expected at least one runtimeId");
  }
  const allowRemote = config.allowRemote ?? true;
  const byId = new Map(runtimes.map((runtime) => [runtime.descriptor.runtimeId, runtime]));
  const attempts: ProviderSelectionAttempt[] = [];

  for (const runtimeId of config.preferredOrder) {
    const runtime = byId.get(runtimeId);
    if (runtime === undefined) {
      continue;
    }
    const descriptor = runtime.descriptor;

    if (config.offline === true) {
      attempts.push(attempt(descriptor, "excluded-offline"));
      continue;
    }
    if (!allowRemote && descriptor.locality === "remote") {
      attempts.push(attempt(descriptor, "excluded-remote"));
      continue;
    }
    const negotiation = negotiateCapability(descriptor, config.capability);
    if (!negotiation.supported) {
      attempts.push(attempt(descriptor, "capability-unsupported"));
      continue;
    }
    const status = health.get(runtimeId) ?? "available";
    if (status === "unavailable") {
      attempts.push(attempt(descriptor, "health-unavailable"));
      continue;
    }
    attempts.push(attempt(descriptor, "eligible"));
    return { status: "selected", runtime, descriptor, attempts };
  }

  if (config.offline === true) {
    return { status: "unavailable", reason: "offline-mode", attempts };
  }
  const anyCapable = attempts.some((entry) => entry.outcome !== "capability-unsupported");
  return {
    status: "unavailable",
    reason: anyCapable ? "all-unavailable" : "no-compatible-provider",
    attempts,
  };
}

function attempt(
  descriptor: ProviderRuntimeDescriptor,
  outcome: ProviderSelectionAttemptOutcome,
): ProviderSelectionAttempt {
  return {
    runtimeId: descriptor.runtimeId,
    providerId: descriptor.providerId,
    locality: descriptor.locality,
    outcome,
  };
}

/**
 * Probes every runtime's `health()` (parallel, best-effort — a throwing
 * health check counts as unavailable rather than failing the whole probe)
 * and returns a map `selectProviderRuntime` can consume.
 */
export async function checkProviderRuntimeHealth(
  runtimes: readonly LearningCompanionProviderRuntime[],
): Promise<ReadonlyMap<string, ProviderRuntimeHealthStatus>> {
  const entries = await Promise.all(
    runtimes.map(async (runtime) => {
      try {
        const health: ProviderRuntimeHealth = await runtime.health();
        return [runtime.descriptor.runtimeId, health.status] as const;
      } catch {
        return [
          runtime.descriptor.runtimeId,
          "unavailable" as ProviderRuntimeHealthStatus,
        ] as const;
      }
    }),
  );
  return new Map(entries);
}

const UNAVAILABLE_MESSAGES: Record<"en" | "es", Record<ProviderUnavailableReason, string>> = {
  en: {
    "offline-mode": "AI help is turned off right now. You can still build and run your program.",
    "no-compatible-provider":
      "AI help isn't available for this yet. You can still build and run your program.",
    "all-unavailable":
      "AI help is unavailable right now. You can still build and run your program.",
  },
  es: {
    "offline-mode":
      "La ayuda de IA está apagada ahora. Igual podés construir y ejecutar tu programa.",
    "no-compatible-provider":
      "La ayuda de IA todavía no está disponible para esto. Igual podés construir y ejecutar tu programa.",
    "all-unavailable":
      "La ayuda de IA no está disponible ahora. Igual podés construir y ejecutar tu programa.",
  },
};

/**
 * Child-facing copy for an unavailable outcome: no provider/runtime jargon,
 * always reassures the deterministic runtime still works (AC: "offline mode
 * ... no fake claim that AI responded").
 */
export function describeProviderUnavailableForLearner(
  reason: ProviderUnavailableReason,
  locale: string | undefined = "en",
): string {
  const normalized = locale.toLowerCase().startsWith("es") ? "es" : "en";
  return UNAVAILABLE_MESSAGES[normalized][reason];
}
