/**
 * Aggregated, in-memory counters for the experimental Ori shadow transport.
 * No raw learner messages, programs, IP addresses or model outputs.
 */
export type OriShadowOutcome =
  | "valid"
  | "invalid-contract"
  | "oversized"
  | "http-error"
  | "timeout"
  | "network-error";
const OUTCOMES: readonly OriShadowOutcome[] = [
  "valid", "invalid-contract", "oversized", "http-error", "timeout", "network-error",
];
export interface OriShadowMetrics {
  readonly record: (outcome: OriShadowOutcome) => void;
  readonly snapshot: () => Readonly<Record<OriShadowOutcome, number>>;
}
export function createOriShadowMetrics(): OriShadowMetrics {
  const counts = Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0])) as Record<
    OriShadowOutcome, number
  >;
  return Object.freeze({
    record(outcome: OriShadowOutcome): void {
      if (!Object.prototype.hasOwnProperty.call(counts, outcome)) return;
      counts[outcome]++;
    },
    snapshot(): Readonly<Record<OriShadowOutcome, number>> {
      return Object.freeze({ ...counts });
    },
  });
}
