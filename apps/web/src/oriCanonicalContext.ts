import type { RunOutcome } from "@agorix/runtime";

/**
 * Explicit canonical execution outcome. Budget exceeded is NOT success.
 * This function never exposes traces, world state or program contents.
 */
export type OriExecutionOutcome = "not-run" | "completed" | "failed" | "stopped";
export function deriveOriExecutionOutcome(input: {
  readonly hasRun: boolean;
  readonly status: RunOutcome | "unknown";
}): OriExecutionOutcome {
  if (!input.hasRun) return "not-run";
  if (input.status === "completed") return "completed";
  if (input.status === "budget-exceeded") return "failed";
  return "stopped";
}
export function buildOriMinimalContext(input: {
  readonly scriptCount: number;
  readonly hintCount: number;
  readonly hasRun: boolean;
  readonly status: RunOutcome | "unknown";
}) {
  const clamp = (value: number) =>
    Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1000) : 0;
  return Object.freeze({
    scriptCount: clamp(input.scriptCount),
    hintCount: clamp(input.hintCount),
    outcome: deriveOriExecutionOutcome(input),
  });
}
