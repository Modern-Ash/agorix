import type { OriMig04Mode } from "./oriMig04RolloutGate.js";

export type OriMig04Outcome = "success" | "error" | "fallback" | "blocked";

/**
 * Aggregate-only rollout observability. No child IDs, prompts, programs,
 * tokens or project IDs are retained in metrics.
 */
export function createOriMig04RolloutTelemetry() {
  const counters: Record<OriMig04Outcome, number> = {
    success: 0,
    error: 0,
    fallback: 0,
    blocked: 0,
  };
  const durations: number[] = [];
  let lastMode: OriMig04Mode = "disabled";
  return Object.freeze({
    record(mode: OriMig04Mode, outcome: OriMig04Outcome, durationMs: number): void {
      if (!["disabled", "shadow", "pilot"].includes(mode) ||
          !["success", "error", "fallback", "blocked"].includes(outcome) ||
          !Number.isFinite(durationMs) || durationMs < 0 || durationMs > 60000)
        return;
      lastMode = mode;
      counters[outcome]++;
      if (durations.length >= 1000) durations.shift();
      durations.push(durationMs);
    },
    snapshot() {
      const sorted = [...durations].sort((a, b) => a - b);
      const percentile = (p: number) => sorted.length
        ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]!
        : null;
      return Object.freeze({
        mode: lastMode,
        attempts: Object.values(counters).reduce((a, b) => a + b, 0),
        outcomes: Object.freeze({ ...counters }),
        p50Ms: percentile(0.5),
        p95Ms: percentile(0.95),
        rolloutAuthorized: false as const,
      });
    },
  });
}
