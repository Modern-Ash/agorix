/**
 * Only trusted canonical runtime status is mapped into Ori's minimal context.
 * Unknown results fail closed as stopped; raw traces and project contents
 * are never included in the request.
 */
export type OriExecutionOutcome = "not-run" | "completed" | "failed" | "stopped";
export function deriveOriExecutionOutcome(input: {
  readonly hasRun: boolean;
  readonly status: "completed" | "failed" | "stopped" | "unknown";
}): OriExecutionOutcome {
  if (!input.hasRun) return "not-run";
  return input.status === "completed" || input.status === "failed"
    ? input.status : "stopped";
}
export function buildOriMinimalContext(input: {
  readonly scriptCount: number;
  readonly hintCount: number;
  readonly hasRun: boolean;
  readonly status: "completed" | "failed" | "stopped" | "unknown";
}) {
  const clamp=(value:number)=>Number.isSafeInteger(value) && value>=0
    ? Math.min(value,1000) : 0;
  return Object.freeze({
    scriptCount:clamp(input.scriptCount),
    hintCount:clamp(input.hintCount),
    outcome:deriveOriExecutionOutcome(input)
  });
}
