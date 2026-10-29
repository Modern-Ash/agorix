import { createOriMig04RolloutController } from "./oriMig04RolloutController.js";
import {
  createOriMig04RolloutTelemetry,
  type OriMig04Outcome,
} from "./oriMig04RolloutTelemetry.js";
import type { OriMig04Mode } from "./oriMig04RolloutGate.js";

/**
 * Server-owned circuit breaker. Thresholds apply to aggregate observations;
 * no learner identity, prompt or program is stored.
 */
export function createOriMig04CircuitBreaker({
  controller,
  telemetry,
  minimumSamples = 20,
  maxErrorRate = 0.2,
  maxP95Ms = 5000,
}: {
  readonly controller: ReturnType<typeof createOriMig04RolloutController>;
  readonly telemetry: ReturnType<typeof createOriMig04RolloutTelemetry>;
  readonly minimumSamples?: number;
  readonly maxErrorRate?: number;
  readonly maxP95Ms?: number;
}) {
  if (
    !Number.isSafeInteger(minimumSamples) ||
    minimumSamples < 1 ||
    !Number.isFinite(maxErrorRate) ||
    maxErrorRate < 0 ||
    maxErrorRate > 1 ||
    !Number.isFinite(maxP95Ms) ||
    maxP95Ms <= 0
  )
    throw Error("invalid MIG-04 circuit breaker thresholds");
  let tripped = false;
  return Object.freeze({
    observe(mode: OriMig04Mode, outcome: OriMig04Outcome, durationMs: number) {
      telemetry.record(mode, outcome, durationMs);
      const snapshot = telemetry.snapshot();
      const measured =
        snapshot.outcomes.success + snapshot.outcomes.error + snapshot.outcomes.fallback;
      if (tripped || measured < minimumSamples || mode !== "pilot") return;
      const failureRate = (snapshot.outcomes.error + snapshot.outcomes.fallback) / measured;
      if (failureRate > maxErrorRate || (snapshot.p95Ms !== null && snapshot.p95Ms > maxP95Ms)) {
        tripped = true;
        controller.emergencyDisable();
      }
    },
    snapshot() {
      return Object.freeze({ tripped, ...telemetry.snapshot() });
    },
  });
}
